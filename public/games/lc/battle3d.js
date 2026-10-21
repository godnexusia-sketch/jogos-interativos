'use strict';

// Batalhas em 3D: Colina dos Zumbis, Guerra de Tanques, Pancada no Boneco e MMA dos Países.

// Nome flutuando sobre um objeto 3D (sprite do G3).
function nameTag(text, color = '#ffffff', border = null) { const s = G3.label(text, { color, border, scale: 0.13 }); return s; }

// ---------------- Colina dos Zumbis (Zombie Hill) ----------------
const ZH_RANKS = ['Recruta', 'Soldado', 'Cabo', 'Sargento', 'Subtenente', 'Aspirante', 'Tenente', 'Capitão', 'Major', 'Tenente-Coronel', 'Coronel', 'General', 'Marechal'];
defineGame({
  id: 'zombie-hill', name: 'Colina dos Zumbis', genre: 'battle', icon: '🧟', color: '#65a30d', three: true,
  desc: 'Defesa em primeira pessoa: o chat inteiro é a horda subindo a colina. Cada espectador que entra ou manda presente vira um zumbi com o nome, e a sua arma mira e derruba sozinha.',
  help: '<p>Quem entra, comenta, curte ou manda presente vira um <b>zumbi com o nome</b> subindo a colina. A metralhadora atira sozinha. Abates sobem as <b>patentes</b> (13 no total). Se um zumbi chegar no topo, a base perde vida.</p><p>🎁 Presentes grandes viram zumbis mais fortes ou ajudam a defesa: ❤️ kit médico, ⚡ sobrecarga, 🛡️ escudo, 🧊 congelar, e defesas (torreta, tesla, lâminas, arame farpado).</p>',
  settings: [
    { key: 'difficulty', type: 'select', label: 'Dificuldade', options: [['0.7', 'Fácil'], ['1', 'Normal'], ['1.4', 'Difícil']], default: '1' },
    { key: 'baseHealth', type: 'number', label: 'Vida da base', min: 5, max: 500, default: 50 },
    { key: 'maxZombies', type: 'number', label: 'Zumbis ao mesmo tempo', min: 5, max: 80, default: 35 },
    { key: 'demoMode', type: 'toggle', label: 'Zumbis automáticos quando a live está parada', default: true },
    ...BOARD_SETTINGS(5),
  ],
  actions: [{ id: 'spawn_walker', label: 'Zumbi', icon: '🧟' }, { id: 'spawn_by_value', label: 'Zumbi pelo valor', icon: '🎁' }, { id: 'powerup_medkit', label: 'Kit médico', icon: '❤️' }, { id: 'powerup_overdrive', label: 'Sobrecarga', icon: '⚡' }, { id: 'powerup_shield', label: 'Escudo', icon: '🛡️' }, { id: 'powerup_freeze', label: 'Congelar', icon: '🧊' }, { id: 'defense_turret', label: 'Torreta', icon: '🔫' }, { id: 'defense_tesla', label: 'Tesla', icon: '⚡' }, { id: 'defense_blade', label: 'Lâminas', icon: '🪚' }, { id: 'defense_barbedWire', label: 'Arame farpado', icon: '〰️' }],
  bindings: [{ action: 'spawn_walker', trigger: 'join' }, { action: 'spawn_walker', trigger: 'comment' }, { action: 'spawn_walker', trigger: 'like', likes: 30 }, { action: 'spawn_walker', trigger: 'follow' }, { action: 'spawn_walker', trigger: 'share' }, { action: 'spawn_by_value', trigger: 'gift', minCoins: 1 }, { action: 'powerup_medkit', trigger: 'gift', minCoins: 99, on: false }, { action: 'defense_turret', trigger: 'gift', minCoins: 299, on: false }],
  reset() {
    this.z = []; this.hp = this.s.baseHealth; this.kills = 0; this.score = 0; this.killers = new Map(); this.feed = new Feed(4); this.over = 0;
    this.buff = { over: 0, shield: 0, freeze: 0 }; this.defs = []; this.muzzle = 0; this.aim = 0; this.demoT = 2; this.shotT = 0; this.tracers = [];
    if (this.r) for (const m of this.r.zMeshes) m.root.visible = false;
  },
  sample() { return pick(['zumbi', 'bora', 'grr']); },
  spawn(user, hp = 30, big = 1) {
    if (this.over || this.z.length >= this.s.maxZombies) return;
    if (this.z.some((x) => x.k === (user.id || user.nick) && x.alive)) { const ex = this.z.find((x) => x.k === (user.id || user.nick)); ex.hp += hp; ex.big = Math.max(ex.big, big); return; }
    this.z.push({ k: user.id || user.nick, user, hp: hp * Number(this.s.difficulty), max: hp * Number(this.s.difficulty), d: 30 + rand(0, 5), x: rand(-9, 9), speed: rand(1.2, 1.8) * Number(this.s.difficulty), big, alive: true, mesh: null, t: rand(0, 6) });
  },
  rank() { let r = 0; for (let i = 0; i < ZH_RANKS.length; i++) if (this.kills >= i * i * 8) r = i; return r; },
  onAction(id, a) {
    if (id === 'spawn_walker') return this.spawn(a.user);
    if (id === 'spawn_by_value') { const big = a.coins >= 1000 ? 2.4 : a.coins >= 100 ? 1.7 : a.coins >= 10 ? 1.3 : 1; this.spawn(a.user, 30 + a.coins * 8, big); if (big > 1) this.feed.push(a.user, big > 2 ? '🧟‍♂️ ZUMBI GIGANTE!' : '🧟 zumbi forte', '#84cc16'); return; }
    const names = { powerup_medkit: '❤️ kit médico', powerup_overdrive: '⚡ sobrecarga', powerup_shield: '🛡️ escudo', powerup_freeze: '🧊 congelou a horda', defense_turret: '🔫 torreta', defense_tesla: '⚡ tesla', defense_blade: '🪚 lâminas', defense_barbedWire: '〰️ arame farpado' };
    if (id === 'powerup_medkit') this.hp = Math.min(this.s.baseHealth, this.hp + Math.max(5, Math.round(a.qty * 2)));
    else if (id === 'powerup_overdrive') this.buff.over = 12;
    else if (id === 'powerup_shield') this.buff.shield = 15;
    else if (id === 'powerup_freeze') this.buff.freeze = 6;
    else if (id.startsWith('defense_')) this.defs.push({ kind: id.slice(8), t: 30, cd: 0, x: rand(-6, 6) });
    this.feed.push(a.user, names[id], '#22e3ee');
  },
  update(dt) {
    this.feed.update(dt);
    if (this.over) { this.over -= dt; if (this.over <= 0) this.reset(); return; }
    for (const k in this.buff) this.buff[k] = Math.max(0, this.buff[k] - dt);
    if (this.s.demoMode) { this.demoT -= dt; if (this.demoT <= 0) { this.demoT = rand(1.5, 3.5); if (this.z.filter((x) => x.alive).length < 6) this.spawn(botUser('z')); } }
    for (const zb of this.z) {
      if (!zb.alive) continue;
      zb.t += dt;
      if (!this.buff.freeze) zb.d -= zb.speed * dt * (this.defs.some((d) => d.kind === 'barbedWire') && zb.d < 14 ? 0.4 : 1);
      if (zb.d <= 2) {
        zb.alive = false;
        if (!this.buff.shield) { this.hp -= Math.ceil(zb.big * 2); this.hitFlash = 0.5; sfx.boom(); }
        if (this.hp <= 0) { this.over = 6; voice.say(`A base caiu! ${this.kills} zumbis abatidos.`); }
      }
    }
    // Arma automática: mira o zumbi mais perto
    this.shotT -= dt;
    const live = this.z.filter((x) => x.alive).sort((a, b) => a.d - b.d);
    const tgt = live[0];
    if (tgt) {
      this.aim += (Math.atan2(tgt.x, tgt.d) - this.aim) * Math.min(1, dt * 8);
      if (this.shotT <= 0) {
        this.shotT = this.buff.over ? 0.06 : 0.14; this.muzzle = 0.06;
        sfx.tone(rand(140, 200), 0.04, 'square', 0.03);
        this.damage(tgt, (this.buff.over ? 14 : 10) + this.rank() * 1.5);
        this.tracers.push({ x: tgt.x, d: tgt.d, t: 0.08 });
      }
    }
    for (const df of this.defs) {
      df.t -= dt; df.cd -= dt;
      if (df.cd <= 0 && live.length) { df.cd = df.kind === 'tesla' ? 1.5 : df.kind === 'blade' ? 0.4 : 0.25; const near = live.filter((x) => x.d < (df.kind === 'blade' ? 8 : 25)); for (const zb of df.kind === 'tesla' ? near.slice(0, 4) : near.slice(0, 1)) this.damage(zb, df.kind === 'tesla' ? 40 : 15); }
    }
    this.defs = this.defs.filter((d) => d.t > 0);
    for (const tr of this.tracers) tr.t -= dt;
    this.tracers = this.tracers.filter((t) => t.t > 0);
    this.muzzle = Math.max(0, this.muzzle - dt); this.hitFlash = Math.max(0, (this.hitFlash || 0) - dt);
    this.z = this.z.filter((x) => x.alive || (x.dieT = (x.dieT ?? 1) - dt) > 0);
  },
  damage(zb, d) {
    if (!zb.alive) return;
    zb.hp -= d;
    if (zb.hp <= 0) {
      zb.alive = false; zb.dieT = 1; this.kills++; this.score += Math.round(10 * zb.big);
      const before = this.rank();
      if (!zb.user.bot) { const k = zb.k; this.killers.set(k, { user: zb.user, value: (this.killers.get(k)?.value || 0) + 1 }); }
      if (this.rank() > before) { announcer.show(`PATENTE: ${ZH_RANKS[this.rank()].toUpperCase()}`, '#ffc93c', 2.5, 40); sfx.win(); }
    }
  },
  scene3d() {
    if (this.r || !G3.ready) return this.r;
    const T = THREE, scene = new T.Scene();
    scene.background = G3.skyTex('#1a1a2e', '#3b2f4a', '#7c5b3a');
    scene.fog = new T.Fog(0x2a2235, 30, 90);
    G3.lights(scene, { hemi: 0.6, sun: 1.6, pos: [-10, 30, -20], sky: 0xffd9a8, ground: 0x223322 });
    const hill = new T.Mesh(new T.PlaneGeometry(60, 70, 30, 35), new T.MeshStandardMaterial({ map: G3.tex(128, 128, (g) => { g.fillStyle = '#3f5f2a'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 300; i++) { g.fillStyle = Math.random() < 0.5 ? '#4d7a2f' : '#2f4a1f'; g.fillRect(rand(0, 128), rand(0, 128), 2, 3); } }, [6, 6]), roughness: 1 }));
    const pos = hill.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setZ(i, (35 - y) * 0.28 + Math.sin(pos.getX(i) * 0.5) * 0.4); }
    hill.geometry.computeVertexNormals();
    hill.rotation.x = -Math.PI / 2; hill.position.z = -33; hill.receiveShadow = true; scene.add(hill);
    for (let i = 0; i < 30; i++) { const tr = new T.Mesh(new T.ConeGeometry(rand(0.8, 1.4), rand(3, 5), 6), new T.MeshStandardMaterial({ color: 0x1f3d1f, flatShading: true })); const zz = rand(-65, -5); tr.position.set(pick([-1, 1]) * rand(12, 28), (68 + zz) * 0.28 + 2, zz); scene.add(tr); }
    const zMeshes = [];
    const gun = new T.Group();
    const barrel = new T.Mesh(new T.CylinderGeometry(0.12, 0.16, 2.4, 12), new T.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 })); barrel.rotation.x = Math.PI / 2; barrel.position.z = -1.2; gun.add(barrel);
    const body = new T.Mesh(new T.BoxGeometry(0.6, 0.5, 1.2), new T.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6 })); gun.add(body);
    const flash = new T.Mesh(new T.SphereGeometry(0.25, 8, 8), new T.MeshBasicMaterial({ color: 0xffd23f })); flash.position.z = -2.5; gun.add(flash);
    const cam = new T.PerspectiveCamera(46, W / H, 0.1, 200); cam.position.set(0, 23, 4); cam.lookAt(0, 12, -24);
    gun.position.set(0.55, -0.75, -2.2); gun.scale.setScalar(0.7); cam.add(gun); scene.add(cam);
    this.r = { scene, cam, zMeshes, gun, flash };
    return this.r;
  },
  zMesh(zb) {
    const r = this.r;
    let m = r.zMeshes.find((x) => !x.used);
    if (!m) { m = makeBlocky3D('zumbi' + r.zMeshes.length, ''); m.root.traverse((o) => { if (o.isMesh && !Array.isArray(o.material)) o.material = o.material.clone(); }); m.tag = nameTag(''); m.tag.position.y = 3.2; m.root.add(m.tag); r.scene.add(m.root); r.zMeshes.push(m); }
    m.used = true; m.root.visible = true;
    m.torso.material.color.set('#4d7c0f'); m.head.material.forEach?.((mm, i) => { if (i !== 4) mm.color.set('#84cc16'); });
    const ft = G3.faceTex(zb.user, zb.user.nick); m.head.material[4].map = ft; m.head.material[4].needsUpdate = true;
    m.tag.userData.draw(trim(zb.user.nick, 14));
    return m;
  },
  draw() {
    const r = this.scene3d(), t = performance.now() / 1000;
    if (r) {
      for (const m of r.zMeshes) m.used = false;
      for (const zb of this.z) {
        if (!zb.mesh || !r.zMeshes.includes(zb.mesh)) zb.mesh = this.zMesh(zb);
        zb.mesh.used = true;
        const m = zb.mesh, y = (68 - zb.d) * 0.28;
        m.root.position.set(zb.x, y + 0.1, -zb.d);
        m.root.scale.setScalar(zb.big);
        if (zb.alive) { walkBlocky(m, zb.t, 0.6); m.aL.rotation.x = -1.4; m.aR.rotation.x = -1.4; m.root.rotation.x = 0; }
        else m.root.rotation.x = -Math.min(1.5, (1 - zb.dieT) * 4);
      }
      for (const m of r.zMeshes) if (!m.used) m.root.visible = false; else m.root.visible = true;
      r.gun.rotation.y = -this.aim * 0.8; r.flash.visible = this.muzzle > 0;
      r.cam.position.x = Math.sin(t * 0.5) * 0.3;
      G3.render(r.scene, r.cam);
    } else stageBg('green');
    if (this.hitFlash > 0) { ctx.fillStyle = `rgba(220,38,38,${this.hitFlash * 0.6})`; ctx.fillRect(0, 0, W, H); }
    if (this.buff.shield) { ctx.strokeStyle = 'rgba(56,189,248,.6)'; ctx.lineWidth = 16; ctx.strokeRect(8, 8, W - 16, H - 16); }
    if (this.buff.freeze) { ctx.fillStyle = 'rgba(186,230,253,.18)'; ctx.fillRect(0, 0, W, H); }
    title('COLINA DOS ZUMBIS', W / 2, 52, 42, '#a3e635');
    panel(20, 84, 300, 74, { r: 16 });
    label(`🎖️ ${ZH_RANKS[this.rank()]}`, 40, 106, 20, '#ffc93c', 'left', 900);
    label(`💀 ${this.kills} abates · ${fmtK(this.score)} pts`, 40, 136, 18, '#fff', 'left', 800);
    panel(W - 320, 84, 300, 74, { r: 16 });
    label(`🏠 BASE ${Math.max(0, this.hp)}/${this.s.baseHealth}`, W - 300, 106, 20, '#fff', 'left', 900);
    glossBar(W - 300, 126, 260, 16, this.hp / this.s.baseHealth, this.hp / this.s.baseHealth > 0.4 ? '#22c55e' : '#ef4444');
    const bf = [this.buff.over && '⚡', this.buff.shield && '🛡️', this.buff.freeze && '🧊', ...this.defs.map((d) => ({ turret: '🔫', tesla: '⚡', blade: '🪚', barbedWire: '〰️' }[d.kind]))].filter(Boolean).join(' ');
    if (bf) pill(bf, W / 2, 180, { size: 22, bg: 'rgba(0,0,0,.6)' });
    if (this.s.showLeaderboard) hudBoard([...this.killers.values()].sort((a, b) => b.value - a.value), W - 250, 1000, 230, { title: 'ZUMBIS MAIS ABATIDOS', n: 3, rowH: 28 });
    this.feed.draw(20, 1010);
    if (this.over) { ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(0, 0, W, H); title('A BASE CAIU!', W / 2, H / 2 - 40, 64, '#ef4444'); text(`${this.kills} abates · ${ZH_RANKS[this.rank()]}`, W / 2, H / 2 + 30, 30); }
  },
});

// ---------------- Guerra de Tanques (Tank Battle) ----------------
defineGame({
  id: 'tank-battle', name: 'Guerra de Tanques', genre: 'battle', icon: '🪖', color: '#4d7c0f', three: true,
  desc: 'Os espectadores pegam um tanque e lutam sozinhos num estádio. Presentes chamam ataques aéreos, buracos negros e melhorias.',
  help: '<p>Comente <b>tanque</b> (ou qualquer coisa) para pegar o seu tanque com a sua foto. Eles batalham sozinhos; quem morre volta depois de alguns segundos.</p><p>❤️ Likes recuperam vida. 🎁 Presentes: <b>tanque turbinado</b>, <b>ataque aéreo</b>, <b>buraco negro</b>, <b>tanque maluco</b>.</p>',
  settings: [
    ...ROUND_SETTINGS(5),
    { key: 'maxTanks', type: 'number', label: 'Máximo de tanques', min: 4, max: 40, default: 20 },
    { key: 'minTanks', type: 'number', label: 'Mínimo (completa com bots)', min: 0, max: 20, default: 6 },
    { key: 'respawnDelay', type: 'number', label: 'Segundos para voltar', min: 1, max: 30, default: 5 },
    { key: 'randomEvents', type: 'toggle', label: 'Eventos aleatórios', default: true },
    ...BOARD_SETTINGS(5),
  ],
  actions: [{ id: 'join_battle', label: 'Pegar tanque', icon: '🪖' }, { id: 'hp_surge', label: 'Recuperar vida', icon: '❤️' }, { id: 'power_tank', label: 'Tanque turbinado', icon: '💪' }, { id: 'air_strike', label: 'Ataque aéreo', icon: '✈️' }, { id: 'black_hole', label: 'Buraco negro', icon: '🕳️' }, { id: 'crazy_tank', label: 'Tanque maluco', icon: '🤪' }],
  bindings: [{ action: 'join_battle', trigger: 'comment' }, { action: 'hp_surge', trigger: 'like', likes: 10 }, { action: 'power_tank', trigger: 'gift', minCoins: 1 }, { action: 'black_hole', trigger: 'gift', minCoins: 99 }, { action: 'air_strike', trigger: 'gift', minCoins: 30 }, { action: 'crazy_tank', trigger: 'gift', minCoins: 299 }],
  reset() { this.t = []; this.shells = []; this.fx = []; this.holes = []; this.kills = new Map(); this.ph = new Phases(); this.ph.go('play', this.s.roundMode === 'countdown' ? this.s.roundMinutes * 60 : 1e9); this.feed = new Feed(4); this.evT = 40; if (this.r) for (const m of this.r.pool) m.g.visible = false; },
  sample() { return pick(['tanque', 'bora', 'fogo']); },
  tank(user) {
    const k = user.id || user.nick;
    let tk = this.t.find((x) => x.k === k);
    if (tk) return tk;
    if (this.t.length >= this.s.maxTanks) { const bot = this.t.find((x) => x.user.bot); if (!bot || user.bot) return null; this.t.splice(this.t.indexOf(bot), 1); if (bot.mesh) bot.mesh.used = false; }
    tk = { k, user, x: rand(-14, 14), z: rand(-20, 20), a: rand(0, 7), tur: 0, hp: 100, max: 100, cd: rand(0, 2), dead: 0, power: 1, crazy: 0, color: new THREE.Color().setHSL(hashStr(k) % 360 / 360, 0.6, 0.45) };
    this.t.push(tk);
    return tk;
  },
  onAction(id, a) {
    const tk = this.tank(a.user);
    if (!tk) return;
    if (id === 'hp_surge') tk.hp = Math.min(tk.max, tk.hp + 4 * a.count / 10);
    else if (id === 'power_tank') { tk.power = Math.min(4, tk.power + 0.2 * a.power / 3); tk.max += a.coins * 3; tk.hp = tk.max; this.feed.push(a.user, '💪 tanque turbinado', '#84cc16'); }
    else if (id === 'air_strike') { for (let i = 0; i < 8; i++) { const foe = pick(this.t.filter((x) => x !== tk && !x.dead)); if (foe) this.fx.push({ k: 'bomb', x: foe.x + rand(-2, 2), z: foe.z + rand(-2, 2), t: -i * 0.15, by: tk }); } this.feed.push(a.user, '✈️ ataque aéreo!', '#ffc93c'); }
    else if (id === 'black_hole') { this.holes.push({ x: rand(-10, 10), z: rand(-14, 14), t: 6, by: tk }); this.feed.push(a.user, '🕳️ buraco negro!', '#a855f7'); }
    else if (id === 'crazy_tank') { tk.crazy = 10; this.feed.push(a.user, '🤪 tanque maluco!', '#ff6b8a'); }
  },
  hit(tk, d, by) {
    if (tk.dead) return;
    tk.hp -= d;
    if (tk.hp <= 0) { tk.dead = this.s.respawnDelay; this.fx.push({ k: 'boom', x: tk.x, z: tk.z, t: 0 }); sfx.boom(); if (by && by !== tk && !by.user.bot) this.kills.set(by.k, { user: by.user, value: (this.kills.get(by.k)?.value || 0) + 1 }); }
  },
  update(dt) {
    this.feed.update(dt);
    while (this.t.length < this.s.minTanks) if (!this.tank(botUser('t'))) break;
    if (this.s.randomEvents) { this.evT -= dt; if (this.evT <= 0) { this.evT = rand(40, 80); announcer.show('✈️ BOMBARDEIO GERAL!', '#ffc93c', 2.5, 42); for (let i = 0; i < 10; i++) this.fx.push({ k: 'bomb', x: rand(-15, 15), z: rand(-20, 20), t: -i * 0.2 }); } }
    for (const tk of this.t) {
      if (tk.dead) { tk.dead -= dt; if (tk.dead <= 0) { tk.dead = 0; tk.hp = tk.max; tk.x = rand(-14, 14); tk.z = rand(-20, 20); } continue; }
      tk.crazy = Math.max(0, tk.crazy - dt);
      const foes = this.t.filter((o) => o !== tk && !o.dead);
      const foe = foes.sort((a, b) => Math.hypot(a.x - tk.x, a.z - tk.z) - Math.hypot(b.x - tk.x, b.z - tk.z))[0];
      if (foe) {
        const want = Math.atan2(foe.x - tk.x, foe.z - tk.z), d = Math.hypot(foe.x - tk.x, foe.z - tk.z);
        tk.tur = want;
        const turn = ((want - tk.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        tk.a += clamp(turn, -1.5 * dt, 1.5 * dt) * (tk.crazy ? -3 : 1);
        const sp = (d > 10 ? 4 : d < 6 ? -2 : 0.5) * (tk.crazy ? 2 : 1);
        tk.x = clamp(tk.x + Math.sin(tk.a) * sp * dt, -16, 16); tk.z = clamp(tk.z + Math.cos(tk.a) * sp * dt, -22, 22);
        tk.cd -= dt * (tk.crazy ? 4 : 1);
        if (tk.cd <= 0) { tk.cd = rand(1.4, 2.2); this.shells.push({ x: tk.x, z: tk.z, vx: Math.sin(tk.tur) * 22, vz: Math.cos(tk.tur) * 22, t: 0, by: tk, dmg: 18 * tk.power }); sfx.tone(90, 0.12, 'sawtooth', 0.05); }
      }
      for (const h of this.holes) { const d = Math.hypot(h.x - tk.x, h.z - tk.z); if (d < 9 && h.by !== tk) { tk.x += (h.x - tk.x) / d * 6 * dt; tk.z += (h.z - tk.z) / d * 6 * dt; if (d < 1.5) this.hit(tk, 60 * dt, h.by); } }
    }
    for (const s of this.shells) { s.t += dt; s.x += s.vx * dt; s.z += s.vz * dt; for (const tk of this.t) if (tk !== s.by && !tk.dead && Math.hypot(tk.x - s.x, tk.z - s.z) < 1.4) { this.hit(tk, s.dmg, s.by); s.t = 99; this.fx.push({ k: 'spark', x: s.x, z: s.z, t: 0 }); } }
    this.shells = this.shells.filter((s) => s.t < 1.5);
    for (const f of this.fx) { f.t += dt; if (f.k === 'bomb' && f.t >= 0.5 && !f.done) { f.done = true; sfx.boom(); for (const tk of this.t) if (Math.hypot(tk.x - f.x, tk.z - f.z) < 4) this.hit(tk, 70, f.by); } }
    this.fx = this.fx.filter((f) => f.t < 1.2);
    for (const h of this.holes) h.t -= dt;
    this.holes = this.holes.filter((h) => h.t > 0);
    if (this.ph.update(dt)) {
      if (this.ph.name === 'play') { const w = [...this.kills.values()].sort((a, b) => b.value - a.value)[0]; this.champ = w; if (w) scores.add(this.id, w.user, w.value, 1); confetti(140); sfx.win(); this.ph.go('end', 7); }
      else this.reset();
    }
  },
  scene3d() {
    if (this.r || !G3.ready) return this.r;
    const T = THREE, scene = new T.Scene();
    scene.background = G3.skyTex('#0ea5e9', '#7dd3fc', '#e0f2fe');
    G3.lights(scene, { hemi: 1, sun: 2.4, pos: [20, 40, 10] });
    const pitch = new T.Mesh(new T.PlaneGeometry(40, 52), new T.MeshStandardMaterial({ map: G3.tex(256, 256, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#2f8f3a' : '#36a244'; g.fillRect(0, i * 32, 256, 32); } g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3; g.strokeRect(10, 10, 236, 236); g.beginPath(); g.moveTo(10, 128); g.lineTo(246, 128); g.stroke(); g.beginPath(); g.arc(128, 128, 30, 0, 7); g.stroke(); }) }));
    pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true; scene.add(pitch);
    // Arquibancadas
    for (const [x, z, w, d] of [[0, -29, 44, 4], [0, 29, 44, 4], [-23, 0, 4, 60], [23, 0, 4, 60]]) { const st = new T.Mesh(new T.BoxGeometry(w, 3, d), new T.MeshStandardMaterial({ color: 0x64748b })); st.position.set(x, 1.5, z); scene.add(st); }
    const pool = [];
    const shellM = new T.InstancedMesh(new T.SphereGeometry(0.2, 8, 6), new T.MeshBasicMaterial({ color: 0xffd23f }), 120); shellM.frustumCulled = false; scene.add(shellM);
    const boomM = new T.InstancedMesh(new T.SphereGeometry(1, 12, 8), new T.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.7 }), 40); boomM.frustumCulled = false; scene.add(boomM);
    const holeM = new T.Mesh(new T.TorusGeometry(2, 0.6, 12, 32), new T.MeshBasicMaterial({ color: 0x7c3aed })); holeM.rotation.x = Math.PI / 2; scene.add(holeM);
    const cam = new T.PerspectiveCamera(48, W / H, 0.1, 200); cam.position.set(0, 52, 30); cam.lookAt(0, 0, 2);
    this.r = { scene, cam, pool, shellM, boomM, holeM, d: new T.Object3D() };
    return this.r;
  },
  tankMesh(tk) {
    const T = THREE, r = this.r;
    let m = r.pool.find((x) => !x.used);
    if (!m) {
      const g = new T.Group(), mat = new T.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.6 });
      const hull = new T.Mesh(new T.BoxGeometry(1.8, 0.7, 2.6), mat); hull.position.y = 0.6; hull.castShadow = true; g.add(hull);
      const tr = new T.Mesh(new T.BoxGeometry(2.1, 0.5, 2.8), new T.MeshStandardMaterial({ color: 0x1f2937 })); tr.position.y = 0.35; g.add(tr);
      const tur = new T.Group(); tur.position.y = 1.15; g.add(tur);
      const dome = new T.Mesh(new T.CylinderGeometry(0.6, 0.7, 0.5, 16), mat); tur.add(dome);
      const gun = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 1.8, 10), new T.MeshStandardMaterial({ color: 0x111827 })); gun.rotation.x = Math.PI / 2; gun.position.z = 1; tur.add(gun);
      const face = new T.Sprite(new T.SpriteMaterial({ map: G3.faceTex('', '?', true), depthTest: false })); face.scale.set(1.6, 1.6, 1); face.position.y = 2.6; face.renderOrder = 15; g.add(face);
      r.scene.add(g);
      m = { g, mat, tur, face, hpBar: null };
      r.pool.push(m);
    }
    m.used = true; m.g.visible = true;
    m.mat.color.copy(tk.color);
    m.face.material.map = G3.faceTex(tk.user, tk.user.nick, true); m.face.material.needsUpdate = true;
    return m;
  },
  draw() {
    const r = this.scene3d();
    if (r) {
      for (const m of r.pool) m.used = false;
      for (const tk of this.t) {
        if (!tk.mesh || !r.pool.includes(tk.mesh) || tk.mesh.owner !== tk) { tk.mesh = this.tankMesh(tk); tk.mesh.owner = tk; }
        tk.mesh.used = true;
        const m = tk.mesh;
        m.g.visible = !tk.dead;
        m.g.position.set(tk.x, 0, tk.z); m.g.rotation.y = tk.a; m.tur.rotation.y = tk.tur - tk.a;
        m.g.scale.setScalar(1 + (tk.power - 1) * 0.25);
      }
      for (const m of r.pool) if (!m.used) { m.g.visible = false; m.owner = null; }
      this.shells.forEach((s, i) => { r.d.position.set(s.x, 1.2, s.z); r.d.scale.setScalar(1); r.d.updateMatrix(); r.shellM.setMatrixAt(i, r.d.matrix); });
      for (let i = this.shells.length; i < 120; i++) { r.d.position.set(0, -99, 0); r.d.updateMatrix(); r.shellM.setMatrixAt(i, r.d.matrix); }
      r.shellM.instanceMatrix.needsUpdate = true;
      this.fx.slice(0, 40).forEach((f, i) => { const k = f.t < 0 ? 0 : f.k === 'bomb' ? (f.t > 0.5 ? (f.t - 0.5) * 6 : 0.3) : f.t * (f.k === 'boom' ? 5 : 2); r.d.position.set(f.x, f.k === 'bomb' && f.t < 0.5 ? 20 - f.t * 40 : 1, f.z); r.d.scale.setScalar(Math.max(0.01, k)); r.d.updateMatrix(); r.boomM.setMatrixAt(i, r.d.matrix); });
      for (let i = Math.min(40, this.fx.length); i < 40; i++) { r.d.position.set(0, -99, 0); r.d.updateMatrix(); r.boomM.setMatrixAt(i, r.d.matrix); }
      r.boomM.instanceMatrix.needsUpdate = true;
      const h = this.holes[0]; r.holeM.visible = Boolean(h); if (h) { r.holeM.position.set(h.x, 0.2, h.z); r.holeM.rotation.z += 0.1; }
      G3.render(r.scene, r.cam);
      // Barras de vida (2D por cima, projetadas)
      for (const tk of this.t) {
        if (tk.dead || !tk.mesh) continue;
        const v = new THREE.Vector3(tk.x, 3.6, tk.z).project(r.cam), x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 24, y, 48, 6); ctx.fillStyle = tk.hp / tk.max > 0.4 ? '#22c55e' : '#ef4444'; ctx.fillRect(x - 24, y, 48 * clamp(tk.hp / tk.max, 0, 1), 6);
        if (!tk.user.bot) label(trim(tk.user.nick, 10), x, y + 16, 12, '#fff', 'center', 800);
      }
    } else stageBg('green');
    title('GUERRA DE TANQUES', W / 2, 52, 42);
    pill(this.s.roundMode === 'countdown' && this.ph.name === 'play' ? `⏱ ${fmtTime(this.ph.t)} · ${this.t.length} tanques` : `${this.t.length} tanques`, W / 2, 96, { size: 16, bg: 'rgba(0,0,0,.6)' });
    if (this.s.showLeaderboard) hudBoard([...this.kills.values()].sort((a, b) => b.value - a.value), W - 250, 1000, 230, { title: 'ABATES', n: 3, rowH: 28 });
    this.feed.draw(20, 1010);
    if (this.ph.name === 'end' && this.champ) winnerSpot(this.champ.user, 560, { title: 'COMANDANTE' });
  },
});

// ---------------- Pancada no Boneco (Tung Tung Smash) ----------------
// Boneco de madeira original (sem personagem de terceiros) que apanha de 20 armas, das menores às maiores.
const SMASH_WEAPONS = [
  [1, '🥢', 'Palitinho'], [1, '🧦', 'Meia molhada'], [5, '🥖', 'Baguete'], [5, '🐟', 'Peixe'], [10, '🍳', 'Frigideira'], [10, '🏏', 'Taco'],
  [30, '🔨', 'Martelo'], [30, '🪓', 'Machado'], [99, '⚾', 'Taco de beisebol'], [99, '🛹', 'Skate'], [199, '🚲', 'Bicicleta'], [299, '🛞', 'Pneu'],
  [499, '🪨', 'Pedregulho'], [999, '🚗', 'Carro'], [1999, '🚌', 'Ônibus'], [2999, '🚂', 'Trem'], [4999, '✈️', 'Avião'], [9999, '🚀', 'Foguete'], [19999, '☄️', 'Meteoro'], [29999, '🕳️', 'Buraco negro'],
];
defineGame({
  id: 'tung-tung-smash', name: 'Pancada no Boneco', genre: 'battle', icon: '🪵', color: '#a16207', three: true,
  desc: 'Os espectadores destroem um boneco de madeira com 20 armas. Presentes maiores trazem armas maiores, de um palitinho até um buraco negro.',
  help: '<p>Todo mundo bate no <b>boneco de madeira</b>! 💬 comentários, ❤️ likes, ⭐ seguir e 🔁 compartilhar dão pancadinhas. 🎁 Presentes trazem armas: quanto mais moedas, maior a arma (até o 🕳️ buraco negro com 30 mil).</p><p>O placar mostra quem causou mais dano.</p>',
  settings: [
    { key: 'toughness', type: 'select', label: 'Resistência do boneco', options: [['500', 'Fraco'], ['2000', 'Normal'], ['8000', 'Duro']], default: '2000' },
    { key: 'showScoreboard', type: 'toggle', label: 'Mostrar placar de dano', default: true },
    { key: 'scoreboardSize', type: 'number', label: 'Quantos no placar', min: 3, max: 10, default: 5 },
    { key: 'showDamagePopups', type: 'toggle', label: 'Mostrar números de dano', default: true },
    { key: 'screenShake', type: 'toggle', label: 'Tela tremendo', default: true },
  ],
  actions: [{ id: 'smash', label: 'Pancada', icon: '💥' }],
  bindings: [{ action: 'smash', trigger: 'comment' }, { action: 'smash', trigger: 'like', likes: 10 }, { action: 'smash', trigger: 'share' }, { action: 'smash', trigger: 'follow' }, { action: 'smash', trigger: 'gift', minCoins: 1 }],
  reset() { this.hp = Number(this.s.toughness); this.max = this.hp; this.dmg = new Map(); this.hits = []; this.wob = 0; this.wv = 0; this.shake = 0; this.ko = 0; this.round = (this.round || 0) + 1; this.feed = new Feed(3); },
  sample() { return pick(['bate', 'pancada', 'toma']); },
  onAction(id, a) {
    if (this.ko) return;
    const c = a.gift ? a.coins : a.ev?.type === 'chat' ? 1 : 2;
    let w = SMASH_WEAPONS[0];
    for (const x of SMASH_WEAPONS) if (c >= x[0]) w = x;
    if (!a.gift) w = SMASH_WEAPONS[randInt(0, 1)];
    const d = Math.round(3 + c * 2.2);
    this.hits.push({ e: w[1], name: w[2], d, user: a.user, t: 0, side: Math.random() < 0.5 ? -1 : 1, big: Math.min(3, 1 + Math.log10(c + 1)) });
    if (a.gift && c >= 30) this.feed.push(a.user, `${w[1]} ${w[2]}! -${fmtK(d)}`, '#ffc93c');
  },
  update(dt) {
    this.feed.update(dt);
    this.wv += -this.wob * 40 * dt; this.wv *= 1 - dt * 3; this.wob += this.wv * dt;
    this.shake = Math.max(0, this.shake - dt);
    if (this.ko) { this.ko -= dt; if (this.ko <= 0) this.reset(); return; }
    for (const h of this.hits) {
      h.t += dt * 2.2;
      if (h.t >= 1 && !h.done) {
        h.done = true;
        this.hp -= h.d; this.wv += h.side * (2 + h.big * 3); this.shake = Math.min(1, 0.2 + h.big * 0.2);
        const k = h.user.id || h.user.nick; this.dmg.set(k, { user: h.user, value: (this.dmg.get(k)?.value || 0) + h.d });
        if (this.s.showDamagePopups) floatText(`-${fmtK(h.d)}`, W / 2 + rand(-80, 80), 520, '#fde047', 26 + h.big * 8);
        sfx.tone(120 + Math.random() * 60, 0.1, 'square', 0.1);
        if (this.hp <= 0) { this.ko = 6; sfx.boom(); confetti(160); const top = [...this.dmg.values()].sort((a, b) => b.value - a.value)[0]; if (top) { scores.add(this.id, top.user, 1, 1); voice.say(`O boneco quebrou! ${top.user.nick} deu mais dano.`); } }
      }
    }
    this.hits = this.hits.filter((h) => h.t < 1.4);
  },
  scene3d() {
    if (this.r || !G3.ready) return this.r;
    const T = THREE, scene = new T.Scene();
    scene.background = G3.skyTex('#1e1b4b', '#4c1d95', '#f97316');
    G3.lights(scene, { hemi: 0.9, sun: 2.4, pos: [8, 20, 14] });
    const floor = new T.Mesh(new T.CircleGeometry(20, 48), new T.MeshStandardMaterial({ color: 0x3b2a1a })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const pod = new T.Mesh(new T.CylinderGeometry(3, 3.4, 1, 32), new T.MeshStandardMaterial({ color: 0x78350f })); pod.position.y = 0.5; pod.receiveShadow = true; scene.add(pod);
    const dummy = new T.Group(); dummy.position.y = 1;
    const wood = new T.MeshStandardMaterial({ map: G3.tex(64, 128, (g) => { g.fillStyle = '#b07a43'; g.fillRect(0, 0, 64, 128); g.strokeStyle = 'rgba(80,40,10,.35)'; g.lineWidth = 2; for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(rand(0, 64), 0); g.bezierCurveTo(rand(0, 64), 40, rand(0, 64), 80, rand(0, 64), 128); g.stroke(); } }), roughness: 0.8 });
    const body = new T.Mesh(new T.CylinderGeometry(1.1, 1.3, 4.2, 24), wood); body.position.y = 2.1; body.castShadow = true; dummy.add(body);
    const head = new T.Mesh(new T.SphereGeometry(1.2, 24, 16), wood); head.position.y = 5.1; head.castShadow = true; dummy.add(head);
    const faceT = G3.tex(256, 256, (g) => { g.fillStyle = '#111'; g.beginPath(); g.arc(80, 110, 18, 0, 7); g.arc(176, 110, 18, 0, 7); g.fill(); g.lineWidth = 12; g.strokeStyle = '#111'; g.beginPath(); g.arc(128, 150, 50, 0.15, Math.PI - 0.15); g.stroke(); g.fillStyle = 'rgba(230,80,80,.5)'; g.beginPath(); g.arc(56, 160, 20, 0, 7); g.arc(200, 160, 20, 0, 7); g.fill(); });
    const face = new T.Mesh(new T.SphereGeometry(1.21, 24, 16, Math.PI / 2 - 0.9, 1.8, 0.8, 1.4), new T.MeshStandardMaterial({ map: faceT, transparent: true })); face.position.y = 5.1; dummy.add(face);
    for (const s of [-1, 1]) { const arm = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 2.4, 12), wood); arm.position.set(s * 1.6, 3.2, 0); arm.rotation.z = s * 0.9; arm.castShadow = true; dummy.add(arm); }
    scene.add(dummy);
    const cam = new T.PerspectiveCamera(42, W / H, 0.1, 200); cam.position.set(0, 5, 16); cam.lookAt(0, 3.6, 0);
    this.r = { scene, cam, dummy, face, faceT };
    return this.r;
  },
  draw() {
    const r = this.scene3d();
    ctx.save();
    if (this.shake > 0 && this.s.screenShake) ctx.translate(rand(-10, 10) * this.shake, rand(-10, 10) * this.shake);
    if (r) {
      r.dummy.rotation.z = this.wob * 0.25; r.dummy.rotation.x = this.ko ? Math.min(1.5, (6 - this.ko) * 2) : 0;
      r.dummy.position.y = 1 + (this.ko ? -Math.min(1, 6 - this.ko) * 0.5 : 0);
      G3.render(r.scene, r.cam);
    } else stageBg('purple');
    for (const h of this.hits) {
      const k = Math.min(1, h.t), x = W / 2 + h.side * (360 - 300 * k), y = 300 + 250 * k - Math.sin(k * Math.PI) * 120;
      ctx.save(); ctx.translate(x, y); ctx.rotate(h.side * (k * 5));
      label(h.e, 0, 0, 60 * h.big, '#fff', 'center', 400); ctx.restore();
      if (h.t > 1) label('💥', W / 2 + h.side * 60, 560, 90 + h.big * 30, '#fff', 'center', 400);
    }
    ctx.restore();
    title('PANCADA NO BONECO', W / 2, 52, 42, '#fbbf24');
    panel(60, 90, W - 120, 56, { r: 16 });
    glossBar(80, 108, W - 160, 22, this.hp / this.max, this.hp / this.max > 0.35 ? '#f59e0b' : '#ef4444');
    label(`${fmtK(Math.max(0, this.hp))} / ${fmtK(this.max)} · rodada ${this.round}`, W / 2, 120, 14, '#111', 'center', 900);
    if (this.s.showScoreboard) hudBoard([...this.dmg.values()].sort((a, b) => b.value - a.value), W - 260, 170, 240, { title: 'MAIS DANO', n: this.s.scoreboardSize, rowH: 30, bg: 'rgba(8,10,20,.7)' });
    label('comente, curta e mande presente para bater', W / 2, 1180, 18, '#fff', 'center', 800);
    this.feed.draw(20, 1000);
    if (this.ko) title('QUEBROU!', W / 2, 460, 90, '#ef4444');
  },
});

// ---------------- MMA dos Países (MMA Clash) ----------------
defineGame({
  id: 'mma-clash', name: 'MMA dos Países', genre: 'battle', icon: '🥊', color: '#dc2626', three: true,
  desc: 'Espectadores mandam presentes para colocar um lutador do seu país no octógono, e as moedas viram a vida dele. As vitórias sobem no ranking de países.',
  help: '<p>Comente o <b>nome do seu país</b> e mande um 🎁 presente: entra um lutador com a sua foto e a bandeira, e as moedas viram a vida dele. Os dois mais fortes da fila lutam; quem vence fica.</p><p>As vitórias contam no <b>ranking de países</b>.</p>',
  settings: [
    { key: 'roundDuration', type: 'number', label: 'Segundos por luta', min: 10, max: 300, default: 60 },
    { key: 'hpPerCoin', type: 'number', label: 'Vida por moeda', min: 1, max: 100, default: 10 },
    { key: 'maxHpCap', type: 'number', label: 'Vida máxima', min: 100, max: 1000000, default: 50000 },
    { key: 'damagePerHit', type: 'number', label: 'Dano por golpe', min: 1, max: 500, default: 25 },
    { key: 'houseFighterEnabled', type: 'toggle', label: 'Lutador da casa quando não há desafiantes', default: true },
    { key: 'houseFighterCountry', type: 'country', label: 'País do lutador da casa', default: 'BR' },
    { key: 'tauntsEnabled', type: 'toggle', label: 'Provocações em voz alta', default: true },
    ...BOARD_SETTINGS(5),
  ],
  actions: [{ id: 'spawn_fighter', label: 'Colocar lutador', icon: '🥊' }],
  bindings: [{ action: 'spawn_fighter', trigger: 'gift', minCoins: 1 }],
  init() { loadData('countries').then((d) => (this.countries = d)); },
  reset() { this.q = []; this.f = [null, null]; this.ph = new Phases(); this.ph.go('wait', 1); this.wins = new Map(); this.picks = new Teams(); this.act = [{}, {}]; this.feed = new Feed(3); this.tauntT = 15; },
  sample() { return pick(['brasil', 'portugal', 'mexico', 'argentina']); },
  onChat(ev) { const c = this.countries?.find((k) => answerMatch(ev.text, [k.name, ...k.alt, k.code])); if (c) this.picks.set(ev.user, c.code); },
  onAction(id, a) {
    const code = this.picks.get(a.user) || this.s.houseFighterCountry || 'BR';
    const k = a.user.id || a.user.nick;
    let e = [...this.f, ...this.q].find((x) => x && x.k === k);
    const add = Math.min(this.s.maxHpCap, a.coins * this.s.hpPerCoin);
    if (e) { e.hp = Math.min(this.s.maxHpCap, e.hp + add); e.max = Math.max(e.max, e.hp); }
    else { e = { k, user: a.user, code, hp: add + 100, max: add + 100 }; this.q.push(e); this.q.sort((x, y) => y.hp - x.hp); }
    this.feed.push(a.user, `🥊 ${this.cname(code)} +${fmtK(add)} vida`, '#ffc93c');
  },
  cname(code) { return this.countries?.find((c) => c.code === code)?.name || code; },
  update(dt) {
    this.feed.update(dt);
    for (const a of this.act) { a.t = (a.t || 0) + dt; a.hit = Math.max(0, (a.hit || 0) - dt * 3); }
    if (this.ph.name === 'wait') {
      for (let i = 0; i < 2; i++) if (!this.f[i]) { if (this.q.length) this.f[i] = this.q.shift(); else if (this.s.houseFighterEnabled && !this.f[1 - i]?.house) this.f[i] = { k: 'house' + Date.now() + i, user: { nick: 'Lutador da casa', pic: '', id: 'house', bot: true }, code: this.s.houseFighterCountry, hp: 300, max: 300, house: true }; }
      if (this.f[0] && this.f[1]) { this.ph.go('fight', this.s.roundDuration); this.rebuild = true; sfx.confirm(); voice.say(`${this.cname(this.f[0].code)} contra ${this.cname(this.f[1].code)}!`); }
      return;
    }
    if (this.ph.name === 'fight') {
      this.hitT = (this.hitT || 0) - dt;
      if (this.hitT <= 0) {
        this.hitT = rand(0.4, 0.8);
        const i = Math.random() < 0.5 ? 0 : 1, atk = this.f[i], def = this.f[1 - i];
        this.act[i] = { kind: pick(['jab', 'cross', 'kick']), t: 0, dur: 0.4 };
        const dmg = Math.round(this.s.damagePerHit * rand(0.6, 1.5) * (1 + Math.log10(atk.max) * 0.3));
        def.hp -= dmg; this.act[1 - i].hit = 1;
        floatText(`-${dmg}`, W / 2 + (i ? -140 : 140), 520, '#fde047', 28);
        sfx.tone(160, 0.08, 'sawtooth', 0.08);
        if (def.hp <= 0) this.endFight(i);
      }
      if (this.s.tauntsEnabled) { this.tauntT -= dt; if (this.tauntT <= 0) { this.tauntT = rand(15, 30); voice.say(pick(['Que pancadaria!', 'Isso vai doer!', 'Quem vai cair primeiro?', 'Manda presente para dar mais vida!'])); } }
      if (this.ph.update(dt)) this.endFight(this.f[0].hp / this.f[0].max >= this.f[1].hp / this.f[1].max ? 0 : 1);
    } else if (this.ph.update(dt)) { this.f[1 - this.winner] = null; const w = this.f[this.winner]; w.hp = Math.max(w.hp, w.max * 0.6); this.ph.go('wait', 1); }
  },
  endFight(i) {
    if (this.ph.name !== 'fight') return;
    this.winner = i; const w = this.f[i];
    this.wins.set(w.code, (this.wins.get(w.code) || 0) + 1);
    if (!w.user.bot) scores.add(this.id, w.user, 1, 1);
    this.act[1 - i].ko = true; this.act[i].winT = 0.01;
    sfx.win(); confetti(120); voice.say(`Vitória de ${this.cname(w.code)}!`);
    this.ph.go('ko', 4);
  },
  scene3d() {
    if (this.r || !G3.ready) return this.r;
    const T = THREE, scene = new T.Scene();
    scene.background = new T.Color('#08080f');
    G3.lights(scene, { hemi: 0.6, sun: 2.4, pos: [0, 30, 10] });
    const spot = new T.SpotLight(0xffffff, 300, 60, 0.6, 0.5); spot.position.set(0, 20, 4); scene.add(spot);
    const mat = new T.Mesh(new T.CylinderGeometry(10, 10, 0.6, 8), new T.MeshStandardMaterial({ map: G3.tex(256, 256, (g) => { g.fillStyle = '#1f2937'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#dc2626'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 60, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,255,255,.08)'; g.font = '900 40px Barlow'; g.textAlign = 'center'; g.fillText('MMA', 128, 140); }) }));
    mat.position.y = -0.3; mat.receiveShadow = true; scene.add(mat);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8, p = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 3.4), new T.MeshStandardMaterial({ color: 0x111827 })); p.position.set(Math.cos(a) * 9.6, 1.4, Math.sin(a) * 9.6); scene.add(p); }
    const fence = new T.Mesh(new T.CylinderGeometry(9.6, 9.6, 3, 8, 1, true), new T.MeshBasicMaterial({ color: 0x9ca3af, wireframe: true, transparent: true, opacity: 0.25 })); fence.position.y = 1.4; scene.add(fence);
    const cam = new T.PerspectiveCamera(40, W / H, 0.1, 200); cam.position.set(0, 4.2, 15); cam.lookAt(0, 2.2, 0);
    this.r = { scene, cam, fighters: [null, null], flags: [null, null] };
    return this.r;
  },
  buildFighters() {
    const r = this.r;
    for (let i = 0; i < 2; i++) {
      const e = this.f[i];
      if (!e) continue;
      if (r.fighters[i]) r.scene.remove(r.fighters[i].root);
      const fh = makeHuman({ color: i ? '#dc2626' : '#2563eb', gloves: true, photo: e.user, seed: e.user.nick, shorts: '#111827' });
      fh.root.rotation.y = i ? -Math.PI / 2 : Math.PI / 2;
      r.scene.add(fh.root); r.fighters[i] = fh;
      const flagT = G3.tex(128, 80, (g) => { const img = getImg(flagUrl(e.code, 160)); if (img) g.drawImage(img, 0, 0, 128, 80); else { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 80); } });
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.44), new THREE.MeshBasicMaterial({ map: flagT })); fl.position.set(0, 0.55, 0.35); fh.torso.add(fl);
    }
    this.rebuild = false;
  },
  draw() {
    const r = this.scene3d(), t = performance.now() / 1000;
    if (r) {
      if (this.rebuild) this.buildFighters();
      for (let i = 0; i < 2; i++) {
        const fh = r.fighters[i], a = this.act[i];
        if (!fh || !this.f[i]) { if (fh) fh.root.visible = false; continue; }
        fh.root.visible = true;
        const bob = Math.sin(t * 6 + i) * 0.04;
        const p = { torso: [0.15, 0, 0], head: [-0.05, 0, 0], y: -0.08 + bob, sL: [-1.15, 0, 0.35], eL: [-2.0], sR: [-1.0, 0, -0.35], eR: [-2.1], hL: [-0.35, 0, 0.12], kL: [0.55], hR: [0.25, 0, -0.12], kR: [0.45] };
        let lunge = 0;
        if (a.kind && a.t < a.dur) { const k = a.t / a.dur, hk = Math.sin(k * Math.PI); lunge = hk * 0.5; if (a.kind === 'jab') { p.sL = [-1.55 * hk - 1.15 * (1 - hk), 0, 0.15]; p.eL = [-2 * (1 - hk) - 0.05]; } else if (a.kind === 'cross') { p.sR = [-1.6 * hk - 1 * (1 - hk), 0, -0.1]; p.eR = [-2.1 * (1 - hk) - 0.05]; p.torso = [0.2, -0.7 * hk, 0]; } else { p.hR = [-1.6 * hk, 0, -0.2]; p.kR = [0.2 * (1 - hk)]; p.torso = [-0.35 * hk, 0, 0]; } }
        if (a.hit > 0) { p.torso = [-0.45 * a.hit, 0.2 * a.hit, 0]; p.head = [-0.6 * a.hit, 0.3 * a.hit, 0]; }
        if (a.winT) { p.sL = [-2.9, 0, 0.3]; p.sR = [-2.9, 0, -0.3]; p.eL = [-0.3]; p.eR = [-0.3]; p.y = Math.abs(Math.sin(t * 6)) * 0.15; }
        poseHuman(fh, p);
        fh.root.position.x = (i ? 1.5 : -1.5) + (i ? -lunge : lunge);
        fh.root.rotation.z = a.ko && this.ph.name === 'ko' ? (i ? 1 : -1) * Math.min(1.5, (4 - this.ph.t) * 3) : 0;
      }
      r.cam.position.x = Math.sin(t * 0.25) * 3; r.cam.lookAt(0, 2.2, 0);
      G3.render(r.scene, r.cam);
    } else stageBg('red');
    title('MMA DOS PAÍSES', W / 2, 52, 44, '#f87171');
    this.f.forEach((e, i) => {
      if (!e) return;
      const x = i ? W - 30 - 300 : 30;
      slant(x, 90, 300, 76, { fill: 'rgba(8,10,20,.85)', skew: 14, border: i ? '#ef4444' : '#3b82f6' });
      const img = getImg(flagUrl(e.code, 80)); if (img) ctx.drawImage(img, i ? x + 250 : x + 16, 100, 34, 22);
      label(trim(e.user.nick, 12), i ? x + 240 : x + 60, 112, 18, '#fff', i ? 'right' : 'left', 900);
      glossBar(x + 16, 134, 268, 16, e.hp / e.max, e.hp / e.max > 0.4 ? '#22c55e' : '#ef4444');
      label(fmtK(Math.max(0, e.hp)), i ? x + 284 : x + 16, 160, 12, '#fff', i ? 'right' : 'left', 800);
    });
    if (this.ph.name === 'fight') pill(fmtTime(this.ph.t), W / 2, 128, { size: 20, bg: '#0b0f1c' });
    if (this.ph.name === 'ko') title('NOCAUTE!', W / 2, 420, 84, '#ef4444');
    label(`FILA (${this.q.length}) · comente o país e mande presente`, 30, 1000, 15, '#fca5a5', 'left', 900);
    this.q.slice(0, 7).forEach((e, i) => { avatar(e.user, 56 + i * 62, 1044, 24, '#fff'); const img = getImg(flagUrl(e.code, 80)); if (img) ctx.drawImage(img, 44 + i * 62, 1070, 24, 16); });
    if (this.s.showLeaderboard) { const rows = [...this.wins.entries()].sort((a, b) => b[1] - a[1]).map(([code, v]) => ({ nick: this.cname(code), pic: flagUrl(code, 80), value: v })); hudBoard(rows, W - 250, 990, 230, { title: 'PAÍSES', n: this.s.leaderboardSize, rowH: 28 }); }
    this.feed.draw(20, 200);
  },
});
