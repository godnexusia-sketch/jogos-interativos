'use strict';

// ---------------- Arena de Batalha em 3D ----------------
// A regra continua a de team.js (times A e B, armas pelo valor do presente, abates, rodadas).
// Aqui só muda a apresentação: cada lutador vira um personagem 3D animado (corre até o inimigo,
// ataca, apanha, cai), e flechas, bolas de fogo, raios e a bomba nuclear viram efeitos 3D.
(() => {
  const g = GAMES.find((x) => x.id === 'battle-arena');
  if (!g) return;
  g.three = true;
  g.desc = 'O chat comenta a ou b para entrar num time e vira um guerreiro 3D com a sua foto. Presentes aumentam a vida ou bombardeiam o time inimigo, até com bomba nuclear.';
  g.help = '<p>Comente <b>a</b> ou <b>b</b> para entrar: você vira um guerreiro 3D (sempre o mesmo personagem) com a sua foto e o nome. Os guerreiros correm até o inimigo mais perto e lutam sozinhos.</p><p>❤️ Likes aumentam a vida. 🎁 Presentes atacam o time inimigo: 🏹 flechas, 🔥 bola de fogo (10+), 💣 bombardeio (30+), ⚡ raios (100+) e ☢️ bomba nuclear (1.000+). Com bastante vida o guerreiro pega a arma.</p>';
  const base = { reset: g.reset, damage: g.damage, weapon: g.weapon, end: g.end, update: g.update, onAction: g.onAction, draw: g.draw };
  const kill = (r, o) => { if (!o.m) return; r.scene.remove(o.m); o.m.geometry.dispose(); o.m.material.dispose(); o.m.children[0]?.material.dispose(); o.m = null; };
  // Coordenadas do jogo (tela 720×1280) → chão da arena 3D
  const to3 = (x, y) => new THREE.Vector3((x - W / 2) / 80, 0, (y - 690) / 72);
  const heightOf = (fi) => 1.15 + clamp((fi.r - 22) / 38, 0, 1) * 0.75;

  Object.assign(g, {
    // Só as animações e os bots; cada personagem baixa quando aparece (são dezenas na lista)
    enter() { Assets3D.preload(UNDEAD_KINDS.slice(0, 2)); },
    leave() { this.dispose3d(); },
    reset() {
      base.reset.call(this);
      this.fx3 = [];
      if (this.r) { for (const c of this.r.chars.values()) c.dispose(); this.r.chars.clear(); for (const d of this.r.dying) d.c.dispose(); this.r.dying = []; this.r.fx.clear(); }
    },
    dispose3d() {
      if (!this.r) return;
      for (const c of this.r.chars.values()) c.dispose();
      for (const d of this.r.dying) d.c.dispose();
      this.r.chars.clear(); this.r.dying = []; this.r.fx.clear();
    },
    scene3d() {
      if (this.r || !G3.ready) return this.r;
      const T = THREE, scene = new T.Scene();
      const arena = buildArena(scene, { floor: '#2a2f45', rim: this.s.leftColor, rim2: this.s.rightColor, logo: 'A  ×  B', radius: 8.2 });
      // Linha do meio e as duas metades pintadas com a cor de cada time
      for (const [side, col] of [[0, this.s.leftColor], [1, this.s.rightColor]]) {
        const half = new T.Mesh(new T.CircleGeometry(8, 32, side ? -Math.PI / 2 : Math.PI / 2, Math.PI), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.13, depthWrite: false }));
        half.rotation.x = -Math.PI / 2; half.position.y = 0.02; scene.add(half);
      }
      const cam = new T.PerspectiveCamera(46, W / H, 0.1, 200);
      const dir = new CamDirector(cam, { pos: [0, 12.5, 13.5], look: [0, 0, -0.6] });
      dir.drift = 0.4;
      const fx = new FX3D(scene, 300);
      this.r = { scene, cam, dir, fx, arena, chars: new Map(), dying: [] };
      return this.r;
    },
    // Dano: além da regra, o personagem reage (pisca e faz a animação de apanhar ou cair).
    damage(fo, d, user) {
      const alive = fo.hp > 0;
      base.damage.call(this, fo, d, user);
      const c = this.r?.chars.get(fo.k);
      if (!c || !alive) return;
      c.hitFlash(0xffffff, 1);
      const p = c.root.position.clone(); p.y = 1;
      if (fo.hp <= 0) {
        c.play('death', { hold: true });
        this.r.fx.burst(p, { color: [fo.side ? this.s.rightColor : this.s.leftColor, '#ffffff'], n: 18, speed: 4, size: 0.22 });
        this.r.chars.delete(fo.k); this.r.dying.push({ c, t: 1.8 });
        c.setHp(0);
      } else {
        if (!c.busy) c.play('hit', { speed: 1.3 });
        c.setHp(fo.hp / fo.max);
        if (this.s.showDamageNumbers && this.r.fx.texts.length < 6 && Math.random() < 0.4) this.r.fx.text(p.clone().setY(c.height + 0.6), `-${Math.round(d)}`, { size: 0.5, life: 0.7 });
      }
    },
    weapon(coinsN, side, user) {
      const before = this.fx.length;
      base.weapon.call(this, coinsN, side, user);
      if (!this.r) return;
      // Cada efeito novo da regra ganha a versão 3D
      for (const e of this.fx.slice(before)) this.fx3.push({ e, made: false });
      this.r.arena.hype = Math.min(1, this.r.arena.hype + Math.log10(1 + coinsN) * 0.2);
    },
    end(side) {
      base.end.call(this, side);
      if (!this.r) return;
      for (const [k, c] of this.r.chars) { const fi = this.f.find((x) => x.k === k); if (fi && fi.side === side) c.play('victory', { then: 'taunt' }); else c.play('hit'); }
      const p = new THREE.Vector3(side ? 3 : -3, 3, 0);
      this.r.fx.burst(p, { color: ['#fde047', side ? this.s.rightColor : this.s.leftColor, '#ffffff'], n: 70, speed: 7, up: 5, tex: 'star', additive: false, gravity: -4, size: 0.35, life: 1.8 });
    },
    onAction(id, a) {
      const had = this.f.some((x) => x.k === (a.user.id || a.user.nick));
      base.onAction.call(this, id, a);
      const fi = this.f.find((x) => x.k === (a.user.id || a.user.nick));
      const c = fi && this.r?.chars.get(fi.k);
      if (!c) return;
      if (id === 'grow_hp') { this.r.fx.burst(c.root.position.clone().setY(1), { color: ['#4ade80', '#ffffff'], n: 6, speed: 1.2, up: 2, gravity: 0.5, size: 0.18, tex: 'star', additive: false }); if (!c.busy) c.play('powerUp', { speed: 1.4 }); }
      if (had && id.startsWith('attack') && !c.busy) c.play('cast', { speed: 1.3 });
    },
    onCharPick(user) { const key = user.id || user.nick, c = this.r?.chars.get(key); if (c) { c.dispose(); this.r.chars.delete(key); } },
    onChat(ev) {
      const fi = this.f.find((x) => x.k === (ev.user.id || ev.user.nick));
      const c = fi && this.r?.chars.get(fi.k);
      if (c && ev.text.trim().length > 2) c.say(ev.text, { secs: 3 });
    },
    // Cria os personagens novos, move cada um para a posição da regra e escolhe a animação.
    sync3d(dt) {
      const r = this.r, alive = new Set();
      for (const fi of this.f) {
        alive.add(fi.k);
        let c = r.chars.get(fi.k);
        if (!c) {
          c = new Character3D({ kind: fi.bot ? kindFor(fi.user, UNDEAD_KINDS) : kindFor(fi.user), user: fi.user, plate: this.s.showNames && !fi.bot, hp: true, height: heightOf(fi), tint: fi.side ? this.s.rightColor : this.s.leftColor, base: 'fightIdle' });
          c.root.position.copy(to3(fi.x, fi.y));
          c.play('spawnAir');
          c.baseH = heightOf(fi);
          r.scene.add(c.root); r.chars.set(fi.k, c);
          r.fx.burst(c.root.position.clone().setY(0.1), { color: '#cbd5e1', n: 8, speed: 2, up: 0.5, gravity: -1, tex: 'smoke', additive: false, size: 0.5, life: 0.6 });
          c.prev = c.root.position.clone();
        }
        const p = to3(fi.x, fi.y);
        const moved = p.distanceTo(c.root.position);
        c.root.position.lerp(p, Math.min(1, dt * 12));
        // Vira para onde está indo (ou para o inimigo mais perto quando parado)
        let face = null;
        if (moved > 0.02) face = p;
        else { let best = null, bd = 1e9; for (const o of this.f) if (o.side !== fi.side) { const d = Math.hypot(o.x - fi.x, o.y - fi.y); if (d < bd) { bd = d; best = o; } } if (best) face = to3(best.x, best.y); }
        if (face) { const want = Math.atan2(face.x - c.root.position.x, face.z - c.root.position.z); let dr = want - c.root.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); c.root.rotation.y += dr * Math.min(1, dt * 10); }
        if (!c.busy) {
          if (moved > 0.03 && c.state !== 'run') c.play('run', { once: true });
          else if (moved <= 0.03 && c.state === 'run') c.play('fightIdle');
        }
        // Golpe: a regra zera o cd quando ataca (cd volta a 0.7)
        if (fi.cd > (fi.lastCd ?? 0) + 0.3 && !c.busy) c.play(fi.max >= 300 ? 'slash' : pick(['punch', 'punch', 'kick']), { speed: 1.4 });
        fi.lastCd = fi.cd;
        const lo = fi.max >= 300 ? 'weapon' : 'none';
        if (c.loadoutName !== lo) c.setLoadout(lo);
        const h = heightOf(fi);
        if (Math.abs(h - c.height) > 0.05) { c.height += (h - c.height) * 0.1; c.body.scale.setScalar(c.height / c.baseH); }
      }
      for (const [k, c] of r.chars) if (!alive.has(k)) { c.play('death', { hold: true }); r.chars.delete(k); r.dying.push({ c, t: 1.5 }); }
      for (let i = r.dying.length - 1; i >= 0; i--) {
        const d = r.dying[i]; d.t -= dt; d.c.update(dt);
        if (d.t < 0.5) d.c.root.position.y -= dt * 1.2; // afunda no chão
        if (d.t <= 0) { d.c.dispose(); r.dying.splice(i, 1); }
      }
      for (const c of r.chars.values()) c.update(dt);
    },
    // Versão 3D dos ataques (flechas, fogo, raios, nuclear), no mesmo tempo da regra.
    fx3d() {
      const r = this.r, T = THREE;
      for (let i = this.fx3.length - 1; i >= 0; i--) {
        const o = this.fx3[i], e = o.e;
        if (e.t < 0) continue;
        const p = to3(e.x, e.y);
        if (!o.made) {
          o.made = true;
          if (e.k === 'arrow' || e.k === 'boom') {
            const m = e.k === 'arrow'
              ? new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.9, 5), new T.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.4 }))
              : new T.Mesh(new T.SphereGeometry(0.32, 14, 10), new T.MeshBasicMaterial({ color: 0xff8a3d, toneMapped: false }));
            if (e.k === 'boom') { const gl = new T.Sprite(new T.SpriteMaterial({ map: Tex3D.spark(), color: 0xffa040, blending: T.AdditiveBlending, transparent: true, depthWrite: false })); gl.scale.setScalar(2); m.add(gl); }
            m.position.set(p.x - 2, 9, p.z - 1); r.scene.add(m); o.m = m; o.from = m.position.clone();
          } else if (e.k === 'bolt') {
            const pts = []; let x = p.x + rand(-0.5, 0.5), z = p.z;
            for (let y = 14; y > 0; y -= 1.4) { pts.push(new T.Vector3(x, y, z)); x += rand(-0.5, 0.5); z += rand(-0.3, 0.3); }
            pts.push(p.clone());
            const line = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 24, 0.07, 5), new T.MeshBasicMaterial({ color: 0xc7f9ff, toneMapped: false, transparent: true }));
            line.visible = false; r.scene.add(line); o.m = line;
          } else if (e.k === 'nuke') {
            const ball = new T.Mesh(new T.SphereGeometry(1, 24, 16), new T.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, toneMapped: false }));
            ball.position.copy(p); r.scene.add(ball); o.m = ball;
            r.dir.shake(0.6, 1.4); r.arena.hype = 1;
            r.fx.ring(p.clone().setY(0.1), { color: '#fb923c', size: 18, life: 1.2 });
            r.fx.burst(p.clone().setY(1), { color: ['#fde68a', '#fb923c', '#ef4444'], n: 90, speed: 12, up: 6, size: 0.6, life: 1.4 });
          }
        }
        const k = Math.min(1, e.t / 0.25);
        if ((e.k === 'arrow' || e.k === 'boom') && o.m) {
          o.m.position.lerpVectors(o.from, p.clone().setY(0.2), k);
          if (e.k === 'arrow') o.m.lookAt(p), o.m.rotateX(Math.PI / 2);
          if (k >= 1 && !o.hit) {
            o.hit = true;
            if (e.k === 'boom') { r.fx.burst(p.clone().setY(0.4), { color: ['#fde047', '#fb923c', '#ef4444'], n: 28, speed: 6, up: 3, size: 0.4, life: 0.6 }); r.fx.burst(p.clone().setY(0.3), { color: '#475569', n: 8, speed: 2, up: 1.5, gravity: 0, tex: 'smoke', additive: false, size: 1, life: 1 }); r.fx.ring(p.clone().setY(0.05), { color: '#fb923c', size: 4 }); if (this.s.screenShake) r.dir.shake(0.15, 0.25); }
            else r.fx.burst(p.clone().setY(0.2), { color: '#e5e7eb', n: 5, speed: 2, size: 0.12, life: 0.3 });
            r.scene.remove(o.m); o.m.geometry.dispose(); o.m.material.dispose(); o.m.children[0]?.material.dispose(); o.m = null;
          }
        } else if (e.k === 'bolt' && o.m) {
          o.m.visible = e.t >= 0.15 && e.t < 0.45 && Math.random() < 0.85;
          if (e.t >= 0.15 && !o.hit) { o.hit = true; r.fx.burst(p.clone().setY(0.3), { color: ['#a5f3fc', '#ffffff'], n: 22, speed: 6, size: 0.3, life: 0.4 }); r.fx.ring(p.clone().setY(0.05), { color: '#67e8f9', size: 3.5 }); if (this.s.screenShake) r.dir.shake(0.12, 0.2); }
        } else if (e.k === 'nuke' && o.m) {
          const kk = e.t / e.life;
          o.m.scale.setScalar(1 + kk * 14); o.m.material.opacity = 1 - kk;
          o.m.material.color.setHSL(0.1 - kk * 0.08, 1, 0.85 - kk * 0.4);
        }
        if (e.t >= e.life) { if (o.m) { r.scene.remove(o.m); o.m.geometry.dispose(); o.m.material.dispose(); o.m.children[0]?.material.dispose(); } this.fx3.splice(i, 1); }
      }
    },
    update(dt) {
      base.update.call(this, dt);
      if (!this.r) return;
      // Efeitos que a regra já terminou e que ficaram sem par
      this.fx3 = this.fx3.filter((o) => { if (this.fx.includes(o.e)) return true; kill(this.r, o); return false; });
      this.sync3d(dt);
      this.fx3d();
      this.r.fx.update(dt);
      this.r.arena.update(performance.now() / 1000, dt);
    },
    draw() {
      const r = this.scene3d(), t = performance.now() / 1000;
      // Sem WebGL: o desenho 2D original continua funcionando.
      if (!r) return base.draw.call(this);
      r.dir.update(1 / 60, t);
      G3.render(r.scene, r.cam);
      teamScoreboard(this, this.wl, this.wr, 30, this.s.winMode === 'kills' ? `ABATES ${this.kills[0]} x ${this.kills[1]} · meta ${this.s.killTarget}` : `${this.f.filter((x) => !x.side).length} x ${this.f.filter((x) => x.side).length} vivos · ${fmtTime(this.ph.t)}`);
      pill('comente a ou b para lutar · presente ataca o inimigo', W / 2, 192, { size: 17, bg: 'rgba(10,12,30,.8)' });
      if (this.s.showLeaderboard) hudBoard([...this.killers.values()].sort((a, b) => b.value - a.value), W - 250, 1080, 230, { title: 'ABATES', n: 3, rowH: 30 });
      this.feed.draw(20, 1090);
      if (this.ph.name !== 'play') {
        const col = this.winSide ? this.s.rightColor : this.s.leftColor;
        ctx.fillStyle = 'rgba(8,10,24,.75)'; ctx.beginPath(); ctx.roundRect(40, 520, W - 80, 150, 30); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke();
        title(`${(this.winSide ? this.s.rightLabel : this.s.leftLabel).toUpperCase()} ${this.ph.name === 'match' ? 'CAMPEÃO!' : 'VENCEU!'}`, W / 2, 580, 54, col);
        label(`${this.wl} x ${this.wr} no placar · nova rodada já já`, W / 2, 630, 20, '#fff', 'center', 800);
      }
    },
  });
})();
