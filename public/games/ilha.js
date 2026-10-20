'use strict';

// Sobreviva à Ilha: battle royale. A água sobe, a ilha encolhe e o último de pé leva a coroa.
const ISLE = { x: W / 2, y: 690, r: 310 };

registerGame({
  id: 'ilha',
  name: 'Ilha',
  icon: '🏝️',
  help: '<p>Comente <b>entrar</b> para pular na ilha (até 100). Com 2 jogadores a contagem começa. A ilha encolhe: quem cair na água sai.</p><p>🌹 Entra na ilha (ou corre pro centro) · 🍩 Escudo contra uma queda · 🕶️ Água congelada por 10s · 🌌 TSUNAMI: varre a borda e você ganha uma arca.</p>',
  wins: new Map(),
  reset() {
    this.players = [];
    this.phase = 'lobby';
    this.timer = 0;
    this.r = ISLE.r;
    this.freeze = 0;
    this.eventT = 9;
    this.wave = 0;
    this.winner = null;
    this.log = [];
    this.out = 0;
  },
  sample() { return this.phase === 'battle' ? pick(['vai', 'corre', 'kkk']) : 'entrar'; },
  player(id) { return this.players.find((p) => p.id === id); },
  alive() { return this.players.filter((p) => !p.dead); },
  addLog(msg, color = '#fff') { this.log.unshift({ msg, color, t: 6 }); this.log.length = Math.min(this.log.length, 3); },
  join(user) {
    const id = user.id || user.nick;
    if (this.player(id) || this.players.length >= 100 || this.phase === 'end') return null;
    if (this.phase === 'battle') return null;
    const a = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * this.r * 0.8;
    const p = { id, user, x: ISLE.x + Math.cos(a) * d, y: ISLE.y + Math.sin(a) * d * 0.6, tx: 0, ty: 0, shield: 0, platform: 0, dead: false, place: 0, t: rand(0, 3) };
    this.players.push(p);
    sfx.pop();
    if (this.players.length >= 2 && this.phase === 'lobby') { this.phase = 'countdown'; this.timer = 25; }
    return p;
  },
  onEvent(ev) {
    const id = uid(ev);
    if (ev.type === 'chat') {
      if (/\b(entrar|entra|eu|!entrar|bora)\b/i.test(ev.text)) this.join(ev.user);
    } else if (ev.type === 'gift') {
      const tier = giftTier(ev);
      let p = this.player(id);
      if (!p) { p = this.join(ev.user); if (p) this.addLog(`🌹 @${trim(ev.user.nick, 12)} pulou na ilha`, '#ffd23f'); }
      if (!p || p.dead || this.phase !== 'battle') return;
      if (tier === 1 && this.phase === 'battle') { p.tx = ISLE.x + rand(-20, 20); p.ty = ISLE.y + rand(-15, 15); p.dash = 1.5; }
      if (tier === 2) { p.shield++; this.addLog(`🛡️ @${trim(ev.user.nick, 12)} ganhou escudo`, '#25f4ee'); }
      if (tier === 3) { this.freeze = Math.min(30, this.freeze + 10); this.addLog(`🧊 @${trim(ev.user.nick, 12)} CONGELOU a água`, '#25f4ee'); announcer.show('🧊 ÁGUA CONGELADA', '#25f4ee', 2, 52); }
      if (tier === 4) {
        p.platform = 30;
        this.wave = 1.2;
        announcer.show(`🌊 TSUNAMI de @${trim(ev.user.nick, 10)}`, '#4d9bff', 2.5, 50);
        sfx.boom();
        for (const o of this.alive()) {
          if (o === p) continue;
          const d = Math.hypot(o.x - ISLE.x, (o.y - ISLE.y) / 0.6);
          if (d > this.r * 0.6) this.drown(o, `🌊 o tsunami de @${trim(ev.user.nick, 10)} levou`);
        }
      }
    }
  },
  drown(p, why = '💦 caiu na água') {
    if (p.dead || p.platform > 0) return;
    if (p.shield > 0) {
      p.shield--;
      p.x = ISLE.x + rand(-40, 40); p.y = ISLE.y + rand(-25, 25);
      floatText('🛡️ salvo!', p.x, p.y - 40, '#25f4ee', 28);
      return;
    }
    p.dead = true;
    p.place = this.alive().length + 1;
    p.deadT = 1;
    this.out++;
    burst(p.x, p.y, ['#4d9bff', '#fff'], 16, 200);
    this.addLog(`${why} @${trim(p.user.nick, 12)}`, '#4d9bff');
    sfx.tone(300, 0.15, 'sine', 0.08);
  },
  update(dt) {
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    this.wave = Math.max(0, this.wave - dt);
    if (this.phase === 'countdown') {
      this.timer -= dt;
      if (this.timer <= 0) { this.phase = 'battle'; this.timer = 0; sfx.win(); announcer.show('A ÁGUA ESTÁ SUBINDO!', '#4d9bff', 2, 50); }
    } else if (this.phase === 'end') {
      this.timer -= dt;
      if (this.timer <= 0) this.reset();
      return;
    }
    const t = performance.now() / 1000;
    if (this.phase === 'battle') {
      this.timer += dt;
      this.freeze = Math.max(0, this.freeze - dt);
      // Quatro fases, cada uma encolhendo mais rápido.
      const rate = this.timer < 30 ? 2.5 : this.timer < 60 ? 4 : this.timer < 90 ? 6 : 9;
      if (this.freeze <= 0) this.r = Math.max(30, this.r - rate * dt);
      this.eventT -= dt;
      if (this.eventT <= 0) {
        this.eventT = rand(7, 11);
        const list = this.alive();
        if (list.length > 2) {
          announcer.show('🌊 ONDA!', '#4d9bff', 1.4, 56);
          for (const p of list) if (Math.random() < 0.3) { const a = Math.atan2(p.y - ISLE.y, p.x - ISLE.x); p.x += Math.cos(a) * 70; p.y += Math.sin(a) * 42; }
        }
      }
    }
    for (const p of this.players) {
      if (p.dead) { p.deadT = Math.max(0, p.deadT - dt); continue; }
      p.shieldT = (p.shieldT || 0) + dt;
      p.platform = Math.max(0, p.platform - dt);
      p.dash = Math.max(0, (p.dash || 0) - dt);
      p.t -= dt;
      if (p.t <= 0 && !p.dash) {
        p.t = rand(1, 3);
        const a = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * this.r * 0.85;
        p.tx = ISLE.x + Math.cos(a) * d; p.ty = ISLE.y + Math.sin(a) * d * 0.6;
      }
      if (p.platform <= 0) {
        const sp = p.dash ? 5 : 1.4;
        p.x += (p.tx - p.x) * Math.min(1, dt * sp);
        p.y += (p.ty - p.y) * Math.min(1, dt * sp);
      }
    }
    // Empurrões entre quem está muito perto
    const list = this.alive();
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j], d = dist(a, b);
      if (d > 0 && d < 40) { const k = (40 - d) / 2 / d; a.x -= (b.x - a.x) * k; a.y -= (b.y - a.y) * k; b.x += (b.x - a.x) * k; b.y += (b.y - a.y) * k; }
    }
    if (this.phase === 'battle') {
      for (const p of list) if (Math.hypot(p.x - ISLE.x, (p.y - ISLE.y) / 0.6) > this.r) this.drown(p);
      const left = this.alive();
      if (left.length <= 1) {
        this.phase = 'end';
        this.timer = 12;
        this.winner = left[0] || null;
        if (this.winner) { this.winner.place = 1; addScore(this.wins, this.winner.user.nick); }
        sfx.win();
        for (let k = 0; k < 5; k++) setTimeout(() => burst(rand(100, W - 100), rand(250, 700), ['#ffd23f', '#fff', '#7cff6b'], 70, 550), k * 250);
      }
    }
  },
  draw() {
    const t = performance.now() / 1000;
    background('#0a3d62', '#1e6f9f');
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 3;
    for (let k = 0; k < 14; k++) { ctx.beginPath(); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 280 + k * 70 + Math.sin(x / 50 + t * 2 + k) * 8); ctx.stroke(); }
    // Ilha (anéis de areia e grama)
    const R = this.r;
    ctx.fillStyle = this.freeze > 0 ? '#bde7ff' : 'rgba(255,255,255,.25)';
    ctx.beginPath(); ctx.ellipse(ISLE.x, ISLE.y, R + 16, (R + 16) * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4d58d'; ctx.beginPath(); ctx.ellipse(ISLE.x, ISLE.y, R, R * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7cb342'; ctx.beginPath(); ctx.ellipse(ISLE.x, ISLE.y - 6, R * 0.7, R * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    if (R > 100) text('🌴', ISLE.x + R * 0.3, ISLE.y - R * 0.25, 60);
    if (this.wave > 0) { ctx.globalAlpha = this.wave / 1.2; ctx.fillStyle = '#4d9bff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    const sorted = [...this.players].sort((a, b) => a.y - b.y);
    for (const p of sorted) {
      if (p.dead) { if (p.deadT > 0) { ctx.globalAlpha = p.deadT; avatar(p.user, p.x, p.y + (1 - p.deadT) * 30, 20, '#4d9bff'); ctx.globalAlpha = 1; } continue; }
      if (p.platform > 0) { roundRect(p.x - 36, p.y + 8, 72, 18, 6, '#ff8a3d'); text('🛸', p.x, p.y + 40, 26); }
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 20, 18, 6, 0, 0, Math.PI * 2); ctx.fill();
      const hop = Math.abs(Math.sin(t * 6 + p.x)) * 6;
      avatar(p.user, p.x, p.y - hop, 20, p.shield > 0 ? '#25f4ee' : '#fff');
      if (p.shield > 0) text('🛡️', p.x + 20, p.y - 22 - hop, 18);
      if (this.alive().length <= 12) text(trim(p.user.nick, 8), p.x, p.y - 34 - hop, 14, '#fff', 'center', 700);
    }

    roundRect(20, 20, W - 40, 170, 22, 'rgba(0,0,0,.6)');
    text('🏝️ SOBREVIVA À ILHA', W / 2, 58, 40, '#ffd23f', 'center', 900);
    const aliveN = this.alive().length;
    [['VIVOS', aliveN], ['FORA', this.out], ['ILHA', `${Math.round((this.r / ISLE.r) * 100)}%`], [this.phase === 'battle' ? 'TEMPO' : 'STATUS', this.phase === 'battle' ? fmtTime(this.timer) : this.phase === 'countdown' ? `${Math.ceil(this.timer)}s` : 'ABERTA']].forEach(([l, v], i) => {
      const x = 105 + i * 170;
      text(l, x, 110, 18, '#9aa0b4', 'center', 700);
      text(String(v), x, 150, 34);
    });
    if (this.freeze > 0) text(`🧊 água congelada ${Math.ceil(this.freeze)}s`, W / 2, 220, 26, '#bde7ff', 'center', 800);
    if (this.phase === 'lobby' || this.phase === 'countdown') {
      roundRect(60, 1060, W - 120, 90, 24, 'rgba(0,0,0,.6)');
      text(this.phase === 'lobby' ? 'Comente ENTRAR para jogar!' : `Começa em ${Math.ceil(this.timer)}s · comente ENTRAR`, W / 2, 1105, 32, '#fff', 'center', 900);
    }
    this.log.forEach((l, k) => {
      const y = 1180 + k * 34;
      ctx.globalAlpha = clamp(l.t, 0, 1);
      text(trim(l.msg, 44), 30, y, 20, l.color, 'left', 700);
      ctx.globalAlpha = 1;
    });
    if (this.phase === 'end') {
      ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(0, 0, W, H);
      if (this.winner) {
        text('👑 ÚLTIMO SOBREVIVENTE', W / 2, 260, 48, '#ffd23f');
        avatar(this.winner.user, W / 2, 450, 110, '#ffd23f');
        text('👑', W / 2, 310, 80);
        text(`@${trim(this.winner.user.nick, 16)}`, W / 2, 610, 50);
      } else text('NINGUÉM SOBREVIVEU 🌊', W / 2, 400, 50, '#4d9bff');
      leaderboard(this.wins, 'Vitórias na live', W / 2, 720, 3, 30);
      text(`Nova ilha em ${Math.ceil(this.timer)}s`, W / 2, 1050, 32, '#ddd', 'center', 600);
    }
  },
});
