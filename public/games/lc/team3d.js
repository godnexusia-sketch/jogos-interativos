'use strict';

// Jogos de dois times em 3D: Guerra das Torres e Sumô de Cabras.

// ---------------- Guerra das Torres (Tower War) ----------------
defineGame({
  id: 'tower-war', name: 'Guerra das Torres', genre: 'party', icon: '🗼', color: '#8b5cf6', three: true,
  desc: 'Duas torres na tela. Presentes fazem a sua crescer, destroem a inimiga ou roubam blocos. A primeira a chegar à altura alvo vence; só a vencedora volta ao zero.',
  help: '<p>Comente <b>1</b> ou <b>2</b> para escolher a torre. ❤️ Likes e 💬 comentários colocam blocos; 🎁 presentes colocam muitos blocos, <b>destroem</b> a outra torre ou <b>roubam</b> blocos.</p><p>Quem chega à altura alvo vence a rodada. De tempos em tempos vem o <b>multiplicador ×2</b>.</p>',
  settings: [
    ...sideSettings('Chat', '#a855f7', 'Criador', '#f59e0b'),
    { key: 'targetHeight', type: 'number', label: 'Altura para vencer (blocos)', min: 20, max: 2000, default: 150 },
    { key: 'multiplierEnabled', type: 'toggle', label: 'Multiplicador ×2 de vez em quando', default: true },
    { key: 'multiplierSeconds', type: 'number', label: 'Duração do multiplicador (s)', min: 5, max: 60, default: 15, showIf: { key: 'multiplierEnabled', value: true } },
    { key: 'voiceCallouts', type: 'toggle', label: 'Locutor falando', default: true },
    { key: 'winsLabel', type: 'text', label: 'Texto das vitórias', default: 'VITÓRIAS', group: 'Textos' },
  ],
  actions: [
    { id: 'grow_left', label: 'Bloco na torre 1', icon: '🧱' }, { id: 'grow_right', label: 'Bloco na torre 2', icon: '🧱' },
    { id: 'grow_mine', label: 'Crescer a minha torre', icon: '⬆️' }, { id: 'wreck', label: 'Destruir a outra', icon: '💥' },
    { id: 'steal', label: 'Roubar blocos', icon: '🦹' }, { id: 'reset_other', label: 'Zerar a outra', icon: '🧨' }, { id: 'award_win', label: 'Vitória para o meu lado', icon: '🏆' },
  ],
  bindings: [{ action: 'grow_left', trigger: 'comment', text: '1' }, { action: 'grow_right', trigger: 'comment', text: '2' }, { action: 'grow_mine', trigger: 'like', likes: 10 }, { action: 'grow_mine', trigger: 'gift', minCoins: 1 }, { action: 'wreck', trigger: 'gift', minCoins: 30 }, { action: 'steal', trigger: 'gift', minCoins: 99 }, { action: 'reset_other', trigger: 'gift', minCoins: 999 }],
  reset() { this.h = [0, 0]; this.vis = [0, 0]; this.wins = this.wins || [0, 0]; this.fans = new Teams(); this.feed = new Feed(3); this.mult = 0; this.multT = rand(40, 90); this.win = null; this.flying = []; },
  sample() { return pick(['1', '2', '1', '2', 'vai']); },
  side(a) { let s = this.fans.get(a.user); if (s === undefined) { s = Math.random() < 0.5 ? 0 : 1; this.fans.set(a.user, s); } return s; },
  add(s, n) {
    if (this.win) return;
    n *= this.mult > 0 ? 2 : 1;
    this.h[s] = Math.max(0, this.h[s] + n);
    if (this.h[s] >= this.s.targetHeight) {
      this.wins[s]++; this.win = { s, t: 5 }; sfx.win(); confetti(140);
      if (this.s.voiceCallouts) voice.say(`A torre ${s ? this.s.rightLabel : this.s.leftLabel} chegou ao topo!`);
    }
  },
  onAction(id, a) {
    if (id === 'grow_left' || id === 'grow_right') { const s = id === 'grow_left' ? 0 : 1; this.fans.set(a.user, s); this.add(s, 1); return; }
    const s = this.side(a), o = 1 - s;
    if (id === 'grow_mine') { const n = a.gift ? Math.round(a.coins * 1.2 + 1) : 1; this.add(s, n); if (a.gift) this.feed.push(a.user, `+${n} blocos`, s ? this.s.rightColor : this.s.leftColor); }
    else if (id === 'wreck') { const n = Math.min(this.h[o], Math.round(a.coins * 0.8 + 5)); this.h[o] -= n; for (let i = 0; i < Math.min(n, 30); i++) this.flying.push({ s: o, y: this.vis[o] - i, vx: rand(-6, 6), vy: rand(2, 8), vz: rand(-4, 4), x: 0, z: 0, t: 0 }); this.feed.push(a.user, `💥 destruiu ${n}`, '#ff6b8a'); sfx.boom(); if (this.s.voiceCallouts) voice.say('Destruição!'); }
    else if (id === 'steal') { const n = Math.min(this.h[o], Math.round(a.coins * 0.5 + 5)); this.h[o] -= n; this.add(s, n); this.feed.push(a.user, `🦹 roubou ${n}`, '#c084fc'); }
    else if (id === 'reset_other') { this.h[o] = 0; this.feed.push(a.user, '🧨 zerou a outra torre!', '#ff6b8a'); sfx.boom(); }
    else if (id === 'award_win') this.add(s, this.s.targetHeight);
  },
  update(dt) {
    this.feed.update(dt);
    for (const s of [0, 1]) this.vis[s] += (this.h[s] - this.vis[s]) * Math.min(1, dt * 4);
    if (this.s.multiplierEnabled) { if (this.mult > 0) this.mult -= dt; else { this.multT -= dt; if (this.multT <= 0) { this.multT = rand(60, 120); this.mult = this.s.multiplierSeconds; sfx.levelup?.(); if (this.s.voiceCallouts) voice.say('Multiplicador ligado! Tudo vale o dobro!'); } } }
    if (this.win && (this.win.t -= dt) <= 0) { this.h[this.win.s] = 0; this.win = null; }
    for (const f of this.flying) { f.t += dt; f.x += f.vx * dt; f.z += f.vz * dt; f.y += f.vy * dt; f.vy -= 20 * dt; }
    this.flying = this.flying.filter((f) => f.t < 2.5);
  },
  scene3d() {
    if (this.r || !G3.ready) return this.r;
    const T = THREE, scene = new T.Scene();
    scene.background = G3.skyTex('#0b0730', '#3b1a6e', '#ff7a59');
    scene.fog = new T.Fog(0x2a1550, 120, 520);
    G3.lights(scene, { hemi: 0.9, sun: 2.2, pos: [20, 50, 30] });
    const ground = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshStandardMaterial({ color: 0x1f1a33, roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    // Cidade ao fundo
    const city = new T.Group();
    for (let i = 0; i < 60; i++) { const h = rand(4, 26), b = new T.Mesh(new T.BoxGeometry(rand(2, 5), h, rand(2, 5)), new T.MeshStandardMaterial({ color: new T.Color().setHSL(0.72, 0.3, rand(0.08, 0.2)), emissive: new T.Color(0x332266), emissiveIntensity: 0.2 })); b.position.set(rand(-70, 70), h / 2, rand(-80, -30)); city.add(b); }
    scene.add(city);
    const box = new T.BoxGeometry(6, 1, 6);
    const towers = [0, 1].map((s) => {
      const m = new T.InstancedMesh(box, new T.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1 }), 400);
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.position.x = s ? 7.5 : -7.5; scene.add(m);
      return m;
    });
    const flyG = new T.InstancedMesh(box, new T.MeshStandardMaterial({ color: 0xffffff }), 60); flyG.frustumCulled = false; scene.add(flyG);
    const cam = new T.PerspectiveCamera(42, W / H, 0.1, 300);
    this.r = { scene, cam, towers, flyG, dummy: new T.Object3D(), col: new T.Color() };
    return this.r;
  },
  draw() {
    const r = this.scene3d();
    const T = THREE;
    const target = this.s.targetHeight, maxShown = 200;
    if (r) {
      // A altura alvo sempre ocupa ~60 unidades na cena; cada torre tem até 300 blocos.
      const unit = 60 / target, top = Math.max(60, Math.max(this.vis[0], this.vis[1]) * unit);
      [0, 1].forEach((s) => {
        const m = r.towers[s], worldH = this.vis[s] * unit, n = Math.min(300, Math.ceil(this.vis[s])), bh = n ? worldH / n : 1;
        const base = new T.Color(s ? this.s.rightColor : this.s.leftColor);
        for (let i = 0; i < 400; i++) {
          r.dummy.position.set(0, i < n ? (i + 0.5) * bh : -50, 0); r.dummy.rotation.y = Math.sin(i * 0.3) * 0.08; r.dummy.scale.set(1, Math.max(0.05, bh * 0.94), 1);
          r.dummy.updateMatrix(); m.setMatrixAt(i, r.dummy.matrix);
          r.col.copy(base).offsetHSL(0, 0, (i % 2 ? -0.06 : 0.04) + (i % 10 === 0 ? 0.12 : 0)); m.setColorAt(i, r.col);
        }
        m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
      });
      this.flying.forEach((f, i) => { r.dummy.position.set((f.s ? 7.5 : -7.5) + f.x, f.y * unit, f.z); r.dummy.rotation.set(f.t * 3, f.t * 2, 0); r.dummy.scale.setScalar(1); r.dummy.updateMatrix(); r.flyG.setMatrixAt(i, r.dummy.matrix); });
      for (let i = this.flying.length; i < 60; i++) { r.dummy.position.set(0, -50, 0); r.dummy.updateMatrix(); r.flyG.setMatrixAt(i, r.dummy.matrix); }
      r.flyG.instanceMatrix.needsUpdate = true;
      // Linha da meta
      r.goal = r.goal || (() => { const g = new T.Mesh(new T.BoxGeometry(30, 0.25, 0.25), new T.MeshBasicMaterial({ color: 0xffd23f })); r.scene.add(g); return g; })();
      r.goal.position.set(0, 60, 1.5);
      const camY = top * 0.5 + 2, dist = top * 1.25 + 16;
      r.cam.position.set(Math.sin(performance.now() / 6000) * 6, camY, dist); r.cam.lookAt(0, camY, 0);
      G3.render(r.scene, r.cam);
    } else stageBg('purple');
    teamScoreboard(this, this.wins[0], this.wins[1], 26, `META: ${target} BLOCOS`);
    [0, 1].forEach((s) => {
      const x = s ? W - 100 : 100, col = s ? this.s.rightColor : this.s.leftColor;
      num(String(Math.floor(this.h[s])), x, 190, 64, '#fff');
      glossBar(s ? W - 190 : 10, 230, 180, 16, this.h[s] / target, col);
    });
    if (this.mult > 0) pill(`×2 MULTIPLICADOR · ${Math.ceil(this.mult)}s`, W / 2, 270, { size: 22, bg: '#ff2d55', border: '#fff' });
    label('comente 1 ou 2 · presentes constroem, destroem e roubam', W / 2, 140, 17, '#fff', 'center', 800);
    this.feed.draw(20, 1060);
    if (this.win) title(`${(this.win.s ? this.s.rightLabel : this.s.leftLabel).toUpperCase()} VENCEU!`, W / 2, H / 2, 58, '#ffc93c');
  },
});

// ---------------- Sumô de Cabras (Goat Sumo) ----------------
function makeGoat(color, hornColor = '#e5e7eb') {
  const T = THREE, g = new T.Group();
  const m = (c) => new T.MeshStandardMaterial({ color: c, roughness: 0.75 });
  const body = new T.Mesh(new T.CapsuleGeometry(0.55, 1.1, 8, 16), m(color)); body.rotation.z = Math.PI / 2; body.position.y = 1.3; body.castShadow = true; g.add(body);
  const head = new T.Group(); head.position.set(1.05, 1.75, 0); g.add(head);
  const skull = new T.Mesh(new T.BoxGeometry(0.75, 0.55, 0.5), m(color)); skull.castShadow = true; head.add(skull);
  const snout = new T.Mesh(new T.BoxGeometry(0.4, 0.35, 0.42), m(shade(color, 30))); snout.position.set(0.45, -0.12, 0); head.add(snout);
  for (const s of [-1, 1]) {
    const horn = new T.Mesh(new T.TorusGeometry(0.28, 0.08, 8, 16, Math.PI * 1.3), m(hornColor)); horn.position.set(-0.1, 0.32, s * 0.2); horn.rotation.set(0, s * 0.3, 0.6); head.add(horn);
    const eye = new T.Mesh(new T.SphereGeometry(0.07, 8, 8), m('#111')); eye.position.set(0.25, 0.1, s * 0.26); head.add(eye);
  }
  const beard = new T.Mesh(new T.ConeGeometry(0.1, 0.35, 8), m('#f8fafc')); beard.position.set(0.5, -0.45, 0); beard.rotation.z = Math.PI; head.add(beard);
  const legs = [];
  for (const [x, z] of [[0.6, 0.3], [0.6, -0.3], [-0.6, 0.3], [-0.6, -0.3]]) { const l = new T.Mesh(new T.CylinderGeometry(0.1, 0.08, 0.9, 8), m(shade(color, -40))); l.position.set(x, 0.45, z); l.castShadow = true; g.add(l); legs.push(l); }
  return { g, head, legs };
}
defineGame({
  id: 'goat-sumo', name: 'Sumô de Cabras', genre: 'battle', icon: '🐐', color: '#84cc16', three: true,
  desc: 'Duas cabras numa beirada estreita. O seu time empurra, o outro empurra de volta, e quem mantém os cascos na pedra marca ponto.',
  help: '<p>Comente <b>1</b> ou <b>2</b> para empurrar pela sua cabra. ❤️ Likes também empurram pelo seu time. 🎁 Presentes dão <b>cabeçadas fortes</b> e <b>upgrades</b> (cabeçada mais forte por um tempo).</p><p>Pedras caindo e raios atrapalham de vez em quando.</p>',
  settings: [
    ...sideSettings('Cabra Branca', '#e5e7eb', 'Cabra Preta', '#3f3f46'),
    { key: 'winGoal', type: 'number', label: 'Pontos para vencer a partida', min: 1, max: 50, default: 5 },
    { key: 'hitPower', type: 'select', label: 'Força das cabeçadas', options: [['0.6', 'Fraca'], ['1', 'Normal'], ['1.6', 'Forte']], default: '1' },
    { key: 'hazardsEnabled', type: 'toggle', label: 'Perigos (pedras e raios)', default: true },
  ],
  actions: [{ id: 'push_small_left', label: 'Empurrão da 1', icon: '🐐' }, { id: 'push_small_right', label: 'Empurrão da 2', icon: '🐐' }, { id: 'push_small_mine', label: 'Empurrão do meu time', icon: '💪' }, { id: 'push_big', label: 'Cabeçada forte', icon: '💥' }, { id: 'upgrade', label: 'Upgrade', icon: '⭐' }],
  bindings: [{ action: 'push_small_left', trigger: 'comment', text: '1,branca' }, { action: 'push_small_right', trigger: 'comment', text: '2,preta' }, { action: 'push_small_mine', trigger: 'like', likes: 10 }, { action: 'push_big', trigger: 'gift', minCoins: 1 }, { action: 'upgrade', trigger: 'gift', minCoins: 99 }],
  reset() { this.x = 0; this.v = 0; this.score = [0, 0]; this.up = [0, 0]; this.stun = [0, 0]; this.fans = new Teams(); this.feed = new Feed(3); this.fall = null; this.hazT = rand(15, 30); this.rocks = []; this.bolt = null; this.butt = [0, 0]; },
  sample() { return pick(['1', '2']); },
  side(a) { let s = this.fans.get(a.user); if (s === undefined) { s = Math.random() < 0.5 ? 0 : 1; this.fans.set(a.user, s); } return s; },
  push(s, f) { if (this.fall || this.stun[s] > 0) return; this.v += (s ? -1 : 1) * f * Number(this.s.hitPower) * (this.up[s] > 0 ? 1.8 : 1); this.butt[s] = 1; },
  onAction(id, a) {
    if (id === 'push_small_left' || id === 'push_small_right') { const s = id.endsWith('left') ? 0 : 1; this.fans.set(a.user, s); this.push(s, 0.06); return; }
    const s = this.side(a);
    if (id === 'push_small_mine') this.push(s, 0.05);
    else if (id === 'push_big') { this.push(s, 0.15 + a.power * 0.06); this.feed.push(a.user, '💥 cabeçada!', s ? this.s.rightColor : '#fff'); sfx.tone(120, 0.15, 'square', 0.1); }
    else if (id === 'upgrade') { this.up[s] = 20; this.feed.push(a.user, '⭐ upgrade por 20s', '#ffc93c'); }
  },
  update(dt) {
    this.feed.update(dt);
    for (const s of [0, 1]) { this.up[s] = Math.max(0, this.up[s] - dt); this.stun[s] = Math.max(0, this.stun[s] - dt); this.butt[s] = Math.max(0, this.butt[s] - dt * 4); }
    if (this.fall) {
      this.fall.t += dt;
      if (this.fall.t > 3) { this.fall = null; this.x = 0; this.v = 0; if (Math.max(...this.score) >= this.s.winGoal) { this.champ = this.score[0] >= this.s.winGoal ? 0 : 1; this.score = [0, 0]; this.champT = 5; } }
      return;
    }
    if (this.champT > 0) this.champT -= dt;
    this.v *= 1 - dt * 2.5; this.x += this.v * dt * 3; this.x *= 1 - dt * 0.05;
    if (Math.abs(this.x) > 1) { const loser = this.x > 0 ? 1 : 0; this.score[1 - loser]++; this.fall = { loser, t: 0 }; sfx.boom(); voice.say(`${loser ? this.s.leftLabel : this.s.rightLabel} marcou!`); }
    if (this.s.hazardsEnabled) { this.hazT -= dt; if (this.hazT <= 0) { this.hazT = rand(20, 40); const s = Math.random() < 0.5 ? 0 : 1; if (Math.random() < 0.5) this.rocks.push({ s, y: 16, t: 0 }); else { this.bolt = { s, t: 0 }; this.stun[s] = 2.5; sfx.boom(); } } }
    for (const r of this.rocks) { r.t += dt; r.y -= dt * 14; if (r.y < 2.2 && !r.hit) { r.hit = true; this.stun[r.s] = 2; this.v += (r.s ? 1 : -1) * 0.12; } }
    this.rocks = this.rocks.filter((r) => r.t < 2.5);
    if (this.bolt && (this.bolt.t += dt) > 0.6) this.bolt = null;
  },
  scene3d() {
    if (this.r || !G3.ready) return this.r;
    const T = THREE, scene = new T.Scene();
    scene.background = G3.skyTex('#2563eb', '#93c5fd', '#e0f2fe');
    scene.fog = new T.Fog(0xbfdcff, 30, 120);
    G3.lights(scene, { hemi: 1.1, sun: 2.4, pos: [10, 30, 20] });
    // Montanhas e o penhasco
    for (let i = 0; i < 14; i++) { const h = rand(14, 40), m = new T.Mesh(new T.ConeGeometry(rand(8, 16), h, 6), new T.MeshStandardMaterial({ color: 0x64748b, flatShading: true })); m.position.set(rand(-70, 70), h / 2 - 10, rand(-90, -40)); scene.add(m); const snow = new T.Mesh(new T.ConeGeometry(m.geometry.parameters.radius * 0.35, h * 0.3, 6), new T.MeshStandardMaterial({ color: 0xffffff, flatShading: true })); snow.position.set(m.position.x, m.position.y + h * 0.36, m.position.z); scene.add(snow); }
    const rock = new T.Mesh(new T.BoxGeometry(12, 30, 4), new T.MeshStandardMaterial({ color: 0x78716c, flatShading: true }));
    rock.position.set(0, -15, 0); rock.receiveShadow = true; scene.add(rock);
    const top = new T.Mesh(new T.BoxGeometry(12, 0.4, 4.2), new T.MeshStandardMaterial({ color: 0x57534e })); top.position.y = 0; top.receiveShadow = true; scene.add(top);
    const goats = [makeGoat(this.s.leftColor), makeGoat(this.s.rightColor, '#a8a29e')];
    goats[1].g.rotation.y = Math.PI;
    goats.forEach((gt) => scene.add(gt.g));
    const rockM = new T.Mesh(new T.DodecahedronGeometry(0.9), new T.MeshStandardMaterial({ color: 0x57534e, flatShading: true })); scene.add(rockM);
    const cam = new T.PerspectiveCamera(40, W / H, 0.1, 300); cam.position.set(0, 6, 22); cam.lookAt(0, 3, 0);
    this.r = { scene, cam, goats, rockM };
    return this.r;
  },
  draw() {
    const r = this.scene3d(), t = performance.now() / 1000;
    if (r) {
      const cx = this.x * 5;
      r.goats.forEach((gt, s) => {
        let x = cx + (s ? 1.6 : -1.6), y = 0.2, rot = 0;
        if (this.fall?.loser === s) { const k = this.fall.t; x += (s ? 1 : -1) * k * 3; y = 0.2 - k * k * 6; rot = k * 4; }
        gt.g.position.set(x, y, 0); gt.g.rotation.z = (s ? -1 : 1) * rot;
        gt.head.rotation.z = -this.butt[s] * 0.5 - 0.15;
        gt.legs.forEach((l, i) => (l.rotation.z = Math.sin(t * 12 + i) * 0.25 * Math.min(1, Math.abs(this.v) * 3)));
        gt.g.scale.setScalar(this.up[s] > 0 ? 1.25 : 1);
      });
      const rk = this.rocks[0];
      r.rockM.position.set(rk ? (rk.s ? 1.6 : -1.6) + cx : 0, rk ? rk.y : -50, 0);
      G3.render(r.scene, r.cam);
    } else stageBg('blue');
    if (this.bolt) { ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 8; ctx.shadowColor = '#fde047'; ctx.shadowBlur = 30; ctx.beginPath(); let x = W / 2 + (this.bolt.s ? 60 : -60); ctx.moveTo(x, 0); for (let y = 0; y < 640; y += 80) { x += rand(-30, 30); ctx.lineTo(x, y); } ctx.stroke(); ctx.shadowBlur = 0; }
    teamScoreboard(this, this.score[0], this.score[1], 26, `PRIMEIRO A ${this.s.winGoal}`);
    glossBar(60, 160, W - 120, 18, (this.x + 1) / 2, this.s.rightColor, hexA(this.s.leftColor, 0.8));
    label('comente 1 ou 2 · presente = cabeçada forte', W / 2, 205, 17, '#fff', 'center', 800);
    [0, 1].forEach((s) => { if (this.up[s] > 0) pill(`⭐ ${Math.ceil(this.up[s])}s`, s ? W - 90 : 90, 240, { size: 16, bg: '#ffc93c', color: '#111' }); if (this.stun[s] > 0) pill('😵 tonta', s ? W - 90 : 90, 276, { size: 15, bg: 'rgba(0,0,0,.6)' }); });
    this.feed.draw(20, 1060);
    if (this.champT > 0) title(`${(this.champ ? this.s.rightLabel : this.s.leftLabel).toUpperCase()} CAMPEÃ!`, W / 2, H / 2 - 100, 54, '#ffc93c');
  },
});
