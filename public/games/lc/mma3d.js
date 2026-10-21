'use strict';

// ---------------- MMA dos Países com personagens 3D ----------------
// A regra continua em battle3d.js (fila por presente, país pelo comentário, rounds, ranking de países).
// Aqui os lutadores viram personagens 3D (o do espectador, ou o escolhido com !nome), com a bandeira
// do país em cima da placa, socando, chutando, apanhando e caindo no nocaute.
(() => {
  const g = GAMES.find((x) => x.id === 'mma-clash');
  if (!g) return;
  addSettings(g, [charSetting('houseKind', 'Personagem do lutador da casa')]);
  const base = { scene3d: g.scene3d, reset: g.reset };
  Object.assign(g, {
    enter() { Assets3D.preload(HERO_KINDS.slice(0, 4)); },
    leave() { if (this.r?.ch) { for (const c of this.r.ch) c?.dispose(); this.r.ch = [null, null]; } },
    reset() { base.reset.call(this); if (this.r?.ch) { for (const c of this.r.ch) c?.dispose(); this.r.ch = [null, null]; } },
    onCharPick(user) { const key = user.id || user.nick; if (this.f.some((e) => e && e.k === key)) this.rebuild = true; },
    buildFighters() {
      const r = this.r, T = THREE;
      r.ch = r.ch || [null, null];
      // Esconde os bonecos antigos, se existirem
      for (const fh of r.fighters || []) if (fh) fh.root.visible = false;
      for (let i = 0; i < 2; i++) {
        const e = this.f[i];
        r.ch[i]?.dispose(); r.ch[i] = null;
        if (!e) continue;
        const c = new Character3D({ kind: e.house ? pickKind(this.s.houseKind, i) : kindFor(e.user), user: e.user, plate: !e.house, hp: true, height: 2.6, tint: i ? '#dc2626' : '#2563eb', base: 'fightIdle' });
        c.root.position.set(i ? 1.6 : -1.6, 0, 0); c.root.rotation.y = i ? -Math.PI / 2 : Math.PI / 2;
        // Bandeira do país em cima da cabeça
        const tex = new T.TextureLoader().load(proxImgUrl(flagUrl(e.code, 160))); tex.colorSpace = T.SRGBColorSpace;
        const flag = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false })); flag.renderOrder = 32; flag.scale.set(0.9, 0.6, 1); flag.position.y = e.house ? 3.1 : 3.95;
        c.root.add(flag);
        r.scene.add(c.root); r.ch[i] = c; c.prevHit = 0; c.lastAct = this.act[i];
      }
      this.rebuild = false;
    },
    draw() {
      const r = this.scene3d(), t = performance.now() / 1000;
      if (r) {
        if (this.rebuild) this.buildFighters();
        r.ch = r.ch || [null, null];
        for (let i = 0; i < 2; i++) {
          const c = r.ch[i], a = this.act[i], e = this.f[i];
          if (!c) continue;
          c.root.visible = Boolean(e);
          if (!e) continue;
          // Golpe novo (a regra troca o objeto da ação a cada golpe)
          if (a !== c.lastAct && a.kind && !a.ko && !a.winT) { c.play(a.kind === 'kick' ? 'kick' : 'punch', { speed: 1.4 }); const o = r.ch[1 - i]; if (o) { o.root.position.x += (i ? -1 : 1) * 0.05; } }
          c.lastAct = a;
          if ((a.hit || 0) > c.prevHit + 0.5) { c.play('hit', { speed: 1.3 }); c.hitFlash(0xffffff, 1); }
          c.prevHit = a.hit || 0;
          c.setHp(Math.max(0, e.hp) / e.max);
          if (this.ph.name === 'ko') {
            if (a.ko && !c.dead) { c.dead = true; c.play('death', { hold: true }); }
            if (a.winT && !c.won) { c.won = true; c.play('victory', { then: 'taunt' }); c.setCrown(true); }
          }
          c.update(1 / 60);
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
})();
