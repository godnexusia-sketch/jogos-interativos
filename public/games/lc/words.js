'use strict';

// Jogos de palavras pelo chat. As letras são comparadas sem acento (como nos jogos de palavras brasileiros).

const up = (s) => norm(s).replace(/ /g, '').toUpperCase();
// Substantivos do jogo (desenhos, temas e contexto): bons para palavras secretas.
async function nounList() {
  const [dr, as, cx] = await Promise.all([loadData('drawings'), loadData('assoc'), loadData('context')]);
  const set = new Set();
  for (const k of Object.keys(dr || {})) if (!k.includes(' ') && !k.includes('-')) set.add(k);
  for (const a of as || []) for (const w of a.w) if (!w.includes(' ') && !w.includes('-')) set.add(w);
  for (const c of cx || []) { set.add(c.w); for (const w of c.near.slice(0, 15)) if (!w.includes(' ') && !w.includes('-')) set.add(w); }
  return [...set];
}
// Teclado com o estado das letras (verde, amarelo, cinza).
function drawKeyboard(states, y, { keyW = 56, keyH = 58 } = {}) {
  const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  rows.forEach((r, ri) => {
    const x0 = W / 2 - (r.length * (keyW + 6) - 6) / 2;
    [...r].forEach((ch, i) => {
      const st = states[ch];
      const col = st === 'g' ? '#16a34a' : st === 'y' ? '#d4a017' : st === 'x' ? '#1f2433' : '#3b4560';
      ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x0 + i * (keyW + 6), y + ri * (keyH + 8), keyW, keyH, 10); ctx.fill();
      label(ch, x0 + i * (keyW + 6) + keyW / 2, y + ri * (keyH + 8) + keyH / 2 + 1, 24, st === 'x' ? 'rgba(255,255,255,.3)' : '#fff', 'center', 900);
    });
  });
}
function tile(x, y, s, ch, st, flip = 1) {
  const col = st === 'g' ? '#16a34a' : st === 'y' ? '#d4a017' : st === 'x' ? '#333a4d' : st === 'h' ? '#7c3aed' : 'rgba(255,255,255,.06)';
  ctx.save(); ctx.translate(x + s / 2, y + s / 2); ctx.scale(1, flip);
  ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.14); ctx.fill();
  if (!st || st === 'e') { ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; ctx.stroke(); }
  if (ch) label(ch, 0, 2, s * 0.56, '#fff', 'center', 900);
  ctx.restore();
}

// ---------------- 5 Letras ----------------
defineGame({
  id: 'five-letters', name: '5 Letras', genre: 'word', icon: '🟩', color: '#16a34a', voice: true,
  desc: 'O chat descobre junto uma palavra secreta de cinco letras. Cada chute acende as letras; quem acertar a palavra leva a rodada.',
  help: '<p>Comente uma <b>palavra de 5 letras</b>. 🟩 letra certa no lugar certo · 🟨 letra existe em outro lugar · ⬛ não tem.</p><p>Quem acerta a palavra ganha a rodada. 🎁 Presentes <b>revelam uma letra</b> ou <b>mostram uma letra que existe</b>; ❤️ likes <b>eliminam letras</b> do teclado.</p>',
  settings: [
    { key: 'roundSeconds', type: 'number', label: 'Segundos por rodada (0 = sem limite)', min: 0, max: 900, default: 180 },
    { key: 'breakSeconds', type: 'number', label: 'Intervalo', min: 2, max: 20, default: 6 },
    { key: 'autoHints', type: 'toggle', label: 'Dicas automáticas', default: true },
    { key: 'hintAfterSeconds', type: 'number', label: 'Uma dica a cada (segundos)', min: 10, max: 300, default: 45, showIf: { key: 'autoHints', value: true } },
    { key: 'maxRevealed', type: 'number', label: 'Máximo de letras reveladas por dica', min: 0, max: 4, default: 2 },
    { key: 'pointsPerGreen', type: 'number', label: 'Pontos por letra verde nova', min: 0, max: 100, default: 10 },
    { key: 'pointsPerGold', type: 'number', label: 'Pontos por letra amarela nova', min: 0, max: 100, default: 5 },
    { key: 'solveBonus', type: 'number', label: 'Bônus por acertar a palavra', min: 0, max: 1000, default: 100 },
    { key: 'capsInSentence', type: 'toggle', label: 'Aceitar palavra em MAIÚSCULAS no meio da frase', default: true },
    { key: 'customWords', type: 'textarea', label: 'Suas palavras de 5 letras (uma por linha)', default: '', group: 'Palavras' },
    NARRATE_SETTING(), ...MATCH_SETTINGS(10, 500), ...BOARD_SETTINGS(5),
  ],
  actions: [{ id: 'reveal_letter', label: 'Revelar letra', icon: '🔓' }, { id: 'find_letter', label: 'Mostrar letra que existe', icon: '🔍' }, { id: 'rule_out', label: 'Eliminar letras', icon: '🚫' }],
  bindings: [{ action: 'find_letter', trigger: 'gift', minCoins: 1 }, { action: 'reveal_letter', trigger: 'gift', minCoins: 30 }, { action: 'rule_out', trigger: 'like', likes: 50 }],
  init() { loadData('dict').then((d) => { this.dict = d; this.valid = new Set(d.five); this.reset(); }); },
  reset() {
    this.rng = makeRng('five');
    const own = lines(this.s.customWords).map(up).filter((w) => w.length === 5);
    this.pool = this.dict ? this.rng.shuffle(own.length ? own : this.dict.fiveAns.map(up).filter((w) => /^[A-Z]{5}$/.test(w))) : [];
    this.idx = 0; this.round = 0; this.points = new Points(this.id); this.ph = new Phases();
    if (this.pool.length) this.next();
  },
  sample() { return this.dict ? pick(this.dict.fiveAns) : 'mundo'; },
  next() {
    this.word = this.pool[this.idx++ % this.pool.length];
    this.rows = []; this.keys = {}; this.known = [null, null, null, null, null]; this.gold = new Set(); this.winner = null; this.hintT = 0; this.round++; this.tried = new Set();
    this.ph.go('play', this.s.roundSeconds || 99999);
  },
  score(guess) {
    const res = Array(5).fill('x'), left = {};
    for (let i = 0; i < 5; i++) if (guess[i] === this.word[i]) res[i] = 'g'; else left[this.word[i]] = (left[this.word[i]] || 0) + 1;
    for (let i = 0; i < 5; i++) if (res[i] !== 'g' && left[guess[i]]) { res[i] = 'y'; left[guess[i]]--; }
    return res;
  },
  onChat(ev) {
    if (this.ph.name !== 'play') return;
    let w = up(ev.text);
    if (w.length !== 5 && this.s.capsInSentence) { const m = String(ev.text).match(/\b[A-ZÀ-Ú]{5}\b/); if (m) w = up(m[0]); }
    if (!/^[A-Z]{5}$/.test(w) || this.tried.has(w)) return;
    if (!this.valid.has(w.toLowerCase()) && w !== this.word) return;
    this.tried.add(w);
    const res = this.score(w);
    let pts = 0;
    res.forEach((r, i) => {
      const ch = w[i];
      if (r === 'g') { if (!this.known[i]) { this.known[i] = ch; pts += this.s.pointsPerGreen; } this.keys[ch] = 'g'; }
      else if (r === 'y') { if (!this.gold.has(ch) && !this.known.includes(ch)) { this.gold.add(ch); pts += this.s.pointsPerGold; } if (this.keys[ch] !== 'g') this.keys[ch] = 'y'; }
      else if (!this.keys[ch]) this.keys[ch] = 'x';
    });
    this.rows.push({ w, res, user: ev.user, flip: 0 });
    if (this.rows.length > 6) this.rows.shift();
    if (pts) this.points.add(ev.user, pts);
    sfx.key();
    if (w === this.word) this.solve(ev.user);
  },
  solve(user) {
    this.winner = user;
    if (user) { this.points.add(user, this.s.solveBonus); scores.add(this.id, user, 0, 1); confetti(140); sfx.win(); narrate(this, `${user.nick} acertou! A palavra era ${this.word}.`); }
    else narrate(this, `A palavra era ${this.word}.`);
    this.ph.go('reveal', this.s.breakSeconds);
  },
  revealOne() { const i = this.known.findIndex((k, j) => !k && j >= 0); const free = [0, 1, 2, 3, 4].filter((j) => !this.known[j]); if (free.length > 1) { const j = free[Math.floor(this.rng() * free.length)]; this.known[j] = this.word[j]; this.keys[this.word[j]] = 'g'; } return i; },
  onAction(id, a) {
    if (this.ph.name !== 'play') return;
    if (id === 'reveal_letter') { this.revealOne(); this.flash = { user: a.user, msg: '🔓 revelou uma letra', t: 3 }; }
    else if (id === 'find_letter') { const c = [...this.word].find((ch) => !this.known.includes(ch) && !this.gold.has(ch)); if (c) { this.gold.add(c); if (this.keys[c] !== 'g') this.keys[c] = 'y'; this.flash = { user: a.user, msg: `🔍 tem a letra ${c}`, t: 3 }; } }
    else if (id === 'rule_out') { const pool = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter((c) => !this.word.includes(c) && !this.keys[c]); for (let i = 0; i < 3 && pool.length; i++) this.keys[pool.splice(Math.floor(this.rng() * pool.length), 1)[0]] = 'x'; }
  },
  update(dt) {
    for (const r of this.rows) r.flip = Math.min(1, r.flip + dt * 3);
    if (this.flash && (this.flash.t -= dt) <= 0) this.flash = null;
    if (this.ph.name === 'play' && this.s.autoHints) {
      this.hintT += dt;
      if (this.hintT >= this.s.hintAfterSeconds && this.known.filter(Boolean).length < Math.min(4, this.s.maxRevealed + this.round * 0)) { this.hintT = 0; this.revealOne(); }
    }
    if (!this.ph.update(dt)) return;
    if (this.ph.name === 'play') this.solve(null);
    else if (this.ph.name === 'reveal') {
      if (matchOver(this, this.round, this.points.best)) { this.champ = this.points.top(1)[0]; this.ph.go('final', 8); if (this.champ) { confetti(150); sfx.win(); } }
      else this.next();
    } else if (this.ph.name === 'final') { this.points.clear(); this.round = 0; this.next(); }
  },
  draw() {
    if (!customBackground(this)) stageBg('green');
    if (this.ph.name === 'final') { title('FIM DA PARTIDA', W / 2, 120, 54, '#34d399'); if (this.champ) winnerSpot(this.champ.user, 420, { sub: `${fmtNum(this.champ.value)} pontos` }); hudBoard(this.points.top(5), 90, 720, W - 180, { title: 'PÓDIO', unit: ' pts' }); return; }
    if (!this.word) return;
    title('5 LETRAS', W / 2, 58, 50);
    pill(`RODADA ${this.round} · comente uma palavra de 5 letras`, W / 2, 102, { size: 15, bg: 'rgba(0,0,0,.5)', color: '#34d399' });
    if (this.s.roundSeconds && this.ph.name === 'play') hudTimer(W - 66, 66, 40, this.ph.t, this.ph.total, '#34d399');
    // Linha das letras descobertas
    const s = 92, x0 = W / 2 - (5 * (s + 10) - 10) / 2;
    for (let i = 0; i < 5; i++) tile(x0 + i * (s + 10), 140, s, this.ph.name === 'reveal' ? this.word[i] : this.known[i] || '', this.ph.name === 'reveal' || this.known[i] ? 'g' : 'e');
    // Últimos chutes
    const rs = 62, rx = W / 2 - (5 * (rs + 8) - 8) / 2 + 40;
    this.rows.forEach((r, j) => {
      const y = 270 + j * (rs + 10);
      avatar(r.user, rx - 46, y + rs / 2, 24, '#fff');
      for (let i = 0; i < 5; i++) tile(rx + i * (rs + 8), y, rs, r.w[i], r.flip > i * 0.15 ? r.res[i] : 'e', Math.abs(Math.cos(clamp(r.flip * 2 - i * 0.3, 0, 1) * Math.PI)));
    });
    drawKeyboard(this.keys, 730);
    if (this.flash) toast(this.flash.user, this.flash.msg, W / 2, 940, { align: 'center', color: '#ffc93c' });
    if (this.ph.name === 'reveal') { if (this.winner) winnerSpot(this.winner, 560, { r: 70, title: 'ACERTOU!', sub: this.word }); else title(`ERA ${this.word}`, W / 2, 680, 60, '#ffc93c'); }
    if (this.s.showLeaderboard) hudBoard(this.points.top(this.s.leaderboardSize), 120, 990, W - 240, { title: 'RANKING', unit: ' pts', n: 3, rowH: 34 });
  },
});

// ---------------- Descubra a Palavra (Find the Word) ----------------
defineGame({
  id: 'find-the-word', name: 'Descubra a Palavra', genre: 'word', icon: '🔠', color: '#0ea5e9',
  desc: 'Cada chute que acerta mais letras do começo da palavra secreta revela essas letras em verde para todos. Quem completar a palavra vence.',
  help: '<p>Comente palavras. Se o começo da sua palavra bater com o começo da palavra secreta, as letras certas <b>aparecem em verde</b> e você ganha pontos por letra. Quem completar a palavra vence a rodada.</p><p>🎁 Presente <b>revela uma letra</b>.</p>',
  settings: [
    { key: 'roundSeconds', type: 'number', label: 'Segundos por rodada', min: 20, max: 600, default: 120 },
    { key: 'breakSeconds', type: 'number', label: 'Intervalo', min: 2, max: 20, default: 5 },
    { key: 'basePointsPerLetter', type: 'number', label: 'Pontos por letra revelada', min: 1, max: 100, default: 10 },
    { key: 'fullMatchBonus', type: 'number', label: 'Bônus por completar', min: 0, max: 1000, default: 100 },
    { key: 'showLength', type: 'toggle', label: 'Mostrar o número de letras', default: true },
    { key: 'customWords', type: 'textarea', label: 'Suas palavras (uma por linha)', default: '', group: 'Palavras' },
    NARRATE_SETTING(), ...MATCH_SETTINGS(10, 500), ...BOARD_SETTINGS(5),
  ],
  actions: [{ id: 'reveal_letter', label: 'Revelar letra', icon: '🔓' }],
  bindings: [{ action: 'reveal_letter', trigger: 'gift', minCoins: 5 }],
  init() { nounList().then((l) => { this.nouns = l; this.reset(); }); },
  reset() {
    this.rng = makeRng('find');
    const own = lines(this.s.customWords).map(up).filter((w) => w.length >= 3);
    this.pool = this.rng.shuffle(own.length ? own : (this.nouns || []).map(up).filter((w) => w.length >= 4 && w.length <= 10));
    this.idx = 0; this.round = 0; this.points = new Points(this.id); this.ph = new Phases(); this.feed = new Feed(5);
    if (this.pool.length) this.next();
  },
  sample() { return this.word ? (Math.random() < 0.5 ? this.word.slice(0, randInt(1, this.word.length)) + pick(['a', 'o', 'e', '']) : pick(['casa', 'carro', 'bola', 'mesa', 'gato'])) : 'casa'; },
  next() { this.word = this.pool[this.idx++ % this.pool.length]; this.shown = 0; this.round++; this.winner = null; this.ph.go('play', this.s.roundSeconds); },
  onChat(ev) {
    if (this.ph.name !== 'play') return;
    const g = up(ev.text);
    if (g.length < 2) return;
    if (g === this.word) { this.points.add(ev.user, (this.word.length - this.shown) * this.s.basePointsPerLetter + this.s.fullMatchBonus); this.shown = this.word.length; return this.win(ev.user); }
    let n = 0;
    while (n < g.length && n < this.word.length && g[n] === this.word[n]) n++;
    if (n > this.shown) { this.points.add(ev.user, (n - this.shown) * this.s.basePointsPerLetter); this.feed.push(ev.user, `+${n - this.shown} letra${n - this.shown > 1 ? 's' : ''}`, '#7cff6b'); this.shown = Math.min(n, this.word.length - 1); sfx.pop(); }
  },
  win(user) {
    this.winner = user;
    if (user) { scores.add(this.id, user, 0, 1); confetti(130); sfx.win(); narrate(this, `${user.nick} descobriu: ${this.word}!`); }
    this.ph.go('reveal', this.s.breakSeconds);
  },
  onAction(id, a) { if (id === 'reveal_letter' && this.ph.name === 'play' && this.shown < this.word.length - 1) { this.shown++; this.feed.push(a.user, '🔓 revelou uma letra', '#ffc93c'); } },
  update(dt) {
    this.feed?.update(dt);
    if (!this.ph.update(dt)) return;
    if (this.ph.name === 'play') this.win(null);
    else if (this.ph.name === 'reveal') { if (matchOver(this, this.round, this.points.best)) { this.champ = this.points.top(1)[0]; this.ph.go('final', 8); } else this.next(); }
    else { this.points.clear(); this.round = 0; this.next(); }
  },
  draw() {
    if (!customBackground(this)) stageBg('blue');
    if (this.ph.name === 'final') { title('FIM DA PARTIDA', W / 2, 120, 54, '#22e3ee'); if (this.champ) winnerSpot(this.champ.user, 420, { sub: `${fmtNum(this.champ.value)} pontos` }); hudBoard(this.points.top(5), 90, 720, W - 180, { title: 'PÓDIO', unit: ' pts' }); return; }
    if (!this.word) return;
    title('DESCUBRA A PALAVRA', W / 2, 62, 44);
    hudTimer(W / 2, 170, 48, this.ph.name === 'play' ? this.ph.t : 0, this.ph.name === 'play' ? this.ph.total : 1);
    const n = this.word.length, s = Math.min(76, (W - 60) / n - 8), x0 = W / 2 - (n * (s + 8) - 8) / 2;
    for (let i = 0; i < n; i++) {
      const open = i < this.shown || this.ph.name === 'reveal';
      if (!open && !this.s.showLength && i >= this.shown + 1) continue;
      tile(x0 + i * (s + 8), 290, s, open ? this.word[i] : '', open ? 'g' : 'e');
    }
    if (this.s.showLength) label(`${n} letras`, W / 2, 290 + s + 30, 20, 'rgba(255,255,255,.75)', 'center', 700);
    label('comente palavras: o começo certo aparece em verde', W / 2, 460, 19, '#fff', 'center', 700);
    if (this.ph.name === 'reveal' && this.winner) winnerSpot(this.winner, 660, { r: 70, title: 'DESCOBRIU!', sub: this.word });
    this.feed.draw(60, 540);
    if (this.s.showLeaderboard) hudBoard(this.points.top(this.s.leaderboardSize), 120, 900, W - 240, { title: 'RANKING', unit: ' pts' });
  },
});

// ---------------- Associação de Palavras ----------------
defineGame({
  id: 'word-association', name: 'Associação de Palavras', genre: 'word', icon: '🧩', color: '#ec4899',
  desc: 'Cada rodada mostra um tema e espaços escondidos para palavras ligadas a ele. Quem digitar primeiro uma palavra preenche o espaço e pontua.',
  help: '<p>Veja o tema e comente <b>palavras ligadas a ele</b>. Quem acerta primeiro preenche o espaço com a sua foto. Acertos seguidos fazem <b>combo</b>.</p><p>Letras vão aparecendo com o tempo. 🎁 Presente <b>revela letras</b>.</p>',
  settings: [
    { key: 'roundSeconds', type: 'number', label: 'Segundos por rodada', min: 20, max: 300, default: 90 },
    { key: 'breakSeconds', type: 'number', label: 'Intervalo', min: 2, max: 20, default: 6 },
    { key: 'pointsPerCorrect', type: 'number', label: 'Pontos por palavra', min: 1, max: 500, default: 50 },
    { key: 'comboEnabled', type: 'toggle', label: 'Combo para acertos seguidos', default: true },
    { key: 'dripRevealEnabled', type: 'toggle', label: 'Revelar letras com o tempo', default: true },
    { key: 'giftRevealLetters', type: 'number', label: 'Letras reveladas por presente', min: 1, max: 5, default: 2 },
    { key: 'customSets', type: 'textarea', label: 'Seus temas (uma linha: tema | palavra, palavra, palavra...)', default: '', group: 'Palavras' },
    ...MATCH_SETTINGS(8, 500), ...BOARD_SETTINGS(5),
  ],
  actions: [{ id: 'reveal_letter', label: 'Revelar letras', icon: '🔓' }],
  bindings: [{ action: 'reveal_letter', trigger: 'gift', minCoins: 1 }],
  init() { loadData('assoc').then((d) => { this.data = d; this.reset(); }); },
  reset() {
    this.rng = makeRng('assoc');
    const own = lines(this.s.customSets).map((l) => l.split('|')).filter((p) => p.length >= 2).map((p) => ({ p: p[0].trim(), w: p[1].split(',').map((x) => x.trim()).filter(Boolean) }));
    this.pool = this.rng.shuffle([...own, ...(this.data || [])]);
    this.idx = 0; this.round = 0; this.points = new Points(this.id); this.ph = new Phases(); this.feed = new Feed(4); this.lastUser = null; this.combo = 0;
    if (this.pool.length) this.next();
  },
  sample() { const q = this.q; return q && Math.random() < 0.5 ? pick(q.w) : pick(['sol', 'bola', 'casa', 'água']); },
  next() {
    this.q = this.pool[this.idx++ % this.pool.length];
    this.slots = this.q.w.slice(0, 8).map((w) => ({ w: up(w), raw: w, by: null, rev: new Set([0]) }));
    this.round++; this.ph.go('play', this.s.roundSeconds); this.dripT = 0;
  },
  onChat(ev) {
    if (this.ph.name !== 'play') return;
    const g = up(ev.text);
    const s = this.slots.find((x) => !x.by && (x.w === g || (x.w.length >= 6 && lev(x.w, g) <= 1)));
    if (!s) return;
    s.by = ev.user;
    const k = uid(ev);
    this.combo = this.lastUser === k ? this.combo + 1 : 1; this.lastUser = k;
    const pts = this.s.pointsPerCorrect * (this.s.comboEnabled ? Math.min(this.combo, 5) : 1);
    this.points.add(ev.user, pts);
    this.feed.push(ev.user, `${s.raw.toUpperCase()} +${pts}${this.combo > 1 && this.s.comboEnabled ? ` 🔥x${this.combo}` : ''}`, '#7cff6b');
    sfx.confirm();
    if (this.slots.every((x) => x.by)) this.end();
  },
  end() { const mvp = this.points.top(1)[0]; this.ph.go('reveal', this.s.breakSeconds); if (mvp) narrate(this, `Rodada encerrada! Destaque para ${mvp.user.nick}.`); },
  revealSome(n) { for (let i = 0; i < n; i++) { const open = this.slots.filter((x) => !x.by && x.rev.size < x.w.length - 1); if (!open.length) return; const s = open[Math.floor(this.rng() * open.length)]; const idx = [...Array(s.w.length).keys()].filter((j) => !s.rev.has(j)); s.rev.add(idx[Math.floor(this.rng() * idx.length)]); } },
  onAction(id, a) { if (id === 'reveal_letter' && this.ph.name === 'play') { this.revealSome(this.s.giftRevealLetters); this.feed.push(a.user, '🔓 revelou letras', '#ffc93c'); } },
  update(dt) {
    this.feed?.update(dt);
    if (this.ph.name === 'play' && this.s.dripRevealEnabled) { this.dripT += dt; if (this.dripT > 10) { this.dripT = 0; this.revealSome(1); } }
    if (!this.ph.update(dt)) return;
    if (this.ph.name === 'play') this.end();
    else if (this.ph.name === 'reveal') { if (matchOver(this, this.round, this.points.best)) { this.champ = this.points.top(1)[0]; this.ph.go('final', 8); } else this.next(); }
    else { this.points.clear(); this.round = 0; this.next(); }
  },
  draw() {
    if (!customBackground(this)) stageBg('pink');
    if (this.ph.name === 'final') { title('FIM DA PARTIDA', W / 2, 120, 54, '#ff6bd6'); if (this.champ) winnerSpot(this.champ.user, 420, { sub: `${fmtNum(this.champ.value)} pontos` }); hudBoard(this.points.top(5), 90, 720, W - 180, { title: 'PÓDIO', unit: ' pts' }); return; }
    if (!this.q) return;
    title('ASSOCIAÇÃO', W / 2, 56, 46);
    hudTimer(W - 66, 66, 40, this.ph.name === 'play' ? this.ph.t : 0, this.ph.name === 'play' ? this.ph.total : 1, '#ff6bd6');
    panel(80, 110, W - 160, 110, { r: 26, from: '#5b1650', to: '#2a0a25', border: 'rgba(255,107,214,.8)', glow: 'rgba(255,107,214,.35)' });
    label('TEMA', W / 2, 136, 16, '#ff6bd6', 'center', 900);
    title(this.q.p.toUpperCase(), W / 2, 182, 46, '#fff');
    const reveal = this.ph.name === 'reveal';
    this.slots.forEach((s, i) => {
      const col = i % 2, row = Math.floor(i / 2), x = 30 + col * ((W - 72) / 2 + 12), y = 250 + row * 104, w = (W - 72) / 2;
      panel(x, y, w, 90, { r: 18, from: s.by ? '#1f6f3a' : '#251a3d', to: s.by ? '#0d3a1d' : '#120c22', border: s.by ? '#86efac' : 'rgba(255,255,255,.18)' });
      const word = s.by || reveal ? s.raw.toUpperCase() : [...s.w].map((c, j) => (s.rev.has(j) ? c : '_')).join(' ');
      label(trim(word, 18), x + (s.by ? 64 : w / 2), y + 46, s.by || reveal ? 24 : 22, s.by ? '#fff' : reveal ? '#ffc93c' : 'rgba(255,255,255,.85)', s.by ? 'left' : 'center', 900);
      if (s.by) avatar(s.by, x + 34, y + 45, 24, '#86efac');
    });
    this.feed.draw(40, 690);
    if (this.s.showLeaderboard) hudBoard(this.points.top(this.s.leaderboardSize), 120, 900, W - 240, { title: 'RANKING', unit: ' pts' });
  },
});

// ---------------- Contexto ----------------
defineGame({
  id: 'context', name: 'Contexto', genre: 'word', icon: '🎯', color: '#f59e0b',
  desc: 'O chat digita qualquer palavra e vê o quanto o significado dela está perto da palavra secreta. Presentes revelam palavras mais próximas.',
  help: '<p>Comente qualquer palavra. Cada palavra ganha uma <b>posição</b>: 1 é a palavra secreta, números pequenos estão perto (🟩), médios mais ou menos (🟨) e grandes longe (🟥).</p><p>🎁 Presentes revelam uma <b>palavra mais perto</b> ou dão <b>dicas</b>.</p>',
  settings: [
    { key: 'autoHints', type: 'toggle', label: 'Dicas automáticas', default: true },
    { key: 'autoHintSeconds', type: 'number', label: 'Uma dica a cada (segundos)', min: 15, max: 300, default: 60, showIf: { key: 'autoHints', value: true } },
    { key: 'closeBand', type: 'number', label: 'Até qual posição é "perto"', min: 5, max: 100, default: 15 },
    { key: 'mediumBand', type: 'number', label: 'Até qual posição é "médio"', min: 20, max: 500, default: 40 },
    { key: 'finderPoints', type: 'number', label: 'Pontos para quem acertar', min: 10, max: 1000, default: 200 },
    { key: 'breakSeconds', type: 'number', label: 'Intervalo', min: 3, max: 20, default: 8 },
    NARRATE_SETTING(), ...MATCH_SETTINGS(5, 1000), ...BOARD_SETTINGS(5),
  ],
  actions: [{ id: 'reveal_closer', label: 'Revelar palavra mais perto', icon: '🎯' }, { id: 'big_hint', label: 'Dica grande', icon: '💡' }, { id: 'small_hint', label: 'Dica pequena', icon: '🔎' }],
  bindings: [{ action: 'small_hint', trigger: 'gift', minCoins: 1 }, { action: 'reveal_closer', trigger: 'gift', minCoins: 30 }, { action: 'big_hint', trigger: 'gift', minCoins: 99 }],
  init() { loadData('context').then((d) => { this.data = d; this.reset(); }); },
  reset() { this.rng = makeRng('ctx'); this.pool = this.rng.shuffle(this.data || []); this.idx = 0; this.round = 0; this.points = new Points(this.id); this.ph = new Phases(); if (this.pool.length) this.next(); },
  sample() { const c = this.cur; return c && Math.random() < 0.5 ? pick(c.near) : pick(['casa', 'amor', 'tempo', 'mundo', 'vida', 'água', 'festa', 'sol']); },
  next() { this.cur = this.pool[this.idx++ % this.pool.length]; this.near = this.cur.near.map(up); this.secret = up(this.cur.w); this.guesses = new Map(); this.last = null; this.winner = null; this.hintT = 0; this.round++; this.ph.go('play', 99999); },
  rank(w) {
    if (w === this.secret) return 1;
    const i = this.near.indexOf(w);
    if (i >= 0) return i + 2;
    const j = this.near.findIndex((n) => n.length >= 5 && (w.startsWith(n.slice(0, 5)) || n.startsWith(w.slice(0, Math.max(5, w.length - 1)))));
    if (j >= 0) return j + 3;
    return 100 + (hashStr(this.secret + w) % 4900);
  },
  add(w, user, hint = false) {
    if (this.guesses.has(w)) return;
    const r = this.rank(w);
    this.guesses.set(w, { w, r, user, hint });
    this.last = { w, r, user };
    if (r === 1) this.win(user);
  },
  onChat(ev) { if (this.ph.name !== 'play') return; const w = up(ev.text); if (w.length < 2 || w.length > 16 || String(ev.text).trim().includes(' ')) return; this.add(w, ev.user); },
  win(user) { this.winner = user; if (user) { this.points.add(user, this.s.finderPoints); scores.add(this.id, user, 0, 1); confetti(160); sfx.win(); narrate(this, `${user.nick} achou a palavra secreta: ${this.cur.w}!`); } this.ph.go('reveal', this.s.breakSeconds); },
  hint(level, user) {
    const best = Math.min(...[...this.guesses.values()].map((g) => g.r), 999);
    const target = level === 'big' ? Math.max(2, Math.floor(Math.min(best, this.near.length + 2) / 3)) : level === 'closer' ? Math.max(2, Math.min(best - 1, this.near.length + 1)) : Math.max(2, Math.min(best - 1, this.near.length + 1, 30));
    const w = this.near[clamp(target - 2, 0, this.near.length - 1)];
    if (w && !this.guesses.has(w)) this.add(w, user || { nick: 'dica', id: 'hint' }, true);
  },
  onAction(id, a) { if (this.ph.name !== 'play') return; this.hint(id === 'big_hint' ? 'big' : id === 'reveal_closer' ? 'closer' : 'small', a.user); },
  update(dt) {
    if (this.ph.name === 'play' && this.s.autoHints) { this.hintT += dt; if (this.hintT >= this.s.autoHintSeconds) { this.hintT = 0; this.hint('small', null); } }
    if (!this.ph.update(dt)) return;
    if (this.ph.name === 'reveal') { if (matchOver(this, this.round, this.points.best)) { this.champ = this.points.top(1)[0]; this.ph.go('final', 8); } else this.next(); }
    else if (this.ph.name === 'final') { this.points.clear(); this.round = 0; this.next(); }
  },
  bandColor(r) { return r === 1 ? '#22e3ee' : r <= this.s.closeBand ? '#16a34a' : r <= this.s.mediumBand ? '#d4a017' : '#dc2626'; },
  row(g, y, hl = false) {
    const pct = clamp(1 - Math.log(g.r) / Math.log(5000), 0.04, 1);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.roundRect(40, y, W - 80, 48, 12); ctx.fill();
    ctx.fillStyle = hexA(this.bandColor(g.r), 0.85); ctx.beginPath(); ctx.roundRect(40, y, (W - 80) * pct, 48, 12); ctx.fill();
    if (hl) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(40, y, W - 80, 48, 12); ctx.stroke(); }
    if (g.user && g.user.id !== 'hint') avatar(g.user, 66, y + 24, 16, '#fff'); else label('💡', 66, y + 25, 20, '#fff', 'center', 400);
    label(g.w, 92, y + 25, 22, '#fff', 'left', 900);
    label(String(g.r), W - 56, y + 25, 22, '#fff', 'right', 900, F_NUM);
  },
  draw() {
    if (!customBackground(this)) stageBg('gold');
    if (this.ph.name === 'final') { title('FIM DA PARTIDA', W / 2, 120, 54, '#ffc93c'); if (this.champ) winnerSpot(this.champ.user, 420, { sub: `${fmtNum(this.champ.value)} pontos` }); hudBoard(this.points.top(5), 90, 720, W - 180, { title: 'PÓDIO', unit: ' pts' }); return; }
    if (!this.cur) return;
    title('CONTEXTO', W / 2, 60, 52, '#ffc93c');
    pill(`${this.guesses.size} palavras · rodada ${this.round}`, W / 2, 104, { size: 15, bg: 'rgba(0,0,0,.5)', color: '#ffc93c' });
    if (this.last) { label('ÚLTIMA', W / 2, 150, 15, 'rgba(255,255,255,.7)', 'center', 900); this.row(this.last, 166, true); }
    const sorted = [...this.guesses.values()].sort((a, b) => a.r - b.r).slice(0, 13);
    label('MAIS PERTO', W / 2, 250, 15, 'rgba(255,255,255,.7)', 'center', 900);
    sorted.forEach((g, i) => this.row(g, 266 + i * 56));
    if (this.ph.name === 'reveal') { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H); if (this.winner) winnerSpot(this.winner, 500, { title: 'ACHOU!', sub: this.cur.w.toUpperCase() }); }
    if (this.s.showLeaderboard && this.ph.name === 'play') hudBoard(this.points.top(3), 120, 1010, W - 240, { title: 'RANKING', unit: ' pts', rowH: 34, n: 3 });
  },
});

// ---------------- Gerador de palavras cruzadas (Palavras Cruzadas e Roda de Letras) ----------------
// Palavras curtas comuns no dicionário mas estranhas num quadro (siglas, interjeições, nomes).
const CROSS_SKIP = new Set(['OHH', 'AHN', 'HUM', 'UAU', 'OLA', 'TCHAU', 'NAO', 'SIM', 'OPA', 'ETC', 'NUNO', 'ONO', 'EIS', 'AHA', 'OXI', 'UHU', 'EHH', 'PFF', 'SRA', 'SRS', 'DRA']);
function letterCount(w) { const m = {}; for (const c of w) m[c] = (m[c] || 0) + 1; return m; }
function canMake(w, rack) { const m = { ...rack }; for (const c of w) { if (!m[c]) return false; m[c]--; } return true; }
function makeCrossPuzzle(words, rng) {
  const bases = rng.shuffle(words.filter((w) => w.length >= 6 && w.length <= 7));
  for (const base of bases.slice(0, 60)) {
    const rack = letterCount(base);
    const subs = [...new Set(words.filter((w) => w.length >= 3 && w.length <= base.length && canMake(w, rack)))];
    if (subs.length < 6) continue;
    const pick6 = [base, ...rng.shuffle(subs.filter((w) => w !== base)).sort((a, b) => b.length - a.length)].slice(0, 14);
    const grid = layoutCross(pick6, rng);
    if (grid.placed.length >= 5) return { base, letters: rng.shuffle([...base]), ...grid };
  }
  return null;
}
// Coloca as palavras cruzando umas com as outras (horizontal e vertical).
function layoutCross(words, rng) {
  const cells = new Map(), placed = [];
  const key = (x, y) => x + ',' + y;
  const fits = (w, x, y, dir) => {
    let cross = 0;
    for (let i = 0; i < w.length; i++) {
      const cx = x + (dir ? 0 : i), cy = y + (dir ? i : 0), c = cells.get(key(cx, cy));
      if (c && c !== w[i]) return -1;
      if (c) cross++;
      else {
        // Não encostar em letras vizinhas de lado
        const n1 = dir ? key(cx - 1, cy) : key(cx, cy - 1), n2 = dir ? key(cx + 1, cy) : key(cx, cy + 1);
        if (cells.has(n1) || cells.has(n2)) return -1;
      }
    }
    const before = dir ? key(x, y - 1) : key(x - 1, y), after = dir ? key(x, y + w.length) : key(x + w.length, y);
    if (cells.has(before) || cells.has(after)) return -1;
    return cross;
  };
  const put = (w, x, y, dir) => { for (let i = 0; i < w.length; i++) cells.set(key(x + (dir ? 0 : i), y + (dir ? i : 0)), w[i]); placed.push({ w, x, y, dir }); };
  put(words[0], 0, 0, 0);
  for (const w of words.slice(1)) {
    if (placed.length >= 8) break;
    let best = null;
    for (const p of placed) for (let i = 0; i < p.w.length; i++) for (let j = 0; j < w.length; j++) {
      if (p.w[i] !== w[j]) continue;
      const dir = p.dir ? 0 : 1;
      const x = p.dir ? p.x - j : p.x + i, y = p.dir ? p.y + i : p.y - j;
      const c = fits(w, x, y, dir);
      if (c > 0 && (!best || c > best.c || (c === best.c && rng() < 0.3))) best = { x, y, dir, c };
    }
    if (best) put(w, best.x, best.y, best.dir);
  }
  const xs = [...cells.keys()].map((k) => Number(k.split(',')[0])), ys = [...cells.keys()].map((k) => Number(k.split(',')[1]));
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return { placed: placed.map((p) => ({ ...p, x: p.x - minX, y: p.y - minY })), cols: Math.max(...xs) - minX + 1, rows: Math.max(...ys) - minY + 1 };
}
function crossGame(id, name, icon, color, style) {
  return defineGame({
    id, name, genre: 'word', icon, color,
    desc: style === 'wheel' ? 'Uma roda de letras e um quadro de palavras que se cruzam. Todas usam as mesmas letras; o chat digita as palavras.' : 'Um conjunto de letras e um quadro de palavras cruzadas. Achar uma palavra dá pista das outras.',
    help: '<p>Forme palavras com as <b>letras da roda</b> e comente no chat. Cada palavra encontrada aparece no quadro com a sua foto. Complete o quadro para passar de fase.</p><p>💬 Comente <b>embaralhar</b> para misturar as letras. 🎁 Presentes revelam <b>letras</b> ou <b>palavras</b>.</p>',
    settings: [
      { key: 'puzzlesPerMatch', type: 'number', label: 'Quadros por partida', min: 1, max: 30, default: 5 },
      { key: 'puzzleSeconds', type: 'number', label: 'Segundos por quadro', min: 30, max: 900, default: 240 },
      { key: 'breakSeconds', type: 'number', label: 'Intervalo', min: 2, max: 20, default: 5 },
      { key: 'shuffleCooldownSeconds', type: 'number', label: 'Espera entre embaralhadas (s)', min: 0, max: 60, default: 8 },
      { key: 'creditWords', type: 'toggle', label: 'Mostrar quem achou cada palavra', default: true },
      { key: 'extraWords', type: 'toggle', label: 'Palavras extras (fora do quadro) valem pontos', default: true },
      ...BOARD_SETTINGS(5),
    ],
    actions: [{ id: 'hint', label: 'Revelar letra', icon: '🔓' }, { id: 'reveal_word', label: 'Revelar palavra', icon: '📖' }, { id: 'shuffle', label: 'Embaralhar', icon: '🔀' }],
    bindings: [{ action: 'shuffle', trigger: 'comment', text: 'embaralhar,mistura,shuffle' }, { action: 'hint', trigger: 'gift', minCoins: 1 }, { action: 'reveal_word', trigger: 'gift', minCoins: 99 }],
    init() { loadData('dict').then((d) => { this.words = [...new Set(d.common.slice(0, 4000).map(up).filter((w) => /^[A-Z]{3,7}$/.test(w) && !CROSS_SKIP.has(w)))]; this.reset(); }); },
    reset() { this.rng = makeRng(id); this.points = new Points(this.id); this.ph = new Phases(); this.count = 0; this.feed = new Feed(4); if (this.words) this.next(); },
    sample() { const p = this.pz; return p && Math.random() < 0.6 ? pick(p.placed).w.toLowerCase() : 'embaralhar'; },
    next() {
      if (this.count >= this.s.puzzlesPerMatch) { this.champ = this.points.top(1)[0]; if (this.champ) { scores.add(this.id, this.champ.user, 0, 1); confetti(160); sfx.win(); } this.count = 0; this.ph.go('final', 8); return; }
      this.pz = makeCrossPuzzle(this.words, this.rng);
      if (!this.pz) return;
      this.found = new Map(); this.revealed = new Set(); this.extra = new Set(); this.count++; this.lastShuffle = -99;
      this.subs = new Set(this.words.filter((w) => w.length >= 3 && canMake(w, letterCount(this.pz.base))));
      this.ph.go('play', this.s.puzzleSeconds);
    },
    onChat(ev) {
      if (this.ph.name !== 'play' || !this.pz) return;
      const w = up(ev.text);
      const p = this.pz.placed.find((x) => x.w === w);
      if (p && !this.found.has(w)) {
        this.found.set(w, ev.user); this.points.add(ev.user, w.length * 10); sfx.confirm();
        this.feed.push(ev.user, `${w} +${w.length * 10}`, '#7cff6b');
        if (this.found.size === this.pz.placed.length) { this.ph.go('done', this.s.breakSeconds); sfx.win(); confetti(80); }
      } else if (!p && this.s.extraWords && this.subs.has(w) && !this.extra.has(w)) { this.extra.add(w); this.points.add(ev.user, w.length * 3); this.feed.push(ev.user, `${w} (extra) +${w.length * 3}`, '#22e3ee'); }
    },
    onAction(aid, a) {
      if (this.ph.name !== 'play' || !this.pz) return;
      if (aid === 'shuffle') { const now = performance.now() / 1000; if (now - this.lastShuffle >= this.s.shuffleCooldownSeconds) { this.lastShuffle = now; this.pz.letters = this.rng.shuffle(this.pz.letters); sfx.pop(); } }
      else if (aid === 'hint') { const left = this.pz.placed.filter((p) => !this.found.has(p.w)); if (!left.length) return; const p = left[Math.floor(this.rng() * left.length)]; for (let i = 0; i < p.w.length; i++) { const k = (p.x + (p.dir ? 0 : i)) + ',' + (p.y + (p.dir ? i : 0)); if (!this.revealed.has(k)) { this.revealed.add(k); break; } } this.feed.push(a.user, '🔓 revelou uma letra', '#ffc93c'); }
      else if (aid === 'reveal_word') { const p = this.pz.placed.find((x) => !this.found.has(x.w)); if (p) { this.found.set(p.w, a.user); this.feed.push(a.user, `📖 revelou ${p.w}`, '#ffc93c'); if (this.found.size === this.pz.placed.length) this.ph.go('done', this.s.breakSeconds); } }
    },
    update(dt) {
      this.feed?.update(dt);
      if (!this.ph.update(dt)) return;
      if (this.ph.name === 'play') this.ph.go('done', this.s.breakSeconds);
      else if (this.ph.name === 'done') this.next();
      else if (this.ph.name === 'final') { this.points.clear(); this.next(); }
    },
    draw() {
      if (!customBackground(this)) stageBg(style === 'wheel' ? 'night' : 'blue');
      if (this.ph.name === 'final') { title('FIM DA PARTIDA', W / 2, 120, 54, color); if (this.champ) winnerSpot(this.champ.user, 420, { sub: `${fmtNum(this.champ.value)} pontos` }); hudBoard(this.points.top(5), 90, 720, W - 180, { title: 'PÓDIO', unit: ' pts' }); return; }
      if (!this.pz) return;
      title(name.toUpperCase(), W / 2, 54, 42);
      pill(`QUADRO ${this.count}/${this.s.puzzlesPerMatch} · ${this.found.size}/${this.pz.placed.length} palavras`, W / 2, 94, { size: 15, bg: 'rgba(0,0,0,.5)', color });
      if (this.ph.name === 'play') hudTimer(W - 60, 60, 36, this.ph.t, this.ph.total, color);
      // Quadro
      const maxW = W - 60, maxH = style === 'wheel' ? 520 : 600;
      const cs = Math.min(64, maxW / this.pz.cols, maxH / this.pz.rows);
      const ox = W / 2 - (this.pz.cols * cs) / 2, oy = 130 + (maxH - this.pz.rows * cs) / 2;
      const done = this.ph.name === 'done';
      for (const p of this.pz.placed) {
        const by = this.found.get(p.w);
        for (let i = 0; i < p.w.length; i++) {
          const cx = p.x + (p.dir ? 0 : i), cy = p.y + (p.dir ? i : 0);
          const show = by || done || this.revealed.has(cx + ',' + cy) || [...this.found.keys()].some((fw) => { const q = this.pz.placed.find((z) => z.w === fw); for (let k = 0; k < q.w.length; k++) if (q.x + (q.dir ? 0 : k) === cx && q.y + (q.dir ? k : 0) === cy) return true; return false; });
          tile(ox + cx * cs + 2, oy + cy * cs + 2, cs - 4, show ? p.w[i] : '', show ? (by ? 'g' : done ? 'x' : 'h') : 'e');
        }
        if (by && this.s.creditWords) avatar(by, ox + (p.x - (p.dir ? 0 : 0.5)) * cs + (p.dir ? cs / 2 : 0), oy + (p.y - (p.dir ? 0.5 : 0)) * cs + (p.dir ? 0 : cs / 2), cs * 0.28, '#fff');
      }
      // Letras
      const L = this.pz.letters;
      if (style === 'wheel') {
        const cy = 900, R = 150;
        ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.arc(W / 2, cy, R + 50, 0, 7); ctx.fill();
        ctx.strokeStyle = hexA(color, 0.6); ctx.lineWidth = 3; ctx.stroke();
        L.forEach((c, i) => { const a = -Math.PI / 2 + (i / L.length) * Math.PI * 2; const x = W / 2 + Math.cos(a) * R, y = cy + Math.sin(a) * R; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 40, 0, 7); ctx.fill(); label(c, x, y + 2, 38, '#fff', 'center', 900); });
        label('🔀', W / 2, cy + 2, 40, '#fff', 'center', 400);
      } else {
        const s = 70, x0 = W / 2 - (L.length * (s + 8) - 8) / 2;
        L.forEach((c, i) => tile(x0 + i * (s + 8), 780, s, c, 'h'));
        label('💬 embaralhar para misturar as letras', W / 2, 880, 18, 'rgba(255,255,255,.8)', 'center', 700);
      }
      this.feed.draw(20, style === 'wheel' ? 640 : 920);
      if (this.s.showLeaderboard) hudBoard(this.points.top(3), W - 290, style === 'wheel' ? 1080 : 1010, 260, { title: 'RANKING', unit: ' pts', rowH: 30, n: 3 });
      if (done) title(this.found.size === this.pz.placed.length ? 'QUADRO COMPLETO!' : 'TEMPO ESGOTADO', W / 2, H / 2 - 120, 52, '#ffc93c');
    },
  });
}
crossGame('word-cross', 'Palavras Cruzadas', '✏️', '#3b82f6', 'grid');
crossGame('word-swipe', 'Roda de Letras', '🎡', '#8b5cf6', 'wheel');

// ---------------- Caça-Palavras (Word Hunt) ----------------
defineGame({
  id: 'word-hunt', name: 'Caça-Palavras', genre: 'word', icon: '🔍', color: '#14b8a6',
  desc: 'Uma grade de letras esconde várias palavras. O chat digita a palavra ou só aponta um quadrado tipo C7: apontar qualquer letra de uma palavra escondida revela ela inteira.',
  help: '<p>Ache as palavras escondidas e comente a <b>palavra</b>, ou só a <b>coordenada</b> de uma letra dela (ex.: <b>C7</b>). A palavra aparece com a sua foto.</p><p>🎁 Presentes revelam uma <b>palavra</b> ou trocam o <b>quadro</b>.</p>',
  settings: [
    { key: 'boardSize', type: 'select', label: 'Tamanho da grade', options: [['10', '10 × 10'], ['12', '12 × 12'], ['14', '14 × 14']], default: '12' },
    { key: 'wordCount', type: 'number', label: 'Palavras escondidas', min: 5, max: 25, default: 14 },
    { key: 'allowDiagonal', type: 'toggle', label: 'Palavras na diagonal', default: true },
    { key: 'allowBackwards', type: 'toggle', label: 'Palavras de trás para frente', default: false },
    { key: 'boardSeconds', type: 'number', label: 'Segundos por quadro', min: 60, max: 1200, default: 300 },
    { key: 'secondsBetweenBoards', type: 'number', label: 'Intervalo', min: 2, max: 30, default: 6 },
    { key: 'showHints', type: 'toggle', label: 'Mostrar a lista de palavras', default: true },
    { key: 'customWords', type: 'textarea', label: 'Suas palavras (uma por linha)', default: '', group: 'Palavras' },
    { key: 'boardColor', type: 'color', label: 'Cor da grade', default: '#0f2a33', group: 'Visual' },
    ...BOARD_SETTINGS(5),
  ],
  actions: [{ id: 'reveal_word', label: 'Revelar palavra', icon: '📖' }, { id: 'new_board', label: 'Novo quadro', icon: '🔄' }],
  bindings: [{ action: 'reveal_word', trigger: 'gift', minCoins: 10 }],
  init() { nounList().then((l) => { this.nouns = l; this.reset(); }); },
  reset() { this.rng = makeRng('hunt'); this.points = new Points(this.id); this.ph = new Phases(); this.feed = new Feed(4); this.boards = 0; if (this.nouns) this.next(); },
  sample() { const p = this.placed; if (p && Math.random() < 0.6) { const w = pick(p); return Math.random() < 0.5 ? w.w.toLowerCase() : 'ABCDEFGHIJKLMN'[w.cells[0][1]] + (w.cells[0][0] + 1); } return 'B3'; },
  next() {
    const n = Number(this.s.boardSize);
    const own = lines(this.s.customWords).map(up).filter((w) => w.length >= 3 && w.length <= n);
    const cand = this.rng.shuffle(own.length ? own : this.nouns.map(up).filter((w) => w.length >= 3 && w.length <= n && /^[A-Z]+$/.test(w)));
    const grid = Array.from({ length: n }, () => Array(n).fill(''));
    const dirs = [[1, 0], [0, 1]];
    if (this.s.allowDiagonal) dirs.push([1, 1], [1, -1]);
    if (this.s.allowBackwards) dirs.push(...dirs.map(([a, b]) => [-a, -b]));
    this.placed = [];
    for (const w of cand) {
      if (this.placed.length >= this.s.wordCount) break;
      for (let t = 0; t < 60; t++) {
        const [dx, dy] = dirs[Math.floor(this.rng() * dirs.length)];
        const x = Math.floor(this.rng() * n), y = Math.floor(this.rng() * n);
        const cells = [];
        let ok = true;
        for (let i = 0; i < w.length; i++) { const cx = x + dx * i, cy = y + dy * i; if (cx < 0 || cy < 0 || cx >= n || cy >= n || (grid[cy][cx] && grid[cy][cx] !== w[i])) { ok = false; break; } cells.push([cx, cy]); }
        if (!ok) continue;
        cells.forEach(([cx, cy], i) => (grid[cy][cx] = w[i]));
        this.placed.push({ w, cells, by: null });
        break;
      }
    }
    const AL = 'AAAEEEIIOOUUBCDFGLMNPRSTV';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!grid[y][x]) grid[y][x] = AL[Math.floor(this.rng() * AL.length)];
    this.grid = grid; this.n = n; this.boards++;
    this.ph.go('play', this.s.boardSeconds);
  },
  claim(p, user) { if (p.by) return; p.by = user; this.points.add(user, p.w.length * 10); this.feed.push(user, `${p.w} +${p.w.length * 10}`, '#7cff6b'); sfx.confirm(); if (this.placed.every((x) => x.by)) { this.ph.go('done', this.s.secondsBetweenBoards); sfx.win(); confetti(90); } },
  onChat(ev) {
    if (this.ph.name !== 'play') return;
    const t = up(ev.text);
    const m = t.match(/^([A-N])(\d{1,2})$/) || t.match(/^(\d{1,2})([A-N])$/);
    if (m) {
      const col = /\d/.test(m[1]) ? m[2] : m[1], row = Number(/\d/.test(m[1]) ? m[1] : m[2]) - 1;
      const cx = 'ABCDEFGHIJKLMN'.indexOf(col);
      const p = this.placed.find((x) => !x.by && x.cells.some(([a, b]) => a === cx && b === row));
      if (p) this.claim(p, ev.user);
      return;
    }
    const p = this.placed.find((x) => !x.by && x.w === t);
    if (p) this.claim(p, ev.user);
  },
  onAction(id, a) {
    if (this.ph.name !== 'play') return;
    if (id === 'reveal_word') { const p = this.placed.find((x) => !x.by); if (p) this.claim(p, a.user); }
    else if (id === 'new_board') this.next();
  },
  update(dt) { this.feed?.update(dt); if (!this.ph.update(dt)) return; if (this.ph.name === 'play') this.ph.go('done', this.s.secondsBetweenBoards); else this.next(); },
  draw() {
    if (!customBackground(this)) stageBg('teal');
    if (!this.grid) return;
    title('CAÇA-PALAVRAS', W / 2, 52, 42);
    pill(`${this.placed.filter((p) => p.by).length}/${this.placed.length} achadas · comente a palavra ou a casa (C7)`, W / 2, 92, { size: 14, bg: 'rgba(0,0,0,.5)', color: '#2dd4bf' });
    if (this.ph.name === 'play') hudTimer(W - 56, 56, 34, this.ph.t, this.ph.total, '#2dd4bf');
    const n = this.n, cs = Math.min(46, (W - 70) / n), ox = W / 2 - (n * cs) / 2 + 12, oy = 130;
    ctx.fillStyle = this.s.boardColor; ctx.beginPath(); ctx.roundRect(ox - 34, oy - 30, n * cs + 46, n * cs + 42, 18); ctx.fill();
    for (let i = 0; i < n; i++) { label('ABCDEFGHIJKLMN'[i], ox + i * cs + cs / 2, oy - 14, 14, '#2dd4bf', 'center', 900); label(String(i + 1), ox - 18, oy + i * cs + cs / 2, 14, '#2dd4bf', 'center', 900); }
    const done = this.ph.name === 'done';
    for (const p of this.placed) if (p.by || done) {
      const [a, b] = p.cells[0], [c, d] = p.cells[p.cells.length - 1];
      ctx.strokeStyle = p.by ? hexA(colorFor(p.by.nick), 0.55) : 'rgba(255,255,255,.25)'; ctx.lineWidth = cs * 0.78; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ox + a * cs + cs / 2, oy + b * cs + cs / 2); ctx.lineTo(ox + c * cs + cs / 2, oy + d * cs + cs / 2); ctx.stroke();
    }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) label(this.grid[y][x], ox + x * cs + cs / 2, oy + y * cs + cs / 2 + 1, cs * 0.58, '#fff', 'center', 800);
    for (const p of this.placed) if (p.by) avatar(p.by, ox + p.cells[0][0] * cs + cs / 2, oy + p.cells[0][1] * cs + cs / 2, cs * 0.32, '#fff');
    if (this.s.showHints) {
      const y0 = oy + n * cs + 30;
      this.placed.forEach((p, i) => { const col = i % 3, row = Math.floor(i / 3); label(p.w, 70 + col * 200, y0 + row * 30, 18, p.by ? 'rgba(255,255,255,.35)' : '#fff', 'left', 800); if (p.by) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(70 + col * 200, y0 + row * 30, p.w.length * 12, 2); } });
    }
    this.feed.draw(20, 1000);
    if (this.s.showLeaderboard) hudBoard(this.points.top(3), W - 290, 1000, 260, { title: 'RANKING', unit: ' pts', rowH: 30, n: 3 });
  },
});
