'use strict';

// ---------------- Guerra de Territórios em 3D ----------------
// A regra continua em team.js (grade, bolinhas que pintam, chefão, escudo, porcentagens).
// Aqui o mapa vira um tabuleiro 3D: cada casa conquistada sobe com a cor do time (com um "pulo"
// na hora da conquista), as bolinhas são esferas brilhantes com rastro, cada time tem um castelo
// 3D com bandeira e um capitão animado que reage aos eventos, o escudo é uma cúpula e o chefão
// é um guerreiro gigante correndo pelo mapa.
(() => {
  const g = GAMES.find((x) => x.id === 'territory-war');
  if (!g) return;
  g.three = true;
  const base = { reset: g.reset, update: g.update, draw: g.draw, onAction: g.onAction, onChat: g.onChat, finish: g.finish, addBall: g.addBall };
  const S = 0.56; // tamanho de uma casa na cena

  Object.assign(g, {
    enter() { Assets3D.preload(Array.from({ length: this.s.teamCount }, (_, i) => pickKind('', i))); },
    leave() { this.dispose3d(); },
    dispose3d() {
      const r = this.r;
      if (!r) return;
      for (const c of r.captains || []) c.dispose();
      for (const b of r.bosses?.values() || []) b.dispose();
      r.scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { o.geometry?.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m?.map?.dispose?.(); m?.dispose?.(); }); } });
      r.fx.clear();
      this.r = null;
    },
    reset() {
      base.reset.call(this);
      this.prev = null;
      this.popT = new Float32Array(this.grid.length);
      // Tamanho do mapa ou número de times mudou: monta a cena de novo
      if (this.r && (this.r.G !== this.G || this.r.rows !== this.rowsN || this.r.teams !== this.teamsI.length)) this.dispose3d();
      else if (this.r) { for (const c of this.r.captains) c.play('idle'); for (const b of this.r.bosses.values()) b.dispose(); this.r.bosses.clear(); }
    },
    to3(px, py) { return new THREE.Vector3((px / this.cell - this.G / 2) * S, 0, (py / this.cell - this.rowsN / 2) * S); },
    cellPos(x, y) { return new THREE.Vector3((x + 0.5 - this.G / 2) * S, 0, (y + 0.5 - this.rowsN / 2) * S); },
    scene3d() {
      if (this.r || !G3.ready) return this.r;
      const T = THREE, scene = new T.Scene();
      scene.background = G3.skyTex('#0a1028', '#18234d', '#2b3a6b');
      scene.fog = new T.Fog(0x18234d, 40, 110);
      G3.lights(scene, { hemi: 0.8, sun: 2.0, pos: [12, 40, 18] });
      const N = this.G * this.rowsN;
      // Base do tabuleiro (pedra) e a borda
      const wMap = this.G * S, dMap = this.rowsN * S;
      const slab = new T.Mesh(new T.BoxGeometry(wMap + 1.2, 1.2, dMap + 1.2), new T.MeshStandardMaterial({ color: 0x1b2340, roughness: 0.8 }));
      slab.position.y = -0.62; slab.receiveShadow = true; scene.add(slab);
      const water = new T.Mesh(new T.PlaneGeometry(260, 260), new T.MeshStandardMaterial({ color: 0x0b2a4a, roughness: 0.25, metalness: 0.6 }));
      water.rotation.x = -Math.PI / 2; water.position.y = -1.1; scene.add(water);
      // Casas: uma instância por célula (sobe e ganha a cor do time quando conquistada)
      const tiles = new T.InstancedMesh(new T.BoxGeometry(S * 0.94, 1, S * 0.94), new T.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 }), N);
      tiles.receiveShadow = true; tiles.frustumCulled = false; scene.add(tiles);
      // Bolinhas
      const ballMesh = new T.InstancedMesh(new T.SphereGeometry(S * 0.42, 12, 10), new T.MeshStandardMaterial({ roughness: 0.2, metalness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.35 }), 450);
      ballMesh.castShadow = true; ballMesh.frustumCulled = false; scene.add(ballMesh);
      // Castelos
      const castles = this.castles.map((c, i) => {
        const col = new T.Color(this.teamsI[i].color);
        const grp = new T.Group(), stone = new T.MeshStandardMaterial({ color: col.clone().lerp(new T.Color('#e2e8f0'), 0.35), roughness: 0.6 }), roof = new T.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.7), roughness: 0.5 });
        const keep = new T.Mesh(new T.BoxGeometry(2.2, 1.6, 2.2), stone); keep.position.y = 0.8; keep.castShadow = true; grp.add(keep);
        for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
          const tw = new T.Mesh(new T.CylinderGeometry(0.42, 0.48, 2.3, 10), stone); tw.position.set(dx, 1.15, dz); tw.castShadow = true; grp.add(tw);
          const cone = new T.Mesh(new T.ConeGeometry(0.58, 0.9, 10), roof); cone.position.set(dx, 2.75, dz); cone.castShadow = true; grp.add(cone);
        }
        const pole = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 1.8, 6), new T.MeshStandardMaterial({ color: 0xe5e7eb })); pole.position.set(0, 2.5, 0); grp.add(pole);
        const flag = new T.Mesh(new T.PlaneGeometry(0.9, 0.55, 6, 1), new T.MeshStandardMaterial({ color: col, side: T.DoubleSide })); flag.position.set(0.45, 3.1, 0); grp.add(flag);
        grp.userData.flag = flag;
        const lab = G3.label(`${i + 1} · ${this.teamsI[i].name}`, { border: this.teamsI[i].color, scale: 0.13 }); lab.position.set(0, 4.3, 0); grp.add(lab);
        const dome = new T.Mesh(new T.SphereGeometry(2.8, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshBasicMaterial({ color: 0x9be7ff, transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide }));
        dome.visible = false; grp.add(dome); grp.userData.dome = dome;
        grp.position.copy(this.cellPos(c.x, c.y)); grp.position.y = 0.3;
        scene.add(grp);
        return grp;
      });
      // Um capitão de cada time ao lado do castelo
      const captains = this.castles.map((c, i) => {
        const cap = new Character3D({ kind: pickKind('', i), loadout: 'weapon', height: 1.7, tint: this.teamsI[i].color, plate: false, base: 'idle' });
        cap.root.position.copy(this.cellPos(c.x, c.y)).add(new T.Vector3(0, 0.3, 1.9));
        scene.add(cap.root);
        return cap;
      });
      const cam = new T.PerspectiveCamera(42, W / H, 0.1, 300);
      const dir = new CamDirector(cam, { pos: [0, dMap * 1.25 + 6, dMap * 0.62 + 8], look: [0, 0, 1.2] });
      dir.drift = 0.8;
      const fx = new FX3D(scene, 220);
      this.r = { scene, cam, dir, fx, tiles, ballMesh, castles, captains, bosses: new Map(), G: this.G, rows: this.rowsN, teams: this.teamsI.length, dummy: new T.Object3D(), col: new T.Color(), empty: new T.Color('#2a3354'), empty2: new T.Color('#232b48') };
      return this.r;
    },
    onAction(id, a) {
      base.onAction.call(this, id, a);
      const r = this.r;
      if (!r || this.ph.name !== 'play') return;
      const t = this.who.get(a.user);
      if (t === undefined) return;
      const cap = r.captains[t], at = r.castles[t].position.clone().setY(1.5);
      if (id === 'add_balls' && a.gift) { if (!cap.busy) cap.play('cast'); r.fx.burst(at, { color: [this.teamsI[t].color, '#ffffff'], n: 16, speed: 3, up: 3, size: 0.3, life: 0.8 }); }
      else if (id === 'boss') { cap.play('powerUp'); r.dir.shake(0.2, 0.4); r.fx.ring(at.clone().setY(0.4), { color: this.teamsI[t].color, size: 8 }); }
      else if (id === 'shield') { cap.play('block'); r.fx.burst(at, { color: '#9be7ff', n: 18, speed: 2, up: 2, size: 0.3, tex: 'star', additive: false, life: 0.9 }); }
      else if (id === 'speed_up' && Math.random() < 0.3 && !cap.busy) cap.play('jump');
    },
    onChat(ev) {
      const before = this.who.get(ev.user);
      base.onChat.call(this, ev);
      const t = this.who.get(ev.user);
      if (this.r && t !== undefined && t !== before) { const cap = this.r.captains[t]; if (!cap.busy) cap.play('victory', { speed: 1.4 }); cap.say(`${trim(ev.user.nick, 14)} entrou!`, { secs: 2 }); }
    },
    finish(i) {
      base.finish.call(this, i);
      const r = this.r;
      if (!r) return;
      r.captains.forEach((c, k) => (k === i ? c.play('victory', { then: 'taunt' }) : c.play('death', { hold: true })));
      r.dir.focus(r.castles[i].position, { secs: 5, dist: 10, height: 7 });
      r.fx.burst(r.castles[i].position.clone().setY(4), { color: [this.teamsI[i].color, '#fde047', '#ffffff'], n: 80, speed: 8, up: 6, gravity: -5, size: 0.4, tex: 'star', additive: false, life: 2 });
    },
    update(dt) {
      base.update.call(this, dt);
      const r = this.r;
      if (!r) return;
      // Conquistas: casas que mudaram de dono pulam (e soltam faíscas de vez em quando)
      if (!this.prev || this.prev.length !== this.grid.length) this.prev = Int8Array.from(this.grid);
      let sparks = 0;
      for (let i = 0; i < this.grid.length; i++) {
        if (this.grid[i] !== this.prev[i]) {
          this.prev[i] = this.grid[i]; this.popT[i] = 0.45;
          if (sparks < 3 && this.grid[i] >= 0 && Math.random() < 0.04) { sparks++; const x = i % this.G, y = Math.floor(i / this.G); r.fx.burst(this.cellPos(x, y).setY(0.8), { color: this.teamsI[this.grid[i]].color, n: 4, speed: 1.5, up: 2, size: 0.18, life: 0.5 }); }
        } else if (this.popT[i] > 0) this.popT[i] = Math.max(0, this.popT[i] - dt);
      }
      // Chefões: um guerreiro gigante para cada bolinha grande
      const live = new Set();
      for (const b of this.balls) {
        if (b.r < 3) continue;
        live.add(b);
        let c = r.bosses.get(b);
        if (!c) { c = new Character3D({ kind: 'esq_guerreiro', height: 2.6, tint: this.teamsI[b.team].color, plate: false, base: 'run' }); r.scene.add(c.root); r.bosses.set(b, c); }
        const p = this.to3(b.x, b.y); c.root.position.lerp(p, Math.min(1, dt * 10)); c.root.position.y = 0.3;
        c.root.rotation.y = Math.atan2(b.vx, b.vy);
        c.update(dt);
      }
      for (const [b, c] of r.bosses) if (!live.has(b)) { c.dispose(); r.bosses.delete(b); }
      for (const c of r.captains) c.update(dt);
      r.castles.forEach((grp, i) => {
        grp.userData.dome.visible = this.teamsI[i].shield > 0;
        const pos = grp.userData.flag.geometry.attributes.position;
        for (let k = 0; k < pos.count; k++) { const x = pos.getX(k); pos.setZ(k, Math.sin(performance.now() / 220 + x * 5 + i) * 0.08 * (x + 0.45)); }
        pos.needsUpdate = true;
      });
      r.fx.update(dt);
    },
    draw() {
      const r = this.scene3d(), t = performance.now() / 1000;
      if (!r) return base.draw.call(this);
      // Casas
      for (let y = 0; y < this.rowsN; y++) for (let x = 0; x < this.G; x++) {
        const i = y * this.G + x, v = this.grid[i], pop = this.popT[i] || 0;
        const h = v >= 0 ? 0.32 + Math.sin(pop / 0.45 * Math.PI) * 0.5 : 0.12;
        r.dummy.position.set((x + 0.5 - this.G / 2) * S, h / 2, (y + 0.5 - this.rowsN / 2) * S);
        r.dummy.scale.set(1, h, 1); r.dummy.updateMatrix(); r.tiles.setMatrixAt(i, r.dummy.matrix);
        if (v >= 0) { r.col.set(this.teamsI[v].color); if ((x + y) % 2) r.col.offsetHSL(0, 0, -0.05); if (pop > 0) r.col.offsetHSL(0, 0, pop * 0.4); }
        else r.col.copy((x + y) % 2 ? r.empty : r.empty2);
        r.tiles.setColorAt(i, r.col);
      }
      r.tiles.instanceMatrix.needsUpdate = true; r.tiles.instanceColor.needsUpdate = true;
      // Bolinhas (o chefão é desenhado como personagem)
      let n = 0;
      for (const b of this.balls) {
        if (b.r >= 3 || n >= 450) continue;
        const p = this.to3(b.x, b.y);
        r.dummy.position.set(p.x, 0.62 + Math.abs(Math.sin(t * 8 + n)) * 0.15, p.z); r.dummy.scale.setScalar(1); r.dummy.updateMatrix();
        r.ballMesh.setMatrixAt(n, r.dummy.matrix); r.col.set(this.teamsI[b.team].color).lerp(new THREE.Color('#ffffff'), 0.35); r.ballMesh.setColorAt(n, r.col); n++;
      }
      r.ballMesh.count = n; r.ballMesh.instanceMatrix.needsUpdate = true; if (r.ballMesh.instanceColor) r.ballMesh.instanceColor.needsUpdate = true;
      r.dir.update(1 / 60, t);
      G3.render(r.scene, r.cam);
      // HUD
      title('GUERRA DE TERRITÓRIOS', W / 2, 44, 40);
      pill(this.ph.name === 'play' ? `⏱ ${fmtTime(this.ph.t)} · comente o número do castelo` : 'FIM DA RODADA', W / 2, 84, { size: 16, bg: 'rgba(10,12,30,.8)' });
      const ord = this.teamsI.map((tm, i) => ({ tm, p: this.area?.[i] || 0 })).sort((a, b) => b.p - a.p);
      const m = Math.min(5, ord.length);
      ord.slice(0, 5).forEach((o, k) => {
        const x = 20 + k * ((W - 40) / m), w = (W - 40) / m - 8;
        ctx.fillStyle = 'rgba(10,12,30,.82)'; ctx.beginPath(); ctx.roundRect(x, 112, w, 86, 16); ctx.fill();
        ctx.fillStyle = o.tm.color; ctx.beginPath(); ctx.roundRect(x, 112, w * clamp(o.p / Math.max(0.01, ord[0].p), 0, 1), 6, 3); ctx.fill();
        ctx.strokeStyle = o.tm.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, 112, w, 86, 16); ctx.stroke();
        label(trim(o.tm.name, 9), x + w / 2, 136, 15, '#fff', 'center', 900); num(`${Math.round(o.p * 100)}%`, x + w / 2, 166, 30, '#fff'); label(`🏆${o.tm.wins}${o.tm.shield > 0 ? ' 🛡️' : ''}`, x + w / 2, 190, 12, 'rgba(255,255,255,.85)', 'center', 800);
      });
      this.feed.draw(20, H - 160);
      if (this.ph.name === 'end') {
        const tm = this.teamsI[this.winner];
        ctx.fillStyle = 'rgba(8,10,24,.78)'; ctx.beginPath(); ctx.roundRect(40, 900, W - 80, 120, 28); ctx.fill(); ctx.strokeStyle = tm.color; ctx.lineWidth = 4; ctx.stroke();
        title(`${tm.name.toUpperCase()} VENCEU!`, W / 2, 950, 50, tm.color);
        label(`${Math.round((this.area?.[this.winner] || 0) * 100)}% do mapa`, W / 2, 996, 20, '#fff', 'center', 800);
      }
    },
  });
})();
