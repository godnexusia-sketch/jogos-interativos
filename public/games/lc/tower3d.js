'use strict';

// ---------------- Guerra das Torres: construtores, canhão e topo de castelo ----------------
// A regra continua em team3d.js. Aqui entram: um construtor 3D animado em cima de cada torre
// (constrói, apanha, comemora, cai), ameias e bandeira no topo, blocos caindo quando alguém
// constrói, bala de canhão que voa até a outra torre na destruição, e fogos na vitória.
// A placa em cima de cada torre mostra quem construiu por último (foto e nome).
(() => {
  const g = GAMES.find((x) => x.id === 'tower-war');
  if (!g) return;
  const base = { reset: g.reset, onAction: g.onAction, add: g.add, update: g.update, draw: g.draw, scene3d: g.scene3d };
  const TX = [-5.2, 5.2];
  Object.assign(g, {
    enter() { Assets3D.preload(['cavaleiro', 'barbaro']); },
    leave() { if (this.r?.builders) { for (const b of this.r.builders) b.dispose(); this.r.builders = null; for (const p of this.r.plates || []) if (p) { p.parent?.remove(p); p.material.map.dispose(); p.material.dispose(); } this.r.plates = [null, null]; this.r.fx?.clear(); } },
    reset() {
      base.reset.call(this);
      this.drops = []; this.balls = []; this.last = [null, null]; this.lastShown = [null, null];
    },
    scene3d() {
      const r = base.scene3d.call(this);
      if (!r || r.builders) return r;
      const T = THREE;
      if (!r.caps) {
      r.fx = new FX3D(r.scene, 220);
      // Topo de castelo: anel com ameias + mastro com bandeira do time
      r.caps = [0, 1].map((s) => {
        const col = new T.Color(s ? this.s.rightColor : this.s.leftColor);
        const cap = new T.Group();
        const stone = new T.MeshStandardMaterial({ color: col.clone().lerp(new T.Color('#ffffff'), 0.25), roughness: 0.55 });
        const ring = new T.Mesh(new T.BoxGeometry(7, 0.8, 7), stone); ring.position.y = 0.4; ring.castShadow = true; cap.add(ring);
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * Math.PI * 2, merlon = new T.Mesh(new T.BoxGeometry(1.1, 1.1, 1.1), stone);
          const e = 3.2; merlon.position.set(Math.max(-e, Math.min(e, Math.cos(a) * 4.6)), 1.35, Math.max(-e, Math.min(e, Math.sin(a) * 4.6))); merlon.castShadow = true; cap.add(merlon);
        }
        const pole = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 5, 8), new T.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.6, roughness: 0.3 })); pole.position.set(-2.6, 3.3, -2.6); cap.add(pole);
        const flag = new T.Mesh(new T.PlaneGeometry(2.2, 1.3, 8, 1), new T.MeshStandardMaterial({ color: col, side: T.DoubleSide, roughness: 0.6 })); flag.position.set(-1.45, 5.1, -2.6); cap.add(flag);
        cap.userData.flag = flag;
        cap.position.x = TX[s];
        r.scene.add(cap);
        return cap;
      });
      }
      // Um construtor em cada torre (cavaleiro de um lado, bárbaro do outro), com a capa do time
      r.builders = [0, 1].map((s) => {
        const c = new Character3D({ kind: s ? 'barbaro' : 'cavaleiro', loadout: 'weapon', height: 3.4, tint: s ? this.s.rightColor : this.s.leftColor, plate: false, base: 'idle' });
        c.root.position.set(TX[s] + (s ? -1 : 1), 0.8, 1.2);
        c.root.rotation.y = s ? -0.5 : 0.5;
        r.caps[s].parent.add(c.root);
        return c;
      });
      r.plates = [null, null];
      return r;
    },
    add(s, n) {
      const wasWin = this.win;
      base.add.call(this, s, n);
      if (!this.r?.builders) return;
      // Blocos caindo do céu até o topo (no máximo alguns de cada vez)
      for (let i = 0; i < Math.min(4, Math.ceil(n / 5)); i++) this.drops.push({ s, y: 30 + i * 4, v: 0, x: rand(-1.5, 1.5), z: rand(-1.5, 1.5) });
      const b = this.r.builders[s];
      if (!b.busy) b.play(n >= 10 ? 'powerUp' : 'interact', { speed: 1.4 });
      if (!wasWin && this.win) {
        b.play('victory', { then: 'taunt' });
        this.r.builders[1 - s].play('hit', { then: 'idle' });
        this.winFx = 2.5;
      }
    },
    onAction(id, a) {
      const sBefore = this.fans.get(a.user);
      base.onAction.call(this, id, a);
      if (!this.r?.builders) return;
      const s = this.fans.get(a.user) ?? sBefore;
      if (s !== undefined) this.last[s] = a.user;
      if (id === 'wreck' || id === 'reset_other' || id === 'steal') {
        // Bala de canhão (ou saque) voando da torre de quem mandou até a outra
        const from = s ?? 0, to = 1 - from;
        this.balls.push({ from, to, t: 0, dur: 1.1, big: id === 'reset_other', steal: id === 'steal' });
        this.r.builders[from].play(id === 'steal' ? 'throw' : 'cast', { speed: 1.2 });
      }
    },
    update(dt) {
      base.update.call(this, dt);
      const r = this.r;
      if (!r?.builders) return;
      const unit = 60 / this.s.targetHeight;
      for (const s of [0, 1]) {
        const topY = this.vis[s] * unit;
        r.caps[s].position.y = topY;
        r.builders[s].root.position.y = topY + 0.8;
        r.builders[s].update(dt);
        const fl = r.caps[s].userData.flag, pos = fl.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, Math.sin(performance.now() / 250 + x * 2.5) * 0.18 * (x + 1.1)); }
        pos.needsUpdate = true;
        // Placa de quem construiu por último
        if (this.last[s] && this.last[s] !== this.lastShown[s]) {
          this.lastShown[s] = this.last[s];
          if (r.plates[s]) { r.plates[s].parent?.remove(r.plates[s]); r.plates[s].material.map.dispose(); r.plates[s].material.dispose(); }
          const p = makeNameplate(this.last[s], s ? this.s.rightColor : this.s.leftColor);
          p.scale.set(5.2, 5.2 * 176 / 512, 1); r.scene.add(p); r.plates[s] = p;
          p.userData.setTag('ÚLTIMO CONSTRUTOR');
        }
        if (r.plates[s]) r.plates[s].position.set(TX[s], topY + 6.6, 0);
      }
      // Blocos caindo
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i]; d.v += 60 * dt; d.y -= d.v * dt;
        if (d.y <= 0) { r.fx.burst(new THREE.Vector3(TX[d.s] + d.x, this.vis[d.s] * unit + 1, d.z), { color: '#e2e8f0', n: 6, speed: 3, up: 1, size: 0.5, tex: 'smoke', additive: false, gravity: -2, life: 0.5 }); this.drops.splice(i, 1); }
      }
      // Balas de canhão em arco
      for (let i = this.balls.length - 1; i >= 0; i--) {
        const b = this.balls[i]; b.t += dt;
        if (b.t >= b.dur) {
          const p = new THREE.Vector3(TX[b.to], this.vis[b.to] * unit + 1, 0);
          r.fx.burst(p, { color: b.steal ? ['#c084fc', '#ffffff'] : ['#fde047', '#fb923c', '#ef4444'], n: b.big ? 70 : 34, speed: b.big ? 12 : 7, up: 3, size: b.big ? 0.9 : 0.6, life: 0.8 });
          r.fx.ring(p.clone(), { color: b.steal ? '#c084fc' : '#fb923c', size: b.big ? 24 : 12 });
          r.builders[b.to].play('hit', { speed: 1.2 }); r.builders[b.to].hitFlash(0xff6b6b, 1);
          this.balls.splice(i, 1);
        }
      }
      if (this.winFx > 0) {
        this.winFx -= dt;
        if (Math.random() < dt * 6) { const s = this.win?.s ?? 0; r.fx.burst(new THREE.Vector3(TX[s] + rand(-8, 8), this.vis[s] * unit + rand(6, 16), rand(-4, 4)), { color: [pick(['#fde047', '#f472b6', '#60a5fa', '#4ade80']), '#ffffff'], n: 30, speed: 8, up: 0, gravity: -3, size: 0.7, life: 1.1 }); }
      }
      r.fx.update(dt);
    },
    draw() {
      base.draw.call(this);
      const r = this.r;
      if (r && !r.balls3d) r.balls3d = [];
      // As balas são desenhadas na cena antes do próximo quadro (malhas reaproveitadas)
      if (!r?.builders) return;
      const unit = 60 / this.s.targetHeight;
      while (r.balls3d.length < this.balls.length) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.7, roughness: 0.3, emissive: 0xff5500, emissiveIntensity: 0.4 }));
        r.scene.add(m); r.balls3d.push(m);
      }
      r.balls3d.forEach((m, i) => {
        const b = this.balls[i];
        m.visible = Boolean(b);
        if (!b) return;
        const k = b.t / b.dur, y0 = this.vis[b.from] * unit + 4, y1 = this.vis[b.to] * unit + 1;
        m.position.set(TX[b.from] + (TX[b.to] - TX[b.from]) * k, y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * 14, 2);
        m.scale.setScalar(b.big ? 1.6 : 1);
        m.material.color.set(b.steal ? 0x7c3aed : 0x1f2937);
      });
      // Blocos caindo (malhas simples reaproveitadas)
      r.drop3d = r.drop3d || [];
      while (r.drop3d.length < this.drops.length) { const m = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 3), new THREE.MeshStandardMaterial({ roughness: 0.4 })); m.castShadow = true; r.scene.add(m); r.drop3d.push(m); }
      r.drop3d.forEach((m, i) => {
        const d = this.drops[i]; m.visible = Boolean(d); if (!d) return;
        m.position.set(TX[d.s] + d.x, this.vis[d.s] * unit + d.y + 1, d.z);
        m.material.color.set(d.s ? this.s.rightColor : this.s.leftColor);
      });
    },
  });
})();
