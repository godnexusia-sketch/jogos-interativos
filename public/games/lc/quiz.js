'use strict';

// Jogos de pergunta e resposta pelo chat: Quiz Relâmpago, Show do Milhão e Verdadeiro ou Falso.

// Monta a lista de perguntas: banco + perguntas do admin ("pergunta | certa | errada | errada | errada").
function triviaPool(g, data, rng) {
  let qs = (data?.q || []).filter((q) => (g.s.category === 'all' || q.cat === g.s.category) && (g.s.difficulty === 'mix' || String(q.d) === String(g.s.difficulty)));
  const own = lines(g.s.custom).map((l) => l.split('|').map((x) => x.trim())).filter((p) => p.length >= 3).map((p) => ({ q: p[0], a: p.slice(1, 5), cat: 'Suas perguntas', d: 2 }));
  if (g.s.onlyCustom && own.length) qs = own; else qs = [...own, ...qs];
  if (!qs.length) qs = data?.q || [];
  return rng.shuffle(qs);
}
// Embaralha as alternativas guardando qual é a certa.
function shuffleOptions(q, rng) {
  const opts = q.a.map((t, i) => ({ t, ok: i === 0 }));
  const sh = rng.shuffle(opts);
  return { q: q.q, cat: q.cat, d: q.d, opts: sh.map((o) => o.t), correct: sh.findIndex((o) => o.ok) };
}
const QUIZ_CUSTOM = [
  { key: 'custom', type: 'textarea', label: 'Suas perguntas (uma por linha: pergunta | certa | errada | errada | errada)', default: '', group: 'Perguntas', rows: 5 },
  { key: 'onlyCustom', type: 'toggle', label: 'Usar só as minhas perguntas', default: false, group: 'Perguntas' },
];
const CAT_OPTIONS = [['all', 'Todas'], ...['Geografia', 'História', 'Ciências', 'Esportes', 'Futebol', 'Entretenimento', 'Cinema e séries', 'Música', 'Brasil', 'Comida', 'Animais', 'Tecnologia', 'Espaço', 'Corpo humano', 'Matemática', 'Português', 'Arte e Cultura', 'Mitologia', 'Conhecimentos gerais'].map((c) => [c, c])];

// ---------------- Quiz Relâmpago (Trivia Time) ----------------
defineGame({
  id: 'trivia-time', name: 'Quiz Relâmpago', genre: 'trivia', icon: '⚡', color: '#3b82f6', voice: true,
  desc: 'O chat responde A, B, C ou D. Quem acerta mais rápido ganha mais pontos. Presentes tiram uma errada ou pulam a pergunta.',
  help: '<p>Comente <b>A, B, C ou D</b>. Vale a primeira resposta de cada pessoa. Quem acerta mais rápido ganha mais pontos.</p><p>🎁 Presentes: <b>50/50</b> (tira duas erradas) e <b>pular</b>. Configure as categorias, a dificuldade e coloque suas próprias perguntas.</p>',
  settings: [
    { key: 'category', type: 'select', label: 'Categoria', options: CAT_OPTIONS, default: 'all' },
    { key: 'difficulty', type: 'select', label: 'Dificuldade', options: [['mix', 'Aleatória (fácil, média e difícil misturadas)'], ['1', 'Fácil'], ['2', 'Média'], ['3', 'Difícil']], default: 'mix' },
    { key: 'questionSeconds', type: 'number', label: 'Segundos para responder', min: 5, max: 60, default: 15 },
    { key: 'revealSeconds', type: 'number', label: 'Segundos mostrando a resposta', min: 2, max: 15, default: 5 },
    { key: 'breakSeconds', type: 'number', label: 'Intervalo entre perguntas', min: 1, max: 15, default: 3 },
    { key: 'pointsPerCorrect', type: 'number', label: 'Pontos por acerto', min: 1, max: 1000, default: 100 },
    { key: 'speedBonus', type: 'toggle', label: 'Bônus de velocidade (até +50%)', default: true },
    { key: 'showVoteCounts', type: 'toggle', label: 'Mostrar votos ao vivo', default: true },
    { key: 'narrateQuestion', type: 'toggle', label: 'Ler a pergunta em voz alta', default: true, group: 'Voz' },
    NARRATE_SETTING(),
    ...MATCH_SETTINGS(10, 1000), ...BOARD_SETTINGS(5), ...QUIZ_CUSTOM,
    { key: 'accentColor', type: 'select', label: 'Tema', options: [['blue', 'Azul'], ['purple', 'Roxo'], ['red', 'Vermelho'], ['green', 'Verde'], ['gold', 'Dourado']], default: 'blue', group: 'Visual' },
  ],
  actions: [
    { id: 'fifty_fifty', label: '50/50', icon: '✂️' },
    { id: 'skip_question', label: 'Pular pergunta', icon: '⏭️' },
    { id: 'extra_time', label: '+5 segundos', icon: '⏱️' },
  ],
  bindings: [{ action: 'fifty_fifty', trigger: 'gift', minCoins: 1 }, { action: 'skip_question', trigger: 'gift', minCoins: 99 }, { action: 'extra_time', trigger: 'like', likes: 100 }],
  init() { loadData('trivia').then((d) => { this.data = d; this.reset(); }); },
  reset() {
    this.rng = makeRng('trivia');
    this.pool = this.data ? triviaPool(this, this.data, this.rng) : [];
    this.idx = 0; this.round = 0;
    this.points = new Points(this.id);
    this.feed = new Feed(4);
    this.ph = new Phases();
    this.match = 1;
    if (this.data) this.next();
  },
  sample() { return pick(['a', 'b', 'c', 'd', 'A', 'letra b']); },
  next() {
    if (!this.pool.length) return;
    const q = this.pool[this.idx++ % this.pool.length];
    this.q = shuffleOptions(q, this.rng);
    this.votes = new Map(); this.counts = [0, 0, 0, 0]; this.removed = new Set(); this.winners = [];
    this.round++;
    this.ph.go('q', this.s.questionSeconds);
    this.tStart = this.s.questionSeconds;
    if (this.s.narrateQuestion) narrate(this, this.q.q, { maxLen: 220 });
  },
  onChat(ev) {
    if (this.ph.name !== 'q' || !this.q) return;
    const l = answerLetter(ev.text);
    if (!l) return;
    const i = 'abcd'.indexOf(l);
    if (this.removed.has(i) || this.votes.has(uid(ev))) return;
    this.votes.set(uid(ev), { i, user: ev.user, t: this.ph.t });
    this.counts[i]++;
  },
  onAction(id, a) {
    if (!this.q) return;
    if (id === 'fifty_fifty' && this.ph.name === 'q' && !this.removed.size) {
      const wrong = [0, 1, 2, 3].filter((i) => i !== this.q.correct);
      const keep = wrong[Math.floor(this.rng() * 3)];
      wrong.filter((i) => i !== keep).forEach((i) => this.removed.add(i));
      this.feed.push(a.user, '✂️ usou 50/50', '#ffc93c'); sfx.pop();
    } else if (id === 'skip_question' && this.ph.name === 'q') { this.feed.push(a.user, '⏭️ pulou a pergunta', '#ffc93c'); this.next(); }
    else if (id === 'extra_time' && this.ph.name === 'q') { this.ph.t += 5; this.ph.total += 5; this.feed.push(a.user, '⏱️ +5 segundos', '#22e3ee'); }
  },
  update(dt) {
    this.feed?.update(dt);
    if (!this.q) return;
    if (!this.ph.update(dt)) return;
    if (this.ph.name === 'q') {
      // Revela: pontua quem acertou, mais rápido vale mais
      const ok = [...this.votes.values()].filter((v) => v.i === this.q.correct).sort((a, b) => b.t - a.t);
      for (const v of ok) {
        const bonus = this.s.speedBonus ? Math.round(this.s.pointsPerCorrect * 0.5 * (v.t / this.ph.total)) : 0;
        this.points.add(v.user, this.s.pointsPerCorrect + bonus);
      }
      this.winners = ok.map((v) => v.user);
      sfx.confirm();
      if (ok.length) burst(W / 2, 560, ['#22c55e', '#86efac', '#fff'], 50, 420);
      if (this.winners[0]) narrate(this, `A resposta certa é ${this.q.opts[this.q.correct]}. ${this.winners.length} acertaram, ${this.winners[0].nick} foi o mais rápido!`);
      else narrate(this, `A resposta certa era ${this.q.opts[this.q.correct]}.`);
      this.ph.go('reveal', this.s.revealSeconds);
    } else if (this.ph.name === 'reveal') {
      if (matchOver(this, this.round, this.points.best)) {
        const w = this.points.top(1)[0];
        this.champ = w;
        if (w) { scores.add(this.id, w.user, 0, 1); narrate(this, `Fim da partida! ${w.user.nick} é o campeão com ${w.value} pontos!`); confetti(160); sfx.win(); }
        this.ph.go('final', 9);
      } else this.ph.go('break', this.s.breakSeconds);
    } else if (this.ph.name === 'break') this.next();
    else if (this.ph.name === 'final') { this.points.clear(); this.round = 0; this.champ = null; this.next(); }
  },
  draw() {
    const theme = this.s.accentColor;
    if (!customBackground(this)) stageBg(theme);
    const acc = STAGES[theme]?.[2] || '#22e3ee';
    if (!this.q) { title('QUIZ RELÂMPAGO', W / 2, H / 2, 56, '#fff'); return; }
    if (this.ph.name === 'final') {
      title('FIM DA PARTIDA', W / 2, 120, 54, acc);
      if (this.champ) winnerSpot(this.champ.user, 420, { title: 'CAMPEÃO', sub: `${fmtNum(this.champ.value)} pontos` });
      hudBoard(this.points.top(5), 90, 720, W - 180, { title: 'PÓDIO', n: 5, unit: ' pts' });
      return;
    }
    title('QUIZ RELÂMPAGO', W / 2, 62, 44, '#fff');
    pill(`PERGUNTA ${this.round}${this.s.matchEnd === 'rounds' ? '/' + this.s.matchRounds : ''} · ${this.q.cat}`, W / 2, 106, { size: 15, bg: 'rgba(0,0,0,.5)', color: acc });
    hudTimer(W / 2, 196, 52, this.ph.name === 'q' ? this.ph.t : 0, this.ph.name === 'q' ? this.ph.total : 1, acc);
    questionCard(this.q.q, 268, 210, { color: acc, size: 38 });
    const total = Math.max(1, this.votes.size);
    this.q.opts.forEach((o, i) => {
      const y = 510 + i * 96;
      const state = this.ph.name === 'q' ? (this.removed.has(i) ? 'dim' : 'normal') : i === this.q.correct ? 'correct' : 'wrong';
      answerTile(36, y, W - 72, 80, 'abcd'[i], o, { state, pct: this.s.showVoteCounts || this.ph.name !== 'q' ? this.counts[i] / total : null });
    });
    if (this.ph.name !== 'q' && this.winners.length) hudWinners(this.winners, 912, { title: 'ACERTARAM' });
    else label(`${this.votes.size} respostas · comente A, B, C ou D`, W / 2, 920, 20, 'rgba(255,255,255,.8)', 'center', 700);
    if (this.s.showLeaderboard) hudBoard(this.points.top(this.s.leaderboardSize), 120, 1018, W - 240, { title: 'RANKING', n: Math.min(3, this.s.leaderboardSize), unit: ' pts', rowH: 36 });
    this.feed.draw(20, 160);
  },
});

// ---------------- Show do Milhão (Million Quiz) ----------------
const LADDER = [1, 2, 3, 5, 10, 20, 30, 50, 100, 200, 300, 500, 750, 900, 1000];
defineGame({
  id: 'million-quiz', name: 'Show do Milhão', genre: 'trivia', icon: '💰', color: '#ffc93c', voice: true,
  desc: 'O chat vota A, B, C ou D e a resposta da maioria sobe a escada de prêmios até o milhão. Presentes usam as ajudas 50/50 e Pular.',
  help: '<p>A live joga junta: comente <b>A, B, C ou D</b>. A resposta mais votada vale. Acertou, sobe um degrau; errou, volta ao começo.</p><p>🎁 Presentes ativam as ajudas <b>50/50</b> e <b>Pular</b> (limite por partida).</p>',
  settings: [
    { key: 'category', type: 'select', label: 'Categoria', options: CAT_OPTIONS, default: 'all' },
    { key: 'difficulty', type: 'select', label: 'Dificuldade', options: [['mix', 'Sobe com a escada'], ['rand', 'Aleatória (fácil, média e difícil misturadas)'], ['1', 'Fácil'], ['2', 'Média'], ['3', 'Difícil']], default: 'mix' },
    { key: 'prizeUnit', type: 'select', label: 'Prêmio', options: [['mil', 'R$ mil'], ['pts', 'Pontos'], ['moedas', 'Moedas']], default: 'mil' },
    { key: 'votingDuration', type: 'slider', label: 'Segundos de votação', min: 8, max: 60, default: 20 },
    { key: 'finaleDuration', type: 'slider', label: 'Segundos da revelação', min: 3, max: 12, default: 5 },
    { key: 'restartDelay', type: 'slider', label: 'Segundos para recomeçar depois de errar', min: 3, max: 20, default: 8 },
    { key: 'fiftyMaxPerGame', type: 'number', label: 'Máximo de 50/50 por partida', min: 0, max: 15, default: 3 },
    { key: 'skipMaxPerGame', type: 'number', label: 'Máximo de pulos por partida', min: 0, max: 15, default: 3 },
    { key: 'narrateQuestions', type: 'toggle', label: 'Ler a pergunta e as alternativas', default: true, group: 'Voz' },
    NARRATE_SETTING('Falar o resultado'),
    { key: 'hintTicker', type: 'textarea', label: 'Mensagens rolando embaixo (uma por linha)', default: 'Comente A, B, C ou D!\nPresente usa 50/50 ✂️\nSiga a live para jogar sempre ⭐', group: 'Visual' },
    ...QUIZ_CUSTOM,
  ],
  actions: [{ id: 'fifty_fifty', label: '50/50', icon: '✂️' }, { id: 'skip_question', label: 'Pular', icon: '⏭️' }],
  bindings: [{ action: 'fifty_fifty', trigger: 'gift', minCoins: 1 }, { action: 'skip_question', trigger: 'gift', minCoins: 30 }],
  init() { loadData('trivia').then((d) => { this.data = d; this.reset(); }); },
  reset() {
    this.rng = makeRng('million');
    this.step = 0; this.best = 0; this.fifty = 0; this.skips = 0; this.games = 1;
    this.feed = new Feed(3);
    this.ph = new Phases();
    this.used = new Set();
    if (this.data) this.next();
  },
  sample() { return pick(['a', 'b', 'c', 'd']); },
  pickQuestion() {
    const level = this.s.difficulty === 'mix' ? (this.step < 5 ? 1 : this.step < 10 ? 2 : 3) : this.s.difficulty === 'rand' ? 1 + Math.floor(this.rng() * 3) : Number(this.s.difficulty);
    const own = lines(this.s.custom).map((l) => l.split('|').map((x) => x.trim())).filter((p) => p.length >= 3).map((p, i) => ({ q: p[0], a: p.slice(1, 5), cat: 'Suas perguntas', d: level, id: 'c' + i }));
    let pool = this.s.onlyCustom && own.length ? own : [...own, ...this.data.q.filter((q) => q.d === level && (this.s.category === 'all' || q.cat === this.s.category))];
    pool = pool.filter((q) => !this.used.has(q.q));
    if (!pool.length) { this.used.clear(); pool = this.data.q; }
    const q = pool[Math.floor(this.rng() * pool.length)];
    this.used.add(q.q);
    return shuffleOptions(q, this.rng);
  },
  prize(i) { const v = LADDER[i] || 0; return this.s.prizeUnit === 'mil' ? (v >= 1000 ? 'R$ 1 MILHÃO' : `R$ ${v} MIL`) : this.s.prizeUnit === 'pts' ? `${fmtNum(v * 1000)} pts` : `${fmtNum(v * 100)} 🪙`; },
  next() {
    this.q = this.pickQuestion();
    this.votes = new Map(); this.counts = [0, 0, 0, 0]; this.removed = new Set();
    this.ph.go('q', this.s.votingDuration);
    if (this.s.narrateQuestions) narrate(this, `Valendo ${this.prize(this.step)}. ${this.q.q} ${this.q.opts.map((o, i) => `${'ABCD'[i]}: ${o}.`).join(' ')}`, { maxLen: 320 });
  },
  onChat(ev) {
    if (this.ph.name !== 'q') return;
    const l = answerLetter(ev.text);
    if (!l) return;
    const i = 'abcd'.indexOf(l);
    if (this.removed.has(i)) return;
    const prev = this.votes.get(uid(ev));
    if (prev !== undefined) this.counts[prev]--;
    this.votes.set(uid(ev), i);
    this.counts[i]++;
  },
  onAction(id, a) {
    if (this.ph.name !== 'q') return;
    if (id === 'fifty_fifty' && !this.removed.size && this.fifty < this.s.fiftyMaxPerGame) {
      this.fifty++;
      const wrong = this.rng.shuffle([0, 1, 2, 3].filter((i) => i !== this.q.correct)).slice(0, 2);
      wrong.forEach((i) => { this.removed.add(i); this.counts[i] = 0; });
      for (const [k, v] of this.votes) if (this.removed.has(v)) this.votes.delete(k);
      this.feed.push(a.user, '✂️ usou 50/50!', '#ffc93c'); sfx.pop();
      narrate(this, `${a.user.nick} usou a ajuda cinquenta cinquenta!`);
    } else if (id === 'skip_question' && this.skips < this.s.skipMaxPerGame) {
      this.skips++;
      this.feed.push(a.user, '⏭️ pulou a pergunta!', '#22e3ee');
      this.next();
    }
  },
  update(dt) {
    this.feed?.update(dt);
    if (!this.q || !this.ph.update(dt)) return;
    if (this.ph.name === 'q') {
      const max = Math.max(...this.counts);
      this.choice = max > 0 ? this.counts.indexOf(max) : -1;
      this.ph.go('suspense', 2.2);
      sfx.tone(220, 1.6, 'sawtooth', 0.04);
    } else if (this.ph.name === 'suspense') {
      this.right = this.choice === this.q.correct;
      if (this.right) {
        this.step++; this.best = Math.max(this.best, this.step);
        sfx.win(); burst(W / 2, 600, ['#ffc93c', '#fff', '#22c55e'], 70, 520);
        if (this.step >= LADDER.length) { confetti(220); narrate(this, 'Inacreditável! A live ganhou o prêmio máximo!'); }
        else narrate(this, `Certa resposta! A live sobe para ${this.prize(this.step)}.`);
      } else {
        sfx.boom();
        narrate(this, this.choice < 0 ? `Ninguém respondeu! A certa era ${this.q.opts[this.q.correct]}.` : `Que pena! A resposta certa era ${this.q.opts[this.q.correct]}.`);
      }
      this.ph.go('reveal', this.s.finaleDuration);
    } else if (this.ph.name === 'reveal') {
      if (!this.right || this.step >= LADDER.length) { this.ph.go('over', this.s.restartDelay); }
      else this.next();
    } else if (this.ph.name === 'over') {
      this.step = 0; this.fifty = 0; this.skips = 0; this.games++;
      this.next();
    }
  },
  draw() {
    if (!customBackground(this)) stageBg('gold');
    const t = performance.now() / 1000;
    if (!this.q) { title('SHOW DO MILHÃO', W / 2, H / 2, 56, '#ffc93c'); return; }
    // Escada de prêmios à direita
    const lx = W - 168;
    for (let i = LADDER.length - 1; i >= 0; i--) {
      const y = 96 + (LADDER.length - 1 - i) * 30;
      const cur = i === this.step, done = i < this.step;
      ctx.fillStyle = cur ? '#ffc93c' : done ? 'rgba(34,197,94,.35)' : 'rgba(0,0,0,.45)';
      ctx.beginPath(); ctx.roundRect(lx, y, 150, 26, 13); ctx.fill();
      label(`${i + 1}`, lx + 18, y + 14, 13, cur ? '#1a1300' : 'rgba(255,255,255,.6)', 'center', 800);
      label(this.prize(i), lx + 140, y + 14, 14, cur ? '#1a1300' : i % 5 === 4 ? '#ffc93c' : '#fff', 'right', 800);
    }
    title('SHOW DO', 210, 92, 40, '#fff');
    title('MILHÃO', 210, 140, 64, '#ffc93c');
    pill(`Valendo ${this.prize(Math.min(this.step, LADDER.length - 1))}`, 210, 196, { size: 18, bg: 'rgba(0,0,0,.6)', color: '#ffc93c' });
    label(`Recorde: ${this.best ? this.prize(this.best - 1) : '—'} · partida ${this.games}`, 210, 232, 15, 'rgba(255,255,255,.7)', 'center', 700);
    label(`✂️ ${this.s.fiftyMaxPerGame - this.fifty}   ⏭️ ${this.s.skipMaxPerGame - this.skips}`, 210, 262, 18, '#fff', 'center', 800);
    hudTimer(210, 340, 50, this.ph.name === 'q' ? this.ph.t : 0, this.ph.name === 'q' ? this.ph.total : 1, '#ffc93c');
    questionCard(this.q.q, 560, 200, { color: '#ffc93c', size: 36, tag: this.q.cat.toUpperCase() });
    const total = Math.max(1, this.votes.size);
    this.q.opts.forEach((o, i) => {
      const y = 790 + i * 92;
      let state = this.removed.has(i) ? 'dim' : 'normal';
      if (this.ph.name === 'suspense' && i === this.choice) state = 'normal';
      if (this.ph.name === 'reveal' || this.ph.name === 'over') state = i === this.q.correct ? 'correct' : 'wrong';
      const blink = this.ph.name === 'suspense' && i === this.choice && Math.sin(t * 16) > 0;
      answerTile(36, y, W - 72, 76, 'abcd'[i], o, { state, pct: this.counts[i] / total, color: blink ? '#ffc93c' : '#ff9d00' });
    });
    if (this.ph.name === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
      title(this.step >= LADDER.length ? 'MILIONÁRIOS!' : 'FIM DE JOGO', W / 2, H / 2 - 40, 64, this.step >= LADDER.length ? '#ffc93c' : '#ff3b5c');
      text(`A live chegou a ${this.step ? this.prize(this.step - 1) : 'R$ 0'}`, W / 2, H / 2 + 30, 30, '#fff');
      text(`Nova partida em ${Math.ceil(this.ph.t)}s`, W / 2, H / 2 + 80, 22, 'rgba(255,255,255,.8)');
    }
    label(`${this.votes.size} votos`, W / 2, 1172, 18, 'rgba(255,255,255,.75)', 'center', 700);
    const tick = lines(this.s.hintTicker);
    if (tick.length) pill(tick[Math.floor(t / 4) % tick.length], W / 2, 1218, { size: 18, bg: 'rgba(0,0,0,.6)', color: '#fff' });
    this.feed.draw(20, 300);
  },
});

// ---------------- Verdadeiro ou Falso ----------------
function tfAnswer(text) {
  const t = norm(text);
  if (/^(v|verdadeiro|verdade|t|true|sim|real)\b/.test(t)) return true;
  if (/^(f|falso|mentira|false|nao|fake)\b/.test(t)) return false;
  return null;
}
defineGame({
  id: 'true-or-false', name: 'Verdadeiro ou Falso', genre: 'trivia', icon: '✅', color: '#22c55e', voice: true,
  desc: 'O chat comenta V ou F para uma afirmação curiosa, e a resposta aparece com uma explicação curta. Presentes dão mais tempo ou pulam.',
  help: '<p>Comente <b>V</b> (verdadeiro) ou <b>F</b> (falso). Acertou, pontua; mais rápido vale mais e sequências de acertos dão bônus.</p><p>🎁 Presentes: <b>+tempo</b>, <b>pular</b> e <b>holofote</b> (a foto de quem mandou aparece grande).</p>',
  settings: [
    { key: 'category', type: 'select', label: 'Categoria', options: CAT_OPTIONS, default: 'all' },
    { key: 'difficulty', type: 'select', label: 'Dificuldade', options: [['mix', 'Aleatória (fácil, média e difícil misturadas)'], ['1', 'Fácil'], ['2', 'Média'], ['3', 'Difícil']], default: 'mix' },
    { key: 'statementSeconds', type: 'number', label: 'Segundos para responder', min: 5, max: 60, default: 14 },
    { key: 'revealSeconds', type: 'number', label: 'Segundos da explicação', min: 3, max: 15, default: 6 },
    { key: 'breakSeconds', type: 'number', label: 'Intervalo', min: 1, max: 10, default: 2 },
    { key: 'pointsPerCorrect', type: 'number', label: 'Pontos por acerto', min: 1, max: 1000, default: 100 },
    { key: 'speedBonus', type: 'toggle', label: 'Bônus de velocidade', default: true },
    { key: 'showLiveSplit', type: 'toggle', label: 'Mostrar a divisão dos votos ao vivo', default: true },
    { key: 'showVoters', type: 'toggle', label: 'Mostrar fotos de quem votou', default: true },
    { key: 'showStreaks', type: 'toggle', label: 'Mostrar sequências de acertos', default: true },
    { key: 'announcerVoice', type: 'toggle', label: 'Ler a afirmação e a explicação', default: true, group: 'Voz' },
    { key: 'customTF', type: 'textarea', label: 'Suas afirmações (uma por linha: afirmação | V ou F | explicação)', default: '', group: 'Perguntas' },
    { key: 'trueColor', type: 'color', label: 'Cor do verdadeiro', default: '#22c55e', group: 'Visual' },
    { key: 'falseColor', type: 'color', label: 'Cor do falso', default: '#ef4444', group: 'Visual' },
    ...MATCH_SETTINGS(10, 1000), ...BOARD_SETTINGS(5),
  ],
  actions: [{ id: 'extra_time', label: '+5 segundos', icon: '⏱️' }, { id: 'skip_statement', label: 'Pular', icon: '⏭️' }, { id: 'spotlight', label: 'Holofote', icon: '🔦' }],
  bindings: [{ action: 'extra_time', trigger: 'gift', minCoins: 1 }, { action: 'spotlight', trigger: 'gift', minCoins: 30 }, { action: 'skip_statement', trigger: 'gift', minCoins: 99 }],
  init() { loadData('truefalse').then((d) => { this.data = d; this.reset(); }); },
  reset() {
    this.rng = makeRng('tf');
    const own = lines(this.s.customTF).map((l) => l.split('|').map((x) => x.trim())).filter((p) => p.length >= 2).map((p) => ({ s: p[0], t: /^v/i.test(p[1]), e: p[2] || '', cat: 'Suas' }));
    const nivel = (q) => this.s.difficulty === 'mix' || !this.s.difficulty || String(q.d ?? 2) === String(this.s.difficulty);
    let base = this.data ? this.data.q.filter((q) => (this.s.category === 'all' || q.cat === this.s.category) && nivel(q)) : [];
    if (this.data && !base.length) base = this.data.q.filter(nivel);
    this.pool = this.data ? this.rng.shuffle([...own, ...base]) : [];
    this.idx = 0; this.round = 0;
    this.points = new Points(this.id); this.streak = new Map();
    this.feed = new Feed(3); this.ph = new Phases(); this.spot = null;
    if (this.pool.length) this.next();
  },
  sample() { return pick(['V', 'F', 'verdadeiro', 'falso', 'mentira']); },
  next() {
    this.q = this.pool[this.idx++ % this.pool.length];
    this.votes = new Map(); this.round++;
    this.ph.go('q', this.s.statementSeconds);
    if (this.s.announcerVoice) narrate(this, `Verdadeiro ou falso? ${this.q.s}`, { maxLen: 240 });
  },
  onChat(ev) {
    if (this.ph.name !== 'q') return;
    const a = tfAnswer(ev.text);
    if (a === null || this.votes.has(uid(ev))) return;
    this.votes.set(uid(ev), { a, user: ev.user, t: this.ph.t });
  },
  onAction(id, a) {
    if (id === 'extra_time' && this.ph.name === 'q') { this.ph.t += 5; this.ph.total += 5; this.feed.push(a.user, '⏱️ +5s', '#22e3ee'); }
    else if (id === 'skip_statement' && this.ph.name === 'q') { this.feed.push(a.user, '⏭️ pulou', '#ffc93c'); this.next(); }
    else if (id === 'spotlight') { this.spot = { user: a.user, t: 5 }; sfx.pop(); }
  },
  update(dt) {
    this.feed?.update(dt);
    if (this.spot && (this.spot.t -= dt) <= 0) this.spot = null;
    if (!this.q || !this.ph.update(dt)) return;
    if (this.ph.name === 'q') {
      this.winners = [];
      for (const [k, v] of this.votes) {
        if (v.a === this.q.t) {
          const st = (this.streak.get(k) || 0) + 1; this.streak.set(k, st);
          const bonus = (this.s.speedBonus ? Math.round(this.s.pointsPerCorrect * 0.5 * v.t / this.ph.total) : 0) + (st >= 3 ? Math.round(this.s.pointsPerCorrect * 0.2 * Math.min(st, 10)) : 0);
          this.points.add(v.user, this.s.pointsPerCorrect + bonus);
          this.winners.push(v.user);
        } else this.streak.set(k, 0);
      }
      sfx.confirm();
      if (this.s.announcerVoice) narrate(this, `${this.q.t ? 'Verdadeiro' : 'Falso'}! ${this.q.e}`, { maxLen: 240 });
      this.ph.go('reveal', this.s.revealSeconds);
    } else if (this.ph.name === 'reveal') {
      if (matchOver(this, this.round, this.points.best)) { const w = this.points.top(1)[0]; this.champ = w; if (w) { scores.add(this.id, w.user, 0, 1); confetti(150); sfx.win(); narrate(this, `${w.user.nick} venceu a partida!`); } this.ph.go('final', 8); }
      else this.ph.go('break', this.s.breakSeconds);
    } else if (this.ph.name === 'break') this.next();
    else if (this.ph.name === 'final') { this.points.clear(); this.round = 0; this.next(); }
  },
  draw() {
    if (!customBackground(this)) stageBg('teal');
    if (!this.q) { title('VERDADEIRO OU FALSO', W / 2, H / 2, 50); return; }
    if (this.ph.name === 'final') { title('FIM DA PARTIDA', W / 2, 120, 54, '#2dd4bf'); if (this.champ) winnerSpot(this.champ.user, 420, { sub: `${fmtNum(this.champ.value)} pontos` }); hudBoard(this.points.top(5), 90, 720, W - 180, { title: 'PÓDIO', unit: ' pts' }); return; }
    title('VERDADEIRO', W / 2 - 4, 64, 46, this.s.trueColor);
    title('OU FALSO?', W / 2 + 4, 110, 46, this.s.falseColor);
    hudTimer(W / 2, 200, 50, this.ph.name === 'q' ? this.ph.t : 0, this.ph.name === 'q' ? this.ph.total : 1, '#2dd4bf');
    const reveal = this.ph.name !== 'q';
    const cardCol = reveal ? (this.q.t ? this.s.trueColor : this.s.falseColor) : '#2dd4bf';
    questionCard(this.q.s, 280, 260, { color: cardCol, size: 40 });
    const vs = [...this.votes.values()];
    const nT = vs.filter((v) => v.a).length, nF = vs.length - nT, tot = Math.max(1, vs.length);
    // Dois botões grandes
    const bw = (W - 96) / 2;
    [[true, 36, 'V', 'VERDADEIRO', this.s.trueColor, nT], [false, 60 + bw, 'F', 'FALSO', this.s.falseColor, nF]].forEach(([val, x, l, name, col, n]) => {
      const win = reveal && this.q.t === val, lose = reveal && this.q.t !== val;
      ctx.save(); if (lose) ctx.globalAlpha = 0.35;
      panel(x, 570, bw, 200, { r: 28, from: shade(col, 10), to: shade(col, -70), border: win ? '#fff' : hexA(col, 0.9), glow: win ? col : null });
      title(l, x + bw / 2, 640, 80, '#fff');
      label(name, x + bw / 2, 712, 24, '#fff', 'center', 900);
      if (this.s.showLiveSplit || reveal) label(`${Math.round(n / tot * 100)}% · ${n}`, x + bw / 2, 748, 18, 'rgba(255,255,255,.85)', 'center', 800);
      ctx.restore();
      if (this.s.showVoters) vs.filter((v) => v.a === val).slice(0, 10).forEach((v, i) => avatar(v.user, x + 26 + (i % 5) * ((bw - 52) / 4), 800 + Math.floor(i / 5) * 46, 18, col));
    });
    if (reveal && this.q.e) { panel(40, 900, W - 80, 110, { r: 20, from: '#0f2a2a', to: '#081616', border: hexA(cardCol, 0.7) }); textBlock('💡 ' + this.q.e, W / 2, 955, W - 130, 24, { maxLines: 3, minSize: 16 }); }
    else label(`${vs.length} respostas · comente V ou F`, W / 2, 940, 20, 'rgba(255,255,255,.8)', 'center', 700);
    if (this.s.showLeaderboard) hudBoard(this.points.top(3), 120, 1030, W - 240, { title: 'RANKING', unit: ' pts', rowH: 34 });
    if (this.s.showStreaks) {
      const best = [...this.streak.entries()].sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] >= 3) { const u = vs.find((v) => uid({ user: v.user }) === best[0])?.user; pill(`🔥 sequência de ${best[1]}${u ? ' · @' + trim(u.nick, 12) : ''}`, W / 2, 1010 - (this.s.showLeaderboard ? 0 : -40), { size: 16, bg: 'rgba(0,0,0,.6)', color: '#ffc93c' }); }
    }
    if (this.spot) { ctx.globalAlpha = clamp(this.spot.t, 0, 1); avatar(this.spot.user, W - 100, 230, 64, '#ffc93c'); pill('🔦 ' + trim(this.spot.user.nick, 12), W - 100, 312, { size: 15, bg: 'rgba(0,0,0,.7)', color: '#ffc93c' }); ctx.globalAlpha = 1; }
    this.feed.draw(20, 170);
  },
});
