'use strict';

// Combate 3D: dois lutadores 3D num ringue, com a foto de cada um no rosto (configurável).
// O público escolhe o lado comentando 1 ou 2; comentários são jabs e presentes viram golpes maiores.
const MOVES = {
  jab: { name: 'JAB', dmg: 1, color: '#ffffff', anim: 'jab', time: 0.28 },
  1: { name: 'DIRETO', dmg: 3, color: '#ffd23f', anim: 'cross', time: 0.34 },
  2: { name: 'CHUTE', dmg: 8, color: '#ff8a3d', anim: 'kick', time: 0.5 },
  3: { name: 'BOLA DE ENERGIA', dmg: 20, color: '#00e5ff', anim: 'fireball', time: 1.0 },
  4: { name: 'GOLPE FINAL', dmg: 40, color: '#00e5ff', anim: 'upper', time: 1.0 },
  special: { name: 'ESPECIAL DA TORCIDA', dmg: 10, color: '#00e5ff', anim: 'cross', time: 0.4 },
};
const FIGHT_X = 1.15;
const FACE_TURN = 0.8; // vira os lutadores três quartos para a câmera, para o rosto aparecer

registerGame(withConfig({
  id: 'combate',
  name: 'Combate 3D',
  icon: '🥊',
  help: '<p>Comente <b>1</b> ou <b>2</b> (ou o nome) para escolher seu lutador. Depois, cada comentário é um jab (1 a cada 2s).</p><p>1–9 🪙 Direto · 10–99 🪙 Chute · 100–999 🪙 Bola de energia · 1.000+ 🪙 Golpe final em câmera lenta. O dano é 3 × √moedas: Rosa tira 3, Rosquinha 16, Mãos em coração 30, 1.000 🪙 tira 95. ❤️ Likes, ⭐ seguir (+30%) e 🔁 compartilhar (+60%) enchem o especial da torcida.</p>' + TIER_HELP + '<p>Coloque a <b>foto do rosto</b> de cada lutador em <b>Configurar</b>.</p>',
  cd: new Cooldown(2000),
  roundsWon: [0, 0],
  round: 1,
  reset() {
    this.hp = [this.config.hp, this.config.hp];
    this.ghost = [this.config.hp, this.config.hp];
    this.meter = [0, 0];
    this.side = this.side || new Map();
    this.fans = this.fans || [0, 0];
    this.queue = [];
    this.time = 99;
    this.phase = 'intro';
    this.introT = 2.2;
    this.endT = 0;
    this.winner = -1;
    this.hitters = new Map();
    this.log = [];
    this.slowmo = 0;
    this.cool = 0;
    this.shake = 0;
    this.flash = 0;
    this.act = [this.newAct(), this.newAct()];
    if (this.r) this.placeFighters();
  },
  newAct() { return { kind: null, t: 0, dur: 0, hit: 0, ko: 0, push: 0, winT: 0 }; },
  applyConfig(cfg) {
    if (!cfg?.items?.length) return;
    this.config = cfg;
    store.set('cfg:combate', cfg);
    if (this.r) { for (const f of this.r.fighters) this.r.scene.remove(f.root); this.r.fighters = this.config.items.map((it, i) => this.buildFighter(it, i)); }
    this.side = new Map(); this.fans = [0, 0];
    this.reset();
  },
  renderSettings(el, save) {
    renderItemsSettings(el, structuredClone(this.config), {
      min: 2, max: 2, itemLabel: 'Lutador',
      extras: [{ key: 'hp', label: 'Vida de cada lutador', min: 20, max: 100000 }],
    }, (cfg) => { this.applyConfig(cfg); save(this.config); });
  },
  sample() { return Math.random() < 0.3 ? String(randInt(1, 2)) : pick(['bate!', 'vai', 'pow']); },
  addLog(user, msg, color) { this.log.unshift({ user, msg, color, t: 6 }); this.log.length = Math.min(this.log.length, 3); },

  // ---------- Cena 3D ----------
  init3d() {
    if (this.r || !THREE) return;
    const T = THREE;
    const scene = new T.Scene();
    scene.background = new T.Color(0x05060a);
    scene.fog = new T.Fog(0x05060a, 14, 40);
    const camera = new T.PerspectiveCamera(42, W / H, 0.1, 200);
    scene.add(new T.HemisphereLight(0x8899bb, 0x110a08, 0.6));
    // Holofotes em cima do ringue
    const spots = [];
    for (const [x, z, c] of [[-4, 3, 0xffffff], [4, 3, 0xffffff], [0, -4, 0xfff1d6]]) {
      const sp = new T.SpotLight(c, 120, 30, 0.55, 0.5, 1.6);
      sp.position.set(x, 11, z); sp.target.position.set(0, 0, 0);
      sp.castShadow = x === 0; sp.shadow.mapSize.set(1024, 1024);
      scene.add(sp, sp.target); spots.push(sp);
      const cone = new T.Mesh(new T.ConeGeometry(3.2, 10, 24, 1, true), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.045, depthWrite: false, side: T.DoubleSide }));
      cone.position.set(x * 0.6, 6, z * 0.6); scene.add(cone);
    }
    // Ringue: base, lona, cantos e cordas
    const apron = G3.tex(512, 64, (g) => { g.fillStyle = '#0d1b3d'; g.fillRect(0, 0, 512, 64); g.fillStyle = '#ff2e63'; g.fillRect(0, 54, 512, 10); g.fillStyle = '#fff'; g.font = 'italic 900 40px "Barlow Condensed", Impact'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LIVE FIGHT NIGHT', 256, 28); });
    const base = new T.Mesh(new T.BoxGeometry(9, 1.2, 9), [apron, apron, null, null, apron, apron].map((m) => (m ? new T.MeshStandardMaterial({ map: m, roughness: 0.7 }) : new T.MeshStandardMaterial({ color: 0x0d1b3d }))));
    base.position.y = -0.6; base.receiveShadow = true; scene.add(base);
    const canvasTex = G3.tex(512, 512, (g) => {
      const gr = g.createRadialGradient(256, 256, 40, 256, 256, 360); gr.addColorStop(0, '#e9e4d8'); gr.addColorStop(1, '#bdb6a6'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
      g.globalAlpha = 0.85; g.fillStyle = '#0d1b3d'; g.beginPath(); g.arc(256, 256, 120, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = 'italic 900 64px "Barlow Condensed", Impact'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LIVE', 256, 234); g.fillStyle = '#ff2e63'; g.fillText('FIGHT', 256, 290);
    });
    const mat = new T.Mesh(new T.PlaneGeometry(8.6, 8.6), new T.MeshStandardMaterial({ map: canvasTex, roughness: 0.9 }));
    mat.rotation.x = -Math.PI / 2; mat.position.y = 0.01; mat.receiveShadow = true; scene.add(mat);
    const postMat = (c) => new T.MeshStandardMaterial({ color: c, metalness: 0.3, roughness: 0.4 });
    const corners = [[-4.2, -4.2, 0xe11d48], [4.2, -4.2, 0x2563eb], [4.2, 4.2, 0xdddddd], [-4.2, 4.2, 0xdddddd]];
    for (const [x, z, c] of corners) { const p = new T.Mesh(new T.CylinderGeometry(0.14, 0.14, 2.2, 12), postMat(c)); p.position.set(x, 1.1, z); p.castShadow = true; scene.add(p); const pad = new T.Mesh(new T.BoxGeometry(0.4, 1.4, 0.4), postMat(c)); pad.position.set(x, 1.2, z); scene.add(pad); }
    const ropeCols = [0xe11d48, 0xffffff, 0x2563eb];
    for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const rope = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, len, 8), new T.MeshStandardMaterial({ color: ropeCols[k], roughness: 0.4 }));
      rope.position.set((a[0] + b[0]) / 2, 0.75 + k * 0.5, (a[1] + b[1]) / 2);
      rope.rotation.z = Math.PI / 2; rope.rotation.y = Math.atan2(b[1] - a[1], b[0] - a[0]) * -1;
      scene.add(rope);
    }
    // Arquibancada escura com flashes de câmera
    const crowdTex = G3.tex(512, 128, (g) => { g.fillStyle = '#07080c'; g.fillRect(0, 0, 512, 128); for (let i = 0; i < 1400; i++) { g.fillStyle = `hsla(${Math.random() * 360},30%,${15 + Math.random() * 25}%,1)`; g.beginPath(); g.arc(Math.random() * 512, 10 + Math.random() * 118, 2.5, 0, 7); g.fill(); } }, [3, 1]);
    for (let i = 0; i < 4; i++) {
      const st = new T.Mesh(new T.BoxGeometry(30, 7, 1), new T.MeshBasicMaterial({ map: crowdTex }));
      const a = (i / 4) * Math.PI * 2;
      st.position.set(Math.sin(a) * 14, 3, Math.cos(a) * 14); st.rotation.y = a; st.rotation.x = -0.25;
      scene.add(st);
    }
    const flashes = [];
    for (let i = 0; i < 24; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: G3.glowTex(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
      const a = Math.random() * Math.PI * 2; s.position.set(Math.sin(a) * 13.4, 1 + Math.random() * 5, Math.cos(a) * 13.4); s.scale.set(0.35, 0.35, 1);
      scene.add(s); flashes.push(s);
    }
    const ball = new T.Group();
    ball.add(new T.Mesh(new T.SphereGeometry(0.32, 20, 16), new T.MeshBasicMaterial({ color: 0xe0fbff })));
    ball.add(new T.Mesh(new T.SphereGeometry(0.55, 20, 16), new T.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.45, blending: T.AdditiveBlending, depthWrite: false })));
    ball.add(new T.Mesh(new T.TorusGeometry(0.6, 0.06, 8, 24), new T.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.8, blending: T.AdditiveBlending })));
    const ballLight = new T.PointLight(0x00e5ff, 30, 8); ball.add(ballLight);
    ball.visible = false; scene.add(ball);
    this.r = { scene, camera, spots, flashes, ball, cam: { a: 0, d: 10.5, y: 2.2 } };
    this.r.fighters = this.config.items.map((it, i) => this.buildFighter(it, i));
    this.placeFighters();
  },
  buildFighter(it, i) {
    const rig = makeHuman({ color: it.color, shorts: shade(it.color, -60), photo: it.photo, seed: it.name + i, gloves: true, shoes: '#111827' });
    rig.gloveL.material = rig.gloveL.material.clone(); rig.gloveL.material.color.set(it.color);
    rig.gloveR.material = rig.gloveL.material;
    this.r.scene.add(rig.root);
    return rig;
  },
  placeFighters() {
    this.r.fighters.forEach((f, i) => { f.root.position.set(i ? FIGHT_X : -FIGHT_X, 0, 0); f.root.rotation.set(0, i ? -Math.PI / 2 + FACE_TURN : Math.PI / 2 - FACE_TURN, 0); });
  },

  // ---------- Regras ----------
  onEvent(ev) {
    if (this.phase !== 'fight' && this.phase !== 'intro') return;
    const id = uid(ev);
    const items = this.config.items;
    if (ev.type === 'chat') {
      const t = ev.text.trim().toLowerCase();
      const m = t.match(/^([12])\b/);
      const pickSide = m ? Number(m[1]) - 1 : items.findIndex((it) => t.includes(it.name.toLowerCase()));
      if (pickSide >= 0 && this.side.get(id) !== pickSide) {
        if (this.side.has(id)) this.fans[this.side.get(id)]--;
        this.side.set(id, pickSide); this.fans[pickSide]++;
        this.addLog(ev.user, `torce por ${items[pickSide].name}`, items[pickSide].color);
        return;
      }
      if (this.side.has(id) && this.cd.ok(id)) this.queue.push({ s: this.side.get(id), move: MOVES.jab, user: ev.user });
    } else if (ev.type === 'like') {
      if (!this.side.has(id)) return;
      const s = this.side.get(id);
      this.meter[s] += ev.count;
      if (this.meter[s] >= 100) { this.meter[s] -= 100; this.queue.push({ s, move: MOVES.special, user: ev.user }); }
    } else if (ev.type === 'gift') {
      if (!this.side.has(id)) { this.addLog(ev.user, 'comente 1 ou 2 para escolher o lado!', '#ffd23f'); return; }
      // Dano total = 3 × √moedas (Rosa 3 · Coração 9 · Rosquinha 16 · Mãos em coração 30 · 1.000 🪙 95), dividido no combo
      const s = this.side.get(id), tier = giftTier(ev), hits = clamp(ev.count || 1, 1, 5);
      const total = Math.min(this.config.hp * 0.7, Math.round(3 * Math.sqrt(coins(ev))));
      for (let k = 0; k < hits; k++) this.queue.push({ s, move: MOVES[tier], user: ev.user, tier, dmg: Math.max(1, Math.round(total / hits)) });
    } else if (ev.type === 'social') {
      if (!this.side.has(id)) return;
      const s = this.side.get(id);
      this.meter[s] += isFollow(ev) ? 30 : 60;
      this.addLog(ev.user, `${isFollow(ev) ? 'seguiu' : 'compartilhou'}: especial +${isFollow(ev) ? 30 : 60}%`, this.config.items[s].color);
      while (this.meter[s] >= 100) { this.meter[s] -= 100; this.queue.push({ s, move: MOVES.special, user: ev.user }); }
    }
  },
  start(item) {
    const a = this.act[item.s];
    a.kind = item.move.anim; a.t = 0; a.dur = item.move.time; a.item = item; a.done = false;
    if (item.tier === 4) { this.slowmo = 1.4; announcer.show('GOLPE FINAL', '#00e5ff', 1.6, 70); }
  },
  land(item) {
    const { s, user, tier } = item;
    const move = item.dmg ? { ...item.move, dmg: item.dmg } : item.move;
    const o = 1 - s;
    this.hp[o] = Math.max(0, this.hp[o] - move.dmg);
    const v = this.act[o];
    v.hit = Math.min(0.6, 0.25 + move.dmg / 60); v.push = Math.min(0.9, 0.15 + move.dmg / 40);
    addScore(this.hitters, user.nick, move.dmg);
    const p = this.screenOf(o);
    floatText(`-${move.dmg}`, p.x, p.y - 40, move.color, 34 + Math.min(40, move.dmg));
    burst(p.x, p.y, [move.color, '#fff'], 10 + move.dmg, 280 + move.dmg * 8);
    this.shake = Math.min(0.5, 0.08 + move.dmg / 80);
    if (item.move !== MOVES.jab) this.addLog(user, `${move.name} de ${this.config.items[s].name}`, move.color);
    if (tier === 3 || item.move === MOVES.special) announcer.show(move.name, move.color, 1.3, 54);
    if (tier >= 3) { this.flash = 0.25; sfx.boom(); } else sfx.tone(120 + move.dmg * 5, 0.12, 'square', 0.1);
    if (this.hp[o] <= 0) this.end(s);
  },
  end(w) {
    this.phase = 'ko';
    this.winner = w;
    this.endT = 9;
    this.queue = [];
    if (w >= 0) { this.roundsWon[w]++; this.act[1 - w].ko = 0.001; this.act[w].winT = 0.001; }
    sfx.win();
    announcer.items.length = 0;
    this.slowmo = 1.2;
  },
  update(dt) {
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt);
    for (let i = 0; i < 2; i++) this.ghost[i] = Math.max(this.hp[i], this.ghost[i] - dt * this.config.hp * 0.25);
    let gdt = dt;
    if (this.slowmo > 0) { this.slowmo -= dt; gdt = dt * 0.3; }
    this.gdt = gdt;
    if (this.phase === 'intro') { this.introT -= dt; if (this.introT <= 0) { this.phase = 'fight'; announcer.show('LUTEM!', '#ffd23f', 1.2, 110); sfx.tone(880, 0.3, 'square', 0.08); } }
    for (const a of this.act) {
      a.hit = Math.max(0, a.hit - gdt); a.push = Math.max(0, a.push - gdt * 1.4);
      if (a.ko) a.ko = Math.min(1, a.ko + gdt * 1.6);
      if (a.winT) a.winT += gdt;
      if (a.kind) {
        a.t += gdt;
        if (!a.done && a.t >= a.dur * 0.55) { a.done = true; if (this.phase === 'fight') this.land(a.item); }
        if (a.t >= a.dur) a.kind = null;
      }
    }
    if (this.phase === 'ko') { this.endT -= dt; if (this.endT <= 0) { this.round++; this.reset(); } return; }
    if (this.phase !== 'fight') return;
    this.time -= gdt;
    if (this.time <= 0) return this.end(this.hp[0] === this.hp[1] ? -1 : this.hp[0] > this.hp[1] ? 0 : 1);
    // Um golpe por vez de cada lado; com fila grande, saem mais rápido.
    this.cool -= gdt;
    if (this.cool <= 0 && this.queue.length) {
      const idx = this.queue.findIndex((q) => !this.act[q.s].kind);
      if (idx >= 0) { this.start(this.queue.splice(idx, 1)[0]); this.cool = this.queue.length > 10 ? 0.06 : this.queue.length > 3 ? 0.14 : 0.24; }
    }
  },

  // ---------- Animação dos lutadores ----------
  animate(i, t) {
    const f = this.r.fighters[i], a = this.act[i];
    const side = i ? -1 : 1;
    const bob = Math.sin(t * 6 + i) * 0.04;
    // Guarda
    const p = {
      torso: [0.15, 0, 0], head: [-0.05, 0, 0], y: -0.08 + bob,
      sL: [-1.15, 0, 0.35], eL: [-2.0], sR: [-1.0, 0, -0.35], eR: [-2.1],
      hL: [-0.35, 0, 0.12], kL: [0.55], hR: [0.25, 0, -0.12], kR: [0.45],
    };
    let lunge = 0;
    if (a.kind) {
      const k = clamp(a.t / a.dur, 0, 1);
      const hitk = Math.sin(Math.min(1, k / 0.55) * Math.PI / 2) * (k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45);
      lunge = hitk * 0.4;
      if (a.kind === 'jab') { p.sL = [-1.55 * hitk - 1.15 * (1 - hitk), 0, 0.15]; p.eL = [-2.0 * (1 - hitk) - 0.05]; }
      else if (a.kind === 'cross') { p.sR = [-1.6 * hitk - 1.0 * (1 - hitk), 0, -0.1]; p.eR = [-2.1 * (1 - hitk) - 0.05]; p.torso = [0.2, -0.7 * hitk, 0]; lunge = hitk * 0.6; }
      else if (a.kind === 'kick') { p.hR = [-1.6 * hitk, 0, -0.2]; p.kR = [0.2 * (1 - hitk)]; p.torso = [-0.35 * hitk, 0, 0]; lunge = hitk * 0.5; }
      else if (a.kind === 'fireball') {
        // Junta as mãos atrás e empurra para a frente (bola de energia)
        const charge = Math.min(1, k / 0.35), push = clamp((k - 0.35) / 0.2, 0, 1);
        p.sL = [-1.0 - 0.55 * push, 0, 0.6 - 0.75 * push]; p.sR = [-1.0 - 0.55 * push, 0, -0.6 + 0.75 * push];
        p.eL = [-1.6 * (1 - push) - 0.1]; p.eR = [-1.6 * (1 - push) - 0.1];
        p.torso = [0.25, 0.5 * (1 - push) * charge, 0]; p.hL = [-0.6, 0, 0.15]; p.kL = [0.7]; p.hR = [0.5, 0, -0.15]; p.kR = [0.3]; p.y = -0.18;
        lunge = 0;
      }
      else if (a.kind === 'upper') { p.sR = [-2.8 * hitk - 1.0 * (1 - hitk), 0, -0.2]; p.eR = [-1.2 * (1 - hitk) - 0.3]; p.torso = [-0.3 * hitk, -0.4, 0]; p.y = -0.3 * (1 - hitk) + 0.25 * hitk; lunge = hitk * 0.9; }
    }
    if (a.hit > 0) { const h = a.hit * 1.6; p.torso = [-0.45 * h, 0.2 * h, 0]; p.head = [-0.6 * h, 0.3 * h, 0]; }
    if (a.winT) { const w = Math.min(1, a.winT * 2); p.sL = [-2.9 * w, 0, 0.3]; p.sR = [-2.9 * w, 0, -0.3]; p.eL = [-0.3]; p.eR = [-0.3]; p.y = Math.abs(Math.sin(a.winT * 6)) * 0.15; p.torso = [-0.1, 0, 0]; }
    poseHuman(f, p);
    const baseX = i ? FIGHT_X : -FIGHT_X;
    f.root.position.x = baseX + side * lunge - side * a.push;
    f.root.position.y = 0;
    // Nocaute: cai de costas
    f.root.rotation.z = a.ko ? side * -a.ko * 1.5 : 0;
    if (a.ko) f.root.position.y = Math.sin(a.ko * Math.PI) * 0.4;
    const glow = a.kind === 'fireball' || a.kind === 'upper';
    f.gloveR.material.emissive?.set(glow ? 0x00e5ff : 0x000000);
    if (f.gloveR.material.emissiveIntensity !== undefined) f.gloveR.material.emissiveIntensity = glow ? 1.4 : 0;
  },
  screenOf(i) {
    if (!this.r) return { x: i ? 500 : 220, y: 560 };
    const T = THREE;
    const v = new T.Vector3(); this.r.fighters[i].head.getWorldPosition(v);
    v.project(this.r.camera);
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H };
  },
  draw() {
    if (!this.r) {
      this.init3d();
      background('#05060a', '#111827');
      title('COMBATE 3D', W / 2, H / 2 - 20, 70, '#ffffff');
      text('Montando o ringue…', W / 2, H / 2 + 40, 26, '#9aa0b4', 'center', 700);
      three3dReady.then(() => this.init3d());
      return;
    }
    const t = performance.now() / 1000;
    this.animate(0, t); this.animate(1, t);
    // Câmera: lateral, girando devagar; no nocaute, gira em volta do vencedor
    const c = this.r.cam;
    if (this.phase === 'intro') { c.a = -0.7 + (2.2 - this.introT) * 0.3; c.d = 9; }
    else if (this.phase === 'ko' && this.winner >= 0) { c.a += (this.gdt || 0.016) * 0.6; c.d += (7.5 - c.d) * 0.05; }
    else { c.a = Math.sin(t * 0.18) * 0.22; c.d += (10.5 - c.d) * 0.05; }
    const focusX = this.phase === 'ko' && this.winner >= 0 ? (this.winner ? FIGHT_X : -FIGHT_X) : 0;
    const sh = this.shake ? (Math.random() - 0.5) * this.shake * 0.5 : 0;
    this.r.camera.position.set(focusX + Math.sin(c.a) * c.d + sh, c.y + sh, Math.cos(c.a) * c.d);
    this.r.camera.lookAt(focusX, 1.55, 0);
    // Bola de energia: cresce nas mãos e atravessa até o adversário
    const ball = this.r.ball;
    const fa = this.act.findIndex((a) => a.kind === 'fireball');
    if (fa >= 0) {
      const a = this.act[fa], k = a.t / a.dur, side = fa ? -1 : 1;
      const x0 = (fa ? FIGHT_X : -FIGHT_X) + side * 0.9, x1 = (fa ? -FIGHT_X : FIGHT_X);
      ball.visible = k < 0.62;
      const travel = clamp((k - 0.35) / 0.2, 0, 1);
      ball.position.set(x0 + (x1 - x0) * travel, 1.85, 0.25);
      ball.scale.setScalar(0.4 + Math.min(1, k / 0.35) * 0.6 + Math.sin(t * 40) * 0.05);
      ball.rotation.z += 0.3;
    } else ball.visible = false;
    for (const f of this.r.flashes) { if (Math.random() < 0.01) f.material.opacity = 1; f.material.opacity *= 0.85; }
    G3.render(this.r.scene, this.r.camera);
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash * 2})`; ctx.fillRect(0, 0, W, H); }
    this.drawHud();
  },
  drawHud() {
    const items = this.config.items;
    // Barras de vida estilo jogo de luta
    for (let i = 0; i < 2; i++) {
      const left = i === 0;
      const it = items[i];
      const x = left ? 16 : W / 2 + 40, w = W / 2 - 56;
      const pct = this.hp[i] / this.config.hp, gpct = this.ghost[i] / this.config.hp;
      slant(x, 52, w, 34, { fill: 'rgba(5,6,10,.85)', skew: left ? 10 : -10, border: 'rgba(255,255,255,.25)' });
      const fill = (p, col) => {
        const fw = (w - 16) * clamp(p, 0, 1);
        const fx = left ? x + 8 + (w - 16) - fw : x + 8;
        const g = ctx.createLinearGradient(0, 58, 0, 80); g.addColorStop(0, shade(col, 40)); g.addColorStop(1, shade(col, -30));
        ctx.fillStyle = g; ctx.fillRect(fx, 58, fw, 22);
      };
      fill(gpct, '#dc2626');
      fill(pct, pct > 0.5 ? '#facc15' : pct > 0.2 ? '#f97316' : '#ef4444');
      photo(it.photo || fakeFace(it.name + i), left ? x : x + w - 64, 92, 64, 64, 6, (it.name[0] || '?').toUpperCase(), it.color);
      ctx.strokeStyle = it.color; ctx.lineWidth = 3; ctx.strokeRect(left ? x : x + w - 64, 92, 64, 64);
      title(trim(it.name, 12).toUpperCase(), left ? x + 76 : x + w - 76, 112, 30, '#fff', left ? 'left' : 'right');
      label(`${'★'.repeat(Math.min(5, this.roundsWon[i]))}${'☆'.repeat(Math.max(0, 2 - this.roundsWon[i]))}  ·  ${this.fans[i]} na torcida`, left ? x + 76 : x + w - 76, 142, 15, 'rgba(255,255,255,.75)', left ? 'left' : 'right', 700);
      // Medidor do especial
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(left ? x : x + w - 220, 166, 220, 8);
      ctx.fillStyle = '#00e5ff'; ctx.fillRect(left ? x : x + w - 220, 166, 220 * clamp(this.meter[i] / 100, 0, 1), 8);
    }
    slant(W / 2 - 46, 40, 92, 62, { fill: '#0b0d14', skew: 8, border: '#ffd23f' });
    num(String(Math.ceil(Math.max(0, this.time))), W / 2, 72, 46, '#ffd23f');
    label(`ROUND ${this.round}`, W / 2, 116, 14, 'rgba(255,255,255,.8)', 'center', 800);
    // Avisos
    this.log.forEach((l, k) => toast(l.user, trim(`@${trim(l.user.nick, 12)} ${l.msg}`, 34), 20, 1012 + k * 46, { color: l.color, alpha: clamp(l.t, 0, 1), size: 17 }));
    slant(16, 1160, W - 32, 92, { fill: 'rgba(5,6,10,.85)', skew: 14, border: 'rgba(255,255,255,.18)' });
    label('Comente 1 ou 2 para escolher o lutador', W / 2, 1186, 20, '#fff', 'center', 800);
    const moves = [['1+ 🪙', 'DIRETO'], ['10+ 🪙', 'CHUTE'], ['100+ 🪙', 'ENERGIA'], ['1000+ 🪙', 'GOLPE FINAL']];
    moves.forEach(([g, m], k) => { const x = 40 + k * 166; label(g, x, 1218, 12, 'rgba(255,255,255,.55)', 'left', 800); label(m, x, 1236, 17, ['#ffd23f', '#ff8a3d', '#ff2e63', '#00e5ff'][k], 'left', 400, F_TITLE); });
    if (this.phase === 'intro') {
      title(`ROUND ${this.round}`, W / 2, 560, 96, '#fff');
      label(`${items[0].name} × ${items[1].name}`, W / 2, 630, 26, '#ffd23f', 'center', 800);
    }
    if (this.phase === 'ko') {
      const k = clamp((9 - this.endT) * 3, 0, 1);
      ctx.save(); ctx.globalAlpha = k;
      title(this.winner < 0 ? 'EMPATE' : 'K.O.', W / 2, 470, 150 * (1.3 - 0.3 * k), '#ff2e63');
      if (this.winner >= 0) { slant(90, 560, W - 180, 70, { fill: 'rgba(5,6,10,.9)', skew: 14, border: '#ffd23f' }); title(`${trim(items[this.winner].name, 14).toUpperCase()} VENCEU`, W / 2, 596, 42, '#ffd23f'); }
      ctx.restore();
      if (this.endT < 6) { leaderboardSmall(this.hitters, W / 2 - 150, 700); text(`Próximo round em ${Math.ceil(this.endT)}s`, W / 2, 900, 26, '#fff', 'center', 700); }
    }
  },
}, {
  hp: 300,
  items: [
    { name: 'Azul', color: '#2563eb', photo: '' },
    { name: 'Vermelho', color: '#dc2626', photo: '' },
  ],
}));
