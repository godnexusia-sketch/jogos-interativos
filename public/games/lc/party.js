'use strict';

// Festa e corrida: Pista de Dança (2D) e Corrida de Fórmula (cada espectador pilota o seu carro).

// ---------------- Pista de Dança (Dance Floor) ----------------
const SHIRTS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#f8fafc', '#111827'];
defineGame({
  id: 'dance-floor', name: 'Pista de Dança', genre: 'party', icon: '🪩', color: '#d946ef',
  desc: 'Uma festa sem fim. Quem comenta entra na pista como dançarino com a sua foto. Presentes compram atenção: girar, trocar a roupa, crescer, ir para a frente ou ganhar o holofote.',
  help: '<p>Comente para entrar na <b>pista</b>. Os comentários aparecem em balões em cima de você.</p><p>🎁 Presentes: <b>girar</b>, <b>trocar a roupa</b>, <b>crescer</b>, ir para a <b>primeira fila</b>, <b>holofote</b> (a pista apaga e só você brilha) e <b>globo de luz</b>. O ranking conta as moedas.</p>',
  settings: [
    { key: 'maxDancers', type: 'number', label: 'Máximo de dançarinos', min: 6, max: 60, default: 30 },
    { key: 'spotlightSeconds', type: 'number', label: 'Segundos do holofote', min: 3, max: 30, default: 8 },
    { key: 'discoBallSeconds', type: 'number', label: 'Segundos do globo de luz', min: 3, max: 60, default: 12 },
    { key: 'showComments', type: 'toggle', label: 'Mostrar comentários em balões', default: true },
    { key: 'bpm', type: 'number', label: 'Batidas por minuto', min: 60, max: 180, default: 118 },
    { key: 'autoSpawn', type: 'toggle', label: 'Dançarinos bots quando a pista está vazia', default: true },
    { key: 'floorColor', type: 'color', label: 'Cor da pista', default: '#d946ef', group: 'Visual' },
    ...BOARD_SETTINGS(5),
  ],
  actions: [{ id: 'join', label: 'Entrar na pista', icon: '🕺' }, { id: 'hype', label: 'Animar', icon: '🔥' }, { id: 'spin', label: 'Girar', icon: '🌀' }, { id: 'change_face', label: 'Trocar roupa', icon: '👕' }, { id: 'grow', label: 'Crescer', icon: '⬆️' }, { id: 'change_place', label: 'Primeira fila', icon: '⭐' }, { id: 'spotlight', label: 'Holofote', icon: '🔦' }, { id: 'disco_ball', label: 'Globo de luz', icon: '🪩' }],
  bindings: [{ action: 'join', trigger: 'join' }, { action: 'join', trigger: 'comment' }, { action: 'hype', trigger: 'like', likes: 10 }, { action: 'spin', trigger: 'gift', minCoins: 1 }, { action: 'change_face', trigger: 'gift', minCoins: 5 }, { action: 'grow', trigger: 'gift', minCoins: 10 }, { action: 'change_place', trigger: 'gift', minCoins: 30 }, { action: 'spotlight', trigger: 'gift', minCoins: 99 }, { action: 'disco_ball', trigger: 'gift', minCoins: 299 }],
  reset() { this.d = []; this.coins = new Map(); this.spot = null; this.disco = 0; this.botT = 0; },
  sample() { return pick(['bora dançar', 'uhuu', 'solta o som', '🕺', 'que festa']); },
  dancer(user) {
    const k = user.id || user.nick;
    let d = this.d.find((x) => x.k === k);
    if (d) return d;
    if (this.d.length >= this.s.maxDancers) { const bot = this.d.find((x) => x.user.bot) || this.d[this.d.length - 1]; if (user.bot) return null; this.d.splice(this.d.indexOf(bot), 1); }
    d = { k, user, shirt: SHIRTS[hashStr(k) % SHIRTS.length], scale: 1, spin: 0, style: hashStr(k) % 4, ph: rand(0, 6), bubble: null, hype: 0 };
    this.d.push(d);
    return d;
  },
  onChat(ev) { if (!this.s.showComments) return; const d = this.d.find((x) => x.k === uid(ev)); if (d) d.bubble = { t: trim(ev.text, 26), life: 4 }; },
  onAction(id, a) {
    const d = this.dancer(a.user);
    if (!d) return;
    if (a.gift) { const k = d.k; this.coins.set(k, { user: a.user, value: (this.coins.get(k)?.value || 0) + a.coins }); }
    if (id === 'hype') d.hype = 1;
    else if (id === 'spin') d.spin = 2;
    else if (id === 'change_face') d.shirt = pick(SHIRTS.filter((c) => c !== d.shirt));
    else if (id === 'grow') d.scale = Math.min(2.2, d.scale + 0.15 * a.power / 4);
    else if (id === 'change_place') { this.d.splice(this.d.indexOf(d), 1); this.d.unshift(d); }
    else if (id === 'spotlight') { this.spot = { d, t: this.s.spotlightSeconds }; voice.say(`Holofote para ${a.user.nick}!`); }
    else if (id === 'disco_ball') { this.disco = this.s.discoBallSeconds; sfx.win(); }
  },
  update(dt) {
    if (this.s.autoSpawn && this.d.length < 6) { this.botT -= dt; if (this.botT <= 0) { this.botT = 2; this.dancer(botUser('f')); } }
    for (const d of this.d) { d.spin = Math.max(0, d.spin - dt); d.hype = Math.max(0, d.hype - dt); if (d.bubble && (d.bubble.life -= dt) <= 0) d.bubble = null; }
    if (this.spot && (this.spot.t -= dt) <= 0) this.spot = null;
    this.disco = Math.max(0, this.disco - dt);
  },
  draw() {
    const t = performance.now() / 1000, beat = t * this.s.bpm / 60, pulse = Math.pow(1 - (beat % 1), 3);
    if (!customBackground(this)) {
      ctx.fillStyle = '#07030f'; ctx.fillRect(0, 0, W, H);
      // Pista em perspectiva com quadrados que acendem na batida
      const fc = this.s.floorColor;
      for (let r = 0; r < 12; r++) {
        const y0 = 520 + r * r * 4.6 + r * 18, y1 = 520 + (r + 1) * (r + 1) * 4.6 + (r + 1) * 18;
        const w0 = 300 + r * 40, w1 = 300 + (r + 1) * 40;
        for (let c = 0; c < 8; c++) {
          const on = (hashStr(`${c},${r},${Math.floor(beat)}`) % 3 === 0);
          ctx.fillStyle = on ? hexA(fc, 0.35 + pulse * 0.5) : hexA(fc, 0.08);
          ctx.beginPath(); ctx.moveTo(W / 2 - w0 + c * w0 / 4, y0); ctx.lineTo(W / 2 - w0 + (c + 1) * w0 / 4, y0); ctx.lineTo(W / 2 - w1 + (c + 1) * w1 / 4, y1); ctx.lineTo(W / 2 - w1 + c * w1 / 4, y1); ctx.fill();
        }
      }
      for (let i = 0; i < 6; i++) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(60 + i * 120, -20); ctx.rotate(Math.sin(t + i) * 0.6); const g = ctx.createLinearGradient(0, 0, 0, 900); g.addColorStop(0, hexA(COLORS[i], 0.25)); g.addColorStop(1, hexA(COLORS[i], 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.lineTo(110, 900); ctx.lineTo(-110, 900); ctx.fill(); ctx.restore(); }
    }
    if (this.disco > 0) {
      ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.arc(W / 2, 170, 50, 0, 7); ctx.fill();
      for (let i = 0; i < 40; i++) { const a = i * 2.4 + t * 2; ctx.fillStyle = hexA(COLORS[i % 8], 0.7); ctx.fillRect(W / 2 + Math.cos(a) * rand(80, 600), 200 + Math.abs(Math.sin(a)) * 900, 8, 8); }
    }
    // Dançarinos em fileiras (os primeiros na frente)
    const rows = [6, 7, 8, 9, 10], placed = [];
    let idx = 0;
    for (let r = 0; r < rows.length && idx < this.d.length; r++) {
      const n = Math.min(rows[r], this.d.length - idx);
      for (let c = 0; c < n; c++, idx++) placed.push({ d: this.d[idx], r, c, n });
    }
    placed.sort((a, b) => b.r - a.r);
    const dim = this.spot ? 0.25 : 1;
    for (const p of placed) {
      const sc = (1.15 - p.r * 0.16) * p.d.scale, y = 1080 - p.r * 120, x = W / 2 + (p.c - (p.n - 1) / 2) * (110 - p.r * 10) + (p.r % 2 ? 30 : 0);
      ctx.save(); ctx.globalAlpha = this.spot && this.spot.d !== p.d ? dim : 1;
      drawDancer(x, y, sc, p.d, t, beat);
      ctx.restore();
      if (p.d.bubble) { pill(p.d.bubble.t, x, y - 170 * sc, { size: 14, bg: 'rgba(255,255,255,.92)', color: '#111' }); }
    }
    if (this.spot) { const g = ctx.createRadialGradient(W / 2, 600, 40, W / 2, 600, 500); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.6)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); drawDancer(W / 2, 760, 2, this.spot.d, t, beat); pill(`🔦 @${trim(this.spot.d.user.nick, 14)}`, W / 2, 440, { size: 24, bg: '#d946ef' }); }
    title('PISTA DE DANÇA', W / 2, 56, 46, '#f0abfc');
    pill(`${this.d.length} na pista · comente para entrar`, W / 2, 100, { size: 16, bg: 'rgba(0,0,0,.6)' });
    if (this.s.showLeaderboard) hudBoard([...this.coins.values()].sort((a, b) => b.value - a.value), W - 250, 130, 230, { title: 'TOP DA FESTA', n: this.s.leaderboardSize, unit: ' 🪙', rowH: 30, bg: 'rgba(8,10,20,.6)' });
  },
});
// Dançarino 2D: corpo colorido, braços e pernas no ritmo, foto na cabeça.
function drawDancer(x, y, s, d, t, beat) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (d.spin > 0) ctx.scale(Math.cos(d.spin * 12), 1);
  const ph = beat * Math.PI + d.ph, b = Math.abs(Math.sin(ph)) * 8;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 6, 34, 9, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = shade(d.shirt, -60); ctx.lineWidth = 12; ctx.lineCap = 'round';
  const st = d.style;
  const legA = st === 1 ? Math.sin(ph) * 0.6 : Math.sin(ph) * 0.3;
  ctx.beginPath(); ctx.moveTo(-8, -50 - b); ctx.lineTo(-14 - legA * 20, 0); ctx.moveTo(8, -50 - b); ctx.lineTo(14 + legA * 20, 0); ctx.stroke();
  ctx.fillStyle = d.shirt; ctx.beginPath(); ctx.roundRect(-24, -110 - b, 48, 66, 14); ctx.fill();
  ctx.strokeStyle = d.shirt; ctx.lineWidth = 11;
  const up = st === 2 ? -1 : st === 3 ? Math.sin(ph * 2) : Math.sin(ph);
  ctx.beginPath(); ctx.moveTo(-20, -100 - b); ctx.lineTo(-40, -100 - b - up * 40); ctx.moveTo(20, -100 - b); ctx.lineTo(40, -100 - b + (st === 2 ? -40 : up * 40)); ctx.stroke();
  ctx.restore();
  avatar(d.user, x, y - (138 + Math.abs(Math.sin(beat * Math.PI + d.ph)) * 8) * s, 26 * s, d.hype > 0 ? '#ffc93c' : '#fff');
  if (d.hype > 0) label('🔥', x + 24 * s, y - 170 * s, 22 * s, '#fff', 'center', 400);
}

// ---------------- Corrida de Fórmula (Car Race) ----------------
// Pista: curva fechada (pontos de controle suavizados), a corrida anda pelo parâmetro p (0–1 = uma volta).
const TRACK_PTS = [[360, 300], [600, 320], [650, 520], [520, 640], [600, 820], [560, 1040], [320, 1080], [140, 960], [210, 760], [110, 600], [130, 380]];
function trackPoint(p) {
  const n = TRACK_PTS.length, f = ((p % 1) + 1) % 1 * n, i = Math.floor(f), u = f - i;
  const P = (k) => TRACK_PTS[(i + k + n) % n];
  const [p0, p1, p2, p3] = [P(-1), P(0), P(1), P(2)];
  const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
  return [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])];
}
defineGame({
  id: 'car-race', name: 'Corrida de Fórmula', genre: 'racing', icon: '🏎️', color: '#ef4444',
  desc: 'Cada espectador pilota o próprio carro numa corrida ao vivo. Presentes soltam turbo, mega turbo, raio, fantasma, modo gigante, óleo na pista e chuva. O pódio coroa os campeões.',
  help: '<p>Comente (ou entre na live) durante as <b>inscrições</b> para ganhar um carro com a sua foto. Na corrida, 🎁 presentes dão: <b>turbo</b>, <b>mega turbo</b> (100+), <b>raio</b> que freia os da frente, <b>fantasma</b>, <b>gigante</b>, <b>óleo</b> na pista e <b>chuva</b> para todo mundo menos você.</p>',
  settings: [
    { key: 'numberOfLaps', type: 'number', label: 'Voltas', min: 1, max: 10, default: 3 },
    { key: 'registrationSeconds', type: 'number', label: 'Segundos de inscrição', min: 10, max: 180, default: 30 },
    { key: 'minCarsToStart', type: 'number', label: 'Mínimo de carros (completa com bots)', min: 2, max: 20, default: 6 },
    { key: 'maxCars', type: 'number', label: 'Máximo de carros', min: 4, max: 30, default: 16 },
    { key: 'aiAggression', type: 'select', label: 'Bots', options: [['0.8', 'Lentos'], ['1', 'Normais'], ['1.15', 'Rápidos']], default: '1' },
    { key: 'podiumSeconds', type: 'number', label: 'Segundos do pódio', min: 3, max: 30, default: 10 },
    ...BOARD_SETTINGS(5),
  ],
  actions: [{ id: 'join', label: 'Entrar na corrida', icon: '🏎️' }, { id: 'turbo_boost', label: 'Turbo', icon: '🔥' }, { id: 'mega_boost', label: 'Mega turbo', icon: '🚀' }, { id: 'lightning_boost', label: 'Raio', icon: '⚡' }, { id: 'ghost_boost', label: 'Fantasma', icon: '👻' }, { id: 'giant_mode', label: 'Gigante', icon: '🦖' }, { id: 'oil_slick', label: 'Óleo', icon: '🛢️' }, { id: 'weather_shift', label: 'Chuva', icon: '🌧️' }, { id: 'gift_boost', label: 'Poder pelo valor', icon: '🎁' }],
  bindings: [{ action: 'join', trigger: 'comment' }, { action: 'join', trigger: 'join' }, { action: 'turbo_boost', trigger: 'like', likes: 20 }, { action: 'gift_boost', trigger: 'gift', minCoins: 1 }],
  reset() { this.cars = []; this.oil = []; this.rain = 0; this.rainBy = null; this.ph = new Phases(); this.ph.go('reg', this.s.registrationSeconds); this.feed = new Feed(3); this.podium = []; },
  sample() { return pick(['eu', 'corrida', 'bora']); },
  car(user) {
    const k = user.id || user.nick;
    let c = this.cars.find((x) => x.k === k);
    if (c || this.ph.name !== 'reg' || this.cars.length >= this.s.maxCars) return c;
    const i = this.cars.length;
    c = { k, user, p: -0.012 * (Math.floor(i / 2)), lane: i % 2 ? 14 : -14, v: 0, base: rand(0.95, 1.05), boost: 0, ghost: 0, giant: 0, slow: 0, lap: 0, done: false, color: SHIRTS[i % SHIRTS.length] };
    this.cars.push(c);
    return c;
  },
  onAction(id, a) {
    if (id === 'join') return this.car(a.user);
    const c = this.cars.find((x) => x.k === (a.user.id || a.user.nick)) || this.car(a.user);
    if (!c || this.ph.name !== 'race') return;
    let kind = id;
    if (id === 'gift_boost') kind = a.coins >= 1000 ? 'weather_shift' : a.coins >= 299 ? 'giant_mode' : a.coins >= 100 ? 'mega_boost' : a.coins >= 30 ? 'lightning_boost' : a.coins >= 10 ? 'ghost_boost' : a.coins >= 5 ? 'oil_slick' : 'turbo_boost';
    const name = { turbo_boost: '🔥 turbo', mega_boost: '🚀 mega turbo', lightning_boost: '⚡ raio', ghost_boost: '👻 fantasma', giant_mode: '🦖 gigante', oil_slick: '🛢️ óleo', weather_shift: '🌧️ chuva' }[kind];
    if (kind === 'turbo_boost') c.boost = Math.max(c.boost, 2 + a.power * 0.1);
    else if (kind === 'mega_boost') c.boost = 5;
    else if (kind === 'lightning_boost') { for (const o of this.cars) if (o !== c && o.p + o.lap > c.p + c.lap) o.slow = 2.5; sfx.boom(); }
    else if (kind === 'ghost_boost') { c.ghost = 6; c.boost = Math.max(c.boost, 1.5); }
    else if (kind === 'giant_mode') { c.giant = 10; c.boost = Math.max(c.boost, 2); }
    else if (kind === 'oil_slick') this.oil.push({ p: (c.p - 0.02 + 1) % 1, t: 15 });
    else if (kind === 'weather_shift') { this.rain = 10; this.rainBy = c; }
    this.feed.push(a.user, name, '#ffc93c');
  },
  update(dt) {
    this.feed.update(dt);
    if (this.ph.name === 'race') {
      for (const o of this.oil) o.t -= dt;
      this.oil = this.oil.filter((o) => o.t > 0);
      this.rain = Math.max(0, this.rain - dt);
      const aggr = Number(this.s.aiAggression);
      for (const c of this.cars) {
        if (c.done) continue;
        for (const k of ['boost', 'ghost', 'giant', 'slow']) c[k] = Math.max(0, c[k] - dt);
        let v = 0.055 * c.base * (c.user.bot ? aggr : 1) * (1 + (c.boost > 0 ? 0.8 : 0) + (c.giant > 0 ? 0.15 : 0)) * (c.slow > 0 ? 0.35 : 1) * (this.rain > 0 && this.rainBy !== c ? 0.7 : 1);
        v *= 1 + Math.sin(performance.now() / 900 + c.base * 20) * 0.08;
        for (const o of this.oil) if (!c.ghost && Math.abs(((c.p - o.p) % 1 + 1) % 1) < 0.006) { c.slow = Math.max(c.slow, 1.2); c.spin = 1; }
        c.spin = Math.max(0, (c.spin || 0) - dt);
        c.v = v; c.p += v * dt;
        if (c.p >= 1) { c.p -= 1; c.lap++; if (c.lap >= this.s.numberOfLaps) { c.done = true; this.podium.push(c); if (this.podium.length === 1) { sfx.win(); voice.say(`${c.user.nick} venceu a corrida!`); if (!c.user.bot) scores.add(this.id, c.user, 10, 1); } else if (!c.user.bot) scores.add(this.id, c.user, Math.max(1, 6 - this.podium.length)); } }
      }
      if (this.cars.every((c) => c.done) || (this.podium.length >= 3 && this.ph.t > 15)) this.ph.t = Math.min(this.ph.t, 3);
    }
    if (!this.ph.update(dt)) return;
    if (this.ph.name === 'reg') {
      let i = 0;
      while (this.cars.length < this.s.minCarsToStart && i++ < 30) this.car(botUser('car'));
      this.ph.go('count', 3); sfx.tone(440, 0.3, 'square', 0.1);
    } else if (this.ph.name === 'count') { this.ph.go('race', 300); sfx.tone(880, 0.5, 'square', 0.12); }
    else if (this.ph.name === 'race') { for (const c of [...this.cars].sort((a, b) => (b.lap + b.p) - (a.lap + a.p))) if (!this.podium.includes(c)) this.podium.push(c); confetti(140); this.ph.go('podium', this.s.podiumSeconds); }
    else this.reset();
  },
  order() { return [...this.cars].sort((a, b) => (b.done ? 100 - this.podium.indexOf(b) : b.lap + b.p) - (a.done ? 100 - this.podium.indexOf(a) : a.lap + a.p)); },
  draw() {
    const t = performance.now() / 1000;
    if (!customBackground(this)) {
      ctx.fillStyle = '#2f7d32'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 60; i++) { ctx.fillStyle = 'rgba(0,0,0,.06)'; ctx.fillRect((i * 137) % W, 180 + (i * 89) % (H - 180), 30, 30); }
    }
    // Pista: zebra, asfalto, linha branca
    const draw = (w, col, dash) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.setLineDash(dash || []); ctx.beginPath(); for (let i = 0; i <= 200; i++) { const [x, y] = trackPoint(i / 200); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.stroke(); ctx.setLineDash([]); };
    draw(96, '#e5e7eb', [18, 18]); draw(96, 'rgba(220,38,38,.9)', [18, 18]);
    ctx.lineDashOffset = 18; draw(96, '#f8fafc', [18, 18]); ctx.lineDashOffset = 0;
    draw(84, '#3f3f46'); draw(2, 'rgba(255,255,255,.4)', [16, 20]);
    // Largada
    const [sx, sy] = trackPoint(0), [sx2, sy2] = trackPoint(0.004), ang = Math.atan2(sy2 - sy, sx2 - sx);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang + Math.PI / 2); for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff'; ctx.fillRect(-42 + i * 10.5, -5 + j * 5, 10.5, 5); } ctx.restore();
    for (const o of this.oil) { const [x, y] = trackPoint(o.p); ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.beginPath(); ctx.ellipse(x, y, 22, 14, 0.4, 0, 7); ctx.fill(); }
    // Carros
    for (const c of [...this.cars].sort((a, b) => a.giant - b.giant)) {
      const [x, y] = trackPoint(c.p), [x2, y2] = trackPoint(c.p + 0.002), a = Math.atan2(y2 - y, x2 - x);
      const nx = -Math.sin(a), ny = Math.cos(a), s = c.giant > 0 ? 1.8 : 1;
      ctx.save(); ctx.translate(x + nx * c.lane, y + ny * c.lane); ctx.rotate(a + (c.spin ? c.spin * 6 : 0)); ctx.scale(s, s);
      ctx.globalAlpha = c.ghost > 0 ? 0.45 : 1;
      if (c.boost > 0) { ctx.fillStyle = `rgba(255,${120 + Math.random() * 100},0,.8)`; ctx.beginPath(); ctx.moveTo(-22, -5); ctx.lineTo(-40 - Math.random() * 14, 0); ctx.lineTo(-22, 5); ctx.fill(); }
      ctx.fillStyle = '#111'; ctx.fillRect(-16, -14, 9, 6); ctx.fillRect(-16, 8, 9, 6); ctx.fillRect(9, -13, 8, 5); ctx.fillRect(9, 8, 8, 5);
      ctx.fillStyle = c.color; ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(10, -7); ctx.lineTo(-20, -8); ctx.lineTo(-20, 8); ctx.lineTo(10, 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(c.color, -50); ctx.fillRect(-24, -10, 5, 20); ctx.fillRect(20, -9, 4, 18);
      ctx.restore();
      avatar(c.user, x + nx * c.lane, y + ny * c.lane - 22 * s, 11 * s, c.slow > 0 ? '#22e3ee' : '#fff');
    }
    if (this.rain > 0) { ctx.strokeStyle = 'rgba(180,200,255,.45)'; ctx.lineWidth = 2; for (let i = 0; i < 120; i++) { const x = (i * 53 + t * 400) % W, y = (i * 97 + t * 900) % H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 18); ctx.stroke(); } }
    title('CORRIDA DE FÓRMULA', W / 2, 46, 40);
    if (this.ph.name === 'reg') { pill(`INSCRIÇÕES: comente para correr · ${Math.ceil(this.ph.t)}s · ${this.cars.length} carros`, W / 2, 92, { size: 16, bg: '#ef4444' }); }
    else if (this.ph.name === 'count') bigCount(Math.ceil(this.ph.t), '#ffc93c');
    else if (this.ph.name === 'race') { const lead = this.order()[0]; pill(`VOLTA ${Math.min(this.s.numberOfLaps, (lead?.lap || 0) + 1)}/${this.s.numberOfLaps}${this.rain > 0 ? ' · 🌧️ CHUVA' : ''}`, W / 2, 92, { size: 18, bg: 'rgba(0,0,0,.7)' }); }
    if (this.ph.name !== 'podium' && this.s.showLeaderboard) hudBoard(this.order().map((c, i) => ({ user: c.user, value: c.done ? '🏁' : `V${c.lap + 1}` })), 20, 124, 210, { title: 'POSIÇÕES', n: this.s.leaderboardSize, rowH: 28, bg: 'rgba(8,10,20,.7)' });
    this.feed.draw(W - 260, 130);
    if (this.ph.name === 'podium') {
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
      title('PÓDIO', W / 2, 260, 64, '#ffc93c');
      const pos = [[W / 2, 560, 1], [W / 2 - 200, 620, 2], [W / 2 + 200, 660, 3]];
      pos.forEach(([x, y, n]) => { const c = this.podium[n - 1]; if (!c) return; ctx.fillStyle = ['#ffc93c', '#d7dde8', '#e08a3c'][n - 1]; ctx.fillRect(x - 80, y + 70, 160, 800 - y); num(String(n), x, y + 120, 60, '#1a1a1a'); avatar(c.user, x, y, 60, '#fff'); label(trim(c.user.nick, 12), x, y - 80, 22, '#fff', 'center', 900); });
    }
  },
});
