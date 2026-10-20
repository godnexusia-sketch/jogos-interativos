'use strict';

// Corrida de Torcidas: 2 a 4 corredores com foto e nome escolhidos por você.
// O público escolhe por quem torce comentando o nome ou o número; presentes viram efeitos na pista.
const TORCIDA_COLORS = ['#2f7cf6', '#e5383b', '#1f9d55', '#f59f00'];

registerGame(withConfig({
  id: 'torcida',
  name: 'Corrida de Torcidas',
  icon: '🏃',
  help: '<p>Comente o <b>nome</b> ou o <b>número</b> (1, 2…) do corredor para torcer por ele. Cada comentário depois disso empurra um pouco.</p><p>🌹 Impulso · 🍩 Casca de banana no rival da frente · 🕶️ Superarrancada · 🌌 Tropeço em todos os rivais + escudo.</p><p>❤️ Likes enchem a <b>meta coletiva</b>: quando completa, quem está em último ganha uma arrancada.</p>',
  cd: new Cooldown(1500),
  wins: new Map(),
  reset() {
    const n = this.config.items.length;
    this.runners = this.config.items.map((it, i) => ({ ...it, i, pos: 0, boost: 0, mult: 1, slip: 0, shield: 0, fans: 0 }));
    this.fan = new Map();
    this.top = new Map();
    this.phase = 'countdown';
    this.timer = 5;
    this.log = [];
    this.goal = { n: 0, need: 100, t: 30 };
    this.winner = null;
    this.speedFx = new Array(n).fill(0);
  },
  renderSettings(el, save) {
    renderItemsSettings(el, structuredClone(this.config), {
      min: 2, max: 4, itemLabel: 'Corredor',
      extras: [{ key: 'length', label: 'Tamanho da pista (100 = uns 2 min)', min: 30, max: 1000 }],
      newItem: (n) => ({ name: `Corredor ${n + 1}`, color: TORCIDA_COLORS[n], photo: '' }),
    }, (cfg) => { this.applyConfig(cfg); save(this.config); });
  },
  sample() { return Math.random() < 0.4 ? String(randInt(1, this.runners.length)) : pick(['vai!', 'corre', 'bora']); },
  pickRunner(t) {
    t = t.trim().toLowerCase();
    const m = t.match(/^([1-4])\b/);
    if (m && Number(m[1]) <= this.runners.length) return this.runners[Number(m[1]) - 1];
    return this.runners.find((r) => t.includes(r.name.toLowerCase()));
  },
  addLog(user, msg, color) { this.log.unshift({ user, msg, color, t: 7 }); this.log.length = Math.min(this.log.length, 4); },
  leaderOf(except) { return [...this.runners].filter((r) => r !== except).sort((a, b) => b.pos - a.pos)[0]; },
  apply(r, kind, secs, user) {
    if (kind === 'boost') { r.boost = Math.max(r.boost, secs); r.mult = Math.max(r.mult, 2); }
    if (kind === 'super') { r.boost = Math.max(r.boost, secs); r.mult = 3.5; }
    if (kind === 'slip') {
      if (r.shield > 0) { r.shield = 0; this.addLog(user, `bateu no escudo de ${r.name}`, '#25f4ee'); return; }
      r.slip = Math.max(r.slip, secs); r.boost = 0;
      burst(160 + (W - 300) * (r.pos / this.config.length), this.laneY(r.i), ['#ffd23f', '#fff'], 20, 250);
    }
  },
  onEvent(ev) {
    if (this.phase === 'finish') return;
    const id = uid(ev);
    if (ev.type === 'chat') {
      const r = this.pickRunner(ev.text);
      if (r && this.fan.get(id) !== r.i) {
        if (this.fan.has(id)) this.runners[this.fan.get(id)].fans--;
        this.fan.set(id, r.i); r.fans++;
        this.addLog(ev.user, `torce por ${r.name}`, r.color);
        return;
      }
      const mine = this.fan.has(id) ? this.runners[this.fan.get(id)] : null;
      if (mine && this.phase === 'race' && this.cd.ok(id)) { mine.pos += 0.35; addScore(this.top, ev.user.nick, 1); }
    } else if (ev.type === 'like') {
      this.goal.n += ev.count;
      const mine = this.fan.has(id) ? this.runners[this.fan.get(id)] : null;
      if (mine && this.phase === 'race') mine.pos += Math.min(1, 0.04 * ev.count);
    } else if (ev.type === 'social') {
      const mine = this.fan.has(id) ? this.runners[this.fan.get(id)] : null;
      if (mine) { mine.pos += 2; this.addLog(ev.user, `seguiu/compartilhou: +2 para ${mine.name}`, mine.color); }
    } else if (ev.type === 'gift') {
      if (!this.fan.has(id)) { this.addLog(ev.user, 'comente o nome do corredor antes!', '#ffd23f'); return; }
      const r = this.runners[this.fan.get(id)];
      const tier = giftTier(ev);
      addScore(this.top, ev.user.nick, coins(ev) * 5);
      if (tier === 1) { this.apply(r, 'boost', 3 + ev.count, ev.user); this.addLog(ev.user, `deu IMPULSO em ${r.name}`, r.color); }
      else if (tier === 2) {
        const rival = this.leaderOf(r);
        this.apply(rival, 'slip', 2.5, ev.user);
        this.addLog(ev.user, `jogou 🍌 em ${rival.name}`, '#ffd23f');
      } else if (tier === 3) { this.apply(r, 'super', 5, ev.user); this.addLog(ev.user, `SUPERARRANCADA em ${r.name}`, r.color); announcer.show(`⚡ ${trim(ev.user.nick, 12)}`, r.color, 2, 56); }
      else {
        for (const o of this.runners) if (o !== r) this.apply(o, 'slip', 3, ev.user);
        r.shield = 15;
        this.apply(r, 'super', 4, ev.user);
        this.addLog(ev.user, `derrubou todo mundo! 🛡️ ${r.name}`, r.color);
        announcer.show(`🌪️ ${trim(ev.user.nick, 12)}`, r.color, 2.5, 64);
        sfx.boom();
      }
    }
  },
  update(dt) {
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    if (this.phase === 'countdown') {
      this.timer -= dt;
      if (this.timer <= 0) { this.phase = 'race'; this.timer = 0; announcer.show('LARGADA!', '#7cff6b', 1.2, 90); sfx.win(); }
      return;
    }
    if (this.phase === 'finish') {
      this.timer -= dt;
      if (this.timer <= 0) { const fans = this.fan; this.reset(); this.fan = fans; for (const [, i] of fans) if (this.runners[i]) this.runners[i].fans++; }
      return;
    }
    this.timer += dt;
    // Meta coletiva de likes
    this.goal.t -= dt;
    if (this.goal.n >= this.goal.need) {
      const last = [...this.runners].sort((a, b) => a.pos - b.pos)[0];
      this.apply(last, 'super', 5);
      announcer.show(`META BATIDA! ⚡ ${last.name}`, '#7cff6b', 2.5, 50);
      sfx.win();
      this.goal = { n: 0, need: Math.round(this.goal.need * 1.3), t: 30 };
    } else if (this.goal.t <= 0) this.goal = { n: 0, need: this.goal.need, t: 30 };

    const L = this.config.length;
    for (const r of this.runners) {
      r.boost = Math.max(0, r.boost - dt);
      if (r.boost <= 0) r.mult = 1;
      r.slip = Math.max(0, r.slip - dt);
      r.shield = Math.max(0, r.shield - dt);
      const v = r.slip > 0 ? 0.1 : 0.8 * r.mult;
      r.pos = Math.min(L, r.pos + v * dt);
    }
    const w = this.runners.find((r) => r.pos >= L);
    if (w) {
      this.winner = w;
      this.phase = 'finish';
      this.timer = 15;
      addScore(this.wins, w.name);
      sfx.win();
      for (let k = 0; k < 5; k++) setTimeout(() => burst(rand(100, W - 100), rand(250, 700), [w.color, '#ffd23f', '#fff'], 70, 550), k * 250);
    }
  },
  laneY(i) {
    const n = this.runners.length;
    const h = 520 / n;
    return 400 + h * i + h / 2;
  },
  draw() {
    background('#c0392b', '#e67e22');
    const L = this.config.length;
    // Placar
    roundRect(20, 20, W - 40, 70 + this.runners.length * 62, 20, 'rgba(0,0,0,.65)');
    text('🏃 CORRIDA DE TORCIDAS', 40, 52, 30, '#ffd23f', 'left', 900);
    text(this.phase === 'race' ? fmtTime(this.timer) : this.phase === 'countdown' ? `LARGADA ${Math.ceil(this.timer)}` : 'CHEGADA', W - 40, 52, 28, '#fff', 'right', 800);
    const order = [...this.runners].sort((a, b) => b.pos - a.pos);
    order.forEach((r, k) => {
      const y = 112 + k * 62;
      text(`${k + 1}º`, 50, y, 26, '#fff', 'center', 900);
      avatar({ nick: r.name, pic: r.photo }, 100, y, 24, r.color);
      text(trim(r.name, 10), 135, y, 24, '#fff', 'left', 800);
      roundRect(300, y - 12, 300, 24, 12, 'rgba(255,255,255,.15)');
      roundRect(300, y - 12, Math.max(24, 300 * (r.pos / L)), 24, 12, r.color);
      text(`${Math.round((r.pos / L) * 100)}%`, 640, y, 22, '#fff', 'center', 800);
    });

    // Pista
    const top = 360, bottom = 960;
    ctx.fillStyle = '#b5482c'; ctx.fillRect(0, top, W, bottom - top);
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4;
    for (let i = 0; i <= this.runners.length; i++) {
      const y = i === this.runners.length ? 920 : this.laneY(i) - 520 / this.runners.length / 2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (let k = 0; k < 12; k++) { ctx.fillStyle = k % 2 ? '#fff' : '#111'; ctx.fillRect(W - 80, 400 + k * 43.3, 24, 43.3); }
    const t = performance.now() / 1000;
    for (const r of this.runners) {
      const x = 90 + (W - 230) * (r.pos / L), y = this.laneY(r.i);
      const bob = r.slip > 0 ? 0 : Math.abs(Math.sin(t * (8 + r.mult * 4) + r.i)) * 14;
      if (r.boost > 0) { ctx.globalAlpha = 0.6; for (let k = 1; k < 4; k++) avatar({ nick: r.name, pic: r.photo }, x - k * 26, y - 30, 30, r.color); ctx.globalAlpha = 1; }
      if (r.shield > 0) { ctx.beginPath(); ctx.arc(x, y - 10, 70, 0, Math.PI * 2); ctx.fillStyle = 'rgba(37,244,238,.25)'; ctx.fill(); ctx.strokeStyle = '#25f4ee'; ctx.stroke(); }
      ctx.save(); ctx.translate(x, y + 20 - bob);
      if (r.slip > 0) ctx.rotate(Math.PI / 2);
      roundRect(-22, -10, 44, 54, 12, r.color);
      ctx.restore();
      avatar({ nick: r.name, pic: r.photo }, x, y - 36 - bob, 34, '#fff');
      if (r.slip > 0) text('🍌💫', x, y - 90, 30);
      roundRect(x - 60, y - 112 - bob, 120, 30, 15, r.color);
      text(trim(r.name, 9), x, y - 97 - bob, 18, '#fff', 'center', 800);
    }

    // Meta coletiva
    roundRect(20, 975, W - 40, 70, 18, 'rgba(0,0,0,.6)');
    text(`❤️ META: ${this.goal.n}/${this.goal.need} likes`, 40, 1010, 24, '#fff', 'left', 800);
    text(`⏱ ${Math.ceil(this.goal.t)}s · ajuda o último`, W - 40, 1010, 20, '#ffd23f', 'right', 700);
    roundRect(330, 1030, 340, 8, 4, 'rgba(255,255,255,.2)');
    roundRect(330, 1030, 340 * clamp(this.goal.n / this.goal.need, 0, 1), 8, 4, '#fe2c55');

    this.log.forEach((l, k) => {
      const y = 1080 + k * 46;
      ctx.globalAlpha = clamp(l.t, 0, 1);
      roundRect(20, y - 20, W - 40, 40, 20, 'rgba(0,0,0,.6)');
      avatar(l.user, 42, y, 16, l.color);
      text(trim(`@${trim(l.user.nick, 12)} ${l.msg}`, 42), 66, y, 20, '#fff', 'left', 700);
      ctx.globalAlpha = 1;
    });

    if (this.phase === 'finish' && this.winner) {
      const w = this.winner;
      ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(0, 0, W, H);
      text('🏆 VENCEU', W / 2, 250, 72, '#ffd23f');
      avatar({ nick: w.name, pic: w.photo }, W / 2, 450, 140, w.color);
      text(trim(w.name, 16), W / 2, 640, 60);
      text(`${w.fans} torcedores`, W / 2, 710, 34, '#ddd', 'center', 600);
      leaderboard(this.top, 'Quem mais empurrou', W / 2, 800, 3, 30);
      text(`Nova corrida em ${Math.ceil(this.timer)}s`, W / 2, 1100, 32, '#ddd', 'center', 600);
    }
  },
}, {
  length: 100,
  items: [
    { name: 'Azul', color: '#2f7cf6', photo: '' },
    { name: 'Vermelho', color: '#e5383b', photo: '' },
  ],
}));
