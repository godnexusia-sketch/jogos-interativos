'use strict';

// ---------------- Escaladas 3D: Só Subindo, Torre de Obstáculos, Rumo ao Céu ----------------
// Motor único: o personagem espera a contagem, depois pula um degrau por vez sozinho, para sempre.
// Presentes e likes empurram para cima (sobe rápido, voa) ou para baixo (cai rolando). Cada jogo
// muda o cenário, o caminho dos degraus, a câmera e um detalhe da regra (checkpoints que seguram
// a queda na Torre de Obstáculos, altitude em metros no Rumo ao Céu).

// Hash determinístico: todas as telas montam o mesmo caminho.
const climbHash = (i, s = 0) => { let h = (i * 374761393 + s * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

// Ações: subir e descer em vários tamanhos, mais os poderes
const CLIMB_ACTIONS = [
  { id: 'up_1', label: 'Sobe 1', icon: '⬆️', dir: 1, n: 1 }, { id: 'up_5', label: 'Sobe 5', icon: '⬆️', dir: 1, n: 5 }, { id: 'up_10', label: 'Sobe 10', icon: '⏫', dir: 1, n: 10 },
  { id: 'up_25', label: 'Sobe 25', icon: '⏫', dir: 1, n: 25 }, { id: 'up_50', label: 'Voa 50', icon: '🚀', dir: 1, n: 50 }, { id: 'up_100', label: 'Voa 100', icon: '🚀', dir: 1, n: 100 },
  { id: 'up_value', label: 'Sobe pelo valor do presente', icon: '🎁', dir: 1, n: 0 },
  { id: 'down_5', label: 'Desce 5', icon: '⬇️', dir: -1, n: 5 }, { id: 'down_10', label: 'Desce 10', icon: '⬇️', dir: -1, n: 10 }, { id: 'down_25', label: 'Desce 25', icon: '⏬', dir: -1, n: 25 },
  { id: 'down_50', label: 'Cai 50', icon: '💥', dir: -1, n: 50 }, { id: 'down_100', label: 'Cai 100', icon: '💥', dir: -1, n: 100 },
  { id: 'down_checkpoint', label: 'Volta ao último checkpoint', icon: '🚩', dir: -1, n: 'cp' }, { id: 'down_start', label: 'Volta ao começo', icon: '☠️', dir: -1, n: 'start' },
  { id: 'freeze', label: 'Congelar (para de pular)', icon: '🧊' }, { id: 'turbo', label: 'Turbo (pula 3× mais rápido)', icon: '⚡' }, { id: 'shield', label: 'Escudo contra quedas', icon: '🛡️' },
];
// Presentes padrão (nomes do catálogo em português + id). Tudo editável em ⚡ Gatilhos.
const CLIMB_BINDS = [
  { action: 'up_1', trigger: 'like', likes: 20 }, { action: 'up_5', trigger: 'follow' }, { action: 'up_5', trigger: 'share' },
  { action: 'up_value', trigger: 'gift', minCoins: 1 },
  { action: 'up_5', trigger: 'gift', giftId: '5655', giftName: 'Rosa' }, { action: 'up_10', trigger: 'gift', giftId: '5487', giftName: 'Coração de dedo' },
  { action: 'up_25', trigger: 'gift', giftId: '5658', giftName: 'Perfume' }, { action: 'up_25', trigger: 'gift', giftId: '5879', giftName: 'Rosquinha' },
  { action: 'up_50', trigger: 'gift', giftId: '6104', giftName: 'Boné' }, { action: 'up_100', trigger: 'gift', giftId: '5585', giftName: 'Confete' },
  { action: 'turbo', trigger: 'gift', giftId: '5659', giftName: 'Tsuru de papel' }, { action: 'shield', trigger: 'gift', giftId: '5465', giftName: 'Mishka Bear' },
  { action: 'down_5', trigger: 'gift', giftId: '5269', giftName: 'TikTok' }, { action: 'down_10', trigger: 'gift', giftId: '6064', giftName: 'GG' },
  { action: 'down_5', trigger: 'gift', giftId: '5827', giftName: 'Casquinha' }, { action: 'freeze', trigger: 'gift', giftId: '6788', giftName: 'Bastão luminoso' },
  { action: 'down_50', trigger: 'gift', giftId: '6427', giftName: 'Chapéu e Bigode' }, { action: 'down_100', trigger: 'gift', giftId: '5509', giftName: 'Óculos de sol' },
  { action: 'down_checkpoint', trigger: 'gift', giftId: '7168', giftName: 'Arma de dinheiro' }, { action: 'down_start', trigger: 'gift', giftId: '5587', giftName: 'Gold Mine' },
];

function defineClimb(v) {
  const charOptions = [['', 'Do painel (🧍 Personagens)'], ...Object.keys(CHARACTERS).filter((k) => !CHARACTERS[k].undead).map((k) => [k, CHARACTERS[k].name])];
  return defineGame({
    id: v.id, name: v.name, genre: 'arcade', icon: v.icon, color: v.color, three: true,
    desc: v.desc,
    help: `<p>Depois da contagem, o personagem <b>pula sozinho um degrau por vez</b>. Chegou em <b>${v.target}</b>, vence a rodada e começa de novo.</p><p>❤️ Likes, seguir e compartilhar <b>sobem</b>. 🎁 Cada presente tem um efeito (veja nas placas da tela): uns fazem <b>subir muito rápido</b> ou <b>voar</b>, outros fazem <b>cair</b>${v.cpStops ? ' (a queda para no último checkpoint 🚩)' : ''}. Também tem <b>turbo</b>, <b>congelar</b> e <b>escudo</b>.</p>`,
    settings: [
      { key: 'startDelay', type: 'number', label: 'Segundos de contagem antes de começar', min: 0, max: 60, default: 5 },
      { key: 'hopTime', type: 'slider', label: 'Segundos entre um pulo e outro', min: 0.3, max: 3, step: 0.1, default: v.hop || 0.9 },
      { key: 'target', type: 'number', label: 'Degraus para vencer', min: 20, max: 10000, default: v.target },
      { key: 'checkpointEvery', type: 'number', label: 'Checkpoint a cada quantos degraus (0 = sem)', min: 0, max: 1000, default: v.cpEvery },
      { key: 'cpStops', type: 'toggle', label: 'A queda para no último checkpoint', default: Boolean(v.cpStops) },
      { key: 'winHold', type: 'number', label: 'Segundos comemorando a vitória', min: 2, max: 20, default: 6 },
      { key: 'character', type: 'select', label: 'Personagem', options: charOptions, default: v.char || '', group: 'Visual' },
      { key: 'turboSeconds', type: 'number', label: 'Segundos de turbo', min: 3, max: 60, default: 12, group: 'Poderes' },
      { key: 'freezeSeconds', type: 'number', label: 'Segundos congelado', min: 3, max: 60, default: 8, group: 'Poderes' },
      { key: 'shieldSeconds', type: 'number', label: 'Segundos de escudo', min: 3, max: 60, default: 15, group: 'Poderes' },
      { key: 'bubbles', type: 'toggle', label: 'Personagem agradece e reclama em balões', default: true, group: 'Visual' },
      { key: 'fxLevel', type: 'slider', label: 'Intensidade dos efeitos', min: 0.2, max: 1, step: 0.1, default: 1, group: 'Visual' },
      ...BOARD_SETTINGS(3),
    ],
    actions: CLIMB_ACTIONS.map(({ id, label, icon }) => ({ id, label, icon })),
    bindings: CLIMB_BINDS,
    sample() { return pick(['vai', 'sobe', 'bora', 'pula']); },
    enter() { Assets3D.preload([this.kind()]); },
    leave() { this.dispose3d(); },
    kind() { const k = this.s.character; return k && CHARACTERS[k] ? k : HERO_KINDS[0] || 'sapo'; },
    reset() {
      this.step = 0; this.best = 0; this.cp = 0; this.wins = this.wins || 0;
      this.ph = 'countdown'; this.t = this.s.startDelay; this.hopT = 0;
      this.q = []; this.move = null; this.turboT = 0; this.freezeT = 0; this.shieldT = 0; this.sayT = 0;
      this.helpers = new Map(); this.saboteurs = new Map(); this.feed = new Feed(3);
      if (this.r) { this.placeChar(); this.r.char?.play('idle'); }
    },
    // ---------- Regras ----------
    onAction(id, a) {
      const act = CLIMB_ACTIONS.find((x) => x.id === id);
      if (!act || this.ph === 'win') return;
      const mult = a.gift ? clamp(a.count || 1, 1, 20) : 1;
      if (id === 'freeze') { this.freezeT = this.s.freezeSeconds; this.say(a.user, 'me congelou! 🧊', -1); this.fx('freeze'); return; }
      if (id === 'turbo') { this.turboT = this.s.turboSeconds; this.say(a.user, 'TURBO! ⚡', 1); this.fx('turbo'); return; }
      if (id === 'shield') { this.shieldT = this.s.shieldSeconds; this.say(a.user, 'escudo! 🛡️', 1); this.fx('shield'); return; }
      let n = act.n;
      if (n === 0) n = Math.min(300, Math.max(1, Math.round(a.coins)));
      else if (n === 'cp') n = Math.max(0, this.target() - this.floorFor(true));
      else if (n === 'start') n = this.target();
      else n *= mult;
      if (act.dir < 0) {
        if (this.shieldT > 0) { this.say(a.user, 'não me derruba! 🛡️', 1); this.fx('blocked'); return; }
        const k = uid(a); this.saboteurs.set(k, { user: a.user, value: (this.saboteurs.get(k)?.value || 0) + (typeof act.n === 'number' ? n : 1) });
      } else if (a.gift || a.ev?.type === 'social') { const k = uid(a); this.helpers.set(k, { user: a.user, value: (this.helpers.get(k)?.value || 0) + n }); }
      this.q.push({ dir: act.dir, n, user: a.user, kind: act.n });
      if (a.gift || act.n !== 1) { this.say(a.user, act.dir > 0 ? `+${n}` : act.n === 'start' ? 'me mandou pro começo! ☠️' : act.n === 'cp' ? 'me mandou pro checkpoint!' : `-${n}`, act.dir); this.feed.push(a.user, `${act.icon} ${act.dir > 0 ? '+' : '-'}${typeof act.n === 'number' ? n : act.label}`, act.dir > 0 ? '#4ade80' : '#f87171'); }
    },
    // Onde o personagem está (ou para onde vai) — usado para calcular quedas até o checkpoint
    target() { return this.move ? this.move.to : this.step; },
    floorFor(toCp) { const e = this.s.checkpointEvery; return (toCp || this.s.cpStops) && e > 0 ? this.cp : 0; },
    say(user, msg, dir) {
      if (!this.s.bubbles || !this.r?.char) return;
      if (this.sayT > 0 && dir === this.lastSayDir) return;
      this.sayT = 1.2; this.lastSayDir = dir;
      const who = user ? trim(user.nick, 12) : '';
      this.r.char.say(dir > 0 ? `valeu ${who}! ${msg}` : `${who} ${msg}`, { color: dir > 0 ? '#ffffff' : '#ffe4e6', secs: 2.2 });
    },
    update(dt) {
      this.feed.update(dt);
      this.sayT = Math.max(0, this.sayT - dt);
      for (const k of ['turboT', 'freezeT', 'shieldT']) this[k] = Math.max(0, this[k] - dt);
      if (this.ph === 'countdown') { this.t -= dt; if (this.t <= 0) { this.ph = 'climb'; this.hopT = 0; sfx.confirm?.(); this.r?.char?.play('victory', { speed: 1.4 }); } }
      else if (this.ph === 'win') { this.t -= dt; if (this.t <= 0) this.reset(); }
      else if (this.ph === 'climb') {
        if (!this.move) {
          const m = this.q.shift();
          if (m) this.startMove(m.dir, m.n, m.kind);
          else if (this.freezeT <= 0) { this.hopT += dt; if (this.hopT >= this.s.hopTime / (this.turboT > 0 ? 3 : 1)) { this.hopT = 0; this.startMove(1, 1, 1); } }
        }
      }
      if (this.r) this.tick3d(dt);
    },
    // Movimento: 1 degrau = pulo; vários para cima = pulos rápidos ou voo; para baixo = queda rolando
    startMove(dir, n, kind) {
      const floor = this.floorFor(kind === 'cp');
      const to = dir > 0 ? Math.min(this.s.target, this.step + n) : Math.max(kind === 'start' ? 0 : floor, this.step - n);
      if (to === this.step) return;
      const steps = Math.abs(to - this.step);
      const mode = dir < 0 ? 'fall' : steps === 1 ? 'hop' : steps <= 12 ? 'chain' : 'fly';
      const dur = mode === 'hop' ? Math.min(0.55, this.s.hopTime * 0.8) : mode === 'chain' ? steps * 0.16 : mode === 'fly' ? Math.min(3.5, 0.6 + steps * 0.02) : Math.min(2.6, 0.5 + steps * 0.025);
      this.move = { from: this.step, to, mode, t: 0, dur, last: this.step };
      const c = this.r?.char;
      if (c) {
        if (mode === 'hop') c.play('jump', { speed: 1.5 });
        else if (mode === 'chain') c.play('jump', { speed: 2.4 });
        else if (mode === 'fly') { c.play('powerUp', { speed: 1.2 }); this.r.dir.shake(0.08, 0.3); }
        else { c.play('hit', { speed: 1.3 }); c.hitFlash(0xff5555, 1); this.r.dir.shake(0.18, 0.5); }
      }
    },
    finishMove() {
      const m = this.move;
      this.step = m.to; this.move = null;
      this.best = Math.max(this.best, this.step);
      const e = this.s.checkpointEvery;
      if (e > 0 && Math.floor(this.step / e) * e > this.cp) { this.cp = Math.floor(this.step / e) * e; this.fx('checkpoint'); }
      const c = this.r?.char;
      if (c) {
        if (m.mode === 'fall') c.play('standUp', { then: 'idle' });
        else if (m.mode === 'fly') c.play('victory', { speed: 1.5 });
      }
      if (m.mode !== 'hop') this.fx(m.mode === 'fall' ? 'land' : 'arrive');
      if (this.step >= this.s.target) this.win();
    },
    win() {
      this.ph = 'win'; this.t = this.s.winHold; this.wins++; this.q = [];
      sfx.win?.(); confetti(140);
      voice.say(`Chegou no topo! ${this.wins} ${this.wins === 1 ? 'vitória' : 'vitórias'}!`);
      const top = [...this.helpers.values()].sort((a, b) => b.value - a.value)[0];
      if (top && !top.user.bot) scores.add(this.id, top.user, 1, 1);
      this.r?.char?.play('victory', { then: 'taunt' });
      this.fx('win');
    },
    // ---------- Cena ----------
    scene3d() {
      if (this.r || !G3.ready) return this.r;
      const T = THREE, scene = new T.Scene();
      scene.fog = new T.Fog(0xffffff, 30, 120);
      const hemi = new T.HemisphereLight(0xffffff, 0x445566, 1.0); scene.add(hemi);
      const sun = new T.DirectionalLight(0xffffff, 2.2); sun.position.set(20, 40, 25); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 140 }); scene.add(sun, sun.target);
      const cam = new T.PerspectiveCamera(50, W / H, 0.1, 400);
      const fx = new FX3D(scene, 240);
      this.r = { scene, cam, fx, hemi, sun, plats: new Map(), deco: v.decor?.(scene, this) || null, camPos: new T.Vector3(), camLook: new T.Vector3(), skyC: new T.Color(), dir: { shakeT: 0, shakeA: 0, shake(a, s) { this.shakeA = Math.max(this.shakeA, a); this.shakeT = Math.max(this.shakeT, s); } } };
      v.build?.(scene, this);
      const ch = new Character3D({ kind: this.kind(), height: v.charH || 1.6, plate: false, base: 'idle' });
      scene.add(ch.root); this.r.char = ch; this.r.charKind = this.kind();
      this.placeChar(true);
      return this.r;
    },
    dispose3d() {
      const r = this.r;
      if (!r) return;
      r.char?.dispose(); r.fx.clear();
      r.scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { o.geometry?.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m?.map?.dispose?.(); m?.dispose?.(); }); } });
      this.r = null;
    },
    pos(i) { return v.pos(Math.max(0, i), this); },
    placeChar(snapCam) {
      const r = this.r, p = this.pos(this.step);
      r.char.root.position.copy(p);
      const nx = this.pos(this.step + 1); r.char.root.rotation.y = Math.atan2(nx.x - p.x, nx.z - p.z);
      if (snapCam) { const [cp, cl] = v.cam(p, this, r.char.root.rotation.y); r.camPos.copy(cp); r.camLook.copy(cl); }
    },
    // Degraus perto do personagem (cria os que entram na janela e tira os que saem)
    syncPlats() {
      const r = this.r, cur = this.move ? Math.round(this.move.last) : this.step, lo = Math.max(0, cur - 18), hi = Math.min(this.s.target, cur + 36);
      for (const [i, m] of r.plats) if (i < lo || i > hi) { r.scene.remove(m); r.plats.delete(i); }
      for (let i = lo; i <= hi; i++) if (!r.plats.has(i)) { const m = v.plat(i, this); m.position.copy(this.pos(i)); r.scene.add(m); r.plats.set(i, m); }
    },
    fx(kind) {
      const r = this.r; if (!r) return;
      const p = r.char.root.position.clone();
      if (kind === 'checkpoint') { r.fx.burst(p.clone().setY(p.y + 1), { color: ['#4ade80', '#fde047', '#ffffff'], n: 30, speed: 4, up: 3, size: 0.3, tex: 'star', additive: false, life: 1.2 }); r.fx.ring(p.clone().setY(p.y + 0.05), { color: '#4ade80', size: 3 }); }
      else if (kind === 'land') { r.fx.burst(p.clone().setY(p.y + 0.2), { color: '#cbd5e1', n: 16, speed: 3, up: 1, gravity: -1, tex: 'smoke', additive: false, size: 0.7, life: 0.8 }); r.dir.shake(0.15, 0.3); }
      else if (kind === 'arrive') r.fx.burst(p.clone().setY(p.y + 0.5), { color: ['#fde047', '#ffffff'], n: 20, speed: 3, up: 2, size: 0.25, life: 0.7 });
      else if (kind === 'turbo') r.fx.burst(p.clone().setY(p.y + 0.8), { color: ['#fde047', '#22d3ee'], n: 24, speed: 4, size: 0.3, life: 0.6 });
      else if (kind === 'freeze') r.fx.burst(p.clone().setY(p.y + 0.8), { color: ['#bae6fd', '#ffffff'], n: 24, speed: 2.5, size: 0.3, tex: 'star', additive: false, life: 1 });
      else if (kind === 'shield' || kind === 'blocked') r.fx.ring(p.clone().setY(p.y + 0.9), { color: '#7dd3fc', size: 3, flat: false });
      else if (kind === 'win') for (let k = 0; k < 4; k++) r.fx.burst(p.clone().add(new THREE.Vector3(rand(-3, 3), rand(2, 5), rand(-3, 3))), { color: ['#fde047', '#f472b6', '#60a5fa', '#4ade80'], n: 40, speed: 7, up: 2, gravity: -3, size: 0.4, life: 1.6 });
    },
    tick3d(dt) {
      const r = this.r, c = r.char;
      // Personagem trocado no painel: monta o novo no lugar
      if (r.charKind !== this.kind()) { c.dispose(); r.char = new Character3D({ kind: this.kind(), height: v.charH || 1.6, plate: false, base: 'idle' }); r.scene.add(r.char.root); r.charKind = this.kind(); this.placeChar(); return; }
      r.fx.level = this.s.fxLevel;
      const m = this.move;
      if (m) {
        m.t += dt;
        const k = Math.min(1, m.t / m.dur);
        if (m.mode === 'hop' || m.mode === 'chain') {
          // Pulos: em cadeia, cada degrau é um arco
          const total = m.to - m.from, f = m.from + total * (m.mode === 'hop' ? k : k), seg = Math.floor(f), sk = f - seg;
          const a = this.pos(Math.min(seg, m.to)), b = this.pos(Math.min(seg + 1, m.to)), arcH = v.arc || 0.9;
          c.root.position.lerpVectors(a, b, m.mode === 'hop' ? k : sk); c.root.position.y += Math.sin((m.mode === 'hop' ? k : sk) * Math.PI) * arcH;
          if (Math.round(f) !== Math.round(m.last) && m.mode === 'chain') { if (!c.busy || true) c.play('jump', { speed: 2.4 }); r.fx.burst(a.clone().setY(a.y + 0.1), { color: '#e2e8f0', n: 3, speed: 1, up: 0.3, size: 0.3, tex: 'smoke', additive: false, life: 0.4 }); }
          m.last = f;
          c.root.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) || c.root.rotation.y;
        } else {
          // Voo e queda: desliza pelo caminho (com giro na queda) e solta rastro
          const ease = m.mode === 'fly' ? 1 - Math.pow(1 - k, 2) : k * k * (3 - 2 * k);
          const f = m.from + (m.to - m.from) * ease, seg = Math.floor(f), sk = f - seg;
          const a = this.pos(seg), b = this.pos(seg + 1);
          c.root.position.lerpVectors(a, b, sk); c.root.position.y += m.mode === 'fly' ? 0.8 + Math.sin(k * Math.PI) * 1.5 : Math.sin(k * Math.PI) * 1.2;
          if (m.mode === 'fall') { c.body.rotation.x = k < 1 ? -k * Math.PI * 4 : 0; }
          m.trail = (m.trail || 0) - dt;
          if (m.trail <= 0) { m.trail = 0.04; r.fx.burst(c.root.position.clone().setY(c.root.position.y + 0.6), m.mode === 'fly' ? { color: ['#fde047', '#fb923c', '#ffffff'], n: 4, speed: 1, up: -1, gravity: 0, size: 0.4, life: 0.5 } : { color: '#94a3b8', n: 3, speed: 1, up: 0.5, gravity: 0, tex: 'smoke', additive: false, size: 0.6, life: 0.6 }); }
          m.last = f;
          if (m.mode === 'fly') c.root.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) || c.root.rotation.y;
        }
        if (k >= 1) { c.body.rotation.x = 0; this.finishMove(); this.placeChar(); }
      } else if (this.ph !== 'win') {
        const p = this.pos(this.step); c.root.position.lerp(p, Math.min(1, dt * 10));
      }
      c.update(dt);
      // Poderes visíveis: gelo e escudo
      r.shieldMesh = r.shieldMesh || (() => { const s = new THREE.Mesh(new THREE.SphereGeometry(1.2, 20, 14), new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.22, depthWrite: false })); r.scene.add(s); return s; })();
      r.shieldMesh.visible = this.shieldT > 0; r.shieldMesh.position.copy(c.root.position).add(new THREE.Vector3(0, 0.85, 0)); r.shieldMesh.scale.setScalar(1 + Math.sin(performance.now() / 150) * 0.03);
      r.iceMesh = r.iceMesh || (() => { const s = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.9, 1.1), new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.2 })); r.scene.add(s); return s; })();
      r.iceMesh.visible = this.freezeT > 0; r.iceMesh.position.copy(c.root.position).add(new THREE.Vector3(0, 0.95, 0));
      this.syncPlats();
      v.tick?.(this, dt);
      // Céu muda com a altura
      const f = clamp(this.step / this.s.target, 0, 1), sky = v.sky, n = sky.length - 1, i = Math.min(n - 1, Math.floor(f * n)), kk = f * n - i;
      r.skyC.set(sky[i]).lerp(new THREE.Color(sky[i + 1]), kk);
      r.scene.background = r.skyC; r.scene.fog.color.copy(r.skyC);
      // Câmera segue o personagem
      const [cp, cl] = v.cam(c.root.position, this, c.root.rotation.y);
      const fast = this.move && this.move.mode !== 'hop' ? 2.5 : 1;
      r.camPos.lerp(cp, Math.min(1, dt * 3 * fast)); r.camLook.lerp(cl, Math.min(1, dt * 4 * fast));
      r.cam.position.copy(r.camPos);
      if (r.dir.shakeT > 0) { r.dir.shakeT -= dt; const a = r.dir.shakeA; r.cam.position.x += rand(-a, a); r.cam.position.y += rand(-a, a); } else r.dir.shakeA = 0;
      r.cam.lookAt(r.camLook);
      r.sun.position.copy(c.root.position).add(new THREE.Vector3(20, 40, 25)); r.sun.target.position.copy(c.root.position);
      r.fx.update(dt);
    },
    // ---------- Desenho ----------
    draw() {
      const r = this.scene3d();
      if (r) G3.render(r.scene, r.cam); else if (!customBackground(this)) stageBg('blue');
      // O contador acompanha o movimento (sobe/desce junto com o personagem)
      const shown = this.move ? Math.round(this.move.last) : this.step;
      const tgt = this.s.target, unit = v.unit ? v.unit(shown) : `${shown}`;
      // Topo: progresso
      ctx.fillStyle = 'rgba(8,10,24,.72)'; ctx.beginPath(); ctx.roundRect(W / 2 - 200, 24, 400, 132, 26); ctx.fill();
      title(v.title, W / 2, 52, 30, v.titleColor || '#fff');
      num(v.unit ? unit : `${shown} / ${tgt}`, W / 2, 98, 46, '#fff');
      glossBar(W / 2 - 170, 126, 340, 14, shown / tgt, v.color);
      label(`🏆 ${this.wins}${this.s.checkpointEvery > 0 ? `  ·  🚩 ${this.cp}` : ''}`, W / 2, 168, 16, '#fff', 'center', 800);
      // Poderes ativos
      const pw = [this.turboT > 0 && `⚡ TURBO ${Math.ceil(this.turboT)}s`, this.freezeT > 0 && `🧊 CONGELADO ${Math.ceil(this.freezeT)}s`, this.shieldT > 0 && `🛡️ ESCUDO ${Math.ceil(this.shieldT)}s`].filter(Boolean);
      pw.forEach((txt, k) => pill(txt, W / 2, 202 + k * 38, { size: 16, bg: 'rgba(8,10,24,.8)', border: '#7dd3fc' }));
      // Placas laterais: o que cada presente faz (pegando dos gatilhos)
      this.drawGiftRail();
      // Contagem e vitória
      if (this.ph === 'countdown') {
        const n = Math.ceil(this.t), k = 1 - (this.t % 1);
        ctx.globalAlpha = 0.4 + 0.6 * (1 - k * 0.5);
        title(n > 0 ? String(n) : 'VAI!', W / 2, H / 2 - 80, 120 + k * 40, '#fff');
        ctx.globalAlpha = 1;
        pill('prepare os presentes! ⬆️ sobe · ⬇️ desce', W / 2, H / 2 + 20, { size: 20, bg: 'rgba(8,10,24,.8)' });
      }
      if (this.ph === 'win') {
        ctx.fillStyle = 'rgba(8,10,24,.8)'; ctx.beginPath(); ctx.roundRect(50, H / 2 - 120, W - 100, 170, 30); ctx.fill(); ctx.strokeStyle = '#fde047'; ctx.lineWidth = 4; ctx.stroke();
        title(v.winText || 'CHEGOU NO TOPO!', W / 2, H / 2 - 66, 50, '#fde047');
        const top = [...this.helpers.values()].sort((a, b) => b.value - a.value)[0];
        if (top) { avatar(top.user, W / 2 - 150, H / 2 + 4, 30, '#fde047'); label(`maior ajuda: ${trim(top.user.nick, 14)} (+${top.value})`, W / 2 - 108, H / 2 + 6, 22, '#fff', 'left', 800); }
        else label(`${this.wins} vitórias`, W / 2, H / 2 + 6, 24, '#fff', 'center', 800);
      }
      if (this.s.showLeaderboard) {
        hudBoard([...this.helpers.values()].sort((a, b) => b.value - a.value), 16, 1000, 220, { title: 'AJUDARAM ⬆️', n: this.s.leaderboardSize, rowH: 30, color: '#4ade80' });
        hudBoard([...this.saboteurs.values()].sort((a, b) => b.value - a.value), W - 236, 1000, 220, { title: 'DERRUBARAM ⬇️', n: this.s.leaderboardSize, rowH: 30, color: '#f87171' });
      }
      this.feed.draw(20, 840);
    },
    drawGiftRail() {
      const binds = this.binds.filter((b) => b.on !== false && b.trigger === 'gift' && (b.giftId || b.giftName));
      const ups = binds.filter((b) => (CLIMB_ACTIONS.find((a) => a.id === b.action)?.dir || 0) > 0 || ['turbo', 'shield'].includes(b.action)).slice(0, 8);
      const downs = binds.filter((b) => (CLIMB_ACTIONS.find((a) => a.id === b.action)?.dir || 0) < 0 || b.action === 'freeze').slice(0, 8);
      const chip = (b, x, y, side) => {
        const act = CLIMB_ACTIONS.find((a) => a.id === b.action), up = side === 'L';
        const img = learnedGifts[b.giftId] ? getImg(proxImgUrl(learnedGifts[b.giftId])) : null;
        const gc = GIFT_CATALOG.find((g) => g.id === String(b.giftId)) || {};
        ctx.fillStyle = 'rgba(8,10,24,.62)'; ctx.beginPath(); ctx.roundRect(x, y, 92, 58, 14); ctx.fill();
        ctx.strokeStyle = up ? 'rgba(74,222,128,.6)' : 'rgba(248,113,113,.6)'; ctx.lineWidth = 2; ctx.stroke();
        if (img) ctx.drawImage(img, x + 6, y + 6, 30, 30);
        else { ctx.fillStyle = up ? '#14532d' : '#7f1d1d'; ctx.beginPath(); ctx.arc(x + 21, y + 21, 15, 0, 7); ctx.fill(); label(String(gc.coins ?? '🎁'), x + 21, y + 22, gc.coins >= 100 ? 11 : 14, '#fde047', 'center', 900); }
        const amt = typeof act?.n === 'number' && act.n ? `${act.dir > 0 ? '+' : '-'}${act.n}` : act?.id === 'down_checkpoint' ? '🚩' : act?.id === 'down_start' ? '☠️' : act?.icon || '';
        label(amt, x + 64, y + 22, 18, up ? '#4ade80' : '#f87171', 'center', 900);
        label(trim(b.giftName || gc.name || '', 11), x + 46, y + 48, 11, '#fff', 'center', 800);
      };
      ups.forEach((b, k) => chip(b, 10, 300 + k * 64, 'L'));
      downs.forEach((b, k) => chip(b, W - 102, 300 + k * 64, 'R'));
    },
  });
}

// ---------------- 1) Só Subindo: ilhas flutuantes em espiral ao redor de uma torre gigante ----------------
defineClimb({
  id: 'only-climb', char: 'sapo', name: 'Só Subindo', icon: '🧗', color: '#f59e0b', title: 'SÓ SUBINDO', titleColor: '#fde68a', target: 1000, cpEvery: 50, hop: 0.9, charH: 1.5, arc: 1.1,
  desc: 'O personagem sobe sozinho uma espiral de ilhas flutuantes em volta de uma torre gigante, um pulo de cada vez. Presentes fazem ele subir voando ou cair várias ilhas.',
  sky: ['#ffd29b', '#ff9f6e', '#a259c6', '#2a1b5c', '#05030f'],
  pos(i) { const a = i * 0.42, R = 4.2; return new THREE.Vector3(Math.cos(a) * R, i * 0.62, Math.sin(a) * R); },
  build(scene, g) {
    const T = THREE;
    // Torre central (pedra com faixas) que acompanha a altura
    const tex = G3.tex(256, 512, (c, w, h) => { c.fillStyle = '#7c6f64'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? 0 : 32; x < w; x += 64) { c.fillStyle = `hsl(28, 10%, ${36 + Math.random() * 14}%)`; c.fillRect(x + 2, y + 2, 60, 28); } }, [1, 1]);
    tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(3, 40);
    const H3 = g.s.target * 0.62 + 20;
    const tower = new T.Mesh(new T.CylinderGeometry(2.6, 3.2, H3, 24, 1, false), new T.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    tower.position.y = H3 / 2 - 10; tower.receiveShadow = true; scene.add(tower);
    const vine = new T.Mesh(new T.TorusKnotGeometry(2.9, 0.12, 400, 8, 1, 60), new T.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 0.8 }));
    vine.scale.y = 3; vine.position.y = 60; scene.add(vine);
    const ground = new T.Mesh(new T.CircleGeometry(80, 40), new T.MeshStandardMaterial({ color: 0x5fae4a, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.6; ground.receiveShadow = true; scene.add(ground);
    // Nuvens em várias alturas
    g.r.clouds = [];
    for (let k = 0; k < 40; k++) { const cl = new T.Group(); for (let j = 0; j < 4; j++) { const s = new T.Mesh(new T.SphereGeometry(rand(1.2, 2.2), 12, 10), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.9 })); s.position.set(j * 1.5 - 2, rand(-0.3, 0.4), rand(-0.5, 0.5)); cl.add(s); } const a = rand(0, 7), rr = rand(12, 26); cl.position.set(Math.cos(a) * rr, k * 16 + rand(0, 10), Math.sin(a) * rr); scene.add(cl); g.r.clouds.push(cl); }
    g.r.mats = { grass: new T.MeshStandardMaterial({ color: 0x6cc24a, roughness: 0.8 }), rock: new T.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.9, flatShading: true }), gold: new T.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6, roughness: 0.3, emissive: 0x6b4f00, emissiveIntensity: 0.4 }), flag: new T.MeshStandardMaterial({ color: 0xef4444, side: T.DoubleSide }) };
    g.r.geos = { top: new T.CylinderGeometry(0.85, 0.75, 0.3, 10), rock: new T.ConeGeometry(0.75, 1.2, 8), pole: new T.CylinderGeometry(0.04, 0.04, 1.6, 6), flag: new T.PlaneGeometry(0.7, 0.45) };
  },
  plat(i, g) {
    const T = THREE, r = g.r, grp = new T.Group(), cp = g.s.checkpointEvery > 0 && i > 0 && i % g.s.checkpointEvery === 0;
    const top = new T.Mesh(r.geos.top, cp ? r.mats.gold : r.mats.grass); top.position.y = -0.15; top.castShadow = true; top.receiveShadow = true; grp.add(top);
    const rock = new T.Mesh(r.geos.rock, r.mats.rock); rock.rotation.x = Math.PI; rock.position.y = -0.9; rock.rotation.y = i; grp.add(rock);
    if (cp || i === g.s.target) { const pole = new T.Mesh(r.geos.pole, r.mats.rock); pole.position.set(0.5, 0.8, 0); grp.add(pole); const fl = new T.Mesh(r.geos.flag, i === g.s.target ? r.mats.gold : r.mats.flag); fl.position.set(0.85, 1.4, 0); grp.add(fl); }
    return grp;
  },
  cam(p, g, yaw) { const a = Math.atan2(p.z, p.x) - 0.25; return [new THREE.Vector3(Math.cos(a) * 15, p.y + 4.2, Math.sin(a) * 15), new THREE.Vector3(p.x * 0.6, p.y + 1.4, p.z * 0.6)]; },
});

// ---------------- 2) Torre de Obstáculos: blocos coloridos em zigue-zague, checkpoints seguram a queda ----------------
const OBBY_COLS = ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9e00'];
defineClimb({
  id: 'obby-tower', char: 'cactoro', name: 'Torre de Obstáculos', icon: '🧱', color: '#06d6a0', title: 'TORRE DE OBSTÁCULOS', titleColor: '#a7f3d0', target: 500, cpEvery: 25, cpStops: true, hop: 0.8, charH: 1.4, arc: 1.0,
  desc: 'Percurso de obstáculos colorido: o personagem pula de bloco em bloco subindo em zigue-zague. A cada 25 blocos tem um checkpoint que segura as quedas (menos o presente que manda para o começo).',
  sky: ['#8ed6ff', '#5ab8ff', '#7f8cff', '#c77dff', '#ff8fab'],
  pos(i) {
    // Zigue-zague: anda 7 blocos para um lado, vira e volta, sempre subindo
    const lane = Math.floor(i / 7), k = i % 7, dir = lane % 2 ? -1 : 1;
    return new THREE.Vector3((k - 3) * 1.25 * dir, i * 0.55, -lane * 0.0 + (climbHash(i, 3) - 0.5) * 0.5);
  },
  build(scene, g) {
    const T = THREE;
    const ground = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshStandardMaterial({ color: 0x3ddc84, roughness: 0.9 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.6; ground.receiveShadow = true; scene.add(ground);
    // Pilares de fundo e faixas neon (profundidade)
    // Torres coloridas bem ao fundo (desbotadas pela névoa), para dar profundidade sem atrapalhar
    for (let k = 0; k < 26; k++) { const h = rand(40, 320), side = k % 2 ? 1 : -1, b = new T.Mesh(new T.BoxGeometry(rand(3, 6), h, rand(3, 6)), new T.MeshStandardMaterial({ color: new T.Color(pick(OBBY_COLS)).lerp(new T.Color('#9ad8ff'), 0.45), roughness: 0.7 })); b.position.set(side * rand(12, 45), h / 2 - 0.6, rand(-70, -35)); scene.add(b); }
    scene.fog.near = 25; scene.fog.far = 90;
    g.r.mats = OBBY_COLS.map((c) => new T.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.05 }));
    g.r.cpMat = new T.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x0b5d2a, emissiveIntensity: 0.6, roughness: 0.3 });
    g.r.killMat = new T.MeshBasicMaterial({ color: 0xff1744, toneMapped: false });
    g.r.geos = { block: new T.BoxGeometry(1.1, 0.4, 1.1), kill: new T.BoxGeometry(0.9, 0.08, 0.12), pole: new T.CylinderGeometry(0.05, 0.05, 1.8, 6), flag: new T.PlaneGeometry(0.75, 0.45) };
    g.r.white = new T.MeshStandardMaterial({ color: 0xffffff });
  },
  plat(i, g) {
    const T = THREE, r = g.r, grp = new T.Group(), cp = i > 0 && g.s.checkpointEvery > 0 && i % g.s.checkpointEvery === 0;
    const b = new T.Mesh(r.geos.block, cp ? r.cpMat : r.mats[i % r.mats.length]); b.position.y = -0.2; b.castShadow = true; b.receiveShadow = true; grp.add(b);
    // Barra vermelha de "perigo" girando em alguns blocos (enfeite do percurso)
    if (!cp && climbHash(i, 7) < 0.18) { const kb = new T.Mesh(r.geos.kill, r.killMat); kb.position.y = 0.25; kb.userData.spin = true; grp.add(kb); grp.userData.kill = kb; }
    if (cp || i === g.s.target) { const pole = new T.Mesh(r.geos.pole, r.white); pole.position.set(0.45, 0.9, 0); grp.add(pole); const fl = new T.Mesh(r.geos.flag, i === g.s.target ? r.mats[1] : r.cpMat); fl.position.set(0.82, 1.5, 0); grp.add(fl); }
    return grp;
  },
  tick(g) { const t = performance.now() / 600; for (const m of g.r.plats.values()) if (m.userData.kill) m.userData.kill.rotation.y = t * 2; },
  cam(p) { return [new THREE.Vector3(p.x * 0.35, p.y + 3.2, p.z + 13), new THREE.Vector3(p.x * 0.55, p.y + 1.4, p.z)]; },
});

// ---------------- 3) Rumo ao Céu 3D: pilha de objetos da cidade até o espaço, com portal no topo ----------------
const HEAVEN_TYPES = ['crate', 'barrel', 'car', 'beam', 'pipe', 'sofa', 'sign', 'cloud'];
defineClimb({
  id: 'only-heaven', char: 'astronauta', name: 'Rumo ao Céu 3D', icon: '☁️', color: '#38bdf8', title: 'RUMO AO CÉU', titleColor: '#e0f2fe', target: 300, cpEvery: 0, hop: 1.0, charH: 1.5, arc: 1.3,
  desc: 'Subida vertical por uma pilha de objetos (caixas, barris, carros, vigas, nuvens) saindo da cidade, passando pelas nuvens e chegando ao espaço, até o Portal do Céu. Presentes fazem voar ou despencar.',
  winText: 'CHEGOU AO CÉU!',
  unit(step) { return `${(step * 3.2).toFixed(0)} m`; },
  sky: ['#9fd3ff', '#cfe8ff', '#ffb27d', '#5b3c88', '#0b0b2a', '#000005'],
  pos(i) {
    if (i === 0) return new THREE.Vector3(0, 0, 0);
    const a = climbHash(i, 1) * Math.PI * 2, rr = 1.2 + climbHash(i, 2) * 1.6;
    return new THREE.Vector3(Math.cos(a) * rr, i * 1.05, Math.sin(a) * rr * 0.7);
  },
  build(scene, g) {
    const T = THREE;
    // Cidade lá embaixo
    const ground = new T.Mesh(new T.PlaneGeometry(300, 300), new T.MeshStandardMaterial({ color: 0x6b7280, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.6; ground.receiveShadow = true; scene.add(ground);
    // Prédios em volta, longe do caminho e da câmera (que fica na frente, em +z)
    for (let k = 0, made = 0; k < 400 && made < 70; k++) {
      const a = rand(0, Math.PI * 2), rr = rand(18, 90), x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (z > -8 && Math.abs(x) < 22) continue;
      const h = rand(8, 50), b = new T.Mesh(new T.BoxGeometry(rand(4, 9), h, rand(4, 9)), new T.MeshStandardMaterial({ color: new T.Color().setHSL(0.6, 0.12, rand(0.4, 0.7)), roughness: 0.8 }));
      b.position.set(x, h / 2 - 0.6, z); scene.add(b); made++;
    }
    // Mar de nuvens no meio do caminho e estrelas lá em cima
    const cloudY = g.s.target * 1.05 * 0.35;
    for (let k = 0; k < 60; k++) { const s = new T.Mesh(new T.SphereGeometry(rand(3, 7), 12, 10), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.85 })); const a = rand(0, 7), rr = rand(8, 60); s.position.set(Math.cos(a) * rr, cloudY + rand(-3, 3), Math.sin(a) * rr); s.scale.y = 0.45; scene.add(s); }
    const starG = new T.BufferGeometry(), pts = [];
    for (let k = 0; k < 1500; k++) { const a = rand(0, 7), e = rand(-0.2, 1.2), rr = 150; pts.push(Math.cos(a) * rr, g.s.target * 1.05 * 0.7 + Math.sin(e) * rr, Math.sin(a) * rr); }
    starG.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    scene.add(new T.Points(starG, new T.PointsMaterial({ color: 0xffffff, size: 0.6, sizeAttenuation: true })));
    // Portal do Céu no topo
    const portal = new T.Group();
    const ring = new T.Mesh(new T.TorusGeometry(3, 0.35, 16, 48), new T.MeshStandardMaterial({ color: 0xfde047, emissive: 0xfacc15, emissiveIntensity: 1.2, metalness: 0.8, roughness: 0.2 }));
    const glow = new T.Mesh(new T.CircleGeometry(2.8, 40), new T.MeshBasicMaterial({ color: 0xfff7cc, transparent: true, opacity: 0.55, toneMapped: false, side: T.DoubleSide }));
    portal.add(ring, glow); const top = g.pos(g.s.target); portal.position.set(top.x, top.y + 3.2, top.z - 1); scene.add(portal); g.r.portal = portal;
    const m = (c, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
    g.r.mats = { wood: m(0xa16207), metal: m(0x9ca3af, { metalness: 0.6, roughness: 0.35 }), red: m(0xdc2626), blue: m(0x2563eb), sofa: m(0x7c3aed), white: m(0xf8fafc), cloud: m(0xffffff, { roughness: 1 }), tire: m(0x111827), glass: m(0x93c5fd, { metalness: 0.3, roughness: 0.1 }) };
    g.r.geos = { crate: new T.BoxGeometry(1.4, 1, 1.4), barrel: new T.CylinderGeometry(0.6, 0.6, 1.1, 14), carBody: new T.BoxGeometry(2.2, 0.6, 1.2), carTop: new T.BoxGeometry(1.2, 0.5, 1.1), wheel: new T.CylinderGeometry(0.28, 0.28, 0.2, 12), beam: new T.BoxGeometry(2.6, 0.35, 0.6), pipe: new T.CylinderGeometry(0.4, 0.4, 2.4, 14), sofaSeat: new T.BoxGeometry(1.8, 0.45, 0.9), sofaBack: new T.BoxGeometry(1.8, 0.7, 0.25), signPole: new T.CylinderGeometry(0.06, 0.06, 1.2, 6), signTop: new T.BoxGeometry(1.4, 0.5, 0.08), puff: new T.SphereGeometry(0.75, 12, 10) };
  },
  plat(i, g) {
    const T = THREE, r = g.r, M = r.mats, G = r.geos, grp = new T.Group();
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new T.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; o.receiveShadow = true; grp.add(o); return o; };
    const t = i === 0 ? 'crate' : HEAVEN_TYPES[Math.floor(climbHash(i, 5) * (i > 120 ? HEAVEN_TYPES.length : HEAVEN_TYPES.length - 1))];
    if (t === 'crate') add(G.crate, M.wood, 0, -0.5, 0);
    else if (t === 'barrel') add(G.barrel, climbHash(i, 9) < 0.5 ? M.red : M.blue, 0, -0.55, 0);
    else if (t === 'car') { add(G.carBody, climbHash(i, 9) < 0.5 ? M.red : M.blue, 0, -0.3, 0); add(G.carTop, M.glass, -0.1, 0.05, 0); for (const [x, z] of [[-0.7, 0.6], [0.7, 0.6], [-0.7, -0.6], [0.7, -0.6]]) add(G.wheel, M.tire, x, -0.6, z, Math.PI / 2); }
    else if (t === 'beam') add(G.beam, M.metal, 0, -0.18, 0, 0, climbHash(i, 4) * 3);
    else if (t === 'pipe') add(G.pipe, M.metal, 0, -0.4, 0, 0, climbHash(i, 4) * 3, Math.PI / 2);
    else if (t === 'sofa') { add(G.sofaSeat, M.sofa, 0, -0.22, 0); add(G.sofaBack, M.sofa, 0, 0.1, -0.35); }
    else if (t === 'sign') { add(G.crate, M.wood, 0, -0.5, 0); add(G.signPole, M.metal, 0.5, 0.6, -0.5); add(G.signTop, M.white, 0.5, 1.2, -0.5); }
    else { for (let k = 0; k < 3; k++) add(G.puff, M.cloud, (k - 1) * 0.7, -0.45, (climbHash(i, k) - 0.5) * 0.4).scale.y = 0.6; }
    grp.rotation.y = climbHash(i, 8) * 0.6 - 0.3;
    return grp;
  },
  tick(g) { if (g.r.portal) { g.r.portal.rotation.y = performance.now() / 2000; } },
  cam(p) { return [new THREE.Vector3(p.x * 0.3 + 3, p.y + 2.8, p.z + 11.5), new THREE.Vector3(p.x, p.y + 2.2, p.z)]; },
});
