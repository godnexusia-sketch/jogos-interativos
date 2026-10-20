'use strict';

// Flappy: você joga (espaço, clique ou toque) e o público sabota com presentes.
// Quem comenta "pula" ajuda a bater as asas.
const SABOTAGE = {
  1: { key: 'wind', name: 'AR TURBULENTO', color: '#25f4ee', secs: 4 },
  2: { key: 'giant', name: 'OBSTÁCULOS GIGANTES', color: '#ff8a3d', secs: 0 },
  3: { key: 'dark', name: 'VISÃO PREJUDICADA', color: '#b36bff', secs: 6 },
  4: { key: 'chaos', name: 'CAOS GALÁCTICO', color: '#ff6bd6', secs: 8 },
};

registerGame({
  id: 'flappy',
  name: 'Flappy',
  icon: '🐤',
  help: '<p><b>Você joga</b>: espaço, clique ou toque na tela. Quem comenta <b>pula</b> também faz o passarinho voar.</p><p>Os presentes sabotam: 🌹 ar turbulento · 🍩 canos gigantes · 🕶️ visão escura · 🌌 caos galáctico.</p>',
  best: 0,
  saboteurs: new Map(),
  helpCd: new Cooldown(250),
  reset() {
    this.y = H / 2; this.vy = 0; this.pipes = []; this.spawn = 1; this.score = 0;
    this.dead = 0; this.started = false; this.lastHelper = '';
    this.effects = { wind: 0, dark: 0, chaos: 0 };
    this.giantNext = 0;
    this.lastSaboteur = null;
    this.meteors = [];
    this.stars = Array.from({ length: 80 }, () => ({ x: rand(0, W), y: rand(0, H), s: rand(1, 3) }));
  },
  sample: () => (Math.random() < 0.8 ? 'pula' : 'kkkk'),
  flap(nick) {
    if (this.dead > 0) return;
    this.started = true;
    this.vy = -540;
    if (nick) this.lastHelper = nick;
    sfx.tone(700, 0.05, 'sine', 0.06);
  },
  onPress() { if (this.dead <= 0) this.flap(); },
  onEvent(ev) {
    if (ev.type === 'chat' && /pula|pulo|jump|sobe/i.test(ev.text) && this.helpCd.ok('all')) this.flap(ev.user.nick);
    else if (ev.type === 'gift') {
      const s = SABOTAGE[giftTier(ev)];
      addScore(this.saboteurs, ev.user.nick, coins(ev));
      this.lastSaboteur = { user: ev.user, s, t: 3 };
      if (s.key === 'giant') this.giantNext = Math.min(6, this.giantNext + 3);
      else this.effects[s.key] = Math.min(s.secs * 3, this.effects[s.key] + s.secs);
      if (s.key === 'chaos') { this.effects.wind = Math.max(this.effects.wind, 4); sfx.boom(); }
      else sfx.tone(220, 0.25, 'sawtooth', 0.08);
    }
  },
  update(dt) {
    if (this.lastSaboteur && (this.lastSaboteur.t -= dt) <= 0) this.lastSaboteur = null;
    for (const k in this.effects) this.effects[k] = Math.max(0, this.effects[k] - dt);
    if (this.dead > 0) { this.dead -= dt; if (this.dead <= 0) this.reset(); return; }
    if (!this.started) { this.y = H / 2 + Math.sin(performance.now() / 300) * 20; return; }
    const slow = this.effects.chaos > 0 ? 0.6 : 1;
    dt *= slow;
    this.vy += 1500 * dt;
    if (this.effects.wind > 0) this.vy += rand(-1, 1) * 2600 * dt;
    this.y += this.vy * dt;
    this.spawn -= dt;
    if (this.spawn <= 0) {
      this.spawn = 2.2;
      const giant = this.giantNext > 0;
      if (giant) this.giantNext--;
      const gap = giant ? 250 : 360;
      this.pipes.push({ x: W + 60, gap: rand(250, H - 300 - gap), h: gap, w: giant ? 200 : 120, passed: false, giant });
    }
    const speed = 250 + Math.min(150, this.score * 6);
    for (const p of this.pipes) p.x -= speed * dt;
    this.pipes = this.pipes.filter((p) => p.x > -260);
    if (this.effects.chaos > 0 && Math.random() < dt * 1.5) this.meteors.push({ x: rand(200, W + 200), y: -40, vx: -260, vy: 420 });
    for (const m of this.meteors) { m.x += m.vx * dt; m.y += m.vy * dt; }
    this.meteors = this.meteors.filter((m) => m.y < H + 50);
    const bx = 200, r = 30;
    for (const p of this.pipes) {
      if (!p.passed && p.x + p.w < bx) { p.passed = true; this.score++; this.best = Math.max(this.best, this.score); sfx.tone(1200, 0.06, 'sine', 0.06); }
      const inX = bx + r > p.x && bx - r < p.x + p.w;
      if (inX && (this.y - r < p.gap || this.y + r > p.gap + p.h)) this.die();
    }
    for (const m of this.meteors) if (Math.hypot(m.x - bx, m.y - this.y) < r + 26) this.die();
    if (this.y < r) { this.y = r; this.vy = 0; }
    if (this.y > H - 90 - r) this.die();
  },
  die() {
    if (this.dead > 0) return;
    this.dead = 3;
    sfx.boom();
    burst(200, this.y, ['#ffd23f', '#ff8a3d', '#fff'], 50, 450);
  },
  draw() {
    const chaos = this.effects.chaos > 0;
    if (chaos) {
      background('#0b0420', '#2a0a3a');
      for (const s of this.stars) { ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.s, s.s); }
      const t = performance.now() / 1000;
      ctx.save(); ctx.translate(W - 140, 260); ctx.rotate(t);
      for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.fillStyle = 'rgba(180,107,255,.35)'; ctx.beginPath(); ctx.ellipse(40, 0, 70, 18, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    } else background('#4fc3f7', '#b3e5fc');
    for (const p of this.pipes) {
      ctx.fillStyle = p.giant ? '#e8590c' : '#2e7d32';
      ctx.fillRect(p.x, 0, p.w, p.gap); ctx.fillRect(p.x, p.gap + p.h, p.w, H);
      ctx.fillStyle = p.giant ? '#ff922b' : '#43a047';
      ctx.fillRect(p.x - 10, p.gap - 40, p.w + 20, 40); ctx.fillRect(p.x - 10, p.gap + p.h, p.w + 20, 40);
      if (p.giant) { text('🍩', p.x + p.w / 2, p.gap - 90, 70); text('🍩', p.x + p.w / 2, p.gap + p.h + 100, 70); }
    }
    for (const m of this.meteors) text('☄️', m.x, m.y, 56);
    ctx.fillStyle = '#8d6e63'; ctx.fillRect(0, H - 90, W, 90);
    ctx.fillStyle = '#7cb342'; ctx.fillRect(0, H - 90, W, 16);
    ctx.save(); ctx.translate(200, this.y); ctx.rotate(clamp(this.vy / 900, -0.5, 0.9));
    if (this.effects.wind > 0) ctx.translate(rand(-3, 3), rand(-3, 3));
    text('🐤', 0, 0, 68); ctx.restore();

    if (this.effects.dark > 0) {
      // Só se enxerga dentro de dois "óculos" em volta do passarinho.
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.94)';
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.moveTo(290, this.y);
      ctx.arc(170, this.y, 120, 0, Math.PI * 2);
      ctx.moveTo(540, this.y);
      ctx.arc(420, this.y, 120, 0, Math.PI * 2);
      ctx.fill('evenodd');
      ctx.restore();
      text('🕶️', 295, this.y - 150, 80);
    }
    if (this.effects.wind > 0 && !chaos) for (let k = 0; k < 5; k++) text('🌹', (performance.now() / 3 + k * 170) % (W + 100) - 50, 300 + k * 160, 34);

    text(String(this.score), W / 2, 150, 110);
    text(`Recorde: ${this.best}`, W / 2, 240, 32, '#fff', 'center', 700);
    const active = Object.entries(this.effects).filter(([, v]) => v > 0).map(([k, v]) => `${Object.values(SABOTAGE).find((s) => s.key === k).name} ${v.toFixed(0)}s`);
    if (this.giantNext) active.push(`CANOS GIGANTES ×${this.giantNext}`);
    active.forEach((a, i) => text(a, W / 2, 300 + i * 40, 26, '#fe2c55', 'center', 800));

    if (this.lastSaboteur && this.dead <= 0) {
      const l = this.lastSaboteur;
      const sz = l.s.key === 'chaos' ? 1.5 : 1;
      ctx.globalAlpha = clamp(l.t, 0, 1);
      roundRect(40, 440, W - 80, 160 * sz, 26, 'rgba(0,0,0,.75)');
      avatar(l.user, 120, 440 + 80 * sz, 50 * sz, l.s.color);
      text(`@${trim(l.user.nick, 12)}`, 200 + (sz - 1) * 60, 490 + (sz - 1) * 30, 40 * sz, l.s.color, 'left', 900);
      text(`SABOTOU: ${l.s.name}`, 200 + (sz - 1) * 60, 545 + (sz - 1) * 50, 26 * sz, '#fff', 'left', 800);
      ctx.globalAlpha = 1;
    }
    if (!this.started && this.dead <= 0) {
      text('Aperte ESPAÇO ou toque para começar', W / 2, H / 2 + 120, 34);
      text('Chat: comente "pula" para ajudar', W / 2, H / 2 + 170, 28, '#fff', 'center', 600);
      text('Presentes ATRAPALHAM 😈', W / 2, H / 2 + 220, 30, '#fe2c55');
    }
    if (this.lastHelper && this.started) text(`último pulo do chat: @${trim(this.lastHelper, 14)}`, W / 2, H - 130, 24, '#fff', 'center', 700);
    if (this.dead > 0) {
      roundRect(70, H / 2 - 170, W - 140, 340, 30, 'rgba(0,0,0,.8)');
      text('💥 BATEU!', W / 2, H / 2 - 90, 70, '#fe2c55');
      text(`Pontos: ${this.score}`, W / 2, H / 2 - 10, 46);
      leaderboard(this.saboteurs, 'Maiores sabotadores', W / 2, H / 2 + 50, 2, 26);
    }
  },
});
