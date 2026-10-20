'use strict';

// Corrida Maluca: quem comenta "carro" ou "moto" entra na pista com a foto e o @ em cima do veículo.
// Comentários e likes empurram; presentes viram nitro, óleo, míssil e bomba no líder.
const CAR_MAX = 10;
const CAR_EMOJI = { carro: ['🚗', '🚙', '🚕', '🏎️', '🚓'], moto: ['🏍️', '🛵'] };

registerGame({
  id: 'corrida',
  name: 'Corrida Maluca',
  icon: '🏁',
  help: '<p>Comente <b>carro</b> ou <b>moto</b> para entrar (até 10). Com 2 pilotos a largada começa.</p><p>💬 Comentário e ❤️ like: empurrão. 🌹 Nitro · 🍩 Óleo em quem vem atrás · 🕶️ Míssil em quem está na frente · 🌌 Bomba no líder.</p><p>Quem não está correndo e manda presente ataca o líder.</p>',
  cd: new Cooldown(1000),
  wins: new Map(),
  reset() {
    this.cars = [];
    this.next = []; // inscritos durante a corrida, entram na próxima
    this.phase = 'lobby';
    this.timer = 0;
    this.podium = [];
    this.log = [];
    this.oil = [];
  },
  sample() { return this.phase === 'race' ? pick(['vai!', 'acelera', 'bora']) : pick(['carro', 'moto']); },
  car(id) { return this.cars.find((c) => c.id === id); },
  ranked() { return [...this.cars].sort((a, b) => b.pos - a.pos); },
  addLog(msg, color = '#fff') { this.log.unshift({ msg, color, t: 7 }); this.log.length = Math.min(this.log.length, 4); },
  join(ev, kind) {
    if (this.car(uid(ev)) || this.next.some((n) => n.id === uid(ev))) return;
    const entry = { id: uid(ev), user: ev.user, kind, emoji: pick(CAR_EMOJI[kind]), color: colorFor(ev.user.nick) };
    if (this.phase === 'race' || this.phase === 'finish') { if (this.next.length < CAR_MAX) this.next.push(entry); return; }
    if (this.cars.length >= CAR_MAX) return;
    this.cars.push({ ...entry, pos: 0, boost: 0, stun: 0, spin: 0, shake: 0 });
    sfx.pop();
    if (this.cars.length >= 2 && this.phase === 'lobby') { this.phase = 'countdown'; this.timer = 20; }
  },
  onEvent(ev) {
    const id = uid(ev);
    if (ev.type === 'chat') {
      const t = ev.text.trim().toLowerCase();
      if (/\b(carro|moto|!entrar|entrar)\b/.test(t)) return this.join(ev, /moto/.test(t) ? 'moto' : 'carro');
      const c = this.car(id);
      if (c && this.phase === 'race' && this.cd.ok(id)) c.pos += 0.5;
    } else if (ev.type === 'like') {
      const c = this.car(id);
      if (c && this.phase === 'race') c.pos += Math.min(1.5, 0.15 * ev.count);
    } else if (ev.type === 'gift') {
      if (this.phase !== 'race') {
        if (this.phase !== 'finish') this.join(ev, 'carro');
        const c = this.car(id);
        if (c) { c.boost = 4; this.addLog(`🌹 @${trim(ev.user.nick, 12)} largou com nitro`, '#25f4ee'); }
        return;
      }
      this.gift(ev);
    }
  },
  gift(ev) {
    const me = this.car(uid(ev));
    const tier = giftTier(ev);
    const order = this.ranked();
    const who = `@${trim(ev.user.nick, 12)}`;
    const leader = order[0];
    if (!me) {
      // Fora da pista: ataca o líder.
      this.hit(leader, tier >= 3 ? 8 : 4, 1.5);
      this.addLog(`💥 ${who} atacou o líder @${trim(leader.user.nick, 10)}`, '#ff8a3d');
      return;
    }
    const idx = order.indexOf(me);
    if (tier === 1) {
      me.boost = Math.min(10, me.boost + 3 * (ev.count || 1));
      this.addLog(`🔥 ${who} ligou o NITRO`, '#25f4ee');
    } else if (tier === 2) {
      const behind = order[idx + 1];
      this.oil.push({ pos: me.pos - 1, t: 6 });
      if (behind) { this.hit(behind, 3, 2); this.addLog(`🛢️ ${who} jogou óleo em @${trim(behind.user.nick, 10)}`, '#ffd23f'); }
      else this.addLog(`🛢️ ${who} derramou óleo na pista`, '#ffd23f');
    } else if (tier === 3) {
      const ahead = order[idx - 1] || order[idx + 1];
      if (ahead) { this.hit(ahead, 9, 2.5); this.addLog(`🚀 ${who} lançou um MÍSSIL em @${trim(ahead.user.nick, 10)}`, '#fe2c55'); }
      me.boost = Math.max(me.boost, 3);
    } else {
      const target = leader === me ? order[1] : leader;
      if (target) {
        for (const c of this.cars) if (c !== me && Math.abs(c.pos - target.pos) < 6) this.hit(c, c === target ? 15 : 6, 3);
        this.addLog(`💣 ${who} BOMBARDEOU o líder @${trim(target.user.nick, 10)}`, '#fe2c55');
        announcer.show(`💣 ${trim(ev.user.nick, 14)}`, '#fe2c55', 2.5, 64);
        sfx.boom();
      }
      me.boost = Math.max(me.boost, 5);
    }
  },
  hit(c, back, stun) {
    if (!c) return;
    c.pos = Math.max(0, c.pos - back);
    c.stun = Math.max(c.stun, stun);
    c.spin = 1;
    c.shake = 0.5;
    const p = this.carXY(c);
    burst(p.x, p.y, ['#ff8a3d', '#ffd23f', '#fe2c55'], 30, 350);
  },
  update(dt) {
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    this.oil = this.oil.filter((o) => (o.t -= dt) > 0);
    if (this.phase === 'countdown') {
      this.timer -= dt;
      if (this.timer <= 0) { this.phase = 'race'; this.timer = 0; sfx.win(); announcer.show('GO!', '#7cff6b', 1.2, 120); }
    } else if (this.phase === 'race') {
      this.timer += dt;
      for (const c of this.cars) {
        c.boost = Math.max(0, c.boost - dt);
        c.stun = Math.max(0, c.stun - dt);
        c.spin = Math.max(0, c.spin - dt);
        c.shake = Math.max(0, c.shake - dt);
        const base = 1.1 + Math.sin(this.timer * 0.7 + c.pos) * 0.25;
        const v = c.stun > 0 ? 0.2 : base * (c.boost > 0 ? 3 : 1);
        c.pos = Math.min(100, c.pos + v * dt);
      }
      const done = this.cars.filter((c) => c.pos >= 100);
      if (done.length) {
        this.phase = 'finish';
        this.timer = 12;
        this.podium = this.ranked().slice(0, 3);
        announcer.items.length = 0;
        addScore(this.wins, this.podium[0].user.nick);
        sfx.win();
        burst(W / 2, 500, COLORS, 120, 600);
      }
    } else if (this.phase === 'finish') {
      this.timer -= dt;
      if (this.timer <= 0) {
        const next = this.next;
        this.reset();
        for (const n of next) this.cars.push({ ...n, pos: 0, boost: 0, stun: 0, spin: 0, shake: 0 });
        if (this.cars.length >= 2) { this.phase = 'countdown'; this.timer = 20; }
      }
    }
  },
  laneY(i) { return 300 + i * 66; },
  carXY(c) { return { x: 60 + (W - 170) * (c.pos / 100), y: this.laneY(this.cars.indexOf(c)) + 33 }; },
  draw() {
    background('#14161f', '#0b0c12');
    // Título e status
    roundRect(20, 20, W - 40, 80, 18, '#05070c');
    text('🏁 CORRIDA MALUCA', 40, 60, 38, '#ffd23f', 'left', 900);
    const st = this.phase === 'race' ? `⏱ ${fmtTime(this.timer)}` : this.phase === 'countdown' ? `LARGADA ${Math.ceil(this.timer)}` : this.phase === 'finish' ? 'CHEGADA' : 'SALA ABERTA';
    text(st, W - 40, 60, 30, '#fff', 'right', 800);

    // Placar de posições
    const order = this.ranked();
    roundRect(20, 112, W - 40, 160, 18, 'rgba(255,255,255,.06)');
    order.slice(0, 6).forEach((c, i) => {
      const x = 40 + (i % 3) * 225, y = 150 + Math.floor(i / 3) * 74;
      roundRect(x, y - 26, 210, 56, 14, i === 0 ? '#ffd23f' : 'rgba(0,0,0,.5)');
      text(`${i + 1}º`, x + 22, y + 2, 26, i === 0 ? '#111' : '#fff', 'center', 900);
      avatar(c.user, x + 64, y + 2, 20, c.color);
      text(trim(c.user.nick, 9), x + 92, y + 2, 22, i === 0 ? '#111' : '#fff', 'left', 800);
    });
    if (!order.length) text('Ninguém na pista ainda', W / 2, 192, 30, '#9aa0b4');

    // Pista
    const top = 290, bottom = this.laneY(CAR_MAX) + 10;
    ctx.fillStyle = '#2b2d36'; ctx.fillRect(20, top, W - 40, bottom - top);
    for (let k = 0; k < 14; k++) { ctx.fillStyle = k % 2 ? '#fff' : '#111'; ctx.fillRect(W - 90, top + k * (bottom - top) / 14, 20, (bottom - top) / 14); }
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.setLineDash([24, 18]); ctx.lineWidth = 3;
    for (let i = 1; i < CAR_MAX; i++) { ctx.beginPath(); ctx.moveTo(20, this.laneY(i)); ctx.lineTo(W - 90, this.laneY(i)); ctx.stroke(); }
    ctx.setLineDash([]);
    for (const o of this.oil) { ctx.globalAlpha = clamp(o.t, 0, 1); text('🛢️', 60 + (W - 170) * (o.pos / 100), top + 20, 30); ctx.globalAlpha = 1; }
    for (let i = this.cars.length; i < CAR_MAX; i++) text('— vaga: comente carro ou moto —', W / 2 - 30, this.laneY(i) + 33, 20, 'rgba(255,255,255,.25)', 'center', 600);
    for (const c of this.cars) {
      const p = this.carXY(c);
      const sx = c.shake ? rand(-4, 4) : 0;
      if (c.boost > 0) { ctx.globalAlpha = 0.8; text('🔥', p.x - 44 + rand(-3, 3), p.y + 4, 34); ctx.globalAlpha = 1; }
      ctx.save();
      ctx.translate(p.x + sx, p.y + 6);
      if (c.spin > 0) ctx.rotate(c.spin * Math.PI * 4);
      ctx.scale(-1, 1); // emojis de carro apontam para a esquerda
      text(c.emoji, 0, 0, 50);
      ctx.restore();
      avatar(c.user, p.x + 8, p.y - 20, 15, c.color);
      text(`@${trim(c.user.nick, 9)}`, p.x + 28, p.y - 20, 16, '#fff', 'left', 700);
      if (c.stun > 0) text('💫', p.x, p.y - 44, 24);
    }

    // Avisos
    const by = bottom + 50;
    if (this.phase === 'lobby') {
      text('Comente CARRO ou MOTO para correr!', W / 2, by, 36, '#25f4ee');
      text(`${this.cars.length}/${CAR_MAX} pilotos · mínimo 2`, W / 2, by + 50, 28, '#ddd', 'center', 600);
    } else if (this.phase === 'countdown') {
      text(`Largada em ${Math.ceil(this.timer)}s`, W / 2, by, 48, '#ffd23f');
      text('Ainda dá tempo: comente CARRO ou MOTO', W / 2, by + 50, 26, '#ddd', 'center', 600);
    }
    this.log.forEach((l, k) => {
      const y = (this.phase === 'race' ? by - 10 : by + 110) + k * 44;
      ctx.globalAlpha = clamp(l.t, 0, 1);
      roundRect(30, y - 20, W - 60, 40, 20, 'rgba(0,0,0,.6)');
      text(trim(l.msg, 44), 50, y, 21, l.color, 'left', 700);
      ctx.globalAlpha = 1;
    });
    if (this.next.length) text(`${this.next.length} na fila para a próxima corrida`, W / 2, H - 40, 24, '#9aa0b4', 'center', 600);

    if (this.phase === 'finish') this.drawPodium();
  },
  drawPodium() {
    ctx.fillStyle = 'rgba(0,0,0,.8)';
    ctx.fillRect(0, 0, W, H);
    text('🏆 PÓDIO', W / 2, 220, 80, '#ffd23f');
    const spots = [{ i: 1, x: 170, h: 200 }, { i: 0, x: 360, h: 280 }, { i: 2, x: 550, h: 150 }];
    for (const s of spots) {
      const c = this.podium[s.i];
      roundRect(s.x - 85, 820 - s.h, 170, s.h, 14, ['#ffd23f', '#c0c0c0', '#cd7f32'][s.i]);
      text(`${s.i + 1}º`, s.x, 820 - s.h + 50, 54, '#111');
      if (!c) continue;
      avatar(c.user, s.x, 820 - s.h - 80, s.i === 0 ? 70 : 56, c.color);
      text(`@${trim(c.user.nick, 10)}`, s.x, 820 - s.h - 10, 26);
    }
    leaderboard(this.wins, 'Vitórias na live', W / 2, 920, 3, 28);
    text(`Próxima sala em ${Math.ceil(this.timer)}s`, W / 2, 1180, 32, '#ddd', 'center', 600);
  },
});
