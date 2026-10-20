'use strict';

// Passarela 3D: quem comenta entra na fila e desfila. Com nick do Roblox, desfila com o avatar real;
// sem nick, com um boneco de blocos estilo Roblox e a foto no rosto. Presente fura a fila e muda o desfile.
const WALK_SECS = 9;
const RUNWAY_BACK = -26, RUNWAY_FRONT = 4;

registerGame({
  id: 'desfile',
  name: 'Passarela',
  icon: '💃',
  help: '<p>Comente qualquer coisa para entrar na <b>fila do desfile</b>. Se comentar o seu <b>nick do Roblox</b>, desfila com o seu avatar.</p><p>Durante o seu desfile, comentários e ❤️ likes viram aplausos.</p><p>🌹 Fura a fila (2× maior) · 🍩 Desfile dançando (3×) · 🕶️ Salão piscando (6×) · 🌌 O GIGANTE (12×).</p>',
  claps: new Map(),
  reset() {
    for (const m of [...(this.walking || []), ...(this.seats || [])]) this.r?.scene.remove(m.obj);
    this.queue = [];
    this.walking = [];
    this.seats = [];
    this.party = 0;
    this.giant = 0;
    this.gap = 0;
    this.recent = new Map();
    this.flashT = 0;
  },
  sample: () => pick(['eu', 'builderman', 'linda', 'arrasou', 'Roblox', 'diva']),
  inLine(id) { return this.queue.find((q) => q.id === id) || this.walking.find((w) => w.id === id); },
  enqueue(ev, tier = 0) {
    const id = uid(ev);
    let m = this.inLine(id);
    if (!m) {
      if (!tier && (this.recent.get(id) || 0) > performance.now()) return null;
      m = { id, user: ev.user, rbx: null, tier: 0, claps: 0 };
      this.queue.push(m);
      const txt = (ev.text || '').trim().replace(/^!nick\s+/i, '').replace(/^@/, '');
      if (looksLikeNick(txt)) robloxLookup(txt).then((r) => { if (r) { m.rbx = r; m.thumb = G3.ready ? null : null; } });
    }
    if (tier > m.tier) m.tier = tier;
    if (tier >= 1 && this.queue.includes(m)) {
      this.queue.splice(this.queue.indexOf(m), 1);
      const pos = this.queue.findIndex((q) => !q.tier);
      this.queue.splice(pos < 0 ? this.queue.length : pos, 0, m);
    }
    return m;
  },
  current() { return this.walking.find((m) => m.t < WALK_SECS * 0.75) || this.walking[0]; },
  onEvent(ev) {
    const id = uid(ev);
    const w = this.walking.find((x) => x.id !== id && x.t < WALK_SECS);
    if (ev.type === 'chat') {
      if (w && /👏|linda|lindo|arras|diva|uau|top|maravil/i.test(ev.text)) w.claps++;
      this.enqueue(ev);
    } else if (ev.type === 'like') {
      if (w) w.claps += ev.count;
    } else if (ev.type === 'gift') {
      const tier = giftTier(ev);
      this.enqueue(ev, tier);
      announcer.show(`@${trim(ev.user.nick, 12)} ${['', 'furou a fila', 'vai desfilar dançando', 'acendeu o salão', 'é O GIGANTE'][tier]}`, ['#fff', '#ffc93c', '#ff2e63', '#00e5ff', '#a3e635'][tier], 2.2, 40);
    }
  },
  update(dt) {
    this.party = Math.max(0, this.party - dt);
    this.giant = Math.max(0, this.giant - dt);
    this.flashT = Math.max(0, this.flashT - dt);
    this.gap -= dt;
    // Fila indiana: o próximo entra quando quem está na frente já passou da metade da ida.
    const front = this.walking[this.walking.length - 1];
    if (this.queue.length && this.gap <= 0 && (!front || front.t > WALK_SECS * 0.3)) {
      const m = this.queue.shift();
      m.t = 0;
      this.walking.push(m);
      if (this.r) this.buildModel(m);
      this.gap = 1.2;
      if (m.tier >= 3) this.party = 10;
      if (m.tier >= 4) { this.giant = WALK_SECS; sfx.boom(); }
      sfx.pop();
    }
    for (const m of this.walking) {
      const before = m.t; m.t += dt;
      if (before < WALK_SECS * 0.45 && m.t >= WALK_SECS * 0.45) { this.flashT = 1.2; sfx.tone(1600, 0.05, 'square', 0.04); }
    }
    for (const m of this.walking.filter((m) => m.t >= WALK_SECS)) {
      addScore(this.claps, m.rbx?.name || m.user.nick, m.claps);
      this.recent.set(m.id, performance.now() + 60000);
      this.seat(m);
    }
    this.walking = this.walking.filter((m) => m.t < WALK_SECS);
  },
  seat(m) {
    this.seats.push(m);
    if (this.seats.length > 12) { const old = this.seats.shift(); this.r?.scene.remove(old.obj); }
    this.seats.forEach((s, i) => { s.seatPos = { x: (i % 2 ? 1 : -1) * (4.6 + Math.floor(i / 6) * 1.6), z: RUNWAY_BACK + 6 + (Math.floor(i / 2) % 3) * 6 }; });
  },
  // Caminho na passarela: entra pelo arco, vem até a frente, pausa para pose e volta.
  pathAt(p) {
    if (p < 0.42) return { z: RUNWAY_BACK + (RUNWAY_FRONT - RUNWAY_BACK) * (p / 0.42), x: -0.6, dir: 1 };
    if (p < 0.55) return { z: RUNWAY_FRONT, x: 0, dir: 1, pose: true };
    return { z: RUNWAY_FRONT - (RUNWAY_FRONT - RUNWAY_BACK) * ((p - 0.55) / 0.45), x: 0.6, dir: -1 };
  },

  // ---------- Cena 3D ----------
  init3d() {
    if (this.r || !THREE) return;
    const T = THREE;
    const scene = new T.Scene();
    scene.background = new T.Color(0x07050d);
    scene.fog = new T.Fog(0x07050d, 20, 70);
    const camera = new T.PerspectiveCamera(42, W / H, 0.1, 200);
    scene.add(new T.HemisphereLight(0xffeeff, 0x1a1020, 0.8));
    const key = new T.SpotLight(0xffffff, 300, 60, 0.5, 0.5, 1.4); key.position.set(0, 16, 10); key.target.position.set(0, 0, -6); key.castShadow = true; scene.add(key, key.target);
    // Passarela branca brilhante com LED nas bordas
    const runway = new T.Mesh(new T.BoxGeometry(3.2, 0.8, RUNWAY_FRONT - RUNWAY_BACK + 4), new T.MeshPhysicalMaterial({ color: 0xf5f3ff, roughness: 0.15, metalness: 0.1, clearcoat: 1 }));
    runway.position.set(0, 0.4, (RUNWAY_FRONT + RUNWAY_BACK) / 2); runway.receiveShadow = true; scene.add(runway);
    const ledMat = new T.MeshBasicMaterial({ color: 0xff2e63 });
    for (const x of [-1.62, 1.62]) { const l = new T.Mesh(new T.BoxGeometry(0.06, 0.08, RUNWAY_FRONT - RUNWAY_BACK + 4), ledMat); l.position.set(x, 0.82, (RUNWAY_FRONT + RUNWAY_BACK) / 2); scene.add(l); }
    const floor = new T.Mesh(new T.PlaneGeometry(80, 120), new T.MeshStandardMaterial({ color: 0x120c1c, roughness: 0.4, metalness: 0.5 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    // Arco de entrada com telão
    const archMat = new T.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.25 });
    const arch = new T.Mesh(new T.TorusGeometry(3.6, 0.28, 12, 40, Math.PI), archMat); arch.position.set(0, 0.8, RUNWAY_BACK - 1); scene.add(arch);
    const screenC = document.createElement('canvas'); screenC.width = 512; screenC.height = 256;
    const screenTex = new T.CanvasTexture(screenC); screenTex.colorSpace = T.SRGBColorSpace;
    const screen = new T.Mesh(new T.PlaneGeometry(16, 8), new T.MeshBasicMaterial({ map: screenTex })); screen.position.set(0, 7, RUNWAY_BACK - 3); scene.add(screen);
    // Plateia: fileiras de cadeiras dos dois lados
    const seatMat = new T.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.7 });
    for (const side of [-1, 1]) for (let row = 0; row < 3; row++) for (let k = 0; k < 9; k++) {
      const c = new T.Mesh(new T.BoxGeometry(0.9, 0.5, 0.9), seatMat); c.position.set(side * (3.8 + row * 1.6), 0.25 + row * 0.3, RUNWAY_BACK + 2 + k * 3.2); scene.add(c);
    }
    // Fotógrafos (flashes) perto da frente
    const flashes = [];
    for (let i = 0; i < 16; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: G3.glowTex(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending })); s.position.set(rand(-6, 6), rand(1, 2.4), RUNWAY_FRONT + rand(1, 4)); s.scale.set(0.8, 0.8, 1); scene.add(s); flashes.push(s); }
    const partyLights = [];
    for (let i = 0; i < 4; i++) { const p = new T.PointLight([0xff2e63, 0x00e5ff, 0xa3e635, 0xffc93c][i], 0, 30); p.position.set((i - 1.5) * 5, 6, -8); scene.add(p); partyLights.push(p); }
    this.r = { scene, camera, screen: { c: screenC, tex: screenTex, t: 0 }, flashes, partyLights, ledMat, cam: new T.Vector3(0, 4, 14), look: new T.Vector3(0, 2, -6) };
    for (const m of this.walking) this.buildModel(m);
    for (const m of this.seats) this.buildModel(m);
  },
  buildModel(m) {
    const T = THREE;
    const g = new T.Group();
    if (m.rbx?.img) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: G3.imageTex(m.rbx.img), transparent: true }));
      s.center.set(0.5, 0.02); s.scale.set(3.2, 3.2, 1); g.add(s); m.sprite = s;
    } else {
      m.blocky = makeBlocky3D(m.user.nick, m.user.pic); g.add(m.blocky.root);
    }
    const tag = G3.label(`@${trim(m.rbx?.name || m.user.nick, 14)}`, { scale: 0.12, border: m.tier ? '#ffc93c' : 'rgba(255,255,255,.3)' });
    tag.center.set(0.5, 0); tag.position.set(0, 3.2, 0); g.add(tag);
    m.obj = g;
    this.r.scene.add(g);
  },
  drawScreen(t) {
    const S = this.r.screen;
    if (t - S.t < 0.1) return;
    S.t = t;
    const g = S.c.getContext('2d');
    const cur = this.current();
    const gr = g.createLinearGradient(0, 0, 512, 256); gr.addColorStop(0, '#2e1065'); gr.addColorStop(1, '#831843');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#fff'; g.font = 'italic 900 56px "Barlow Condensed", Impact'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(cur ? `@${trim(cur.rbx?.name || cur.user.nick, 14)}` : 'PASSARELA', 256, 100);
    g.font = '700 30px Barlow'; g.fillStyle = 'rgba(255,255,255,.85)';
    g.fillText(cur ? `${cur.claps} aplausos` : 'comente para desfilar', 256, 170);
    S.tex.needsUpdate = true;
  },
  draw() {
    if (!this.r) {
      this.init3d();
      background('#07050d', '#2e1065');
      title('PASSARELA', W / 2, H / 2 - 20, 70, '#fff');
      text('Montando o salão…', W / 2, H / 2 + 40, 26, '#e9d5ff', 'center', 700);
      three3dReady.then(() => this.init3d());
      return;
    }
    const T = THREE, t = performance.now() / 1000, r = this.r;
    this.drawScreen(t);
    for (const m of this.walking) {
      if (!m.obj) this.buildModel(m);
      const p = this.pathAt(m.t / WALK_SECS);
      const big = [1, 2, 3, 6, 12][m.tier];
      m.obj.position.set(p.x, 0.8, p.z);
      m.obj.scale.setScalar(big * (m.tier >= 4 ? 1 : 1));
      const dance = m.tier >= 2;
      if (m.sprite) {
        m.sprite.position.y = Math.abs(Math.sin(t * (dance ? 8 : 6))) * (dance ? 0.25 : 0.12);
        m.sprite.material.rotation = Math.sin(t * (dance ? 6 : 4)) * (dance ? 0.18 : 0.06);
        m.sprite.scale.x = 3.2 * (p.dir < 0 ? -1 : 1);
      } else {
        if (p.pose) danceBlocky(m.blocky, t, 1); else if (dance) danceBlocky(m.blocky, t, 0); else walkBlocky(m.blocky, t, 1);
        m.blocky.root.rotation.y = p.dir > 0 ? 0 : Math.PI;
      }
    }
    for (const s of this.seats) {
      if (!s.obj) this.buildModel(s);
      s.obj.scale.setScalar(0.7);
      s.obj.position.set(s.seatPos.x, 0.5 + (Math.abs(s.seatPos.x) > 5 ? 0.3 : 0), s.seatPos.z);
      if (s.blocky) { s.blocky.lL.rotation.x = -1.5; s.blocky.lR.rotation.x = -1.5; s.blocky.aL.rotation.x = Math.sin(t * 8 + s.seatPos.z) * 0.5 - 0.5; s.blocky.aR.rotation.x = -Math.sin(t * 8 + s.seatPos.z) * 0.5 - 0.5; s.blocky.root.rotation.y = s.seatPos.x > 0 ? -Math.PI / 2 : Math.PI / 2; }
    }
    // Flashes dos fotógrafos na pose e luzes de festa
    for (const f of r.flashes) { if (this.flashT > 0 && Math.random() < 0.25) f.material.opacity = 1; f.material.opacity *= 0.82; }
    r.partyLights.forEach((p, i) => { p.intensity = this.party > 0 ? 200 * Math.max(0, Math.sin(t * 12 + i * 1.6)) : 0; });
    r.ledMat.color.setHSL(this.party > 0 ? (t * 2) % 1 : 0.95, 1, 0.55);
    const cur = this.current();
    const giantOn = cur && cur.tier >= 4;
    const big = cur ? [1, 2, 3, 6, 12][cur.tier] : 1;
    const want = giantOn ? new T.Vector3(0, 14, 34) : new T.Vector3(Math.sin(t * 0.2) * 1.2, 3.6 + big * 1.4, 13 + big * 4);
    r.cam.lerp(want, 0.04);
    r.look.lerp(new T.Vector3(0, giantOn ? 10 : 1.6 + big * 1.2, cur ? Math.max(RUNWAY_BACK, this.pathAt(cur.t / WALK_SECS).z - 3) : -8), 0.06);
    r.camera.position.copy(r.cam); r.camera.lookAt(r.look);
    G3.render(r.scene, r.camera);
    if (this.flashT > 0.9) { ctx.fillStyle = `rgba(255,255,255,${(this.flashT - 0.9) * 1.2})`; ctx.fillRect(0, 0, W, H); }
    this.drawHud();
  },
  drawHud() {
    slant(16, 20, W - 32, 74, { fill: 'rgba(14,8,28,.85)', skew: 14, border: 'rgba(255,255,255,.18)' });
    title('PASSARELA DA LIVE', W / 2, 46, 34, '#fff');
    label(`Comente para desfilar · nick do Roblox = seu avatar · na fila: ${this.queue.length}`, W / 2, 76, 15, 'rgba(255,255,255,.75)', 'center', 700);
    // Próximos da fila
    this.queue.slice(0, 5).forEach((m, i) => {
      const x = 76 + i * 142, y = 150;
      slant(x - 60, y - 40, 124, 92, { fill: m.tier ? 'rgba(255,201,60,.2)' : 'rgba(14,8,28,.85)', skew: 8, border: m.tier ? '#ffc93c' : 'rgba(255,255,255,.12)' });
      if (m.rbx?.img) { const img = getImg(m.rbx.img); if (img) ctx.drawImage(img, x - 36, y - 40, 72, 72); }
      else avatar(m.user, x, y - 6, 24, colorFor(m.user.nick));
      label(`${i + 1}. @${trim(m.rbx?.name || m.user.nick, 9)}`, x, y + 40, 13, '#fff', 'center', 800);
    });
    const cur = this.current();
    if (cur) {
      slant(16, 1110, W - 32, 74, { fill: 'rgba(14,8,28,.88)', skew: 14, border: '#ff2e63' });
      label('DESFILANDO AGORA', 40, 1132, 13, 'rgba(255,255,255,.65)', 'left', 800);
      title(`@${trim(cur.rbx?.name || cur.user.nick, 16).toUpperCase()}`, 40, 1160, 30, '#fff', 'left');
      num(`${cur.claps}`, W - 120, 1150, 40, '#ffc93c', 'right');
      label('aplausos', W - 40, 1154, 15, 'rgba(255,255,255,.75)', 'right', 700);
    }
    const rows = [...this.claps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (rows.length) label(`Mais aplaudidos: ${rows.map(([n, v], i) => `${i + 1}. ${trim(n, 10)} (${v})`).join('   ')}`, W / 2, 1226, 15, '#ffc93c', 'center', 800);
  },
});
