'use strict';

// Combate: dois lutadores com foto e nome escolhidos por você. O público escolhe o lado e cada presente vira golpe.
const MOVES = {
  jab: { name: 'JAB', dmg: 1, color: '#fff' },
  1: { name: 'SOCO', dmg: 3, color: '#ffd23f' },
  2: { name: 'CHUTE', dmg: 8, color: '#ff8a3d' },
  3: { name: 'ESPECIAL', dmg: 20, color: '#fe2c55' },
  4: { name: 'GOLPE FINAL', dmg: 40, color: '#b36bff' },
  special: { name: 'ESPECIAL DA TORCIDA', dmg: 10, color: '#25f4ee' },
};

registerGame(withConfig({
  id: 'combate',
  name: 'Combate',
  icon: '🥊',
  help: '<p>Comente <b>1</b> ou <b>2</b> (ou o nome) para escolher seu lutador. Depois, cada comentário é um jab (1 a cada 2s).</p><p>🌹 Soco · 🍩 Chute · 🕶️ Especial · 🌌 Golpe final. ❤️ Likes enchem o especial da torcida.</p><p>Fotos e nomes em <b>Configurar</b>.</p>',
  cd: new Cooldown(2000),
  roundsWon: [0, 0],
  reset() {
    this.hp = [this.config.hp, this.config.hp];
    this.meter = [0, 0];
    this.side = new Map();
    this.fans = [0, 0];
    this.queue = [];
    this.anim = [{ lunge: 0, hit: 0 }, { lunge: 0, hit: 0 }];
    this.time = 99;
    this.phase = 'fight';
    this.endT = 0;
    this.winner = -1;
    this.hitters = new Map();
    this.log = [];
    this.slowmo = 0;
    this.cool = 0;
  },
  renderSettings(el, save) {
    renderItemsSettings(el, structuredClone(this.config), {
      min: 2, max: 2, itemLabel: 'Lutador',
      extras: [{ key: 'hp', label: 'Vida de cada lutador', min: 20, max: 100000 }],
    }, (cfg) => { this.applyConfig(cfg); save(this.config); });
  },
  sample() { return Math.random() < 0.3 ? String(randInt(1, 2)) : pick(['bate!', 'vai', 'pow']); },
  addLog(user, msg, color) { this.log.unshift({ user, msg, color, t: 6 }); this.log.length = Math.min(this.log.length, 3); },
  onEvent(ev) {
    if (this.phase !== 'fight') return;
    const id = uid(ev);
    const items = this.config.items;
    if (ev.type === 'chat') {
      const t = ev.text.trim().toLowerCase();
      const m = t.match(/^([12])\b/);
      const pickSide = m ? Number(m[1]) - 1 : items.findIndex((it) => t.includes(it.name.toLowerCase()));
      if (pickSide >= 0 && this.side.get(id) !== pickSide) {
        if (this.side.has(id)) this.fans[this.side.get(id)]--;
        this.side.set(id, pickSide); this.fans[pickSide]++;
        this.addLog(ev.user, `entrou no time ${items[pickSide].name}`, items[pickSide].color);
        return;
      }
      if (this.side.has(id) && this.cd.ok(id)) this.queue.push({ s: this.side.get(id), move: MOVES.jab, user: ev.user });
    } else if (ev.type === 'like') {
      if (!this.side.has(id)) return;
      const s = this.side.get(id);
      this.meter[s] += ev.count;
      if (this.meter[s] >= 100) { this.meter[s] -= 100; this.queue.push({ s, move: MOVES.special, user: ev.user }); }
    } else if (ev.type === 'gift') {
      if (!this.side.has(id)) { this.addLog(ev.user, 'comente 1 ou 2 para escolher o lado!', '#ffd23f'); return; }
      const s = this.side.get(id), tier = giftTier(ev);
      for (let k = 0; k < Math.min(10, ev.count || 1); k++) this.queue.push({ s, move: MOVES[tier], user: ev.user, tier });
    }
  },
  strike({ s, move, user, tier }) {
    const o = 1 - s;
    this.hp[o] = Math.max(0, this.hp[o] - move.dmg);
    this.anim[s].lunge = 0.25;
    this.anim[o].hit = 0.3;
    addScore(this.hitters, user.nick, move.dmg);
    const x = o === 0 ? 200 : 520;
    floatText(`-${move.dmg}`, x, 560, move.color, 30 + move.dmg);
    burst(x, 620, [move.color, '#fff'], 10 + move.dmg * 2, 300 + move.dmg * 8);
    if (move !== MOVES.jab) this.addLog(user, `${move.name} de ${this.config.items[s].name}`, move.color);
    if (tier >= 3 || move === MOVES.special) announcer.show(`${move.name}! @${trim(user.nick, 10)}`, move.color, 1.8, 50);
    if (tier === 4) { this.slowmo = 1.2; sfx.boom(); } else sfx.tone(140 + move.dmg * 6, 0.12, 'square', 0.1);
    if (this.hp[o] <= 0) this.end(s);
  },
  end(w) {
    this.phase = 'ko';
    this.winner = w;
    this.endT = 9;
    this.queue = [];
    if (w >= 0) this.roundsWon[w]++;
    sfx.win();
    announcer.items.length = 0;
  },
  update(dt) {
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    for (const a of this.anim) { a.lunge = Math.max(0, a.lunge - dt); a.hit = Math.max(0, a.hit - dt); }
    if (this.phase === 'ko') { this.endT -= dt; if (this.endT <= 0) this.reset(); return; }
    if (this.slowmo > 0) { this.slowmo -= dt; dt *= 0.3; }
    this.time -= dt;
    if (this.time <= 0) return this.end(this.hp[0] === this.hp[1] ? -1 : this.hp[0] > this.hp[1] ? 0 : 1);
    // Golpes saem um a um; com fila grande saem mais rápido.
    this.cool -= dt;
    if (this.cool <= 0 && this.queue.length) {
      this.strike(this.queue.shift());
      this.cool = this.queue.length > 10 ? 0.08 : this.queue.length > 3 ? 0.18 : 0.32;
    }
  },
  fighter(i) {
    const it = this.config.items[i];
    const a = this.anim[i];
    const dir = i === 0 ? 1 : -1;
    const t = performance.now() / 1000;
    const bx = (i === 0 ? 200 : 520) + dir * a.lunge * 160 - dir * a.hit * 60;
    const by = 700 + Math.sin(t * 5 + i) * 8;
    if (this.phase === 'ko' && this.winner === 1 - i) {
      ctx.save(); ctx.translate(bx, by + 120); ctx.rotate(dir * -1.4);
      roundRect(-60, -160, 120, 200, 30, it.color);
      ctx.restore();
      avatar({ nick: it.name, pic: it.photo }, bx - dir * 120, by + 110, 60, '#fff');
      text('💫', bx - dir * 120, by + 30, 40);
      return;
    }
    roundRect(bx - 60, by - 40, 120, 200, 30, it.color);
    roundRect(bx - 50, by + 160, 40, 90, 14, '#222');
    roundRect(bx + 10, by + 160, 40, 90, 14, '#222');
    text('🥊', bx + dir * (70 + a.lunge * 120), by + 10, 64);
    text('🥊', bx + dir * 40, by + 70, 54);
    avatar({ nick: it.name, pic: it.photo }, bx, by - 100, 72, '#fff');
    if (a.hit > 0) { ctx.globalAlpha = a.hit * 2; ctx.beginPath(); ctx.arc(bx, by - 100, 74, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1; }
  },
  draw() {
    background('#2b1055', '#7597de');
    // Ringue
    ctx.fillStyle = '#d9d2c5'; ctx.beginPath(); ctx.moveTo(0, 960); ctx.lineTo(W, 960); ctx.lineTo(W, 1060); ctx.lineTo(0, 1060); ctx.fill();
    for (let k = 0; k < 3; k++) { ctx.fillStyle = ['#fe2c55', '#fff', '#2f7cf6'][k]; ctx.fillRect(0, 520 + k * 60, W, 8); }
    const items = this.config.items;
    // Barras de vida
    for (let i = 0; i < 2; i++) {
      const x = i === 0 ? 20 : W / 2 + 40, w = W / 2 - 60;
      const pct = this.hp[i] / this.config.hp;
      roundRect(x, 40, w, 40, 10, 'rgba(0,0,0,.6)');
      const fill = Math.max(10, w * pct);
      roundRect(i === 0 ? x + w - fill : x, 40, fill, 40, 10, pct > 0.5 ? '#7cff6b' : pct > 0.2 ? '#ffd23f' : '#fe2c55');
      text(trim(items[i].name, 10), i === 0 ? x : x + w, 105, 28, '#fff', i === 0 ? 'left' : 'right', 900);
      text(`${this.hp[i]}`, i === 0 ? x + w - 10 : x + 10, 60, 22, '#111', i === 0 ? 'right' : 'left', 900);
      text(`${'⭐'.repeat(Math.min(5, this.roundsWon[i]))}`, i === 0 ? x : x + w, 140, 22, '#fff', i === 0 ? 'left' : 'right');
      roundRect(x, 160, w, 14, 7, 'rgba(0,0,0,.5)');
      roundRect(x, 160, w * (this.meter[i] / 100), 14, 7, '#25f4ee');
      text(`👥 ${this.fans[i]}`, i === 0 ? x : x + w, 196, 20, '#fff', i === 0 ? 'left' : 'right', 700);
    }
    roundRect(W / 2 - 46, 30, 92, 70, 14, '#05070c');
    text(String(Math.ceil(Math.max(0, this.time))), W / 2, 66, 44);
    text('VS', W / 2, 300, 90, '#ffd23f', 'center', 900);
    this.fighter(0);
    this.fighter(1);

    this.log.forEach((l, k) => {
      const y = 1100 + k * 46;
      ctx.globalAlpha = clamp(l.t, 0, 1);
      roundRect(20, y - 20, W - 40, 40, 20, 'rgba(0,0,0,.65)');
      avatar(l.user, 42, y, 16, l.color);
      text(trim(`@${trim(l.user.nick, 12)} ${l.msg}`, 42), 66, y, 20, '#fff', 'left', 700);
      ctx.globalAlpha = 1;
    });
    label('Comente 1 ou 2 para escolher o lado', W / 2, 1010, 30, '#2b1055', 'center', 900);

    if (this.phase === 'ko') {
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
      text(this.winner < 0 ? 'EMPATE!' : 'K.O.!', W / 2, 330, 140, '#fe2c55', 'center', 900);
      if (this.winner >= 0) {
        const it = items[this.winner];
        avatar({ nick: it.name, pic: it.photo }, W / 2, 560, 110, '#ffd23f');
        text(`${trim(it.name, 14)} VENCEU`, W / 2, 720, 54, '#ffd23f');
      }
      leaderboard(this.hitters, 'Quem mais bateu', W / 2, 810, 3, 30);
      text(`Próximo round em ${Math.ceil(this.endT)}s`, W / 2, 1150, 30, '#fff', 'center', 600);
    }
  },
}, {
  hp: 300,
  items: [
    { name: 'Azul', color: '#2f7cf6', photo: '' },
    { name: 'Vermelho', color: '#e5383b', photo: '' },
  ],
}));
