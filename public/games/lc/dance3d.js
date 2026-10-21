'use strict';

// ---------------- Pista de Dança em 3D ----------------
// A regra continua em party.js (quem comenta entra, presentes giram, trocam roupa, crescem,
// vão para a frente, holofote e globo de luz). Aqui cada dançarino é um personagem 3D que dança
// uma coreografia montada com as animações disponíveis, no ritmo da batida (BPM das configurações).
// A pista é de LED (acende na batida), tem globo espelhado com feixes de luz, holofote que
// escurece a festa e aproxima a câmera, e balões com o comentário de cada um.
(() => {
  const g = GAMES.find((x) => x.id === 'dance-floor');
  if (!g) return;
  g.three = true;
  const base = { draw: g.draw, update: g.update, onAction: g.onAction, onChat: g.onChat, reset: g.reset };
  const MOVES = [['victory', 'taunt', 'jump', 'strafeL', 'strafeR', 'victory'], ['taunt', 'powerUp', 'jump', 'dodgeL', 'dodgeR', 'interact'], ['strafeL', 'strafeR', 'victory', 'jump', 'spin', 'taunt'], ['powerUp', 'victory', 'dodgeR', 'dodgeL', 'jump', 'taunt']];
  const MAX3D = 30;
  // Fileiras: os primeiros da lista ficam na frente
  const slot = (i) => { const rows = [5, 6, 7, 8]; let r = 0, k = i; while (r < rows.length - 1 && k >= rows[r]) { k -= rows[r]; r++; } const n = rows[r]; return new THREE.Vector3((k - (n - 1) / 2) * 1.2 + (r % 2 ? 0.3 : 0), 0, 2.6 - r * 1.9); };

  Object.assign(g, {
    enter() { Assets3D.preload(HERO_KINDS); },
    leave() {
      const r = this.r;
      if (!r) return;
      for (const c of r.chars.values()) c.dispose();
      r.chars.clear(); r.fx.clear();
    },
    reset() { base.reset.call(this); if (this.r) { for (const c of this.r.chars.values()) c.dispose(); this.r.chars.clear(); } },
    scene3d() {
      if (this.r || !G3.ready) return this.r;
      const T = THREE, scene = new T.Scene();
      scene.background = G3.skyTex('#05020c', '#120526', '#1f0a3a');
      scene.fog = new T.Fog(0x120526, 14, 42);
      const hemi = new T.HemisphereLight(0xb9a6ff, 0x1a0b2e, 0.7); scene.add(hemi);
      const key = new T.DirectionalLight(0xffffff, 1.4); key.position.set(4, 12, 10); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 }); scene.add(key);
      // Pista de LED: cada placa acende numa cor na batida
      const NX = 12, NZ = 10, tile = 1.25;
      const floor = new T.InstancedMesh(new T.BoxGeometry(tile * 0.96, 0.2, tile * 0.96), new T.MeshStandardMaterial({ roughness: 0.25, metalness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.0 }), NX * NZ);
      floor.receiveShadow = true;
      const d = new T.Object3D();
      for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) { d.position.set((x - NX / 2 + 0.5) * tile, -0.1, (z - NZ / 2 + 0.5) * tile - 1.5); d.updateMatrix(); floor.setMatrixAt(z * NX + x, d.matrix); floor.setColorAt(z * NX + x, new T.Color('#1a1030')); }
      scene.add(floor);
      // Palco do DJ ao fundo com caixas de som e telão
      const stageM = new T.MeshStandardMaterial({ color: 0x150a26, roughness: 0.5, metalness: 0.4 });
      const stage = new T.Mesh(new T.BoxGeometry(10, 1, 3), stageM); stage.position.set(0, 0.5, -9.5); scene.add(stage);
      for (const sx of [-5.8, 5.8]) { const spk = new T.Mesh(new T.BoxGeometry(1.6, 3.4, 1.4), new T.MeshStandardMaterial({ color: 0x0b0b12, roughness: 0.6 })); spk.position.set(sx, 1.7, -9); scene.add(spk); for (const y of [1.1, 2.4]) { const cone = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.1, 20), new T.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.3 })); cone.rotation.x = Math.PI / 2; cone.position.set(sx, y, -8.25); scene.add(cone); } }
      const screenTex = G3.tex(512, 256, (gg, w, h) => { const gr = gg.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#d946ef'); gr.addColorStop(1, '#22d3ee'); gg.fillStyle = gr; gg.fillRect(0, 0, w, h); gg.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 0; y < h; y += 6) gg.fillRect(0, y, w, 2); gg.fillStyle = '#fff'; gg.font = 'italic 900 70px Barlow Condensed, Barlow, sans-serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('PISTA DE DANÇA', w / 2, h / 2); });
      const screen = new T.Mesh(new T.PlaneGeometry(8, 4), new T.MeshBasicMaterial({ map: screenTex, toneMapped: false })); screen.position.set(0, 4, -10.9); scene.add(screen);
      // Globo espelhado + feixes de luz coloridos
      const ballTex = G3.tex(256, 128, (gg, w, h) => { for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) { const v = 140 + Math.random() * 115; gg.fillStyle = `rgb(${v},${v},${v + 10})`; gg.fillRect(x, y, 7, 7); } });
      const ball = new T.Mesh(new T.SphereGeometry(0.9, 24, 16), new T.MeshStandardMaterial({ map: ballTex, metalness: 1, roughness: 0.15, emissive: 0x333344 }));
      ball.position.set(0, 6.5, -1.5); ball.visible = false; scene.add(ball);
      const beams = [];
      for (let i = 0; i < 8; i++) {
        const b = new T.Mesh(new T.ConeGeometry(1.2, 12, 16, 1, true), new T.MeshBasicMaterial({ color: COLORS[i % COLORS.length], transparent: true, opacity: 0.12, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
        b.geometry.translate(0, -6, 0); b.position.set((i - 3.5) * 1.6, 8, -6); scene.add(b); beams.push(b);
      }
      const spot = new T.SpotLight(0xffffff, 0, 30, 0.28, 0.4, 1); spot.position.set(0, 12, 4); scene.add(spot, spot.target);
      const cone = new T.Mesh(new T.ConeGeometry(1.6, 12, 24, 1, true), new T.MeshBasicMaterial({ color: 0xfff7d6, transparent: true, opacity: 0.0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      cone.geometry.translate(0, -6, 0); cone.position.set(0, 12, 0); scene.add(cone);
      const cam = new T.PerspectiveCamera(46, W / H, 0.1, 200);
      const dir = new CamDirector(cam, { pos: [0, 7.2, 15.5], look: [0, 1.6, -1.6] });
      dir.drift = 0.7;
      const fx = new FX3D(scene, 240);
      this.r = { scene, cam, dir, fx, floor, NX, NZ, ball, beams, spot, cone, hemi, key, screen, chars: new Map(), col: new T.Color(), lastBeat: -1 };
      return this.r;
    },
    onAction(id, a) {
      base.onAction.call(this, id, a);
      const r = this.r;
      if (!r) return;
      const d = this.d.find((x) => x.k === (a.user.id || a.user.nick)), c = d && r.chars.get(d.k);
      if (!c) return;
      const p = c.root.position.clone().setY(1.2);
      if (id === 'hype') { c.play('jump'); r.fx.burst(p, { color: ['#f472b6', '#ffffff'], n: 6, speed: 1.5, up: 2, gravity: 0.5, size: 0.25, tex: 'star', additive: false, life: 0.8 }); }
      else if (id === 'spin') { c.play('spin'); r.fx.ring(p.clone().setY(0.1), { color: '#e879f9', size: 2.5 }); }
      else if (id === 'change_face') { c.setTint(d.shirt); r.fx.burst(p, { color: [d.shirt, '#ffffff'], n: 20, speed: 3, up: 2, size: 0.3, life: 0.7 }); c.play('powerUp'); }
      else if (id === 'grow') { r.fx.burst(p, { color: ['#fde047', '#ffffff'], n: 14, speed: 2, up: 3, size: 0.3, tex: 'star', additive: false }); }
      else if (id === 'change_place') { r.fx.burst(p, { color: ['#22d3ee', '#ffffff'], n: 14, speed: 3, size: 0.3 }); }
      else if (id === 'spotlight') { c.play('victory', { then: 'taunt' }); }
      else if (id === 'disco_ball') { r.fx.burst(r.ball.position.clone(), { color: COLORS.slice(0, 6), n: 40, speed: 6, size: 0.3, life: 1.2 }); }
    },
    onCharPick(user, k) {
      const key = user.id || user.nick, r = this.r, c = r?.chars.get(key), d = this.d.find((x) => x.k === key);
      if (!c || !d) return;
      const n = new Character3D({ kind: k, user: d.user, plate: !d.user.bot, height: 1.55, tint: d.shirt, base: 'idle' });
      n.root.position.copy(c.root.position); n.danceI = c.danceI; n.moveN = 0;
      c.dispose(); r.scene.add(n.root); r.chars.set(key, n); n.play('spawnAir');
      r.fx.burst(n.root.position.clone().setY(1.2), { color: ['#e879f9', '#ffffff'], n: 24, speed: 3, up: 2, size: 0.25, life: 0.8 });
    },
    onChat(ev) {
      base.onChat.call(this, ev);
      const d = this.d.find((x) => x.k === uid(ev)), c = d && this.r?.chars.get(d.k);
      if (c && this.s.showComments) c.say(ev.text, { secs: 4 });
    },
    update(dt) {
      base.update.call(this, dt);
      const r = this.r;
      if (!r) return;
      const t = performance.now() / 1000, beat = t * this.s.bpm / 60;
      // Personagens: cria/remove conforme a lista e anda até o lugar dele na pista
      const shown = this.d.slice(0, MAX3D), keep = new Set(shown.map((x) => x.k));
      for (const [k, c] of r.chars) if (!keep.has(k)) { c.dispose(); r.chars.delete(k); }
      shown.forEach((d, i) => {
        let c = r.chars.get(d.k);
        if (!c) {
          c = new Character3D({ kind: kindFor(d.user), user: d.user, plate: !d.user.bot, height: 1.55, tint: d.shirt, base: 'idle' });
          const s = slot(i); c.root.position.set(s.x, 0, 8); c.play('run', { once: true });
          r.scene.add(c.root); r.chars.set(d.k, c); c.danceI = d.style; c.moveN = 0;
        }
        const s = slot(i), pos = c.root.position;
        const dx = s.x - pos.x, dz = s.z - pos.z, dist = Math.hypot(dx, dz);
        if (dist > 0.08) { const sp = Math.min(dist, dt * 3.5); pos.x += dx / dist * sp; pos.z += dz / dist * sp; c.root.rotation.y = Math.atan2(dx, dz); if (!c.busy && c.state !== 'run') c.play('run', { once: true }); c.walking = true; }
        else if (c.walking) { c.walking = false; c.root.rotation.y = 0; c.play('idle'); }
        else c.root.rotation.y += (0 - c.root.rotation.y) * Math.min(1, dt * 4);
        c.body.scale.setScalar(d.scale);
        if (d.spin > 0) c.root.rotation.y += dt * 9;
        c.update(dt);
      });
      // Coreografia: a cada 2 batidas cada dançarino troca de passo
      const b2 = Math.floor(beat / 2);
      if (b2 !== r.lastBeat) {
        r.lastBeat = b2;
        let k = 0;
        for (const c of r.chars.values()) {
          if (c.walking || c.busy) continue;
          const seq = MOVES[(c.danceI || 0) % MOVES.length];
          c.play(seq[(c.moveN++ + k++) % seq.length], { speed: this.s.bpm / 110 });
        }
      }
      r.fx.update(dt);
    },
    draw() {
      const r = this.scene3d(), t = performance.now() / 1000;
      if (!r) return base.draw.call(this);
      const beat = t * this.s.bpm / 60, pulse = Math.pow(1 - (beat % 1), 3), fc = new THREE.Color(this.s.floorColor);
      // Pista acende na batida
      for (let i = 0; i < r.NX * r.NZ; i++) {
        const on = (hashStr(`${i},${Math.floor(beat)}`) % 3) === 0;
        if (on) r.col.copy(fc).offsetHSL((i % 5) * 0.04, 0, 0).multiplyScalar(0.35 + pulse * 0.9); else r.col.set('#160c2a');
        r.floor.setColorAt(i, r.col);
      }
      r.floor.instanceColor.needsUpdate = true;
      r.floor.material.emissiveIntensity = 0.0;
      // Globo e feixes
      const disco = this.disco > 0;
      r.ball.visible = disco; r.ball.rotation.y = t * 0.8;
      r.beams.forEach((b, i) => { b.rotation.z = Math.sin(t * 1.2 + i) * 0.6; b.rotation.x = Math.cos(t * 0.9 + i * 1.7) * 0.35; b.material.opacity = (disco ? 0.22 : 0.09) * (0.6 + pulse * 0.6); });
      // Holofote: a festa escurece, um cone de luz em quem ganhou e a câmera aproxima
      const sp = this.spot && r.chars.get(this.spot.d.k);
      r.hemi.intensity += ((sp ? 0.12 : 0.7) - r.hemi.intensity) * 0.1;
      r.key.intensity += ((sp ? 0.2 : 1.4) - r.key.intensity) * 0.1;
      r.spot.intensity += ((sp ? 600 : 0) - r.spot.intensity) * 0.15;
      r.cone.material.opacity += ((sp ? 0.18 : 0) - r.cone.material.opacity) * 0.15;
      if (sp) { r.spot.target.position.copy(sp.root.position); r.cone.position.set(sp.root.position.x, 12, sp.root.position.z); if (!r.dir.focusT || r.dir.focusT < 0.2) r.dir.focus(sp.root.position, { secs: 0.6, dist: 5.5, height: 1.8 }); }
      r.dir.update(1 / 60, t);
      G3.render(r.scene, r.cam);
      title('PISTA DE DANÇA', W / 2, 56, 46, '#f0abfc');
      pill(`${this.d.length} na pista · comente para entrar`, W / 2, 100, { size: 16, bg: 'rgba(10,6,24,.75)' });
      if (this.spot) pill(`🔦 HOLOFOTE: ${trim(this.spot.d.user.nick, 16)}`, W / 2, 150, { size: 22, bg: '#d946ef', border: '#fff' });
      if (this.s.showLeaderboard) hudBoard([...this.coins.values()].sort((a, b) => b.value - a.value), W - 250, 180, 230, { title: 'TOP DA FESTA', n: this.s.leaderboardSize, unit: ' 🪙', rowH: 30, bg: 'rgba(8,10,20,.6)' });
    },
  });
})();
