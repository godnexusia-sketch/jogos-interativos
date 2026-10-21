'use strict';

// ---------------- Colina dos Zumbis com personagens 3D ----------------
// A regra continua em battle3d.js. Aqui cada zumbi vira um personagem 3D (Zumbi, Caveira, Esqueletinho,
// Esqueleto Alien e os esqueletos clássicos, ou qualquer personagem escolhido), com a foto e o nome do
// espectador na placa, andando colina acima, piscando quando leva tiro e caindo quando é abatido.
(() => {
  const g = GAMES.find((x) => x.id === 'zombie-hill');
  if (!g) return;
  addSettings(g, [
    { key: 'zombieSet', type: 'select', label: 'Quem são os zumbis', group: 'Personagens', default: 'monsters', options: [['monsters', 'Monstros (zumbi, caveira, esqueletos)'], ['all', 'Qualquer personagem ativo'], ['one', 'Um só (escolha abaixo)']] },
    { ...charSetting('zombieKind', 'Personagem único dos zumbis'), showIf: { key: 'zombieSet', value: 'one' } },
  ]);
  const base = { reset: g.reset, damage: g.damage, draw: g.draw };
  const kindOf = (gm, zb) => {
    if (gm.s.zombieSet === 'one') return pickKind(gm.s.zombieKind);
    return kindFor(zb.user, gm.s.zombieSet === 'all' ? HERO_KINDS : UNDEAD_KINDS);
  };
  Object.assign(g, {
    enter() { Assets3D.preload(this.s.zombieSet === 'all' ? HERO_KINDS.slice(0, 6) : UNDEAD_KINDS); },
    leave() { if (this.r?.zc) { for (const c of this.r.zc.values()) c.dispose(); this.r.zc.clear(); } },
    onSettings() { this.leave(); },
    reset() { base.reset.call(this); if (this.r?.zc) { for (const c of this.r.zc.values()) c.dispose(); this.r.zc.clear(); } },
    damage(zb, d) {
      const alive = zb.alive;
      base.damage.call(this, zb, d);
      const c = this.r?.zc?.get(zb);
      if (!c || !alive) return;
      c.hitFlash(0xffffff, 0.8); c.setHp(Math.max(0, zb.hp) / zb.max);
      if (!zb.alive) c.play('death', { hold: true });
    },
    draw() {
      const r = this.scene3d();
      if (r) {
        r.zc = r.zc || new Map();
        const live = new Set(this.z);
        for (const [zb, c] of r.zc) if (!live.has(zb)) { c.dispose(); r.zc.delete(zb); }
        for (const zb of this.z) {
          let c = r.zc.get(zb);
          if (!c) { c = new Character3D({ kind: kindOf(this, zb), user: zb.user, plate: !zb.user.bot, hp: true, height: 2, base: 'walk' }); r.scene.add(c.root); r.zc.set(zb, c); }
          c.root.position.set(zb.x, (68 - zb.d) * 0.28 + 0.1, -zb.d);
          c.root.scale.setScalar(zb.big);
          c.timeScale = zb.alive ? (this.buff.freeze ? 0 : 0.8) : 1;
          c.update(1 / 60);
        }
      }
      // O desenho original monta a cena e o HUD; com a lista de zumbis vazia ele não cria os bonecos de blocos antigos.
      const z = this.z;
      this.z = [];
      try { base.draw.call(this); } finally { this.z = z; }
    },
  });
})();
