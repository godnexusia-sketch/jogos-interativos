'use strict';

// Mais jogos de chat: Prefere Isso ou Aquilo, Matemática Rápida, Memória Maestro, O Povo Diz e Adivinhe o Número.

// ---------------- Prefere Isso ou Aquilo (Would You Rather) ----------------
defineGame({
  id: 'would-you-rather', name: 'Prefere Isso ou Aquilo?', genre: 'party', icon: '🤔', color: '#8b5cf6', voice: true,
  desc: 'O chat comenta A ou B e a foto de cada um cai no lado que escolheu. Presentes deixam a foto maior, likes sacodem a pilha.',
  help: '<p>Comente <b>A</b> ou <b>B</b> (ou 1 e 2). A sua foto cai no lado escolhido.</p><p>🎁 Presente deixa a sua foto <b>maior</b>. ❤️ Likes <b>sacodem</b> a pilha. Ponha as suas próprias perguntas nas configurações.</p>',
  settings: [
    { key: 'intensity', type: 'select', label: 'Tipo de pergunta', options: [['leve', 'Leves'], ['apim', 'Apimentadas (sem baixaria)'], ['all', 'Todas']], default: 'all' },
    { key: 'voteSeconds', type: 'number', label: 'Segundos de votação', min: 8, max: 120, default: 25 },
    { key: 'revealSeconds', type: 'number', label: 'Segundos do resultado', min: 3, max: 20, default: 6 },
    { key: 'breakSeconds', type: 'number', label: 'Intervalo', min: 1, max: 10, default: 2 },
    { key: 'voteLabels', type: 'select', label: 'Como votar', options: [['ab', 'A ou B'], ['12', '1 ou 2']], default: 'ab' },
    { key: 'allowSwitch', type: 'toggle', label: 'Pode trocar de lado', default: true },
    { key: 'showLivePercent', type: 'toggle', label: 'Mostrar porcentagem ao vivo', default: true },
    { key: 'narrateQuestion', type: 'toggle', label: 'Ler a pergunta em voz alta', default: true, group: 'Voz' },
    { key: 'customWyr', type: 'textarea', label: 'Suas perguntas (uma por linha: opção A | opção B)', default: '', group: 'Perguntas' },
    { key: 'colorA', type: 'color', label: 'Cor do lado A', default: '#3b82f6', group: 'Visual' },
    { key: 'colorB', type: 'color', label: 'Cor do lado B', default: '#ef4444', group: 'Visual' },
  ],
  actions: [{ id: 'boost', label: 'Foto maior', icon: '⬆️' }, { id: 'shake', label: 'Sacudir', icon: '🫨' }, { id: 'skip_question', label: 'Pular', icon: '⏭️' }],
  bindings: [{ action: 'boost', trigger: 'gift', minCoins: 1 }, { action: 'shake', trigger: 'like', likes: 30 }, { action: 'skip_question', trigger: 'gift', minCoins: 299 }],
  init() { loadData('wyr').then((d) => { this.data = d; this.reset(); }); },
  reset() {
    this.rng = makeRng('wyr');
    const own = lines(this.s.customWyr).map((l) => l.split('|').map((x) => x.trim())).filter((p) => p.length >= 2).map((p) => ({ a: p[0], b: p[1] }));
    this.pool = freshPool(this, this.data ? [...own, ...this.data.filter((q) => this.s.intensity === 'all' || q.cat === this.s.intensity)] : own, this.rng);
    this.idx = 0;
    this.ph = new Phases();
    if (this.pool.length) this.next();
  },
  sample() { return this.s.voteLabels === '12' ? pick(['1', '2']) : pick(['a', 'b', 'A', 'B']); },
  next() {
    this.q = nextFresh(this, this.pool, this.rng);
    this.balls = []; this.side = new Map();
    this.ph.go('vote', this.s.voteSeconds);
    if (this.s.narrateQuestion) narrate(this, `Você prefere: ${this.q.a}, ou ${this.q.b}?`);
  },
  pickSide(text) {
    const t = norm(text);
    if (this.s.voteLabels === '12') return /^1\b/.test(t) ? 0 : /^2\b/.test(t) ? 1 : -1;
    return /^a\b/.test(t) ? 0 : /^b\b/.test(t) ? 1 : -1;
  },
  addBall(user, s) {
    const k = user.id || user.nick;
    let b = this.balls.find((x) => x.k === k);
    if (b) { if (b.s === s) return b; if (!this.s.allowSwitch) return b; b.s = s; b.x = s ? W * 0.75 : W * 0.25; b.y = 420; b.vy = 0; return b; }
    b = { k, user, s, x: (s ? W / 2 : 0) + rand(60, W / 2 - 60), y: 380 + rand(-30, 0), vx: rand(-40, 40), vy: 0, r: 26 };
    this.balls.push(b);
    if (this.balls.length > 160) this.balls.shift();
    return b;
  },
  onChat(ev) {
    if (this.ph.name !== 'vote') return;
    const s = this.pickSide(ev.text);
    if (s >= 0) this.addBall(ev.user, s);
  },
  onAction(id, a) {
    if (id === 'boost') { const b = this.balls.find((x) => x.k === (a.user.id || a.user.nick)) || (this.ph.name === 'vote' ? this.addBall(a.user, Math.random() < 0.5 ? 0 : 1) : null); if (b) { b.r = Math.min(110, b.r + 6 * a.power); b.vy = -300; } }
    else if (id === 'shake') for (const b of this.balls) { b.vy -= rand(150, 420); b.vx += rand(-120, 120); }
    else if (id === 'skip_question' && this.ph.name === 'vote') this.next();
  },
  update(dt) {
    if (!this.q) return;
    // Física simples: bolinhas com foto caem e se empilham em cada metade
    const floor = 1070;
    for (const b of this.balls) {
      b.vy += 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 0.98;
      const lo = b.s ? W / 2 + 8 : 8, hi = b.s ? W - 8 : W / 2 - 8;
      if (b.x - b.r < lo) { b.x = lo + b.r; b.vx = Math.abs(b.vx) * 0.5; }
      if (b.x + b.r > hi) { b.x = hi - b.r; b.vx = -Math.abs(b.vx) * 0.5; }
      if (b.y + b.r > floor) { b.y = floor - b.r; b.vy = -b.vy * 0.25; }
    }
    for (let i = 0; i < this.balls.length; i++) for (let j = i + 1; j < this.balls.length; j++) {
      const a = this.balls[i], c = this.balls[j];
      if (a.s !== c.s) continue;
      const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 1, m = a.r + c.r;
      if (d < m) { const p = (m - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * p; a.y -= ny * p; c.x += nx * p; c.y += ny * p; const rv = (c.vy - a.vy) * ny + (c.vx - a.vx) * nx; if (rv < 0) { a.vx += nx * rv * 0.4; a.vy += ny * rv * 0.4; c.vx -= nx * rv * 0.4; c.vy -= ny * rv * 0.4; } }
    }
    if (!this.ph.update(dt)) return;
    if (this.ph.name === 'vote') {
      const n0 = this.balls.filter((b) => !b.s).length, n1 = this.balls.length - n0;
      this.win = n0 === n1 ? -1 : n0 > n1 ? 0 : 1;
      sfx.win();
      narrate(this, this.win < 0 ? 'Empate!' : `A live prefere ${this.win ? this.q.b : this.q.a}!`);
      this.ph.go('reveal', this.s.revealSeconds);
    } else if (this.ph.name === 'reveal') this.ph.go('break', this.s.breakSeconds);
    else if (this.ph.name === 'break') this.next();
  },
  draw() {
    if (!this.q) { stageBg('purple'); return; }
    const cA = this.s.colorA, cB = this.s.colorB;
    if (!customBackground(this)) {
      for (const [x, c] of [[0, cA], [W / 2, cB]]) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, shade(c, -80)); g.addColorStop(1, shade(c, -120)); ctx.fillStyle = g; ctx.fillRect(x, 0, W / 2, H); }
    }
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(W / 2 - 2, 330, 4, H);
    title('VOCÊ PREFERE...', W / 2, 60, 46, '#fff');
    const lab = this.s.voteLabels === '12' ? ['1', '2'] : ['A', 'B'];
    const n0 = this.balls.filter((b) => !b.s).length, n1 = this.balls.length - n0, tot = Math.max(1, n0 + n1);
    const reveal = this.ph.name !== 'vote';
    [[0, cA, this.q.a, n0], [1, cB, this.q.b, n1]].forEach(([s, c, txt, n]) => {
      const x = 22 + s * (W / 2), w = W / 2 - 44;
      ctx.save(); if (reveal && this.win >= 0 && this.win !== s) ctx.globalAlpha = 0.45;
      panel(x, 110, w, 210, { r: 22, from: shade(c, 20), to: shade(c, -60), border: reveal && this.win === s ? '#fff' : hexA(c, 0.9), glow: reveal && this.win === s ? c : null });
      title(lab[s], x + 40, 150, 50, '#fff');
      textBlock(txt, x + w / 2, 225, w - 30, 28, { maxLines: 4, minSize: 16 });
      if (this.s.showLivePercent || reveal) label(`${Math.round(n / tot * 100)}%`, x + w - 20, 150, 30, '#fff', 'right', 900, F_NUM);
      ctx.restore();
    });
    for (const b of this.balls) avatar(b.user, b.x, b.y, b.r, b.s ? cB : cA);
    if (this.ph.name === 'vote') { hudTimer(W / 2, 1140, 44, this.ph.t, this.ph.total, '#fff'); label(`comente ${lab[0]} ou ${lab[1]}`, W / 2, 1200, 20, '#fff', 'center', 800); }
    else { title(this.win < 0 ? 'EMPATE!' : `${lab[this.win]} VENCEU!`, W / 2, 1150, 56, '#ffc93c'); }
  },
});

// ---------------- Matemática Rápida (Quick Math) ----------------
function mathQuestion(level, rng) {
  const r = (a, b) => rng.int(a, b);
  let a, b, q, ans;
  if (level <= 2) { a = r(1, 10 * level); b = r(1, 10 * level); q = `${a} + ${b}`; ans = a + b; }
  else if (level === 3) { a = r(10, 50); b = r(1, a); q = `${a} − ${b}`; ans = a - b; }
  else if (level === 4) { a = r(2, 10); b = r(2, 10); q = `${a} × ${b}`; ans = a * b; }
  else if (level === 5) { b = r(2, 12); ans = r(2, 12); a = b * ans; q = `${a} ÷ ${b}`; }
  else if (level === 6) { a = r(20, 99); b = r(20, 99); q = `${a} + ${b}`; ans = a + b; }
  else if (level === 7) { a = r(2, 12); b = r(2, 12); const c = r(1, 30); q = `${a} × ${b} + ${c}`; ans = a * b + c; }
  else if (level === 8) { a = r(11, 25); b = r(3, 9); q = `${a} × ${b}`; ans = a * b; }
  else if (level === 9) { a = r(2, 15); q = `${a}²`; ans = a * a; }
  else { a = r(100, 999); b = r(100, 999); q = `${a} + ${b}`; ans = a + b; }
  return { q, ans };
}
defineGame({
  id: 'quick-math', name: 'Matemática Rápida', genre: 'trivia', icon: '🧮', color: '#06b6d4',
  desc: 'Uma conta aparece e o chat corre para responder. Todo mundo que acerta pontua, por ordem de velocidade. A dificuldade se ajusta à live.',
  help: '<p>Comente o <b>resultado da conta</b>. Todos que acertam pontuam: o primeiro ganha mais. São 10 níveis; o jogo fica mais difícil quando a live acerta muito e mais fácil quando erra.</p><p>🎁 Presentes dão <b>+tempo</b> ou <b>pulam</b> a conta.</p>',
  settings: [
    { key: 'questionTimeLimit', type: 'number', label: 'Segundos por conta', min: 5, max: 60, default: 15 },
    { key: 'winnersShown', type: 'number', label: 'Quantos vencedores mostrar', min: 3, max: 12, default: 8 },
    { key: 'difficultyBand', type: 'select', label: 'Dificuldade', options: [['auto', 'Automática (ajusta à live)'], ['rand', 'Aleatória (fácil, média e difícil misturadas)'], ['easy', 'Fácil (1–3)'], ['medium', 'Média (4–7)'], ['hard', 'Difícil (8–10)']], default: 'auto' },
    { key: 'breakSeconds', type: 'number', label: 'Intervalo', min: 1, max: 10, default: 3 },
    { key: 'showStreaks', type: 'toggle', label: 'Mostrar sequências', default: true },
    NARRATE_SETTING('Falar a conta e o vencedor'),
    ...MATCH_SETTINGS(15, 1000), ...BOARD_SETTINGS(5),
  ],
  actions: [{ id: 'extra_time', label: '+5 segundos', icon: '⏱️' }, { id: 'skip_question', label: 'Pular conta', icon: '⏭️' }],
  bindings: [{ action: 'extra_time', trigger: 'gift', minCoins: 1 }, { action: 'skip_question', trigger: 'gift', minCoins: 30 }],
  reset() { this.rng = makeRng('math'); this.level = this.s.difficultyBand === 'medium' ? 4 : this.s.difficultyBand === 'hard' ? 8 : 1; this.points = new Points(this.id); this.streak = new Map(); this.round = 0; this.ph = new Phases(); this.feed = new Feed(3); this.next(); },
  sample() { return this.cur ? String(Math.random() < 0.6 ? this.cur.ans : this.cur.ans + randInt(-3, 3)) : '10'; },
  next() {
    const band = { easy: [1, 3], medium: [4, 7], hard: [8, 10] }[this.s.difficultyBand];
    if (band) this.level = clamp(this.level, band[0], band[1]);
    if (this.s.difficultyBand === 'rand') this.level = this.rng.int(1, 10);
    // não repete a mesma conta enquanto houver contas novas
    this.vistas ||= new Set();
    for (let t = 0; t < 30; t++) { this.cur = mathQuestion(this.level, this.rng); if (!this.vistas.has(this.cur.q)) break; }
    this.vistas.add(this.cur.q); if (this.vistas.size > 3000) this.vistas.clear();
    this.right = []; this.tried = new Set(); this.round++;
    this.ph.go('q', this.s.questionTimeLimit);
    narrate(this, `Quanto é ${this.cur.q.replace('×', 'vezes').replace('÷', 'dividido por').replace('−', 'menos').replace('²', ' ao quadrado')}?`);
  },
  onChat(ev) {
    if (this.ph.name !== 'q') return;
    const m = norm(ev.text).match(/^-?\d+$/);
    if (!m) return;
    const k = uid(ev);
    if (this.tried.has(k)) return;
    if (Number(m[0]) === this.cur.ans) {
      this.tried.add(k);
      const pos = this.right.length;
      const pts = Math.max(10, 100 - pos * 10) * Math.ceil(this.level / 2);
      this.right.push({ user: ev.user, pts });
      this.points.add(ev.user, pts);
      const st = (this.streak.get(k) || 0) + 1; this.streak.set(k, st);
      if (pos === 0) { sfx.confirm(); burst(W / 2, 470, ['#22e3ee', '#fff'], 30, 360); }
    }
  },
  onAction(id, a) {
    if (this.ph.name !== 'q') return;
    if (id === 'extra_time') { this.ph.t += 5; this.ph.total += 5; this.feed.push(a.user, '⏱️ +5s'); }
    else if (id === 'skip_question') { this.feed.push(a.user, '⏭️ pulou', '#ffc93c'); this.next(); }
  },
  update(dt) {
    this.feed.update(dt);
    if (!this.ph.update(dt)) return;
    if (this.ph.name === 'q') {
      for (const [k] of this.streak) if (!this.right.some((r) => (r.user.id || r.user.nick) === k)) this.streak.set(k, 0);
      // Ajusta a dificuldade: muita gente acertando sobe, ninguém acertando desce
      if (this.s.difficultyBand === 'auto') this.level = clamp(this.level + (this.right.length >= 3 ? 1 : this.right.length === 0 ? -1 : 0), 1, 10);
      if (this.right[0]) narrate(this, `${this.cur.ans}! ${this.right[0].user.nick} foi o mais rápido.`); else narrate(this, `Era ${this.cur.ans}.`);
      this.ph.go('reveal', 3.5);
    } else if (this.ph.name === 'reveal') {
      if (matchOver(this, this.round, this.points.best)) { this.champ = this.points.top(1)[0]; if (this.champ) { scores.add(this.id, this.champ.user, 0, 1); confetti(140); sfx.win(); } this.ph.go('final', 8); }
      else this.ph.go('break', this.s.breakSeconds);
    } else if (this.ph.name === 'break') this.next();
    else if (this.ph.name === 'final') { this.points.clear(); this.round = 0; this.next(); }
  },
  draw() {
    if (!customBackground(this)) stageBg('teal');
    if (this.ph.name === 'final') { title('FIM DA PARTIDA', W / 2, 120, 54, '#2dd4bf'); if (this.champ) winnerSpot(this.champ.user, 420, { sub: `${fmtNum(this.champ.value)} pontos` }); hudBoard(this.points.top(5), 90, 720, W - 180, { title: 'PÓDIO', unit: ' pts' }); return; }
    title('MATEMÁTICA RÁPIDA', W / 2, 62, 44);
    pill(`NÍVEL ${this.level} · CONTA ${this.round}`, W / 2, 106, { size: 15, bg: 'rgba(0,0,0,.5)', color: '#2dd4bf' });
    hudTimer(W / 2, 200, 52, this.ph.name === 'q' ? this.ph.t : 0, this.ph.name === 'q' ? this.ph.total : 1, '#2dd4bf');
    panel(50, 290, W - 100, 230, { r: 30, from: '#0f3740', to: '#061a20', border: 'rgba(45,212,191,.7)', glow: 'rgba(45,212,191,.35)' });
    num(this.cur.q + ' = ' + (this.ph.name === 'q' ? '?' : this.cur.ans), W / 2, 408, this.cur.q.length > 9 ? 84 : 104, this.ph.name === 'q' ? '#fff' : '#7cff6b');
    const show = this.right.slice(0, this.s.winnersShown);
    title(this.right.length ? `${this.right.length} ACERTARAM` : this.ph.name === 'q' ? 'COMENTE O RESULTADO' : 'NINGUÉM ACERTOU', W / 2, 580, 30, this.right.length ? '#7cff6b' : '#fff');
    show.forEach((r, i) => {
      const y = 620 + i * 50;
      ctx.fillStyle = i === 0 ? 'rgba(255,201,60,.18)' : 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.roundRect(110, y, W - 220, 44, 22); ctx.fill();
      posBadge(i + 1, 136, y + 22, 26);
      avatar(r.user, 174, y + 22, 18, i === 0 ? '#ffc93c' : '#fff');
      label(trim(r.user.nick, 20), 200, y + 23, 18, '#fff', 'left', 800);
      label(`+${r.pts}`, W - 128, y + 23, 18, '#7cff6b', 'right', 900);
      const st = this.streak.get(r.user.id || r.user.nick);
      if (this.s.showStreaks && st >= 3) label(`🔥${st}`, W - 190, y + 23, 16, '#ffc93c', 'right', 800);
    });
    if (this.s.showLeaderboard) hudBoard(this.points.top(this.s.leaderboardSize), 120, 1030, W - 240, { title: 'RANKING', n: 3, unit: ' pts', rowH: 34 });
    this.feed.draw(20, 160);
  },
});

// ---------------- Memória Maestro ----------------
defineGame({
  id: 'memory-maestro', name: 'Memória Maestro', genre: 'trivia', icon: '🧠', color: '#a855f7',
  desc: 'Um número aparece e some. O chat digita de memória. Os números crescem e o tempo diminui a cada nível.',
  help: '<p>Decore o número que aparece. Quando ele sumir, <b>digite no chat</b>. Todo mundo que acertar pontua; os mais rápidos ganham mais. A cada acerto da live o número fica maior.</p><p>🎁 Presentes mostram o número <b>de novo</b> ou dão <b>mais tempo</b>.</p>',
  settings: [
    { key: 'memorySeconds', type: 'number', label: 'Segundos para decorar', min: 1, max: 10, default: 3 },
    { key: 'startingLevel', type: 'number', label: 'Algarismos no começo', min: 2, max: 8, default: 3 },
    { key: 'answerSeconds', type: 'number', label: 'Segundos para responder', min: 5, max: 40, default: 15 },
    { key: 'revealSeconds', type: 'number', label: 'Segundos da resposta', min: 2, max: 10, default: 4 },
    { key: 'breakSeconds', type: 'number', label: 'Intervalo', min: 1, max: 10, default: 2 },
    ...BOARD_SETTINGS(5),
  ],
  actions: [{ id: 'show_again', label: 'Mostrar de novo', icon: '👁️' }, { id: 'extra_time', label: '+5 segundos', icon: '⏱️' }],
  bindings: [{ action: 'show_again', trigger: 'gift', minCoins: 1 }, { action: 'extra_time', trigger: 'like', likes: 100 }],
  reset() { this.rng = makeRng('mem'); this.digits = this.s.startingLevel; this.points = new Points(this.id); this.ph = new Phases(); this.feed = new Feed(3); this.round = 0; this.best = 0; this.next(); },
  sample() { return this.cur && Math.random() < 0.5 ? this.cur : String(randInt(100, 99999)); },
  next() {
    let s = String(this.rng.int(1, 9));
    for (let i = 1; i < this.digits; i++) s += this.rng.int(0, 9);
    this.cur = s; this.right = []; this.tried = new Set(); this.round++;
    this.ph.go('show', Math.max(1, this.s.memorySeconds - Math.floor((this.digits - this.s.startingLevel) / 3) * 0.5));
    sfx.tone(880, 0.15, 'sine', 0.1);
  },
  onChat(ev) {
    if (this.ph.name !== 'answer') return;
    const t = String(ev.text).replace(/[^\d]/g, '');
    const k = uid(ev);
    if (!t || this.tried.has(k)) return;
    this.tried.add(k);
    if (t === this.cur) { const pts = Math.max(10, 50 - this.right.length * 5) * this.digits; this.right.push({ user: ev.user, pts }); this.points.add(ev.user, pts); if (this.right.length === 1) sfx.confirm(); }
  },
  onAction(id, a) {
    if (id === 'show_again' && this.ph.name === 'answer') { this.peek = 1.5; this.feed.push(a.user, '👁️ mostrou de novo', '#c084fc'); }
    else if (id === 'extra_time' && this.ph.name === 'answer') { this.ph.t += 5; this.ph.total += 5; this.feed.push(a.user, '⏱️ +5s'); }
  },
  update(dt) {
    this.feed.update(dt);
    if (this.peek > 0) this.peek -= dt;
    if (!this.ph.update(dt)) return;
    if (this.ph.name === 'show') this.ph.go('answer', this.s.answerSeconds);
    else if (this.ph.name === 'answer') {
      if (this.right.length) { this.best = Math.max(this.best, this.digits); this.digits = Math.min(14, this.digits + 1); sfx.win(); }
      else this.digits = Math.max(this.s.startingLevel, this.digits - 1);
      this.ph.go('reveal', this.s.revealSeconds);
    } else if (this.ph.name === 'reveal') this.ph.go('break', this.s.breakSeconds);
    else if (this.ph.name === 'break') this.next();
  },
  draw() {
    if (!customBackground(this)) stageBg('purple');
    title('MEMÓRIA MAESTRO', W / 2, 62, 44);
    pill(`${this.digits} ALGARISMOS · RECORDE ${this.best || '—'}`, W / 2, 106, { size: 15, bg: 'rgba(0,0,0,.5)', color: '#c084fc' });
    const showNum = this.ph.name === 'show' || this.peek > 0 || this.ph.name === 'reveal';
    panel(40, 200, W - 80, 260, { r: 30, from: '#2a1350', to: '#120626', border: 'rgba(192,132,252,.7)', glow: 'rgba(192,132,252,.4)' });
    if (showNum) num(this.cur.replace(/(\d)(?=(\d{3})+$)/g, '$1 '), W / 2, 332, clamp(560 / (this.cur.length * 0.62), 50, 130), this.ph.name === 'reveal' ? '#7cff6b' : '#fff');
    else { num('?'.repeat(Math.min(this.cur.length, 10)), W / 2, 332, 90, 'rgba(255,255,255,.25)'); }
    if (this.ph.name === 'show') pill('DECORE!', W / 2, 470, { size: 22, bg: '#a855f7' });
    if (this.ph.name === 'answer') { hudTimer(W / 2, 560, 50, this.ph.t, this.ph.total, '#c084fc'); label('digite o número no chat', W / 2, 630, 22, '#fff', 'center', 800); }
    if (this.ph.name !== 'show' && this.right.length) hudWinners(this.right.map((r) => r.user), 680, { title: 'ACERTARAM', color: '#7cff6b' });
    if (this.ph.name === 'reveal' && !this.right.length) title('NINGUÉM LEMBROU!', W / 2, 720, 40, '#ff6b8a');
    if (this.s.showLeaderboard) hudBoard(this.points.top(this.s.leaderboardSize), 120, 830, W - 240, { title: 'RANKING', unit: ' pts' });
    this.feed.draw(20, 160);
  },
});

// ---------------- O Povo Diz (Crowd Says) ----------------
defineGame({
  id: 'crowd-says', name: 'O Povo Diz', genre: 'trivia', icon: '📋', color: '#f97316', voice: true,
  desc: 'Uma pergunta com cinco respostas mais populares. O chat inteiro chuta ao mesmo tempo; a mais popular vale mais. Três X encerram a rodada.',
  help: '<p>Adivinhe o que <b>o povo respondeu</b>: comente a sua resposta. Cada resposta do quadro dá pontos para quem acertou primeiro.</p><p>Se a live ficar um tempo sem acertar, leva um <b>X</b>. Três X e a rodada acaba. 🎁 Presentes revelam uma resposta ou dão um X de sabotagem.</p>',
  settings: [
    { key: 'roundsPerMatch', type: 'number', label: 'Rodadas por partida', min: 1, max: 30, default: 5 },
    { key: 'roundSeconds', type: 'number', label: 'Segundos por rodada', min: 20, max: 180, default: 60 },
    { key: 'strikeEvery', type: 'number', label: 'Segundos sem acerto para levar um X', min: 5, max: 60, default: 15 },
    { key: 'strikesPerRound', type: 'number', label: 'X para acabar a rodada', min: 1, max: 5, default: 3 },
    { key: 'strikesPerViewer', type: 'number', label: 'Chutes errados por pessoa (0 = sem limite)', min: 0, max: 20, default: 5 },
    { key: 'roundBreakSeconds', type: 'number', label: 'Intervalo entre rodadas', min: 2, max: 20, default: 6 },
    { key: 'ttsEnabled', type: 'toggle', label: 'Ler a pergunta e as respostas', default: true, group: 'Voz' },
    { key: 'showGuessFeed', type: 'toggle', label: 'Mostrar chutes ao vivo', default: true },
    { key: 'customSurvey', type: 'textarea', label: 'Suas perguntas (uma por linha: pergunta | resposta1:pontos | resposta2:pontos ...)', default: '', group: 'Perguntas' },
    ...BOARD_SETTINGS(5),
  ],
  actions: [{ id: 'reveal_slot', label: 'Revelar resposta', icon: '🔓' }, { id: 'extra_strike', label: 'Dar um X', icon: '❌' }],
  bindings: [{ action: 'reveal_slot', trigger: 'gift', minCoins: 30 }, { action: 'extra_strike', trigger: 'gift', minCoins: 99 }],
  init() { loadData('survey').then((d) => { this.data = d; this.reset(); }); },
  reset() {
    this.rng = makeRng('survey');
    const own = lines(this.s.customSurvey).map((l) => l.split('|').map((x) => x.trim())).filter((p) => p.length >= 3).map((p) => ({ q: p[0], a: p.slice(1).map((x) => { const [a, pts] = x.split(':'); return { a: a.trim(), p: Number(pts) || 10, alt: [] }; }).slice(0, 6) }));
    this.pool = freshPool(this, [...own, ...(this.data || [])], this.rng);
    this.idx = 0; this.round = 0; this.points = new Points(this.id); this.ph = new Phases(); this.guesses = [];
    if (this.pool.length) this.next();
  },
  sample() { const q = this.q; return q && Math.random() < 0.4 ? pick(q.a).a : pick(['bola', 'pizza', 'cachorro', 'celular', 'praia', 'sol', 'carro']); },
  next() {
    if (this.round >= this.s.roundsPerMatch) { this.champ = this.points.top(1)[0]; if (this.champ) { scores.add(this.id, this.champ.user, 0, 1); confetti(150); sfx.win(); } this.round = 0; this.ph.go('final', 8); return; }
    this.q = nextFresh(this, this.pool, this.rng);
    this.open = this.q.a.map(() => null); this.strikes = 0; this.misses = new Map(); this.lastHit = 0; this.round++; this.guesses = [];
    this.ph.go('play', this.s.roundSeconds);
    this.since = 0;
    if (this.s.ttsEnabled) narrate(this, `Perguntamos ao povo: ${this.q.q}`);
  },
  onChat(ev) {
    if (this.ph.name !== 'play') return;
    const k = uid(ev);
    if (this.s.strikesPerViewer && (this.misses.get(k) || 0) >= this.s.strikesPerViewer) return;
    const i = this.q.a.findIndex((x, j) => !this.open[j] && answerMatch(ev.text, [x.a, ...(x.alt || [])]));
    if (i >= 0) {
      this.open[i] = ev.user; this.points.add(ev.user, this.q.a[i].p); this.since = 0;
      sfx.confirm(); burst(W / 2, 400 + i * 96, ['#ffc93c', '#fff'], 30, 300);
      if (this.s.ttsEnabled) narrate(this, `${this.q.a[i].a}! ${this.q.a[i].p} pontos para ${ev.user.nick}.`);
      if (this.open.every(Boolean)) this.endRound();
    } else if (String(ev.text).length <= 30) {
      this.misses.set(k, (this.misses.get(k) || 0) + 1);
      if (this.s.showGuessFeed) { this.guesses.unshift({ user: ev.user, t: ev.text, life: 3 }); this.guesses.length = Math.min(5, this.guesses.length); }
    }
  },
  strike(user) {
    this.strikes++; this.since = 0; this.xFlash = 1.2; sfx.tone(140, 0.6, 'square', 0.12); sfx.tone(147, 0.6, 'square', 0.12);
    if (user) this.guesses.unshift({ user, t: '❌ deu um X', life: 3 });
    if (this.strikes >= this.s.strikesPerRound) this.endRound();
  },
  endRound() { this.ph.go('reveal', this.s.roundBreakSeconds); if (this.s.ttsEnabled) narrate(this, 'Fim da rodada! Vamos ver as respostas.'); },
  onAction(id, a) {
    if (this.ph.name !== 'play') return;
    if (id === 'reveal_slot') { const i = this.open.lastIndexOf(null); if (i >= 0) { this.open[i] = a.user; this.points.add(a.user, Math.round(this.q.a[i].p / 2)); sfx.pop(); if (this.open.every(Boolean)) this.endRound(); } }
    else if (id === 'extra_strike') this.strike(a.user);
  },
  update(dt) {
    for (const g of this.guesses) g.life -= dt;
    this.guesses = this.guesses.filter((g) => g.life > 0);
    if (this.xFlash > 0) this.xFlash -= dt;
    if (this.ph.name === 'play') { this.since += dt; if (this.since >= this.s.strikeEvery) this.strike(); }
    if (!this.ph.update(dt)) return;
    if (this.ph.name === 'play') this.endRound();
    else if (this.ph.name === 'reveal' || this.ph.name === 'final') { if (this.ph.name === 'final') this.points.clear(); this.next(); }
  },
  draw() {
    if (!customBackground(this)) stageBg('red');
    if (this.ph.name === 'final') { title('FIM DA PARTIDA', W / 2, 120, 54, '#ff8a3d'); if (this.champ) winnerSpot(this.champ.user, 420, { sub: `${fmtNum(this.champ.value)} pontos` }); hudBoard(this.points.top(5), 90, 720, W - 180, { title: 'PÓDIO', unit: ' pts' }); return; }
    if (!this.q) return;
    title('O POVO DIZ', W / 2, 56, 48, '#ffc93c');
    pill(`RODADA ${this.round}/${this.s.roundsPerMatch}`, W / 2, 98, { size: 15, bg: 'rgba(0,0,0,.5)', color: '#ff8a3d' });
    questionCard(this.q.q, 130, 150, { color: '#ff8a3d', size: 34 });
    const reveal = this.ph.name === 'reveal';
    this.q.a.forEach((x, i) => {
      const y = 310 + i * 92, o = this.open[i];
      panel(40, y, W - 80, 80, { r: 16, from: o ? '#1f6f3a' : reveal ? '#3a2a10' : '#1b2a6b', to: o ? '#0d3a1d' : reveal ? '#20170a' : '#0d1640', border: o ? '#86efac' : 'rgba(255,201,60,.6)' });
      if (o || reveal) {
        label(String(x.a).toUpperCase(), 70, y + 40, 26, '#fff', 'left', 900);
        num(String(x.p), W - 70, y + 41, 40, '#ffc93c', 'right');
        if (o) { avatar(o, W - 150, y + 40, 22, '#86efac'); }
      } else { ctx.fillStyle = '#ffc93c'; ctx.beginPath(); ctx.arc(W / 2, y + 40, 26, 0, 7); ctx.fill(); num(String(i + 1), W / 2, y + 42, 34, '#1a1000'); }
    });
    // X das rodadas
    for (let i = 0; i < this.s.strikesPerRound; i++) { const x = W / 2 + (i - (this.s.strikesPerRound - 1) / 2) * 70; title('✕', x, 800, 56, i < this.strikes ? '#ff2d55' : 'rgba(255,255,255,.15)'); }
    if (this.xFlash > 0) { ctx.globalAlpha = clamp(this.xFlash, 0, 1); title('✕', W / 2, 520, 400, '#ff2d55'); ctx.globalAlpha = 1; }
    if (this.ph.name === 'play') { hudTimer(W - 70, 70, 40, this.ph.t, this.ph.total, '#ff8a3d'); const nx = this.s.strikeEvery - this.since; pill(`próximo X em ${Math.ceil(nx)}s`, W / 2, 860, { size: 15, bg: 'rgba(0,0,0,.55)', color: nx < 5 ? '#ff6b8a' : '#fff' }); }
    this.guesses.forEach((g, i) => toast(g.user, trim(g.t, 22), 30, 910 + i * 42, { color: '#ff6b8a', alpha: clamp(g.life, 0, 1), size: 15 }));
    if (this.s.showLeaderboard) hudBoard(this.points.top(3), W - 300, 900, 270, { title: 'RANKING', unit: ' pts', rowH: 34, n: 3 });
  },
});

// ---------------- Adivinhe o Número ----------------
defineGame({
  id: 'guess-the-number', name: 'Adivinhe o Número', genre: 'trivia', icon: '🔢', color: '#10b981', voice: true,
  desc: 'O chat chuta um número escondido e vê na hora se é maior ou menor. Quem acertar (ou chegar mais perto) ganha a rodada.',
  help: '<p>Comente um <b>número</b>. A tela diz se o número secreto é <b>maior ⬆</b> ou <b>menor ⬇</b>. Quem acertar primeiro vence (ou o mais perto no fim do tempo, se configurado).</p><p>🎁 Presente dá uma <b>dica</b>: diminui o intervalo.</p>',
  settings: [
    { key: 'targetMode', type: 'select', label: 'Número secreto', options: [['random', 'Sorteado'], ['manual', 'Eu escolho']], default: 'random' },
    { key: 'manualNumber', type: 'number', label: 'Número secreto (modo eu escolho)', min: 0, max: 1000000, default: 42, showIf: { key: 'targetMode', value: 'manual' } },
    { key: 'rangeMin', type: 'number', label: 'Menor número', min: 0, max: 100000, default: 1 },
    { key: 'rangeMax', type: 'number', label: 'Maior número', min: 2, max: 1000000, default: 100 },
    { key: 'winRule', type: 'select', label: 'Quem vence', options: [['exact', 'Quem acertar primeiro'], ['closest', 'O mais perto quando o tempo acabar']], default: 'exact' },
    { key: 'roundDuration', type: 'number', label: 'Segundos por rodada', min: 15, max: 600, default: 90 },
    { key: 'guessesPerUser', type: 'number', label: 'Chutes por pessoa (0 = sem limite)', min: 0, max: 100, default: 0 },
    { key: 'showHigherLower', type: 'toggle', label: 'Mostrar maior/menor', default: true },
    { key: 'showClosest', type: 'toggle', label: 'Mostrar quem está mais perto', default: true },
    { key: 'breakSeconds', type: 'number', label: 'Intervalo', min: 2, max: 30, default: 6 },
    NARRATE_SETTING(), ...BOARD_SETTINGS(5),
  ],
  actions: [{ id: 'hint', label: 'Dica (diminui o intervalo)', icon: '💡' }],
  bindings: [{ action: 'hint', trigger: 'gift', minCoins: 5 }],
  reset() { this.rng = makeRng('num'); this.points = new Points(this.id); this.ph = new Phases(); this.round = 0; this.next(); },
  sample() { return String(randInt(this.lo ?? 1, this.hi ?? 100)); },
  next() {
    const a = Math.min(this.s.rangeMin, this.s.rangeMax - 1), b = Math.max(this.s.rangeMax, a + 1);
    this.target = this.s.targetMode === 'manual' ? clamp(this.s.manualNumber, a, b) : this.rng.int(a, b);
    this.lo = a; this.hi = b; this.guesses = []; this.count = new Map(); this.closest = null; this.winner = null; this.round++;
    this.ph.go('play', this.s.roundDuration);
  },
  onChat(ev) {
    if (this.ph.name !== 'play') return;
    const m = norm(ev.text).match(/^\d+$/);
    if (!m) return;
    const n = Number(m[0]), k = uid(ev);
    if (this.s.guessesPerUser && (this.count.get(k) || 0) >= this.s.guessesPerUser) return;
    this.count.set(k, (this.count.get(k) || 0) + 1);
    const d = Math.abs(n - this.target);
    if (!this.closest || d < this.closest.d) this.closest = { user: ev.user, n, d };
    this.guesses.unshift({ user: ev.user, n, dir: n < this.target ? 1 : n > this.target ? -1 : 0, life: 6 });
    this.guesses.length = Math.min(this.guesses.length, 7);
    if (n < this.target) this.lo = Math.max(this.lo, n + 1);
    if (n > this.target) this.hi = Math.min(this.hi, n - 1);
    if (n === this.target && this.s.winRule === 'exact') this.win(ev.user);
  },
  win(user) {
    this.winner = user;
    if (user) { this.points.add(user, 100); scores.add(this.id, user, 0, 1); confetti(140); sfx.win(); narrate(this, `${user.nick} acertou! O número era ${this.target}.`); }
    else narrate(this, `Ninguém acertou. O número era ${this.target}.`);
    this.ph.go('reveal', this.s.breakSeconds);
  },
  onAction(id, a) {
    if (id !== 'hint' || this.ph.name !== 'play') return;
    const span = this.hi - this.lo;
    const cut = Math.max(1, Math.floor(span * 0.25));
    if (this.target - this.lo > this.hi - this.target) this.lo = Math.min(this.target, this.lo + cut); else this.hi = Math.max(this.target, this.hi - cut);
    this.guesses.unshift({ user: a.user, n: `💡 ${this.lo}–${this.hi}`, dir: 2, life: 6 });
  },
  update(dt) {
    for (const g of this.guesses) g.life -= dt;
    if (!this.ph.update(dt)) return;
    if (this.ph.name === 'play') this.win(this.s.winRule === 'closest' ? this.closest?.user : null);
    else this.next();
  },
  draw() {
    if (!customBackground(this)) stageBg('green');
    title('ADIVINHE O NÚMERO', W / 2, 62, 44);
    pill(`entre ${fmtNum(this.s.rangeMin)} e ${fmtNum(this.s.rangeMax)} · rodada ${this.round}`, W / 2, 106, { size: 16, bg: 'rgba(0,0,0,.5)', color: '#34d399' });
    hudTimer(W / 2, 200, 50, this.ph.name === 'play' ? this.ph.t : 0, this.ph.name === 'play' ? this.ph.total : 1, '#34d399');
    panel(140, 280, W - 280, 200, { r: 30, from: '#0f4a33', to: '#06251a', border: 'rgba(52,211,153,.7)', glow: 'rgba(52,211,153,.35)' });
    num(this.ph.name === 'reveal' ? String(this.target) : '?', W / 2, 382, 130, this.ph.name === 'reveal' ? '#7cff6b' : '#fff');
    if (this.s.showHigherLower && this.ph.name === 'play') {
      label('o número está entre', W / 2, 520, 20, 'rgba(255,255,255,.8)', 'center', 700);
      num(`${fmtNum(this.lo)}  —  ${fmtNum(this.hi)}`, W / 2, 565, 52, '#ffc93c');
      const span = this.s.rangeMax - this.s.rangeMin || 1;
      glossBar(80, 610, W - 160, 16, 1, 'rgba(255,255,255,.08)');
      ctx.fillStyle = '#34d399'; ctx.fillRect(80 + (W - 160) * (this.lo - this.s.rangeMin) / span, 612, Math.max(4, (W - 160) * (this.hi - this.lo) / span), 12);
    }
    this.guesses.forEach((g, i) => {
      if (g.life <= 0) return;
      const arrow = g.dir === 1 ? '⬆ maior' : g.dir === -1 ? '⬇ menor' : g.dir === 0 ? '🎯 acertou!' : '';
      toast(g.user, `${g.n}  ${this.s.showHigherLower ? arrow : ''}`, 60, 680 + i * 46, { color: g.dir === 0 ? '#7cff6b' : g.dir === 2 ? '#ffc93c' : g.dir === 1 ? '#22e3ee' : '#ff6b8a', alpha: clamp(g.life, 0, 1), size: 18 });
    });
    if (this.s.showClosest && this.closest && this.ph.name === 'play') pill(`🎯 mais perto: @${trim(this.closest.user.nick, 14)}`, W / 2, 1020, { size: 17, bg: 'rgba(0,0,0,.6)', color: '#ffc93c' });
    if (this.ph.name === 'reveal' && this.winner) winnerSpot(this.winner, 820, { r: 70, title: 'ACERTOU!' });
    if (this.s.showLeaderboard && this.ph.name === 'play') hudBoard(this.points.top(3), 120, 1060, W - 240, { title: 'RANKING', unit: ' pts', rowH: 32, n: 3 });
  },
});
