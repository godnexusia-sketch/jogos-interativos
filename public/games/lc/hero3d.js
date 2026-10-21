'use strict';

// Heróis em 3D: Corrida Lunar, Torre Empilhada, Muralha de Blocos e Porquinho Voador 3D.

// Fila de efeitos que chegam do chat (com voo do emoji em 2D por cima da cena).
const Effects3D = {
  queue(g, d, a, good, amount) {
    g.fly = g.fly || new Flyers();
    g.pend = g.pend || [];
    g.fly.push(d[2], good ? 70 : W - 70, good ? 1150 : 260, W / 2, 640, a.user, d[1], good);
    g.pend.push({ amt: good ? amount : -amount, user: a.user, name: d[1], good, id: d[0] });
  },
  tick(g, dt, apply) { g.fly?.update(dt, () => { const p = g.pend.shift(); if (p) apply(p); }); },
};
function helperOf(lists, id) { for (const [list, good] of lists) { const d = list.find((x) => x[0] === id); if (d) return [d, good]; } return [null]; }
// Personagem 3D principal (Character3D) dos jogos abaixo: cria, troca quando o personagem muda e desmonta a cena.
const Hero3D = {
  make(g, o = {}) { const c = new Character3D({ kind: g.kind(), height: 1.6, plate: false, base: 'idle', ...o }); g.r.scene.add(c.root); g.r.char = c; g.r.charKind = g.kind(); return c; },
  // Chamado a cada quadro: troca o boneco se o personagem mudou (painel ou chat) e anima
  tick(g, dt, o, onNew) {
    const r = g.r; if (!r?.char) return null;
    if (r.charKind !== g.kind()) { const old = r.char, p = old.root.position.clone(), ry = old.root.rotation.y; old.dispose(); const c = Hero3D.make(g, o); c.root.position.copy(p); c.root.rotation.y = ry; onNew?.(c); }
    r.char.update(dt); return r.char;
  },
  play(g, st, o) { g.r?.char?.play(st, o); },
  say(g, txt) { g.r?.char?.say(txt, { secs: 2 }); },
  leave(g) {
    const r = g.r; if (!r) return;
    r.char?.dispose();
    r.scene.traverse((m) => { if (m.isMesh || m.isInstancedMesh || m.isPoints) { m.geometry?.dispose(); (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => { x?.map?.dispose?.(); x?.dispose?.(); }); } });
    g.r = null;
  },
};
const nickOf = (u) => String(u?.nick || u?.uniqueId || u?.name || '').slice(0, 14);

// ---------------- Corrida Lunar (Lunar Dash) ----------------
const LUNAR_HELP = [['mech_escort', 'Robô escolta', '🤖', 4], ['rover_turbo', 'Jipe lunar', '🚙', 12], ['rocket_boost', 'Foguete', '🚀', 30], ['spaceship_rush', 'Nave espacial', '🛸', 70]];
const LUNAR_SAB = [['planet_pull', 'Puxão de planeta', '🪐', 3], ['enemy_charge', 'Alien atacando', '👾', 5], ['meteor_strike', 'Meteoro', '☄️', 10], ['gravity_well', 'Poço de gravidade', '🌀', 25], ['ufo_lift', 'Abdução de OVNI', '👽', 40], ['enemy_swarm', 'Enxame alienígena', '🦠', 70]];
defineGame({
  id: 'lunar-dash', name: 'Corrida Lunar', genre: 'arcade', icon: '🌕', color: '#94a3b8', three: true,
  desc: 'O chat leva um astronauta até a chegada. Presentes compram foguete ou nave, ou sabotam com poço de gravidade, OVNI e enxame de aliens.',
  help: '<p>O astronauta corre sozinho na Lua até a chegada. Ajuda: 🤖 robô (likes), 🚙 jipe, 🚀 foguete, 🛸 nave. Atrapalha: 🪐 puxão, 👾 alien e ☄️ meteoro (comentários), 🌀 gravidade, 👽 OVNI, 🦠 enxame (presentes).</p>',
  settings: [
    { key: 'controlMode', type: 'select', label: 'Quem corre', options: [['auto', 'Automático'], ['manual', 'Eu (espaço acelera)']], default: 'auto' },
    { key: 'metersPerRound', type: 'number', label: 'Metros até a chegada', min: 100, max: 10000, default: 1000 },
    { key: 'runSpeed', type: 'number', label: 'Metros por segundo sozinho', min: 0, max: 30, default: 6 },
    { key: 'totalWins', type: 'number', label: 'Vitórias para fechar a partida', min: 1, max: 20, default: 3 },
    charSetting('character', 'Personagem do corredor'),
  ],
  hasChars: true,
  kind() { return this.charOverride && CHARACTERS[this.charOverride] ? this.charOverride : pickKind(this.s.character || 'astronauta', 0, 'lunar-dash'); },
  onCharPick(user, k) { this.charOverride = k; },
  enter() { Assets3D.preload([this.kind()]); },
  leave() { Hero3D.leave(this); },
  actions: [...helperActions(LUNAR_HELP), ...helperActions(LUNAR_SAB)],
  bindings: [{ action: 'mech_escort', trigger: 'like', likes: 15 }, { action: 'planet_pull', trigger: 'comment', text: 'puxa,planeta' }, { action: 'enemy_charge', trigger: 'comment', text: 'alien' }, { action: 'meteor_strike', trigger: 'comment', text: 'meteoro' }, { action: 'rover_turbo', trigger: 'gift', minCoins: 1 }, { action: 'rocket_boost', trigger: 'gift', minCoins: 30 }, { action: 'spaceship_rush', trigger: 'gift', minCoins: 299 }, { action: 'gravity_well', trigger: 'gift', minCoins: 99, on: false }],
  reset() { this.m = 0; this.vel = 0; this.wins = this.wins || 0; this.feed = new Feed(4); this.fly = new Flyers(); this.pend = []; this.cele = 0; this.lift = 0; this.vehicle = null; },
  sample() { return pick(['vai', 'alien', 'meteoro', 'puxa']); },
  onAction(id, a) { const [d, good] = helperOf([[LUNAR_HELP, true], [LUNAR_SAB, false]], id); if (d) Effects3D.queue(this, d, a, good, d[3] * (a.gift ? Math.max(1, a.power / 3) : 1)); },
  onPress() { if (this.s.controlMode === 'manual') this.vel += 4; },
  update(dt) {
    this.feed.update(dt);
    // Corredor 3D: corre em loop, para e comemora na chegada
    const c = Hero3D.tick(this, dt, { height: 1.8, base: this.cele ? 'idle' : 'run' });
    if (c) { if (!this.cele && c.base !== 'run') c.play('run'); if (c.state === 'run' && c.cur) c.cur.timeScale = clamp(0.8 + Math.abs(this.vel) * 0.12, 0.8, 1.8); }
    this.cele = Math.max(0, this.cele - dt); this.lift = Math.max(0, this.lift - dt);
    if (this.vehicle && (this.vehicle.t -= dt) <= 0) this.vehicle = null;
    Effects3D.tick(this, dt, (p) => {
      if (p.good) { this.vel += p.amt; this.vehicle = { id: p.id, t: 2.5 }; sfx.pop(); Hero3D.play(this, p.id === 'rocket_boost' || p.id === 'spaceship_rush' ? 'jump' : 'powerUp', { speed: 1.2 }); Hero3D.say(this, `valeu ${nickOf(p.user)}!`); }
      else { this.vel -= p.amt; if (p.id === 'ufo_lift') this.lift = 2.5; sfx.boom(); Hero3D.play(this, 'hit'); this.r?.char?.hitFlash('#ff4d6d', 1); }
      this.feed.push(p.user, `${p.name} ${p.good ? '+' : '−'}${Math.round(Math.abs(p.amt) * 3)}m`, p.good ? '#7cff6b' : '#ff6b8a');
    });
    if (this.cele) return;
    const base = this.s.controlMode === 'auto' ? this.s.runSpeed : 0;
    this.m = clamp(this.m + (base + this.vel * 3) * dt, 0, this.s.metersPerRound);
    this.vel *= 1 - dt * 0.9;
    if (this.m >= this.s.metersPerRound) { this.wins++; this.cele = 4; this.m = 0; this.vel = 0; sfx.win(); Hero3D.play(this, 'idle'); Hero3D.play(this, 'victory', { then: 'taunt' }); confetti(140); voice.say(this.wins >= this.s.totalWins ? 'Campeão da corrida lunar!' : 'Chegou! Pouso perfeito.'); if (this.wins >= this.s.totalWins) this.wins = 0; }
  },
  scene3d() {
    if (this.r || !G3.ready) return this.r;
    const T = THREE, scene = new T.Scene();
    scene.background = new T.Color('#02030a');
    G3.lights(scene, { hemi: 0.5, sun: 2.6, pos: [-30, 40, 20], sky: 0xcbd5e1, ground: 0x111111 });
    const ground = new T.Mesh(new T.PlaneGeometry(80, 400, 40, 200), new T.MeshStandardMaterial({ map: G3.tex(256, 256, (g) => { g.fillStyle = '#8a8f98'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 70; i++) { const r = rand(4, 22), x = rand(0, 256), y = rand(0, 256); g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(x - 2, y - 2, r * 0.7, 0, 7); g.fill(); } }, [8, 40]), roughness: 1 }));
    const pos = ground.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 0.3) * 0.4 + Math.cos(pos.getY(i) * 0.2) * 0.4);
    ground.geometry.computeVertexNormals();
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const stars = new T.Points(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(Array.from({ length: 3000 }, (_, i) => (i % 3 === 1 ? rand(5, 120) : rand(-200, 200))), 3)), new T.PointsMaterial({ color: 0xffffff, size: 0.4 }));
    scene.add(stars);
    const earth = new T.Mesh(new T.SphereGeometry(14, 48, 32), new T.MeshStandardMaterial({ map: G3.tex(256, 128, (g) => { g.fillStyle = '#1d4ed8'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#16a34a'; for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(rand(0, 256), rand(20, 108), rand(10, 30), rand(6, 18), rand(0, 3), 0, 7); g.fill(); } g.fillStyle = 'rgba(255,255,255,.6)'; for (let i = 0; i < 20; i++) g.fillRect(rand(0, 256), rand(0, 128), rand(10, 40), 3); }), emissive: 0x0a1a40, emissiveIntensity: 0.4 }));
    earth.position.set(-40, 45, -150); scene.add(earth);
    const flag = new T.Group();
    const pole = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 4), new T.MeshStandardMaterial({ color: 0xdddddd })); pole.position.y = 2; flag.add(pole);
    const cloth = new T.Mesh(new T.PlaneGeometry(2, 1.2), new T.MeshStandardMaterial({ color: 0xff2d55, side: T.DoubleSide })); cloth.position.set(1, 3.3, 0); flag.add(cloth);
    scene.add(flag);
    const ufo = new T.Group();
    ufo.add(new T.Mesh(new T.SphereGeometry(1.6, 24, 12), new T.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 }))).scale.set(1, 0.3, 1);
    const dome = new T.Mesh(new T.SphereGeometry(0.7, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: 0x22e3ee, transparent: true, opacity: 0.6 })); dome.position.y = 0.3; ufo.add(dome);
    scene.add(ufo);
    const cam = new T.PerspectiveCamera(50, W / H, 0.1, 400);
    this.r = { scene, cam, ground, flag, ufo };
    Hero3D.make(this, { height: 1.8, base: 'run' }).root.rotation.y = Math.PI; // corre para -z (de costas para a câmera)
    return this.r;
  },
  draw() {
    const r = this.scene3d(), t = performance.now() / 1000;
    if (r) {
      const z = -this.m * 0.12;
      r.char.root.position.set(0, this.lift ? Math.sin(Math.min(1, (2.5 - this.lift)) * Math.PI) * 4 : 0, z);
      r.char.root.rotation.y = this.cele ? 0 : Math.PI; // na chegada vira para a câmera
      r.ufo.position.set(0, this.lift ? 7 : 30, z);
      r.ground.position.z = Math.floor(z / 10) * 10 - 150;
      const fz = -this.s.metersPerRound * 0.12;
      r.flag.position.set(-2, 0, fz);
      r.cam.position.set(Math.sin(t * 0.3) * 2, 4.2, z + 11); r.cam.lookAt(0, 1.6, z - 8);
      G3.render(r.scene, r.cam);
    } else stageBg('night');
    if (this.vehicle) label({ rover_turbo: '🚙', rocket_boost: '🚀', spaceship_rush: '🛸', mech_escort: '🤖' }[this.vehicle.id], W / 2 + 90, 800, 90, '#fff', 'center', 400);
    this.fly.draw();
    title('CORRIDA LUNAR', W / 2, 54, 46, '#e2e8f0');
    panel(W / 2 - 200, 86, 400, 60, { r: 16 });
    num(`${Math.floor(this.m)} m / ${this.s.metersPerRound} m`, W / 2, 116, 38);
    glossBar(40, 160, W - 80, 16, this.m / this.s.metersPerRound, '#e2e8f0');
    label(`🏆 ${this.wins}/${this.s.totalWins}`, W - 40, 198, 20, '#fff', 'right', 900);
    this.feed.draw(20, 1000);
    if (this.cele) title('CHEGOU!', W / 2, 460, 70, '#ffc93c');
  },
});

// ---------------- Torre Empilhada (Stack Tower) ----------------
const STACK_HELP = [['balloons', 'Balões', '🎈', 2], ['rocket', 'Foguete', '🚀', 5], ['dragon', 'Dragão', '🐉', 10], ['superman', 'Super-herói', '🦸', 20]];
const STACK_SAB = [['finger', 'Dedo', '👉', 1], ['axe', 'Machado', '🪓', 3], ['bomb', 'Bomba', '💣', 6], ['hulk', 'Brutamontes', '💪', 12]];
defineGame({
  id: 'tower-stack', name: 'Torre Empilhada', genre: 'arcade', icon: '🧱', color: '#f472b6', three: true,
  desc: 'Um bloco desliza no topo e cai na pilha: alinhado, empilha certinho; errou, a sobra é cortada. O chat joga lotes de blocos ou derruba a torre, e o céu muda do dia ao espaço conforme o recorde cresce.',
  help: '<p>O bloco desliza e cai sozinho (ou aperte <b>espaço</b> no modo manual). O chat <b>ajuda</b> com lotes de blocos perfeitos 🎈🚀🐉🦸 ou <b>derruba</b> 👉🪓💣💪. O céu vai do dia ao <b>espaço</b> conforme a torre sobe.</p>',
  settings: [
    { key: 'controlMode', type: 'select', label: 'Quem joga', options: [['auto', 'Automático'], ['manual', 'Eu (espaço solta o bloco)']], default: 'auto' },
    { key: 'autoStackRate', type: 'number', label: 'Precisão do automático (0–1)', min: 0, max: 1, step: 0.05, default: 0.8 },
    { key: 'winGoalHeight', type: 'number', label: 'Altura para vencer', min: 10, max: 1000, default: 100 },
    { key: 'winTarget', type: 'number', label: 'Vitórias para fechar a partida', min: 1, max: 20, default: 3 },
    charSetting('character', 'Personagem da torre'),
  ],
  hasChars: true,
  kind() { return this.charOverride && CHARACTERS[this.charOverride] ? this.charOverride : pickKind(this.s.character || 'maga', 0, 'tower-stack'); },
  onCharPick(user, k) { this.charOverride = k; },
  enter() { Assets3D.preload([this.kind()]); },
  leave() { Hero3D.leave(this); },
  actions: [...helperActions(STACK_HELP), ...helperActions(STACK_SAB), ...WIN_ACTIONS],
  bindings: [{ action: 'balloons', trigger: 'like', likes: 20 }, { action: 'rocket', trigger: 'gift', minCoins: 1 }, { action: 'dragon', trigger: 'gift', minCoins: 30 }, { action: 'superman', trigger: 'gift', minCoins: 299 }, { action: 'finger', trigger: 'comment', text: 'cai,derruba' }],
  reset() { this.stack = [{ x: 0, z: 0, w: 4, d: 4 }]; this.cur = null; this.dir = 0; this.best = this.best || 0; this.wins = this.wins || 0; this.feed = new Feed(4); this.fly = new Flyers(); this.pend = []; this.falling = []; this.batch = 0; this.cele = 0; this.newBlock(); },
  sample() { return pick(['vai', 'cai', 'empilha']); },
  newBlock() { const top = this.stack[this.stack.length - 1]; this.dir = 1 - this.dir; this.cur = { ...top, t: 0, axis: this.dir ? 'x' : 'z' }; this.cur[this.cur.axis] = -7; },
  onAction(id, a) {
    if (id === 'award_win') return this.win();
    if (id === 'steal_win') { this.wins = Math.max(0, this.wins - 1); return; }
    const [d, good] = helperOf([[STACK_HELP, true], [STACK_SAB, false]], id);
    if (d) Effects3D.queue(this, d, a, good, Math.round(d[3] * (a.gift ? Math.max(1, a.power / 4) : 1)));
  },
  onPress() { if (this.s.controlMode === 'manual') this.drop(false); },
  drop(perfect) {
    const top = this.stack[this.stack.length - 1], c = this.cur, ax = c.axis, size = ax === 'x' ? 'w' : 'd';
    if (perfect) c[ax] = top[ax];
    const delta = c[ax] - top[ax], over = Math.abs(delta);
    if (over >= top[size]) { this.falling.push({ ...c, vy: 0, t: 0 }); this.gameOver(); return; }
    const keep = top[size] - over;
    if (over > 0.05) this.falling.push({ ...c, [size]: over, [ax]: c[ax] + Math.sign(delta) * (keep / 2 + over / 2), vy: 0, t: 0 });
    else c[ax] = top[ax];
    const nb = { x: c.x, z: c.z, w: c.w, d: c.d };
    nb[size] = over > 0.05 ? keep : top[size]; nb[ax] = over > 0.05 ? top[ax] + delta / 2 : top[ax];
    this.stack.push(nb);
    sfx.tone(300 + Math.min(this.stack.length, 60) * 12, 0.08, over < 0.05 ? 'triangle' : 'square', 0.08);
    this.best = Math.max(this.best, this.stack.length - 1);
    if (this.stack.length - 1 >= this.s.winGoalHeight) this.win(); else this.newBlock();
  },
  win() { this.wins++; this.cele = 4; sfx.win(); confetti(160); voice.say(`Torre de ${this.stack.length - 1} andares!`); Hero3D.play(this, 'victory', { then: 'taunt' }); if (this.wins >= this.s.winTarget) this.wins = 0; this.stack = [{ x: 0, z: 0, w: 4, d: 4 }]; this.newBlock(); },
  gameOver() { sfx.boom(); this.overT = 2.5; Hero3D.play(this, 'hit'); this.r?.char?.hitFlash('#ff4d6d', 1); voice.say(`Caiu! A torre teve ${this.stack.length - 1} andares.`); },
  // Mago(a) 3D num disco flutuante ao lado da torre: sobe junto com o topo e reage ao chat
  hero(dt) {
    const c = Hero3D.tick(this, dt, { height: 3.2, loadout: 'weapon' }), r = this.r; if (!c) return;
    const y = Math.max(-0.5, this.stack.length - 1.5), p = c.root.position;
    p.y += (y - p.y) * Math.min(1, dt * 4);
    r.disc.position.set(p.x, p.y - 0.18, p.z); r.disc.rotation.y += dt;
    const face = c.busy && (c.state === 'cast' || c.state === 'powerUp') ? -Math.PI / 4 : Math.PI / 4; // lança o feitiço olhando a torre
    c.root.rotation.y += (face - c.root.rotation.y) * Math.min(1, dt * 8);
  },
  update(dt) {
    this.feed.update(dt);
    this.hero(dt);
    this.cele = Math.max(0, this.cele - dt);
    for (const f of this.falling) { f.t += dt; f.vy -= 25 * dt; f.y = (f.y ?? 0) + f.vy * dt; }
    this.falling = this.falling.filter((f) => f.t < 3);
    if (this.overT > 0) { this.overT -= dt; if (this.overT <= 0) { this.stack = [{ x: 0, z: 0, w: 4, d: 4 }]; this.newBlock(); } return; }
    Effects3D.tick(this, dt, (p) => {
      if (p.good) { this.batch += p.amt; Hero3D.play(this, 'cast', { then: 'powerUp' }); Hero3D.say(this, `valeu ${nickOf(p.user)}!`); }
      else { const n = Math.min(this.stack.length - 1, p.amt); for (let i = 0; i < n; i++) { const b = this.stack.pop(); this.falling.push({ ...b, y: this.stack.length, vy: rand(2, 6), t: 0, spin: rand(-3, 3) }); } this.newBlock(); sfx.boom(); Hero3D.play(this, 'hit'); this.r?.char?.hitFlash('#ff4d6d', 1); }
      this.feed.push(p.user, `${p.name}: ${p.amt > 0 ? '+' : ''}${p.amt} blocos`, p.good ? '#7cff6b' : '#ff6b8a');
    });
    const c = this.cur;
    if (!c) return;
    if (this.batch > 0) { this.batchT = (this.batchT || 0) + dt; if (this.batchT > 0.12) { this.batchT = 0; this.batch--; this.drop(true); } return; }
    c.t += dt;
    const speed = 5 + Math.min(this.stack.length, 80) * 0.06;
    c[c.axis] = Math.sin(c.t * speed / 3.5 - Math.PI / 2) * 7;
    // Automático: solta quando está perto do alinhamento (com erro conforme a precisão)
    if (this.s.controlMode === 'auto') { const top = this.stack[this.stack.length - 1]; const err = (1 - this.s.autoStackRate) * 1.6; if (Math.abs(c[c.axis] - top[c.axis]) < 0.1 + Math.random() * err && c.t > 0.6) this.drop(false); }
  },
  scene3d() {
    if (this.r || !G3.ready) return this.r;
    const T = THREE, scene = new T.Scene();
    G3.lights(scene, { hemi: 1, sun: 2, pos: [10, 30, 15] });
    const box = new T.BoxGeometry(1, 1, 1);
    const blocks = new T.InstancedMesh(box, new T.MeshStandardMaterial({ roughness: 0.5 }), 260); blocks.frustumCulled = false; scene.add(blocks);
    const cur = new T.Mesh(box, new T.MeshStandardMaterial({ roughness: 0.4 })); scene.add(cur);
    const fall = new T.InstancedMesh(box, new T.MeshStandardMaterial({ roughness: 0.5 }), 40); fall.frustumCulled = false; scene.add(fall);
    const stars = new T.Points(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(Array.from({ length: 2400 }, () => rand(-120, 120)), 3)), new T.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0 }));
    scene.add(stars);
    const cam = new T.OrthographicCamera(-9, 9, 16, -16, 0.1, 400);
    const disc = new T.Mesh(new T.CylinderGeometry(1.5, 1.1, 0.35, 32), new T.MeshStandardMaterial({ color: 0xf5f3ff, emissive: 0xa78bfa, emissiveIntensity: 0.45, roughness: 0.4 })); scene.add(disc);
    this.r = { scene, blocks, cur, fall, stars, cam, disc, d: new T.Object3D(), col: new T.Color() };
    const c = Hero3D.make(this, { height: 3.2, loadout: 'weapon' }); c.root.position.set(5, Math.max(-0.5, this.stack.length - 1.5), -5); c.root.rotation.y = Math.PI / 4;
    return this.r;
  },
  draw() {
    const r = this.scene3d(), T = THREE;
    const h = this.stack.length - 1;
    if (r) {
      // Céu: dia → pôr do sol → noite → espaço
      const k = clamp(h / Math.max(20, this.s.winGoalHeight), 0, 1);
      const sky = new T.Color().setHSL(0.58 - k * 0.5, 0.6, 0.6 - k * 0.55);
      r.scene.background = sky; r.stars.material.opacity = clamp((k - 0.5) * 2, 0, 1);
      const show = this.stack.slice(-220);
      const off = this.stack.length - show.length;
      show.forEach((b, i) => { r.d.position.set(b.x, off + i, b.z); r.d.scale.set(b.w, 1, b.d); r.d.rotation.set(0, 0, 0); r.d.updateMatrix(); r.blocks.setMatrixAt(i, r.d.matrix); r.blocks.setColorAt(i, r.col.setHSL(((off + i) * 0.025) % 1, 0.65, 0.55)); });
      for (let i = show.length; i < 260; i++) { r.d.position.set(0, -999, 0); r.d.updateMatrix(); r.blocks.setMatrixAt(i, r.d.matrix); }
      r.blocks.instanceMatrix.needsUpdate = true; if (r.blocks.instanceColor) r.blocks.instanceColor.needsUpdate = true;
      const c = this.cur;
      if (c && !(this.overT > 0)) { r.cur.visible = true; r.cur.position.set(c.x, this.stack.length, c.z); r.cur.scale.set(c.w, 1, c.d); r.cur.material.color.setHSL((this.stack.length * 0.025) % 1, 0.65, 0.6); } else r.cur.visible = false;
      this.falling.slice(0, 40).forEach((f, i) => { r.d.position.set(f.x, (f.y ?? this.stack.length) , f.z); r.d.scale.set(f.w, 1, f.d); r.d.rotation.set(f.t * (f.spin || 1), 0, f.t); r.d.updateMatrix(); r.fall.setMatrixAt(i, r.d.matrix); });
      for (let i = Math.min(40, this.falling.length); i < 40; i++) { r.d.position.set(0, -999, 0); r.d.updateMatrix(); r.fall.setMatrixAt(i, r.d.matrix); }
      r.fall.instanceMatrix.needsUpdate = true;
      const camY = this.stack.length + 2;
      r.cam.position.set(14, camY + 14, 14); r.cam.lookAt(0, camY - 4, 0);
      G3.render(r.scene, r.cam);
    } else stageBg('pink');
    this.fly.draw();
    title('TORRE EMPILHADA', W / 2, 54, 46);
    panel(W / 2 - 150, 86, 300, 60, { r: 16 });
    num(`${h} / ${this.s.winGoalHeight}`, W / 2, 116, 40);
    label(`Recorde ${this.best} · 🏆 ${this.wins}/${this.s.winTarget}${this.batch ? ' · lote +' + this.batch : ''}`, W / 2, 168, 18, '#fff', 'center', 900);
    this.feed.draw(20, 1000);
    if (this.overT > 0) title('CAIU!', W / 2, 460, 80, '#ff6b8a');
    if (this.cele) title('TORRE COMPLETA!', W / 2, 460, 60, '#ffc93c');
  },
});

// ---------------- Muralha de Blocos (Voxel Craft) ----------------
const VOX_HELP = [['build', 'Construir', '🧱', 2], ['chicken', 'Galinhas construtoras', '🐔', 6], ['phoenix_architect', 'Fênix arquiteta', '🔥', 14], ['sky_whale', 'Baleia do céu', '🐋', 30]];
const VOX_SAB = [['zap', 'Raio', '⚡', 3], ['tnt', 'Dinamite', '🧨', 8], ['tornado', 'Tornado', '🌪️', 16], ['black_hole', 'Buraco negro', '🕳️', 32]];
defineGame({
  id: 'voxel-craft', name: 'Muralha de Blocos', genre: 'arcade', icon: '⛏️', color: '#65a30d', three: true,
  desc: 'Construa uma muralha de blocos ao vivo enquanto o chat ajuda e destrói. Presentes mandam galinhas, fênix e baleias para construir, ou dinamite e tornados para quebrar.',
  help: '<p>A muralha se constrói sozinha devagar. ❤️ Likes e presentes de ajuda colocam blocos 🧱🐔🔥🐋; presentes de sabotagem quebram ⚡🧨🌪️🕳️.</p><p>Muralha completa e de pé por alguns segundos = <b>vitória</b>.</p>',
  settings: [
    { key: 'autoBuild', type: 'number', label: 'Blocos por segundo sozinho', min: 0, max: 10, step: 0.5, default: 1 },
    { key: 'defenseSeconds', type: 'number', label: 'Segundos de pé para vencer', min: 1, max: 60, default: 8 },
    { key: 'winGoal', type: 'number', label: 'Vitórias para fechar a partida', min: 1, max: 20, default: 3 },
    { key: 'blockStyle', type: 'select', label: 'Blocos', options: [['grass', 'Grama e terra'], ['stone', 'Pedra'], ['candy', 'Doces']], default: 'grass' },
    charSetting('character', 'Personagem construtor'),
  ],
  hasChars: true,
  kind() { return this.charOverride && CHARACTERS[this.charOverride] ? this.charOverride : pickKind(this.s.character || 'aventureiro', 0, 'voxel-craft'); },
  onCharPick(user, k) { this.charOverride = k; },
  enter() { Assets3D.preload([this.kind()]); },
  leave() { Hero3D.leave(this); },
  actions: [...helperActions(VOX_HELP), ...helperActions(VOX_SAB), ...WIN_ACTIONS],
  bindings: [{ action: 'build', trigger: 'like', likes: 10 }, { action: 'chicken', trigger: 'gift', minCoins: 1 }, { action: 'phoenix_architect', trigger: 'gift', minCoins: 30 }, { action: 'sky_whale', trigger: 'gift', minCoins: 299 }, { action: 'zap', trigger: 'follow' }],
  reset() { this.C = 12; this.R = 9; this.grid = new Array(this.C * this.R).fill(0); this.wins = this.wins || 0; this.feed = new Feed(4); this.fly = new Flyers(); this.pend = []; this.hold = 0; this.cele = 0; this.autoAcc = 0; this.debris = []; },
  sample() { return pick(['constroi', 'bloco']); },
  count() { return this.grid.reduce((a, b) => a + b, 0); },
  place(n) { for (let k = 0; k < n; k++) { const i = this.grid.findIndex((v, j) => !v && (j < this.C || this.grid[j - this.C])); if (i < 0) return; this.grid[i] = 1; this.goX = (i % this.C) - this.C / 2 + 0.5; this.toBuild = true; } },
  breakN(n) { for (let k = 0; k < n; k++) { const filled = this.grid.map((v, i) => (v ? i : -1)).filter((i) => i >= 0); if (!filled.length) return; const i = filled[filled.length - 1 - Math.floor(Math.random() * Math.min(filled.length, 30))]; this.grid[i] = 0; this.debris.push({ i, t: 0, vx: rand(-4, 4), vy: rand(2, 8), vz: rand(-2, 4) }); } for (let j = this.C; j < this.grid.length; j++) if (this.grid[j] && !this.grid[j - this.C]) { this.grid[j] = 0; this.debris.push({ i: j, t: 0, vx: rand(-2, 2), vy: 0, vz: rand(0, 2) }); } },
  onAction(id, a) {
    if (id === 'award_win') return this.win();
    if (id === 'steal_win') { this.wins = Math.max(0, this.wins - 1); return; }
    const [d, good] = helperOf([[VOX_HELP, true], [VOX_SAB, false]], id);
    if (d) Effects3D.queue(this, d, a, good, Math.round(d[3] * (a.gift ? Math.max(1, a.power / 3) : 1)));
  },
  win() { this.wins++; this.cele = 4; sfx.win(); confetti(160); voice.say('Muralha completa!'); this.toBuild = false; Hero3D.play(this, 'idle'); Hero3D.play(this, 'victory', { then: 'taunt' }); if (this.wins >= this.s.winGoal) this.wins = 0; this.grid.fill(0); },
  update(dt) {
    this.feed.update(dt); this.cele = Math.max(0, this.cele - dt);
    for (const d of this.debris) d.t += dt;
    this.debris = this.debris.filter((d) => d.t < 2);
    this.builder(dt);
    Effects3D.tick(this, dt, (p) => { if (p.good) { this.place(p.amt); sfx.pop(); Hero3D.say(this, `valeu ${nickOf(p.user)}!`); } else { this.breakN(p.amt); sfx.boom(); Hero3D.play(this, 'hit'); this.r?.char?.hitFlash('#ff4d6d', 1); this.toBuild = false; } this.feed.push(p.user, `${p.name}: ${p.amt > 0 ? '+' : ''}${p.amt} blocos`, p.good ? '#7cff6b' : '#ff6b8a'); });
    if (this.cele) return;
    this.autoAcc += this.s.autoBuild * dt;
    if (this.autoAcc >= 1) { this.place(Math.floor(this.autoAcc)); this.autoAcc %= 1; }
    if (this.count() === this.grid.length) { this.hold += dt; if (this.hold >= this.s.defenseSeconds) { this.hold = 0; this.win(); } } else this.hold = 0;
  },
  // Construtor 3D: anda até a coluna do último bloco, vira para a muralha e martela/usa/encaixa
  builder(dt) {
    const c = Hero3D.tick(this, dt, { height: 2.2 }); if (!c) return;
    const p = c.root.position, dx = (this.goX ?? -4) - p.x, cele = this.cele > 0;
    if (cele) { c.root.rotation.y = 0; return; } // comemora de frente para a câmera
    if (c.busy) return;
    if (Math.abs(dx) > 0.15) { p.x += Math.sign(dx) * Math.min(Math.abs(dx), 3.2 * dt); c.root.rotation.y = Math.sign(dx) * Math.PI / 2; if (c.base !== 'walk') c.play('walk'); return; }
    c.root.rotation.y = Math.PI; // de frente para a muralha
    if (this.toBuild) { this.toBuild = false; c.play('idle'); c.play(pick(['interact', 'use', 'punch']), { speed: 1.3 }); return; }
    if (c.base !== 'idle') c.play('idle');
  },
  scene3d() {
    if (this.r || !G3.ready) return this.r;
    const T = THREE, scene = new T.Scene();
    scene.background = G3.skyTex('#38bdf8', '#7dd3fc', '#e0f2fe');
    G3.lights(scene, { hemi: 1, sun: 2.2, pos: [15, 30, 20] });
    const st = this.s.blockStyle;
    const top = st === 'grass' ? '#4ade80' : st === 'stone' ? '#9ca3af' : '#f9a8d4', side = st === 'grass' ? '#92400e' : st === 'stone' ? '#6b7280' : '#c084fc';
    const tex = (c, c2) => G3.tex(32, 32, (g) => { g.fillStyle = c; g.fillRect(0, 0, 32, 32); for (let i = 0; i < 40; i++) { g.fillStyle = Math.random() < 0.5 ? shade(c, 20) : c2; g.fillRect(randInt(0, 7) * 4, randInt(0, 7) * 4, 4, 4); } });
    const mats = [tex(side, shade(side, -20)), tex(side, shade(side, -20)), tex(top, shade(top, -20)), tex(side, shade(side, -20)), tex(side, shade(side, -20)), tex(side, shade(side, -20))].map((tx) => { tx.magFilter = T.NearestFilter; return new T.MeshStandardMaterial({ map: tx }); });
    const blocks = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), mats, this.C * this.R); blocks.frustumCulled = false; blocks.castShadow = true; scene.add(blocks);
    const ground = new T.Mesh(new T.BoxGeometry(40, 1, 20), new T.MeshStandardMaterial({ map: tex('#4ade80', '#22c55e') })); ground.position.y = -1; ground.receiveShadow = true; scene.add(ground);
    const debris = new T.InstancedMesh(new T.BoxGeometry(0.9, 0.9, 0.9), mats, 60); debris.frustumCulled = false; scene.add(debris);
    const cam = new T.PerspectiveCamera(45, W / H, 0.1, 200); cam.position.set(0, 7, 36); cam.lookAt(0, 4, 0);
    this.r = { scene, blocks, debris, cam, d: new T.Object3D() };
    Hero3D.make(this, { height: 2.2 }).root.position.set(-4, -0.5, 1.6);
    return this.r;
  },
  draw() {
    const r = this.scene3d(), t = performance.now() / 1000;
    if (r) {
      this.grid.forEach((v, i) => { const x = (i % this.C) - this.C / 2 + 0.5, y = Math.floor(i / this.C); r.d.position.set(x, v ? y : -999, 0); r.d.rotation.set(0, 0, 0); r.d.updateMatrix(); r.blocks.setMatrixAt(i, r.d.matrix); });
      r.blocks.instanceMatrix.needsUpdate = true;
      this.debris.slice(0, 60).forEach((d, k) => { const x = (d.i % this.C) - this.C / 2 + 0.5 + d.vx * d.t, y = Math.floor(d.i / this.C) + d.vy * d.t - 9 * d.t * d.t; r.d.position.set(x, y, d.vz * d.t); r.d.rotation.set(d.t * 4, d.t * 3, 0); r.d.updateMatrix(); r.debris.setMatrixAt(k, r.d.matrix); });
      for (let k = Math.min(60, this.debris.length); k < 60; k++) { r.d.position.set(0, -999, 0); r.d.updateMatrix(); r.debris.setMatrixAt(k, r.d.matrix); }
      r.debris.instanceMatrix.needsUpdate = true;
      r.cam.position.x = Math.sin(t * 0.2) * 5; r.cam.lookAt(0, 4.5, 0);
      G3.render(r.scene, r.cam);
    } else stageBg('green');
    this.fly.draw();
    title('MURALHA DE BLOCOS', W / 2, 54, 44);
    const pct = this.count() / this.grid.length;
    panel(W / 2 - 160, 86, 320, 60, { r: 16 });
    num(`${Math.round(pct * 100)}%`, W / 2, 116, 42);
    glossBar(40, 160, W - 80, 16, pct, '#65a30d');
    label(this.hold > 0 ? `🛡️ segurando: ${Math.ceil(this.s.defenseSeconds - this.hold)}s` : `🏆 ${this.wins}/${this.s.winGoal}`, W / 2, 198, 20, '#fff', 'center', 900);
    this.feed.draw(20, 1000);
    if (this.cele) title('MURALHA COMPLETA!', W / 2, 460, 56, '#ffc93c');
  },
});

// ---------------- Porquinho Voador 3D (Flappy Pig 3D) ----------------
const PIG_HELP = [['apple', 'Maçã', '🍎', 3], ['drone', 'Drone', '🚁', 10], ['pegasus', 'Pégaso', '🦄', 25], ['dragon', 'Dragão', '🐉', 60]];
const PIG_SAB = [['gun', 'Estilingue', '🎯', 4], ['fan', 'Ventilador', '🌬️', 10], ['train', 'Trem', '🚂', 25], ['black_hole', 'Buraco negro', '🕳️', 60]];
defineGame({
  id: 'flappy-3d', name: 'Porquinho Voador 3D', genre: 'arcade', icon: '🐷', color: '#f9a8d4', three: true,
  desc: 'Um porquinho voando num percurso infinito de canos em 3D, com o chat brigando por quanto ele vai longe. Quatro ajudas levam para frente, quatro puxam para trás.',
  help: '<p>O porquinho voa sozinho pelos canos. Ajuda: 🍎 maçã (likes), 🚁 drone, 🦄 pégaso, 🐉 dragão. Atrapalha: 🎯 estilingue (compartilhar), 🌬️ ventilador, 🚂 trem, 🕳️ buraco negro.</p><p>Bater o recorde-meta vale uma vitória.</p>',
  settings: [
    { key: 'recordGoal', type: 'number', label: 'Distância para vencer (canos)', min: 10, max: 2000, default: 100 },
    { key: 'winGoal', type: 'number', label: 'Vitórias para fechar a partida', min: 1, max: 20, default: 3 },
  ],
  actions: [...helperActions(PIG_HELP), ...helperActions(PIG_SAB), ...WIN_ACTIONS],
  bindings: [{ action: 'apple', trigger: 'like', likes: 15 }, { action: 'apple', trigger: 'gift', minCoins: 1 }, { action: 'drone', trigger: 'gift', minCoins: 10 }, { action: 'pegasus', trigger: 'gift', minCoins: 99 }, { action: 'dragon', trigger: 'gift', minCoins: 299 }, { action: 'gun', trigger: 'share' }, { action: 'fan', trigger: 'gift', minCoins: 30, on: false }],
  reset() { this.dist = 0; this.vel = 0; this.y = 3; this.vy = 0; this.wins = this.wins || 0; this.best = this.best || 0; this.feed = new Feed(4); this.fly = new Flyers(); this.pend = []; this.cele = 0; this.ride = null; },
  sample() { return pick(['voa', 'porquinho']); },
  onAction(id, a) {
    if (id === 'award_win') return this.win();
    if (id === 'steal_win') { this.wins = Math.max(0, this.wins - 1); return; }
    const [d, good] = helperOf([[PIG_HELP, true], [PIG_SAB, false]], id);
    if (d) Effects3D.queue(this, d, a, good, d[3] * (a.gift ? Math.max(1, a.power / 3) : 1));
  },
  win() { this.wins++; this.cele = 4; sfx.win(); confetti(160); voice.say('O porquinho bateu a meta!'); if (this.wins >= this.s.winGoal) this.wins = 0; this.dist = 0; },
  gapAt(i) { return 2.5 + Math.sin(i * 1.7) * 1.6 + Math.cos(i * 0.6) * 0.8; },
  update(dt) {
    this.feed.update(dt); this.cele = Math.max(0, this.cele - dt);
    if (this.ride && (this.ride.t -= dt) <= 0) this.ride = null;
    Effects3D.tick(this, dt, (p) => { this.vel += p.amt * 0.5; if (p.good) this.ride = { id: p.id, t: 2 }; p.good ? sfx.pop() : sfx.boom(); this.feed.push(p.user, `${p.name} ${p.good ? '⏩' : '⏪'} ${Math.round(Math.abs(p.amt))}`, p.good ? '#7cff6b' : '#ff6b8a'); });
    if (this.cele) return;
    this.dist = Math.max(0, this.dist + (1.2 + this.vel) * dt);
    this.vel *= 1 - dt * 0.8;
    this.best = Math.max(this.best, Math.floor(this.dist));
    // Voo automático: mira o vão do próximo cano
    const next = Math.floor(this.dist) + 1, target = this.gapAt(next) + 0.3;
    if (this.y < target - 0.3 && this.vy < 1) this.vy = 5.5;
    this.vy -= 14 * dt; this.y = clamp(this.y + this.vy * dt, 0.5, 6.5);
    if (this.dist >= this.s.recordGoal) this.win();
  },
  scene3d() {
    if (this.r || !G3.ready) return this.r;
    const T = THREE, scene = new T.Scene();
    scene.background = G3.skyTex('#38bdf8', '#93c5fd', '#fde68a');
    scene.fog = new T.Fog(0xbfe3ff, 20, 70);
    G3.lights(scene, { hemi: 1.1, sun: 2, pos: [10, 20, 10] });
    const ground = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshStandardMaterial({ color: 0x7ed957 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.5; ground.receiveShadow = true; scene.add(ground);
    const pipeM = new T.MeshStandardMaterial({ color: 0x22a34a, roughness: 0.4 });
    const pipes = [];
    for (let i = 0; i < 14; i++) { const g = new T.Group(); const lo = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 10, 20), pipeM); const hi = lo.clone(); const capM = new T.MeshStandardMaterial({ color: 0x16803a }); const c1 = new T.Mesh(new T.CylinderGeometry(1.1, 1.1, 0.6, 20), capM), c2 = c1.clone(); g.add(lo, hi, c1, c2); g.userData = { lo, hi, c1, c2 }; scene.add(g); pipes.push(g); }
    const pig = new T.Group();
    const pm = new T.MeshStandardMaterial({ color: 0xf9a8d4 });
    const body = new T.Mesh(new T.SphereGeometry(0.7, 24, 16), pm); body.scale.set(1.2, 1, 1); body.castShadow = true; pig.add(body);
    const snout = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, 0.2, 16), new T.MeshStandardMaterial({ color: 0xf472b6 })); snout.rotation.z = Math.PI / 2; snout.position.x = 0.85; pig.add(snout);
    for (const s of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(0.08, 8, 8), new T.MeshStandardMaterial({ color: 0x111111 })); e.position.set(0.6, 0.25, s * 0.25); pig.add(e); const ear = new T.Mesh(new T.ConeGeometry(0.18, 0.35, 8), pm); ear.position.set(0.25, 0.65, s * 0.3); pig.add(ear); const wing = new T.Mesh(new T.SphereGeometry(0.4, 12, 8), new T.MeshStandardMaterial({ color: 0xffffff })); wing.scale.set(1, 0.2, 0.6); wing.position.set(-0.1, 0.4, s * 0.7); pig.add(wing); pig.userData['w' + s] = wing; }
    scene.add(pig);
    const cam = new T.PerspectiveCamera(55, W / H, 0.1, 200);
    this.r = { scene, pipes, pig, cam };
    return this.r;
  },
  draw() {
    const r = this.scene3d(), t = performance.now() / 1000;
    if (r) {
      const sp = 4;
      r.pipes.forEach((g, k) => {
        const i = Math.floor(this.dist) + k - 2, gap = this.gapAt(i);
        g.position.x = (i - this.dist) * sp;
        g.userData.lo.position.y = gap - 1.6 - 5; g.userData.hi.position.y = gap + 1.6 + 5;
        g.userData.c1.position.y = gap - 1.6; g.userData.c2.position.y = gap + 1.6;
      });
      r.pig.position.set(0, this.y, 0); r.pig.rotation.z = clamp(this.vy * 0.06, -0.5, 0.5);
      for (const s of [-1, 1]) r.pig.userData['w' + s].rotation.x = Math.sin(t * 20) * 0.6 * s;
      r.cam.position.set(-6, 4.5, 10); r.cam.lookAt(2, 3, 0);
      G3.render(r.scene, r.cam);
    } else stageBg('blue');
    if (this.ride) label({ apple: '🍎', drone: '🚁', pegasus: '🦄', dragon: '🐉' }[this.ride.id], W / 2 - 40, 560, 90, '#fff', 'center', 400);
    this.fly.draw();
    title('PORQUINHO VOADOR', W / 2, 54, 44);
    panel(W / 2 - 160, 86, 320, 60, { r: 16 });
    num(`${Math.floor(this.dist)} / ${this.s.recordGoal}`, W / 2, 116, 40);
    label(`Recorde ${this.best} · 🏆 ${this.wins}/${this.s.winGoal}`, W / 2, 168, 18, '#0f172a', 'center', 900);
    this.feed.draw(20, 1000);
    if (this.cele) title('META BATIDA!', W / 2, 460, 64, '#ffc93c');
  },
});
