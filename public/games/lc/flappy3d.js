'use strict';

// ---------------- Flappy Batalha em 3D ----------------
// A regra continua em team.js (dois pássaros no piloto automático, canos valem pontos, presentes
// dão impulso, derrubam, roubam ou zeram). Aqui a cena vira 3D: pássaros com rosto (olhos que
// piscam, bico, crista, asas que batem, tontura quando caem), canos com volume e tampa, e um
// cenário em camadas (nuvens e morros em profundidades diferentes) que passa em velocidades diferentes.
function makeBird3D(color) {
  const T = THREE, g = new T.Group();
  const m = (c, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.45, ...o });
  const body = new T.Mesh(new T.SphereGeometry(1, 28, 20), m(color)); body.scale.set(1.15, 1, 1); body.castShadow = true; g.add(body);
  const belly = new T.Mesh(new T.SphereGeometry(0.75, 20, 14), m(new T.Color(color).lerp(new T.Color('#fff7e6'), 0.6))); belly.position.set(0.35, -0.3, 0.35); belly.scale.set(1, 0.8, 0.8); g.add(belly);
  const eyes = [], lids = [], pupils = [];
  for (const z of [-0.42, 0.42]) {
    const eye = new T.Mesh(new T.SphereGeometry(0.32, 16, 12), m('#ffffff', { roughness: 0.2 })); eye.position.set(0.62, 0.38, z); g.add(eye); eyes.push(eye);
    const pupil = new T.Mesh(new T.SphereGeometry(0.15, 12, 10), m('#111827', { roughness: 0.1 })); pupil.position.set(0.86, 0.4, z * 1.05); g.add(pupil); pupils.push(pupil);
    const lid = new T.Mesh(new T.SphereGeometry(0.335, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), m(color)); lid.position.copy(eye.position); lid.scale.y = 0.05; g.add(lid); lids.push(lid);
  }
  const beak = new T.Mesh(new T.ConeGeometry(0.28, 0.75, 12), m('#ff8a3d', { roughness: 0.3 })); beak.rotation.z = -Math.PI / 2; beak.position.set(1.25, 0.02, 0); beak.castShadow = true; g.add(beak);
  const crest = new T.Group(); crest.position.set(0.1, 0.95, 0); g.add(crest);
  for (let i = 0; i < 3; i++) { const f = new T.Mesh(new T.ConeGeometry(0.12, 0.6, 8), m(new T.Color(color).offsetHSL(0.05, 0, -0.1))); f.position.set(-0.15 * i, 0.15, 0); f.rotation.z = 0.4 + i * 0.25; crest.add(f); }
  const wings = [-1, 1].map((s) => {
    const pivot = new T.Group(); pivot.position.set(-0.1, 0.1, s * 0.9); g.add(pivot);
    const w = new T.Mesh(new T.SphereGeometry(0.62, 16, 10), m(new T.Color(color).offsetHSL(0, 0, -0.12))); w.scale.set(1.1, 0.25, 0.8); w.position.set(-0.2, 0, s * 0.35); w.castShadow = true; pivot.add(w);
    return pivot;
  });
  const tail = new T.Mesh(new T.ConeGeometry(0.35, 0.8, 10), m(new T.Color(color).offsetHSL(0, 0, -0.15))); tail.rotation.z = Math.PI / 2 + 0.4; tail.position.set(-1.2, 0.2, 0); g.add(tail);
  // Estrelinhas de tontura (aparecem quando o pássaro é derrubado)
  const stars = new T.Group(); stars.position.set(0, 1.4, 0); stars.visible = false; g.add(stars);
  for (let i = 0; i < 4; i++) { const st = new T.Sprite(new T.SpriteMaterial({ map: Tex3D.star(), color: 0xfde047, depthWrite: false, transparent: true })); st.scale.setScalar(0.45); stars.add(st); }
  return { g, body, wings, lids, pupils, stars, blinkT: rand(1, 4) };
}

(() => {
  const g = GAMES.find((x) => x.id === 'flappy-battle');
  if (!g) return;
  g.three = true;
  const base = { draw: g.draw, onAction: g.onAction, add: g.add, update: g.update, reset: g.reset };
  const LH = 560, U = 40;
  const laneY = (i, y) => (H / 2 - (80 + i * (LH + 30) + y)) / U; // canvas → cena
  const X = (x) => (x - W / 2) / U;

  Object.assign(g, {
    leave() {
      const r = this.r;
      if (!r) return;
      r.scene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      r.fx.clear(); this.r = null;
    },
    scene3d() {
      if (this.r || !G3.ready) return this.r;
      const T = THREE, scene = new T.Scene(), night = this.s.background === 'night';
      scene.background = night ? G3.skyTex('#050a2a', '#14205a', '#2c3a80') : G3.skyTex('#2b8fe8', '#6ccaff', '#c9f1ff');
      G3.lights(scene, { hemi: night ? 0.6 : 1.1, sun: night ? 1.2 : 2.2, pos: [10, 25, 30] });
      const cam = new T.PerspectiveCamera(30, W / H, 0.1, 400); cam.position.set(0, 0, 60); cam.lookAt(0, 0, 0);
      const lanes = [0, 1].map((i) => {
        const col = i ? this.s.rightColor : this.s.leftColor;
        const lane = { i, pipes: [], hills: [], clouds: [] };
        const top = laneY(i, 0), bot = laneY(i, LH);
        // Chão com grama e terra
        const ground = new T.Mesh(new T.BoxGeometry(40, 1, 6), new T.MeshStandardMaterial({ color: night ? 0x1e3a2b : 0x6cc24a, roughness: 0.8 })); ground.position.set(0, bot + 0.5, 0); ground.receiveShadow = true; scene.add(ground);
        const dirt = new T.Mesh(new T.BoxGeometry(40, 0.5, 6), new T.MeshStandardMaterial({ color: night ? 0x3b2a1a : 0xc68642, roughness: 0.9 })); dirt.position.set(0, bot - 0.1, 0); scene.add(dirt);
        // Morros e nuvens em camadas (fundo da faixa)
        for (let k = 0; k < 6; k++) { const h = new T.Mesh(new T.SphereGeometry(rand(3, 5), 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: new T.Color(night ? '#1b2f4a' : '#4caf50').offsetHSL(0, 0, rand(-0.06, 0.06)), roughness: 0.9 })); h.position.set(-20 + k * 8, bot + 0.9, -12); scene.add(h); lane.hills.push(h); }
        for (let k = 0; k < 5; k++) { const c = new T.Group(); for (let j = 0; j < 3; j++) { const s = new T.Mesh(new T.SphereGeometry(rand(0.9, 1.4), 12, 10), new T.MeshStandardMaterial({ color: night ? 0x8090c0 : 0xffffff, roughness: 1, transparent: true, opacity: 0.92 })); s.position.set(j * 1.1 - 1.1, rand(-0.2, 0.3), 0); c.add(s); } c.position.set(-18 + k * 9, rand(top - 4, top - 1.5), -20); scene.add(c); lane.clouds.push(c); }
        // Faixa de separação e moldura com a cor do time
        const frame = new T.Mesh(new T.BoxGeometry(40, 0.25, 1), new T.MeshBasicMaterial({ color: col, toneMapped: false })); frame.position.set(0, top - 0.1, 2); scene.add(frame);
        lane.bird = makeBird3D(col); lane.bird.g.position.set(X(200), laneY(i, 300), 0); lane.bird.g.rotation.y = 0; scene.add(lane.bird.g);
        return lane;
      });
      const pipeMat = new T.MeshStandardMaterial({ color: 0x2fbf4f, roughness: 0.35, metalness: 0.05 }), capMat = new T.MeshStandardMaterial({ color: 0x1f9d3b, roughness: 0.3 });
      const fx = new FX3D(scene, 220);
      this.r = { scene, cam, lanes, fx, pipeMat, capMat, pool: [] };
      return this.r;
    },
    // Cano reaproveitado: tubo de cima + tubo de baixo, cada um com tampa
    pipeMesh() {
      const r = this.r, T = THREE;
      const p = r.pool.pop();
      if (p) { p.visible = true; return p; }
      const grp = new T.Group();
      for (let k = 0; k < 2; k++) {
        const tube = new T.Mesh(new T.CylinderGeometry(0.85, 0.85, 1, 20), r.pipeMat); tube.castShadow = true; grp.add(tube);
        const cap = new T.Mesh(new T.CylinderGeometry(1.05, 1.05, 0.55, 20), r.capMat); cap.castShadow = true; grp.add(cap);
      }
      r.scene.add(grp);
      return grp;
    },
    add(s, n) {
      const wasWin = this.win;
      base.add.call(this, s, n);
      const r = this.r;
      if (!r) return;
      const bird = r.lanes[s].bird.g;
      if (n >= 1) r.fx.burst(bird.position.clone(), { color: ['#fde047', '#facc15', '#ffffff'], n: Math.min(30, 6 + n * 2), speed: 4, up: 2, size: 0.4, tex: 'star', additive: false, life: 0.8 });
      if (!wasWin && this.win) { this.loopT = 1.2; this.loopS = s; r.fx.burst(bird.position.clone(), { color: ['#fde047', '#f472b6', '#60a5fa', '#4ade80'], n: 60, speed: 8, up: 4, size: 0.5, tex: 'star', additive: false, life: 1.6 }); }
    },
    onAction(id, a) {
      const before = [this.b[0].dead, this.b[1].dead];
      base.onAction.call(this, id, a);
      const r = this.r;
      if (!r) return;
      for (const s of [0, 1]) if (this.b[s].dead > before[s]) {
        // Derrubado: penas voando e tremida
        const p = r.lanes[s].bird.g.position.clone();
        r.fx.burst(p, { color: [s ? this.s.rightColor : this.s.leftColor, '#ffffff'], n: 26, speed: 6, up: 2, gravity: -3, size: 0.5, additive: false, tex: 'smoke', life: 1 });
        r.fx.ring(p, { color: '#ffffff', size: 4, flat: false });
      }
      if (id === 'steal') { const s = this.fans.get(a.user) ?? 0; r.fx.burst(r.lanes[1 - s].bird.g.position.clone(), { color: ['#c084fc', '#ffffff'], n: 20, speed: 5, size: 0.4, life: 0.8 }); }
    },
    update(dt) {
      // Cano passado = +1 (mostra faísca no pássaro)
      const before = this.b.map((b) => b.pipes.filter((p) => p.passed).length + b.score);
      base.update.call(this, dt);
      const r = this.r;
      if (!r) return;
      this.b.forEach((b, i) => { const lane = r.lanes[i]; if (b.pipes.filter((p) => p.passed).length + b.score > before[i] + 0.9 && b.dead <= 0) r.fx.burst(lane.bird.g.position.clone().add(new THREE.Vector3(0.8, 0.6, 0)), { color: '#fde047', n: 5, speed: 2, up: 1, size: 0.25, life: 0.4 }); });
      if (this.loopT > 0) this.loopT -= dt;
      r.fx.update(dt);
    },
    draw() {
      const r = this.scene3d(), t = performance.now() / 1000;
      if (!r) return base.draw.call(this);
      // Devolve os canos ao estoque e posiciona os que estão na tela
      r.lanes.forEach((lane) => { for (const m of lane.pipes) { m.visible = false; r.pool.push(m); } lane.pipes = []; });
      this.b.forEach((b, i) => {
        const lane = r.lanes[i], top = laneY(i, 0), bot = laneY(i, LH);
        for (const p of b.pipes) {
          const m = this.pipeMesh(); lane.pipes.push(m);
          const x = X(p.x + 35), gapTop = laneY(i, p.gap - 75), gapBot = laneY(i, p.gap + 75);
          const [tube1, cap1, tube2, cap2] = m.children;
          const h1 = Math.max(0.1, top - gapTop), h2 = Math.max(0.1, gapBot - bot - 1);
          tube1.scale.y = h1; tube1.position.set(x, gapTop + h1 / 2, 0); cap1.position.set(x, gapTop + 0.27, 0);
          tube2.scale.y = h2; tube2.position.set(x, bot + 1 + h2 / 2, 0); cap2.position.set(x, gapBot - 0.27, 0);
        }
        // Parallax: morros e nuvens andam mais devagar que os canos
        for (const h of lane.hills) { h.position.x -= 0.02; if (h.position.x < -24) h.position.x += 48; }
        for (const c of lane.clouds) { c.position.x -= 0.01; if (c.position.x < -24) c.position.x += 45; }
        // Pássaro: posição, inclinação pela velocidade, asas batendo, piscadas, tontura
        const bd = lane.bird, gB = bd.g;
        gB.position.set(X(200), laneY(i, b.y), 0);
        let rot = -clamp(b.vy / 600, -0.5, 1.2);
        if (this.loopT > 0 && this.loopS === i) rot = (1.2 - this.loopT) / 1.2 * Math.PI * 2;
        gB.rotation.z = rot;
        const flap = b.dead > 0 ? 0.2 : Math.sin(t * (b.vy < 0 ? 28 : 14)) * 0.9;
        bd.wings[0].rotation.x = flap; bd.wings[1].rotation.x = -flap;
        const sq = b.vy < -200 ? 1.12 : 1; bd.body.scale.set(1.15 / sq, sq, 1);
        bd.blinkT -= 1 / 60; const blink = bd.blinkT < 0.12;
        if (bd.blinkT < 0) bd.blinkT = rand(2, 5);
        for (const l of bd.lids) l.scale.y = b.dead > 0 ? 0.9 : blink ? 1 : 0.05;
        for (const pu of bd.pupils) pu.position.y = 0.4 + clamp(b.vy / 2000, -0.08, 0.08);
        bd.stars.visible = b.dead > 0;
        if (b.dead > 0) bd.stars.children.forEach((s, k) => { const a = t * 6 + k * Math.PI / 2; s.position.set(Math.cos(a) * 0.9, Math.sin(t * 8 + k) * 0.1, Math.sin(a) * 0.9); });
      });
      G3.render(r.scene, r.cam);
      // HUD por faixa
      this.b.forEach((b, i) => {
        const oy = 80 + i * (LH + 30), col = i ? this.s.rightColor : this.s.leftColor;
        ctx.fillStyle = 'rgba(10,12,30,.72)'; ctx.beginPath(); ctx.roundRect(16, oy + 12, 250, 64, 20); ctx.fill();
        teamBadge(this, i, 50, oy + 44, 24);
        label((i ? this.s.rightLabel : this.s.leftLabel).toUpperCase(), 84, oy + 34, 20, '#fff', 'left', 900, F_TITLE);
        label(`🏆 ${b.wins}`, 84, oy + 58, 14, '#fff', 'left', 800);
        ctx.fillStyle = 'rgba(10,12,30,.72)'; ctx.beginPath(); ctx.roundRect(W - 216, oy + 12, 200, 64, 20); ctx.fill();
        num(`${Math.floor(b.score)} / ${this.s.targetScore}`, W - 30, oy + 44, 34, '#fff', 'right');
        glossBar(20, oy + LH - 26, W - 40, 14, b.score / this.s.targetScore, col);
      });
      title('FLAPPY BATALHA', W / 2, 40, 38);
      this.feed.draw(20, 1230 - 46 * 3);
      if (this.win) {
        const col = this.win.s ? this.s.rightColor : this.s.leftColor;
        ctx.fillStyle = 'rgba(8,10,24,.78)'; ctx.beginPath(); ctx.roundRect(50, H / 2 - 60, W - 100, 110, 28); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke();
        title(`${(this.win.s ? this.s.rightLabel : this.s.leftLabel).toUpperCase()} VENCEU!`, W / 2, H / 2, 54, '#ffc93c');
      }
    },
  });
})();
