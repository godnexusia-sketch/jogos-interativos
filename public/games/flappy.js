'use strict';

// Flappy: você joga (espaço, clique ou toque) e o público sabota com presentes.
// Quem comenta "pula" ajuda a bater as asas.
const SABOTAGE = {
  1: { key: 'wind', name: 'AR TURBULENTO', color: '#25f4ee', secs: 4 },
  2: { key: 'giant', name: 'OBSTÁCULOS GIGANTES', color: '#ff8a3d', secs: 0 },
  3: { key: 'dark', name: 'VISÃO PREJUDICADA', color: '#b36bff', secs: 6 },
  4: { key: 'chaos', name: 'CAOS GALÁCTICO', color: '#ff6bd6', secs: 8 },
};

registerGame({
  id: 'flappy',
  name: 'Flappy',
  icon: '🐤',
  help: '<p><b>Você joga</b>: espaço, clique ou toque na tela. Quem comenta <b>pula</b> também faz o passarinho voar.</p><p>Os presentes sabotam: 🌹 ar turbulento · 🍩 canos gigantes · 🕶️ visão escura · 🌌 caos galáctico.</p>',
  best: 0,
  saboteurs: new Map(),
  helpCd: new Cooldown(250),
  reset() {
    this.y = H / 2; this.vy = 0; this.pipes = []; this.spawn = 1; this.score = 0;
    this.dead = 0; this.started = false; this.lastHelper = '';
    this.effects = { wind: 0, dark: 0, chaos: 0 };
    this.giantNext = 0;
    this.lastSaboteur = null;
    this.meteors = [];
    this.stars = Array.from({ length: 80 }, () => ({ x: rand(0, W), y: rand(0, H), s: rand(1, 3) }));
  },
  sample: () => (Math.random() < 0.8 ? 'pula' : 'kkkk'),
  flap(nick) {
    if (this.dead > 0) return;
    this.started = true;
    this.vy = -540;
    if (nick) this.lastHelper = nick;
    sfx.tone(700, 0.05, 'sine', 0.06);
  },
  onPress() { if (this.dead <= 0) this.flap(); },
  onEvent(ev) {
    if (ev.type === 'chat' && /pula|pulo|jump|sobe/i.test(ev.text) && this.helpCd.ok('all')) this.flap(ev.user.nick);
    else if (ev.type === 'gift') {
      const s = SABOTAGE[giftTier(ev)];
      addScore(this.saboteurs, ev.user.nick, coins(ev));
      this.lastSaboteur = { user: ev.user, s, t: 3 };
      if (s.key === 'giant') this.giantNext = Math.min(6, this.giantNext + 3);
      else this.effects[s.key] = Math.min(s.secs * 3, this.effects[s.key] + s.secs);
      if (s.key === 'chaos') { this.effects.wind = Math.max(this.effects.wind, 4); sfx.boom(); }
      else sfx.tone(220, 0.25, 'sawtooth', 0.08);
    }
  },
  update(dt) {
    if (this.lastSaboteur && (this.lastSaboteur.t -= dt) <= 0) this.lastSaboteur = null;
    for (const k in this.effects) this.effects[k] = Math.max(0, this.effects[k] - dt);
    if (this.dead > 0) { this.dead -= dt; if (this.dead <= 0) this.reset(); return; }
    if (!this.started) { this.y = H / 2 + Math.sin(performance.now() / 300) * 20; return; }
    const slow = this.effects.chaos > 0 ? 0.6 : 1;
    dt *= slow;
    this.vy += 1500 * dt;
    if (this.effects.wind > 0) this.vy += rand(-1, 1) * 2600 * dt;
    this.y += this.vy * dt;
    this.spawn -= dt;
    if (this.spawn <= 0) {
      this.spawn = 2.2;
      const giant = this.giantNext > 0;
      if (giant) this.giantNext--;
      const gap = giant ? 250 : 360;
      this.pipes.push({ x: W + 60, gap: rand(250, H - 300 - gap), h: gap, w: giant ? 200 : 120, passed: false, giant });
    }
    const speed = 250 + Math.min(150, this.score * 6);
    for (const p of this.pipes) p.x -= speed * dt;
    this.pipes = this.pipes.filter((p) => p.x > -260);
    if (this.effects.chaos > 0 && Math.random() < dt * 1.5) this.meteors.push({ x: rand(200, W + 200), y: -40, vx: -260, vy: 420 });
    for (const m of this.meteors) { m.x += m.vx * dt; m.y += m.vy * dt; }
    this.meteors = this.meteors.filter((m) => m.y < H + 50);
    const bx = 200, r = 30;
    for (const p of this.pipes) {
      if (!p.passed && p.x + p.w < bx) { p.passed = true; this.score++; this.best = Math.max(this.best, this.score); sfx.tone(1200, 0.06, 'sine', 0.06); }
      const inX = bx + r > p.x && bx - r < p.x + p.w;
      if (inX && (this.y - r < p.gap || this.y + r > p.gap + p.h)) this.die();
    }
    for (const m of this.meteors) if (Math.hypot(m.x - bx, m.y - this.y) < r + 26) this.die();
    if (this.y < r) { this.y = r; this.vy = 0; }
    if (this.y > H - 90 - r) this.die();
  },
  die() {
    if (this.dead > 0) return;
    this.dead = 3;
    sfx.boom();
    burst(200, this.y, ['#ffd23f', '#ff8a3d', '#fff'], 50, 450);
  },
  // ---------- Cena 3D ----------
  // A lógica usa pixels da tela (720×1280). Aqui 40 px = 1 unidade 3D e a câmera enquadra exatamente a tela.
  wx(x) { return (x - W / 2) / 40; },
  wy(y) { return (H - y) / 40; },
  init3d() {
    if (this.r || !THREE) return;
    const T = THREE;
    const scene = new T.Scene();
    const skyDay = G3.skyTex('#38bdf8', '#7dd3fc', '#e0f2fe'), skyNight = G3.skyTex('#05010f', '#1b0436', '#3b0a5e');
    scene.background = skyDay;
    const camera = new T.PerspectiveCamera(2 * Math.atan(16 / 40) * 180 / Math.PI, W / H, 0.5, 400);
    camera.position.set(0, 16, 40); camera.lookAt(0, 16, 0);
    const sun = G3.lights(scene, { hemi: 1.1, sun: 2.2, pos: [-20, 40, 30] });
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 34, bottom: -2 });
    // Fundo em camadas: morros, prédios e nuvens (andam em velocidades diferentes)
    const layers = [];
    const hills = new T.Group();
    for (let i = 0; i < 14; i++) { const h = new T.Mesh(new T.SphereGeometry(rand(5, 8), 16, 10), new T.MeshLambertMaterial({ color: i % 2 ? 0x4ade80 : 0x22c55e })); h.position.set(-40 + i * 7, -1, -30); h.scale.y = 0.45; hills.add(h); }
    scene.add(hills); layers.push({ g: hills, speed: 0.15, span: 98 });
    const city = new T.Group();
    for (let i = 0; i < 20; i++) { const h = rand(6, 16); const b = new T.Mesh(new T.BoxGeometry(rand(3, 5), h, 3), new T.MeshLambertMaterial({ color: [0x93c5fd, 0xbfdbfe, 0xa5b4fc][i % 3] })); b.position.set(-50 + i * 5.2, h / 2 + 2, -55); city.add(b); }
    scene.add(city); layers.push({ g: city, speed: 0.07, span: 104 });
    const cloudTex = G3.tex(256, 128, (g) => { g.fillStyle = 'rgba(255,255,255,.95)'; for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse(40 + i * 24, 70 + Math.sin(i) * 12, 32, 26, 0, 0, 7); g.fill(); } });
    const clouds = new T.Group();
    for (let i = 0; i < 9; i++) { const c = new T.Sprite(new T.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false })); c.position.set(-40 + i * 10, rand(20, 32), -20); c.scale.set(rand(9, 14), rand(4, 6), 1); clouds.add(c); }
    scene.add(clouds); layers.push({ g: clouds, speed: 0.3, span: 90 });
    const stars = new T.Points(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(Array.from({ length: 900 }, (_, i) => (i % 3 === 2 ? -60 : (i % 3 === 0 ? rand(-60, 60) : rand(0, 50)))), 3)), new T.PointsMaterial({ color: 0xffffff, size: 0.4 }));
    stars.visible = false; scene.add(stars);
    // Chão gramado
    const grassTex = G3.tex(64, 64, (g) => { g.fillStyle = '#65a30d'; g.fillRect(0, 0, 64, 20); g.fillStyle = '#8d6e63'; g.fillRect(0, 20, 64, 44); g.fillStyle = '#7c5c4f'; for (let i = 0; i < 6; i++) g.fillRect(i * 11, 30 + (i % 2) * 12, 6, 6); }, [12, 1]);
    const ground = new T.Mesh(new T.BoxGeometry(80, 2.25, 6), new T.MeshLambertMaterial({ map: grassTex }));
    ground.position.set(0, 1.12, 0); ground.receiveShadow = true; scene.add(ground);
    // Passarinho 3D
    const bird = new T.Group();
    const yellow = new T.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });
    const body = new T.Mesh(new T.SphereGeometry(0.75, 24, 18), yellow); body.scale.set(1.15, 1, 1); body.castShadow = true; bird.add(body);
    const belly = new T.Mesh(new T.SphereGeometry(0.55, 18, 14), new T.MeshStandardMaterial({ color: 0xfef3c7 })); belly.position.set(0.25, -0.25, 0.35); bird.add(belly);
    const beak = new T.Mesh(new T.ConeGeometry(0.22, 0.6, 12), new T.MeshStandardMaterial({ color: 0xf97316 })); beak.rotation.z = -Math.PI / 2; beak.position.set(0.95, -0.05, 0); bird.add(beak);
    for (const z of [-0.45, 0.45]) { const e = new T.Mesh(new T.SphereGeometry(0.2, 12, 10), new T.MeshBasicMaterial({ color: 0xffffff })); e.position.set(0.5, 0.3, z); bird.add(e); const p = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), new T.MeshBasicMaterial({ color: 0x111111 })); p.position.set(0.62, 0.3, z * 1.08); bird.add(p); }
    const wings = [-1, 1].map((s) => { const w = new T.Mesh(new T.SphereGeometry(0.45, 14, 10), yellow); w.scale.set(1.1, 0.3, 0.8); w.position.set(-0.15, 0.05, s * 0.75); bird.add(w); return w; });
    const shades = new T.Mesh(new T.BoxGeometry(0.15, 0.25, 1.1), new T.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 })); shades.position.set(0.68, 0.3, 0); shades.visible = false; bird.add(shades);
    bird.scale.setScalar(1.35);
    scene.add(bird);
    // Canos (reaproveitados)
    const pipeMat = new T.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.35, metalness: 0.1 }), lipMat = new T.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.3 });
    const giantMat = new T.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 }), giantLip = new T.MeshStandardMaterial({ color: 0xfb923c });
    const pipeObjs = [];
    const meteorObjs = [];
    this.r = { scene, camera, sun, layers, stars, skyDay, skyNight, bird, wings, shades, pipeMat, lipMat, giantMat, giantLip, pipeObjs, meteorObjs, ground };
  },
  pipeObj(i) {
    const T = THREE, r = this.r;
    if (!r.pipeObjs[i]) {
      const g = new T.Group();
      const mk = (m) => { const o = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 24), m); o.castShadow = true; g.add(o); return o; };
      const o = { g, top: mk(r.pipeMat), bot: mk(r.pipeMat), lipT: mk(r.lipMat), lipB: mk(r.lipMat) };
      r.scene.add(g); r.pipeObjs[i] = o;
    }
    return r.pipeObjs[i];
  },
  draw() {
    if (!this.r) {
      this.init3d();
      background('#38bdf8', '#e0f2fe');
      title('FLAPPY', W / 2, H / 2 - 20, 80, '#fff');
      text('Preparando o voo…', W / 2, H / 2 + 40, 26, '#0c4a6e', 'center', 700);
      three3dReady.then(() => this.init3d());
      return;
    }
    const r = this.r, t = performance.now() / 1000;
    const chaos = this.effects.chaos > 0;
    r.scene.background = chaos ? r.skyNight : r.skyDay;
    r.stars.visible = chaos;
    for (const L of r.layers) { L.g.visible = !chaos || L.speed !== 0.3; for (const c of L.g.children) { if (this.started && this.dead <= 0) c.position.x -= L.speed * (chaos ? 0.5 : 1); if (c.position.x < -L.span / 2 - 6) c.position.x += L.span; } }
    // Passarinho
    const by = this.wy(this.y);
    r.bird.position.set(this.wx(200), by, 0);
    r.bird.rotation.z = -clamp(this.vy / 900, -0.5, 0.9);
    if (this.effects.wind > 0) { r.bird.position.x += (Math.random() - 0.5) * 0.15; r.bird.position.y += (Math.random() - 0.5) * 0.15; }
    const flap = Math.sin(t * (this.vy < 0 ? 30 : 12));
    r.wings.forEach((w, i) => { w.rotation.x = (i ? 1 : -1) * flap * 0.7; });
    r.shades.visible = this.effects.dark > 0;
    r.bird.visible = this.dead <= 0 || Math.floor(t * 8) % 2 === 0;
    // Canos
    this.pipes.forEach((p, i) => {
      const o = this.pipeObj(i);
      o.g.visible = true;
      const cx = this.wx(p.x + p.w / 2), rad = p.w / 80;
      const mat = p.giant ? this.r.giantMat : this.r.pipeMat, lip = p.giant ? this.r.giantLip : this.r.lipMat;
      const topY0 = this.wy(p.gap), botY0 = this.wy(p.gap + p.h);
      const topH = 34 - topY0, botH = botY0;
      o.top.material = mat; o.bot.material = mat; o.lipT.material = lip; o.lipB.material = lip;
      o.top.scale.set(rad, topH, rad); o.top.position.set(cx, topY0 + topH / 2, 0);
      o.bot.scale.set(rad, botH, rad); o.bot.position.set(cx, botH / 2, 0);
      o.lipT.scale.set(rad * 1.18, 1, rad * 1.18); o.lipT.position.set(cx, topY0 + 0.5, 0);
      o.lipB.scale.set(rad * 1.18, 1, rad * 1.18); o.lipB.position.set(cx, botY0 - 0.5, 0);
    });
    for (let i = this.pipes.length; i < r.pipeObjs.length; i++) r.pipeObjs[i].g.visible = false;
    // Meteoros do caos galáctico
    this.meteors.forEach((m, i) => {
      if (!r.meteorObjs[i]) { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.65, 0), new THREE.MeshStandardMaterial({ color: 0x57534e, flatShading: true }))); const fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: G3.glowTex(), color: 0xff7a18, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); fire.scale.set(3, 3, 1); g.add(fire); r.scene.add(g); r.meteorObjs[i] = g; }
      const g = r.meteorObjs[i]; g.visible = true; g.position.set(this.wx(m.x), this.wy(m.y), 0); g.rotation.x += 0.1; g.rotation.y += 0.07;
    });
    for (let i = this.meteors.length; i < r.meteorObjs.length; i++) r.meteorObjs[i].visible = false;
    r.camera.position.x = Math.sin(t * 0.4) * 0.6; r.camera.lookAt(0, 16, 0);
    G3.render(r.scene, r.camera);
    this.drawHud(chaos);
  },
  drawHud(chaos) {
    if (this.effects.dark > 0) {
      // Só se enxerga dentro de dois "óculos" em volta do passarinho.
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.94)';
      ctx.beginPath(); ctx.rect(0, 0, W, H);
      ctx.moveTo(290, this.y); ctx.arc(170, this.y, 120, 0, Math.PI * 2);
      ctx.moveTo(540, this.y); ctx.arc(420, this.y, 120, 0, Math.PI * 2);
      ctx.fill('evenodd');
      ctx.restore();
    }
    if (this.effects.wind > 0 && !chaos) for (let k = 0; k < 5; k++) text('🌹', (performance.now() / 3 + k * 170) % (W + 100) - 50, 300 + k * 160, 34);
    num(String(this.score), W / 2, 150, 120, '#fff');
    label(`Recorde: ${this.best}`, W / 2, 226, 22, 'rgba(255,255,255,.9)', 'center', 800);
    const active = Object.entries(this.effects).filter(([, v]) => v > 0).map(([k, v]) => `${Object.values(SABOTAGE).find((s) => s.key === k).name} ${v.toFixed(0)}s`);
    if (this.giantNext) active.push(`CANOS GIGANTES ×${this.giantNext}`);
    active.forEach((a, i) => { slant(W / 2 - 170, 262 + i * 46, 340, 38, { fill: 'rgba(190,18,60,.88)', skew: 10 }); title(a, W / 2, 281 + i * 46, 22, '#fff'); });
    if (this.lastSaboteur && this.dead <= 0) {
      const l = this.lastSaboteur;
      const sz = l.s.key === 'chaos' ? 1.4 : 1;
      ctx.save(); ctx.globalAlpha = clamp(l.t, 0, 1);
      slant(30, 470, W - 60, 150 * sz, { fill: 'rgba(10,8,20,.85)', skew: 16, border: l.s.color });
      avatar(l.user, 110, 470 + 75 * sz, 48 * sz, l.s.color);
      title(`@${trim(l.user.nick, 12).toUpperCase()}`, 180 + (sz - 1) * 60, 515 + (sz - 1) * 30, 40 * sz, l.s.color, 'left');
      label(`SABOTOU: ${l.s.name}`, 180 + (sz - 1) * 60, 566 + (sz - 1) * 46, 22 * sz, '#fff', 'left', 800);
      ctx.restore();
    }
    if (!this.started && this.dead <= 0) {
      slant(50, 760, W - 100, 170, { fill: 'rgba(10,8,20,.8)', skew: 16, border: 'rgba(255,255,255,.3)' });
      title('ESPAÇO OU TOQUE PARA VOAR', W / 2, 800, 34, '#fff');
      label('Chat: comente "pula" para ajudar', W / 2, 846, 20, '#fff', 'center', 700);
      title('PRESENTES ATRAPALHAM', W / 2, 892, 30, '#fb7185');
    }
    if (this.lastHelper && this.started) label(`último pulo do chat: @${trim(this.lastHelper, 14)}`, W / 2, H - 130, 18, '#fff', 'center', 800);
    if (this.dead > 0) {
      slant(60, H / 2 - 170, W - 120, 340, { fill: 'rgba(10,8,20,.88)', skew: 16, border: '#fb7185' });
      title('BATEU!', W / 2, H / 2 - 100, 80, '#fb7185');
      label(`${this.score} pontos`, W / 2, H / 2 - 30, 30, '#fff', 'center', 800);
      leaderboard(this.saboteurs, 'Maiores sabotadores', W / 2, H / 2 + 30, 2, 24);
    }
  },
});
