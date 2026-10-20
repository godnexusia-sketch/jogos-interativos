'use strict';

// Céu de Pipas 3D (estilo Pipa Combate): cada pessoa que entra na live (ou comenta) ganha uma pipa com
// a foto e o nome, presa por linha até a laje. Presente faz a pipa caçar e cortar a linha das outras.
// O TikTok avisa quem entra, mas não quem sai: a pipa cai quando a pessoa fica um tempo sem interagir
// ou quando o número de espectadores cai abaixo do número de pipas.
const PIPA_DEFAULT = { autoJoin: true, idleMin: 5, max: 60, matchViewers: true, cutChance: 30, respawnSecs: 10 };
const SKY = { w: 26, top: 46, bottom: 14 };

registerGame({
  id: 'pipa',
  name: 'Céu de Pipas',
  icon: '🪁',
  help: '<p>Quem <b>entra na live</b> ganha uma pipa com o nome e a foto, sem precisar comentar. Comentar também solta a pipa.</p><p>❤️ Likes fazem a pipa subir. Comente <b>corta</b> para tentar cortar a pipa mais perto. Quem sai da live (ou fica muito tempo sem interagir) tem a pipa derrubada.</p><p>🌹 Caça e corta 1 · 🍩 Escudo de 30s · 🕶️ Corta 3 · 🌌 Linha de ouro: corta 10.</p><p>O admin muda as regras em <b>Configurar</b>.</p>',
  wantsPresence: true,
  configKey: 'pipa',
  config: { ...PIPA_DEFAULT, ...store.get('cfg:pipa', {}) },
  getConfig() { return this.config; },
  applyConfig(cfg) { if (!cfg) return; this.config = { ...PIPA_DEFAULT, ...cfg }; store.set('cfg:pipa', this.config); },
  renderSettings(el, save) {
    const c = this.config;
    el.innerHTML = `
      <label class="row2"><input data-k="autoJoin" type="checkbox" ${c.autoJoin ? 'checked' : ''} style="width:auto"> Pipa automática para quem entra na live</label>
      <label class="row2"><input data-k="matchViewers" type="checkbox" ${c.matchViewers ? 'checked' : ''} style="width:auto"> Derrubar pipas quando o número de espectadores cair</label>
      <label>Minutos sem interagir até a pipa cair (0 = nunca) <input data-k="idleMin" type="number" min="0" max="120" value="${c.idleMin}"></label>
      <label>Máximo de pipas no céu <input data-k="max" type="number" min="5" max="150" value="${c.max}"></label>
      <label>Chance de cortar comentando "corta" (%) <input data-k="cutChance" type="number" min="0" max="100" value="${c.cutChance}"></label>
      <label>Segundos para voltar a pipa depois de cortada <input data-k="respawnSecs" type="number" min="0" max="600" value="${c.respawnSecs}"></label>
      <div class="row"><button data-save class="primary">Salvar</button><button data-clear>Derrubar todas</button></div>`;
    el.querySelector('[data-save]').addEventListener('click', () => {
      const v = (k) => el.querySelector(`[data-k="${k}"]`);
      this.applyConfig({ autoJoin: v('autoJoin').checked, matchViewers: v('matchViewers').checked, idleMin: clamp(Number(v('idleMin').value) || 0, 0, 120), max: clamp(Number(v('max').value) || 60, 5, 150), cutChance: clamp(Number(v('cutChance').value) || 0, 0, 100), respawnSecs: clamp(Number(v('respawnSecs').value) || 0, 0, 600) });
      save(this.config);
    });
    el.querySelector('[data-clear]').addEventListener('click', () => { for (const k of [...this.kites]) this.leave(k, true); });
  },
  cd: new Cooldown(8000),
  kings: new Map(),
  reset() {
    for (const k of [...(this.kites || []), ...(this.falling || [])]) this.r?.scene.remove(k.obj, k.line);
    this.kites = [];
    this.falling = [];
    this.respawn = new Map();
    this.comeBack = [];
    this.log = [];
    this.windT = 12;
    this.viewers = 0;
    this.checkT = 1;
  },
  sample: () => pick(['oi', 'corta', 'bora', 'kkk', 'manda', 'linha']),
  kite(id) { return this.kites.find((k) => k.id === id); },
  addLog(user, msg, color) { this.log.unshift({ user, msg, color, t: 6 }); this.log.length = Math.min(this.log.length, 3); },
  spawn(user) {
    const id = user.id || user.nick;
    if (this.kite(id)) return this.kite(id);
    if ((this.respawn.get(id) || 0) > performance.now()) return null;
    // Céu cheio: a pipa mais parada dá lugar à nova
    if (this.kites.length >= this.config.max) { const idle = this.mostIdle(); if (!idle) return null; this.leave(idle, true); }
    const anchor = { x: rand(-14, 14), y: rand(4, 9), z: rand(4, 10) };
    const k = { id, user, color: colorFor(user.nick), color2: colorFor(user.nick + 'b'), x: anchor.x, y: SKY.bottom, z: rand(-8, 2), alt: 0, phase: rand(0, 6), shield: 0, hunt: [], kills: 0, born: 0, anchor, gold: 0, lastSeen: performance.now() };
    k.home = { x: rand(-SKY.w / 2 + 3, SKY.w / 2 - 3), y: rand(SKY.bottom + 6, SKY.top - 6), z: rand(-10, 2) };
    this.kites.push(k);
    if (this.r) this.buildKite(k);
    sfx.pop();
    return k;
  },
  nearestTargets(k, n) {
    const d = (a) => (a.x - k.x) ** 2 + (a.y - k.y) ** 2 + (a.z - k.z) ** 2;
    return this.kites.filter((o) => o !== k && o.shield <= 0 && !k.hunt.includes(o)).sort((a, b) => d(a) - d(b)).slice(0, n);
  },
  mostIdle() { return [...this.kites].sort((a, b) => a.lastSeen - b.lastSeen)[0]; },
  // A pessoa saiu da live (ou ficou muito tempo parada): a pipa cai sem dar ponto a ninguém.
  leave(k, silent = false) {
    const i = this.kites.indexOf(k);
    if (i < 0) return;
    this.kites.splice(i, 1);
    k.fall = { vy: 0, spin: rand(1, 3), t: 4 };
    this.falling.push(k);
    this.comeBack = this.comeBack.filter((c) => c.user.nick !== k.user.nick);
    if (!silent) this.addLog(k.user, 'saiu da live', '#94a3b8');
  },
  onViewers(n) { this.viewers = n; },
  cut(victim, by) {
    const i = this.kites.indexOf(victim);
    if (i < 0) return;
    this.kites.splice(i, 1);
    victim.fall = { vy: 0, spin: rand(2, 5), t: 4 };
    this.falling.push(victim);
    this.respawn.set(victim.id, performance.now() + this.config.respawnSecs * 1000);
    // Quem ainda está na live volta a soltar a pipa depois de um tempo
    if (this.config.autoJoin) this.comeBack.push({ user: victim.user, at: performance.now() + this.config.respawnSecs * 1000 + 300 });
    if (by) { by.kills++; addScore(this.kings, by.user.nick); this.addLog(by.user, `cortou @${trim(victim.user.nick, 10)}`, by.color); }
    if (this.r) { const p = this.screenOf(victim); burst(p.x, p.y, [victim.color, '#fff'], 26, 320); }
    sfx.tone(520, 0.18, 'sawtooth', 0.08);
  },
  onEvent(ev) {
    const id = uid(ev);
    const mine = this.kite(id);
    if (mine) mine.lastSeen = performance.now();
    if (ev.type === 'join') {
      if (!this.config.autoJoin || mine) return;
      const k = this.spawn(ev.user);
      if (k) this.addLog(ev.user, 'entrou na live 🪁', '#a3e635');
      return;
    }
    if (ev.type === 'chat') {
      const k = this.kite(id) || this.spawn(ev.user);
      if (k && /corta|cerol|linha/i.test(ev.text) && this.cd.ok(id)) {
        const [t] = this.nearestTargets(k, 1);
        if (t && Math.random() < this.config.cutChance / 100) k.hunt.push(t);
      }
    } else if (ev.type === 'like') {
      const k = this.kite(id);
      if (k) k.alt = Math.min(12, k.alt + ev.count * 0.3);
    } else if (ev.type === 'gift') {
      const k = this.kite(id) || this.spawn(ev.user);
      if (!k) return;
      const tier = giftTier(ev), n = Math.min(5, ev.count || 1);
      if (tier === 2) { k.shield = Math.min(120, k.shield + 30 * n); this.addLog(ev.user, 'ganhou ESCUDO na linha', '#00e5ff'); return; }
      const cuts = { 1: 1, 3: 3, 4: 10 }[tier] * n;
      k.hunt.push(...this.nearestTargets(k, cuts));
      if (tier >= 3) announcer.show(`${tier === 4 ? 'LINHA DE OURO' : 'CAÇADA'} @${trim(ev.user.nick, 10)}`, tier === 4 ? '#ffc93c' : '#ff2e63', 2, 46);
      if (tier === 4) k.gold = 12;
    }
  },
  update(dt) {
    const t = performance.now() / 1000;
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    for (const k of this.kites) {
      k.born += dt;
      k.shield = Math.max(0, k.shield - dt);
      k.gold = Math.max(0, k.gold - dt);
      k.alt = Math.max(0, k.alt - dt * 0.4);
      k.hunt = k.hunt.filter((o) => this.kites.includes(o));
      const target = k.hunt[0];
      let tx, ty, tz, sp;
      if (target) { tx = target.x; ty = target.y; tz = target.z; sp = 18; }
      else { tx = k.home.x + Math.sin(t * 0.35 + k.phase) * 3; ty = k.home.y + k.alt + Math.sin(t * 0.8 + k.phase) * 1.2; tz = k.home.z + Math.cos(t * 0.3 + k.phase) * 1.5; sp = 2.5; }
      const dx = tx - k.x, dy = ty - k.y, dz = tz - k.z, d = Math.hypot(dx, dy, dz) || 1;
      const step = Math.min(d, sp * dt * (target ? 1 : d * 0.6 + 0.4));
      k.x += dx / d * step; k.y += dy / d * step; k.z += dz / d * step;
      if (target && d < 1.6) {
        if (target.shield > 0) { target.shield = 0; k.hunt.shift(); }
        else { this.cut(target, k); k.hunt.shift(); }
      }
    }
    for (const f of this.falling) { f.fall.t -= dt; f.fall.vy += 6 * dt; f.y -= f.fall.vy * dt; f.x += Math.sin(t * 3 + f.phase) * dt * 2; }
    for (const f of this.falling.filter((f) => f.fall.t <= 0 || f.y < -2)) this.r?.scene.remove(f.obj, f.line);
    this.falling = this.falling.filter((f) => f.fall.t > 0 && f.y >= -2);
    // Presença: pipa cai quando a pessoa some (sem interagir) ou quando há mais pipas que espectadores
    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 1;
      const now = performance.now();
      if (this.config.idleMin > 0) for (const k of [...this.kites]) if (now - k.lastSeen > this.config.idleMin * 60000) this.leave(k);
      if (this.config.matchViewers && this.viewers > 0 && this.kites.length > this.viewers) { const idle = this.mostIdle(); if (idle) this.leave(idle); }
      for (const c of this.comeBack.filter((c) => c.at <= now)) this.spawn(c.user);
      this.comeBack = this.comeBack.filter((c) => c.at > now);
    }
    // Vento embola duas pipas de vez em quando, mesmo sem presente
    this.windT -= dt;
    if (this.windT <= 0) {
      this.windT = 14;
      if (this.kites.length >= 6) { const a = pick(this.kites); const [b] = this.nearestTargets(a, 1); if (b) { announcer.show('EMBOLOU!', '#ffffff', 1.4, 50); this.cut(Math.random() < 0.5 ? b : a, null); } }
    }
  },

  // ---------- Cena 3D ----------
  init3d() {
    if (this.r || !THREE) return;
    const T = THREE;
    const scene = new T.Scene();
    scene.background = G3.skyTex('#2b7de9', '#7cc1ff', '#ffe7b3');
    scene.fog = new T.Fog(0xcfe6ff, 60, 160);
    const camera = new T.PerspectiveCamera(55, W / H, 0.5, 400);
    G3.lights(scene, { ground: 0x7a5c3a, hemi: 1.15, sun: 2.4, pos: [-30, 50, 40] });
    // Sol e nuvens
    const sun = new T.Sprite(new T.SpriteMaterial({ map: G3.glowTex(), color: 0xfff1c1, transparent: true, depthWrite: false }));
    sun.position.set(-30, 70, -80); sun.scale.set(40, 40, 1); scene.add(sun);
    const cloudTex = G3.tex(256, 128, (g) => { g.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(40 + i * 22, 70 + Math.sin(i) * 14, 34, 26, 0, 0, 7); g.fill(); } });
    const clouds = [];
    for (let i = 0; i < 8; i++) { const c = new T.Sprite(new T.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0.85 })); c.position.set(rand(-60, 60), rand(40, 70), rand(-90, -40)); c.scale.set(rand(20, 34), rand(9, 14), 1); scene.add(c); clouds.push(c); }
    // Morro com casas coloridas, lajes e caixas-d'água
    const ground = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshLambertMaterial({ color: 0x8b6b45 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const brick = (col) => G3.tex(64, 64, (g) => { g.fillStyle = col; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < 64; y += 10) g.fillRect(0, y, 64, 1.5); g.fillStyle = 'rgba(30,40,60,.85)'; g.fillRect(14, 20, 12, 14); g.fillRect(40, 20, 12, 14); }, [1, 1]);
    const houseCols = ['#e76f51', '#f4a261', '#e9c46a', '#2a9d8f', '#8ab17d', '#f7ede2', '#c8553d', '#5390d9', '#b5838d'];
    const mats = houseCols.map((c) => new T.MeshLambertMaterial({ map: brick(c) }));
    const roof = new T.MeshLambertMaterial({ color: 0x9ca3af });
    const tank = new T.MeshLambertMaterial({ color: 0x1d4ed8 });
    for (let row = 0; row < 7; row++) for (let i = 0; i < 16; i++) {
      const w = rand(3.5, 6), d = rand(3.5, 6), h = rand(3, 7);
      const x = -42 + i * 5.6 + rand(-1, 1), z = 14 - row * 7 + rand(-1, 1), y0 = row * 2.4;
      const m = mats[(i * 7 + row * 3) % mats.length];
      const b = new T.Mesh(new T.BoxGeometry(w, h, d), [m, m, roof, roof, m, m]); b.position.set(x, y0 + h / 2, z); b.castShadow = true; b.receiveShadow = true; scene.add(b);
      if ((i + row) % 3 === 0) { const tk = new T.Mesh(new T.CylinderGeometry(0.8, 0.8, 1.2, 12), tank); tk.position.set(x + rand(-1, 1), y0 + h + 0.6, z + rand(-1, 1)); scene.add(tk); }
    }
    this.r = { scene, camera, clouds };
    for (const k of this.kites) this.buildKite(k);
  },
  buildKite(k) {
    const T = THREE;
    const g = new T.Group();
    // Pipa em losango com duas cores, varetas e rabiola
    const shape = (col, pts) => { const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); geo.computeVertexNormals(); return new T.Mesh(geo, new T.MeshStandardMaterial({ color: col, side: T.DoubleSide, roughness: 0.6 })); };
    const top = 1.6, bot = -2.0, side = 1.4;
    g.add(shape(k.color, [0, top, 0, -side, 0, 0, 0, 0, 0.05, 0, top, 0, 0, 0, 0.05, side, 0, 0]));
    g.add(shape(k.color2, [-side, 0, 0, 0, bot, 0, 0, 0, 0.05, 0, 0, 0.05, 0, bot, 0, side, 0, 0]));
    const stick = new T.MeshBasicMaterial({ color: 0x5b3a1a });
    const v1 = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, top - bot, 6), stick); v1.position.y = (top + bot) / 2; g.add(v1);
    const v2 = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, side * 2, 6), stick); v2.rotation.z = Math.PI / 2; g.add(v2);
    const tailPts = [];
    for (let i = 0; i < 10; i++) tailPts.push(new T.Vector3(0, bot - i * 0.45, 0));
    const tail = new T.Line(new T.BufferGeometry().setFromPoints(tailPts), new T.LineBasicMaterial({ color: k.color2 }));
    g.add(tail);
    const bows = [];
    for (let i = 1; i < 10; i += 2) { const b = new T.Mesh(new T.PlaneGeometry(0.5, 0.18), new T.MeshBasicMaterial({ color: i % 4 === 1 ? k.color : '#ffffff', side: T.DoubleSide })); b.position.y = bot - i * 0.45; g.add(b); bows.push(b); }
    // Foto e @ de quem é a pipa
    const face = new T.Sprite(new T.SpriteMaterial({ map: G3.faceTex(k.user.pic, k.user.nick, true), depthTest: false, sizeAttenuation: false }));
    face.scale.set(0.036, 0.036, 1); face.renderOrder = 20; g.add(face);
    const tag = G3.label(`@${trim(k.user.nick, 12)}`, { scale: 0.12, border: k.color });
    tag.center.set(0.5, 3.4); g.add(tag);
    const shield = new T.Mesh(new T.SphereGeometry(2.4, 16, 12), new T.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.18, depthWrite: false }));
    g.add(shield);
    const line = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]), new T.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.6 }));
    k.obj = g; k.line = line; k.tail = tail; k.bows = bows; k.shieldMesh = shield; k.mats = [g.children[0].material, g.children[1].material];
    this.r.scene.add(g, line);
  },
  screenOf(k) {
    const v = new THREE.Vector3(k.x, k.y, k.z).project(this.r.camera);
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H };
  },
  draw() {
    if (!this.r) {
      this.init3d();
      background('#2b7de9', '#ffe7b3');
      title('CÉU DE PIPAS', W / 2, H / 2 - 20, 64, '#fff');
      text('Montando o morro…', W / 2, H / 2 + 40, 26, '#fff', 'center', 700);
      three3dReady.then(() => this.init3d());
      return;
    }
    const T = THREE, t = performance.now() / 1000, r = this.r;
    r.clouds.forEach((c, i) => { c.position.x += 0.02 * (1 + i % 3); if (c.position.x > 70) c.position.x = -70; });
    const all = [...this.kites, ...this.falling];
    for (const k of all) {
      if (!k.obj) this.buildKite(k);
      k.obj.position.set(k.x, k.y, k.z);
      const sway = Math.sin(t * 2 + k.phase) * 0.18;
      k.obj.rotation.set(0.15, Math.sin(t * 0.7 + k.phase) * 0.35, sway + (k.fall ? t * k.fall.spin : 0));
      k.obj.scale.setScalar(1.8 * Math.min(1, k.born * 2 + 0.1));
      k.shieldMesh.visible = k.shield > 0;
      const gold = k.gold > 0;
      k.mats[0].color.set(gold ? '#ffc93c' : k.color); k.mats[1].color.set(gold ? '#fff3b0' : k.color2);
      // Rabiola balançando
      const pos = k.tail.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setX(i, Math.sin(t * 5 + i * 0.7 + k.phase) * i * 0.06);
      pos.needsUpdate = true;
      k.bows.forEach((b, i) => { b.position.x = Math.sin(t * 5 + (i * 2 + 1) * 0.7 + k.phase) * (i * 2 + 1) * 0.06; });
      // Linha até a laje (some quando é cortada)
      const lp = k.line.geometry.attributes.position;
      lp.setXYZ(0, k.anchor.x, k.anchor.y, k.anchor.z); lp.setXYZ(1, k.x, k.y - 0.3, k.z); lp.needsUpdate = true;
      k.line.visible = !k.fall;
      k.line.material.color.set(gold ? '#ffc93c' : k.hunt.length ? '#dc2626' : '#222222');
    }
    r.camera.position.set(Math.sin(t * 0.08) * 3, 12, 36);
    r.camera.lookAt(0, 27, -4);
    G3.render(r.scene, r.camera);
    this.drawHud();
  },
  drawHud() {
    slant(16, 18, W - 32, 70, { fill: 'rgba(10,30,70,.82)', skew: 14, border: 'rgba(255,255,255,.3)' });
    title('CÉU DE PIPAS', 40, 46, 34, '#fff', 'left');
    label(`${this.kites.length} pipas no céu${this.viewers ? ` · ${this.viewers} assistindo` : ''} · entrou na live, ganhou pipa`, 40, 74, 15, 'rgba(255,255,255,.85)', 'left', 700);
    const rows = [...this.kings.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (rows.length) {
      slant(W - 236, 100, 220, 34 + rows.length * 34, { fill: 'rgba(10,30,70,.82)', skew: 8 });
      label('REI DA LAJE', W - 214, 118, 13, '#ffc93c', 'left', 900);
      rows.forEach(([n, v], i) => { posBadge(i + 1, W - 208, 146 + i * 34, 22); label(`@${trim(n, 9)}`, W - 190, 147 + i * 34, 15, '#fff', 'left', 800); label(`${v} corte${v === 1 ? '' : 's'}`, W - 30, 147 + i * 34, 13, '#ffc93c', 'right', 800); });
    }
    if (!this.kites.length) { slant(80, 520, W - 160, 110, { fill: 'rgba(10,30,70,.82)', skew: 14, border: '#fff' }); title('O CÉU ESTÁ VAZIO', W / 2, 562, 40, '#fff'); label('Quem entrar na live ganha uma pipa · comentar também solta', W / 2, 604, 18, '#e0f2fe', 'center', 700); }
    this.log.forEach((l, k) => toast(l.user, trim(`@${trim(l.user.nick, 10)} ${l.msg}`, 34), 20, 1120 + k * 44, { color: l.color, alpha: clamp(l.t, 0, 1), size: 17 }));
    slant(16, 1226, W - 32, 40, { fill: 'rgba(10,30,70,.85)', skew: 10 });
    label('ROSA corta 1  ·  ROSQUINHA escudo  ·  ÓCULOS corta 3  ·  GALÁXIA linha de ouro', W / 2, 1247, 14, '#fff', 'center', 800);
  },
});
