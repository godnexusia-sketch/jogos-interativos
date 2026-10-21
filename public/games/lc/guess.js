'use strict';

// Jogos de adivinhar pelo chat: Bandeira, Logo, Desenho (estilo Imagem e Ação automático) e Onde Fica (foto + globo 3D).

// Rodada genérica de "adivinhe": quem acerta entra na faixa de vencedores e pontua por ordem.
function guessRoundSettings(defSecs = 25) {
  return [
    { key: 'roundSeconds', type: 'number', label: 'Segundos por rodada', min: 5, max: 120, default: defSecs },
    { key: 'revealSeconds', type: 'number', label: 'Segundos mostrando a resposta', min: 2, max: 15, default: 4 },
    { key: 'breakSeconds', type: 'number', label: 'Intervalo', min: 1, max: 15, default: 2 },
    { key: 'pointsPerCorrect', type: 'number', label: 'Pontos por acerto', min: 1, max: 1000, default: 100 },
    { key: 'winnerBonus', type: 'number', label: 'Bônus para o primeiro', min: 0, max: 1000, default: 50 },
    { key: 'guessCapEnabled', type: 'toggle', label: 'Limitar chutes por pessoa', default: false },
    { key: 'guessesPerUser', type: 'number', label: 'Chutes por pessoa', min: 1, max: 50, default: 5, showIf: { key: 'guessCapEnabled', value: true } },
    { key: 'showRoundLeaderboard', type: 'toggle', label: 'Mostrar quem acertou na rodada', default: true },
    NARRATE_SETTING(), ...MATCH_SETTINGS(15, 1000), ...BOARD_SETTINGS(5),
  ];
}
// Base comum: fases, acertos, dicas e placar. Cada jogo dá nextItem(), answers(item) e drawItem().
const GuessBase = {
  reset() {
    this.rng = makeRng(this.id);
    this.points = new Points(this.id); this.ph = new Phases(); this.round = 0; this.feed = new Feed(3);
    this.ready = this.prepare ? this.prepare() : true;
    if (this.ready) this.next();
  },
  next() {
    this.item = this.nextItem();
    if (!this.item) return;
    this.right = []; this.tries = new Map(); this.hints = 0; this.round++;
    this.ph.go('play', this.roundSecs ? this.roundSecs() : this.s.roundSeconds);
    this.onItem?.();
  },
  onChat(ev) {
    if (this.ph.name !== 'play' || !this.item) return;
    const k = uid(ev);
    if (this.right.some((r) => uid({ user: r.user }) === k)) return;
    if (this.s.guessCapEnabled) { const n = (this.tries.get(k) || 0) + 1; this.tries.set(k, n); if (n > this.s.guessesPerUser) return; }
    if (!answerMatch(ev.text, this.answers(this.item))) return this.onWrong?.(ev);
    const first = !this.right.length;
    const pts = this.s.pointsPerCorrect + (first ? this.s.winnerBonus : 0) - Math.min(this.right.length * 5, this.s.pointsPerCorrect / 2);
    this.right.push({ user: ev.user, pts });
    this.points.add(ev.user, Math.round(pts));
    if (first) { sfx.confirm(); burst(W / 2, 500, ['#7cff6b', '#fff'], 40, 400); }
    else sfx.pop();
    if (this.endOnFirst?.()) this.endRound();
  },
  endRound() {
    if (this.ph.name !== 'play') return;
    narrate(this, this.right.length ? `É ${this.label(this.item)}! ${this.right.length} acertaram, ${this.right[0].user.nick} primeiro.` : `Era ${this.label(this.item)}.`);
    this.ph.go('reveal', this.s.revealSeconds);
  },
  update(dt) {
    this.feed?.update(dt);
    this.tick?.(dt);
    if (!this.item || !this.ph.update(dt)) return;
    if (this.ph.name === 'play') this.endRound();
    else if (this.ph.name === 'reveal') {
      if (matchOver(this, this.round, this.points.best)) { this.champ = this.points.top(1)[0]; if (this.champ) { scores.add(this.id, this.champ.user, 0, 1); confetti(150); sfx.win(); narrate(this, `${this.champ.user.nick} venceu a partida!`); } this.ph.go('final', 8); }
      else this.ph.go('break', this.s.breakSeconds);
    } else if (this.ph.name === 'break') this.next();
    else if (this.ph.name === 'final') { this.points.clear(); this.round = 0; this.next(); }
  },
  drawFinal(color) { title('FIM DA PARTIDA', W / 2, 120, 54, color); if (this.champ) winnerSpot(this.champ.user, 420, { sub: `${fmtNum(this.champ.value)} pontos` }); hudBoard(this.points.top(5), 90, 720, W - 180, { title: 'PÓDIO', unit: ' pts' }); },
  drawCommon(color, yWin = 960) {
    if (this.ph.name === 'play') hudTimer(W - 64, 64, 40, this.ph.t, this.ph.total, color);
    if (this.s.showRoundLeaderboard && this.right.length) hudWinners(this.right.map((r) => r.user), yWin, { title: this.ph.name === 'play' ? 'JÁ ACERTARAM' : 'ACERTARAM' });
    if (this.s.showLeaderboard) hudBoard(this.points.top(3), 120, yWin + 100, W - 240, { title: 'RANKING', unit: ' pts', rowH: 30, n: 3 });
    this.feed.draw(20, 160);
  },
  // Dica: mostra letras do nome (primeira, depois mais algumas)
  hintText(name) {
    const n = norm(name).toUpperCase();
    let shown = 0;
    return [...n].map((c, i) => (c === ' ' ? '  ' : i === 0 || (this.hints > 1 && (i * 7 + this.round) % (6 - Math.min(this.hints, 4)) === 0) ? (shown++, c) : '_')).join(' ');
  },
};

// ---------------- Adivinhe a Bandeira ----------------
defineGame(Object.assign({
  id: 'guess-the-flag', name: 'Adivinhe a Bandeira', genre: 'trivia', icon: '🏳️', color: '#0ea5e9',
  desc: 'Cada rodada mostra a bandeira de um país e o chat digita o nome. Todo mundo que acerta entra na faixa de vencedores e pontua.',
  help: '<p>Comente o <b>nome do país</b> da bandeira. Vale em português ou inglês, sem acento. Todos que acertam pontuam; o primeiro ganha bônus.</p><p>🎁 Presente revela uma <b>dica</b> (letras do nome).</p>',
  settings: [
    { key: 'region', type: 'select', label: 'Países', options: [['easy', 'Mais conhecidos'], ['all', 'Todos'], ['Américas', 'Américas'], ['Europa', 'Europa'], ['África', 'África'], ['Ásia', 'Ásia'], ['Oceania', 'Oceania']], default: 'easy' },
    ...guessRoundSettings(20),
  ],
  actions: [{ id: 'reveal_hint', label: 'Dica', icon: '💡' }],
  bindings: [{ action: 'reveal_hint', trigger: 'gift', minCoins: 1 }],
  init() { loadData('countries').then((d) => { this.data = d; this.reset(); }); },
  prepare() { if (!this.data) return false; const r = this.s.region; this.pool = this.rng.shuffle(this.data.filter((c) => r === 'all' || (r === 'easy' ? c.easy : c.cont === r))); this.idx = 0; return true; },
  nextItem() { return this.pool?.[this.idx++ % this.pool.length]; },
  answers: (c) => [c.name, ...c.alt],
  label: (c) => c.name,
  sample() { return this.item && Math.random() < 0.4 ? this.item.name : pick(['brasil', 'argentina', 'japão', 'frança', 'itália']); },
  onItem() { getImg(flagUrl(this.item.code, 640)); },
  onAction(id, a) { if (id === 'reveal_hint' && this.ph.name === 'play') { this.hints++; this.feed.push(a.user, '💡 dica', '#ffc93c'); } },
  draw() {
    if (!customBackground(this)) stageBg('blue');
    if (this.ph.name === 'final') return this.drawFinal('#22e3ee');
    if (!this.item) return;
    title('ADIVINHE A BANDEIRA', W / 2, 62, 44);
    pill(`RODADA ${this.round} · comente o nome do país`, W / 2, 106, { size: 15, bg: 'rgba(0,0,0,.5)', color: '#22e3ee' });
    const img = getImg(flagUrl(this.item.code, 640));
    const bw = 560, bh = img ? bw * img.height / img.width : 370, by = 200 + (380 - Math.min(bh, 380)) / 2;
    const t = performance.now() / 1000;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
    if (img) {
      // Bandeira tremulando: fatias verticais com ondulação
      const h2 = Math.min(bh, 380), w2 = h2 === bh ? bw : 380 * img.width / img.height, x0 = W / 2 - w2 / 2;
      const N = 60; for (let i = 0; i < N; i++) { const sx = img.width * i / N, dx = x0 + w2 * i / N, off = Math.sin(t * 3 + i * 0.25) * 8 * (i / N); ctx.drawImage(img, sx, 0, img.width / N, img.height, dx, by + off, w2 / N + 2, h2); }
    }
    ctx.restore();
    if (this.ph.name === 'play' && this.hints) pill(this.hintText(this.item.name), W / 2, 640, { size: 24, bg: 'rgba(0,0,0,.65)', color: '#ffc93c' });
    if (this.ph.name !== 'play') { title(this.item.name.toUpperCase(), W / 2, 660, 52, '#7cff6b'); label(`Capital: ${this.item.cap} · ${this.item.cont}`, W / 2, 710, 20, 'rgba(255,255,255,.8)', 'center', 700); }
    this.drawCommon('#22e3ee', 800);
  },
}, GuessBase));

// ---------------- Adivinhe o Logo ----------------
defineGame(Object.assign({
  id: 'guess-the-logo', name: 'Adivinhe o Logo', genre: 'trivia', icon: '🏷️', color: '#f43f5e',
  desc: 'O chat digita o nome da marca enquanto o logo vai ficando nítido. Presentes revelam dica; quem acerta entra no círculo de vencedores.',
  help: '<p>O logo começa <b>borrado</b> (ou pixelado, ou de pertinho) e vai aparecendo. Comente o <b>nome da marca</b>.</p><p>🎁 Presente dá <b>dica</b>. Coloque marcas suas nas configurações (nome | site).</p>',
  settings: [
    { key: 'difficulty', type: 'select', label: 'Dificuldade', options: [['all', 'Todas'], ['1', 'Fácil'], ['2', 'Média'], ['3', 'Difícil']], default: 'all' },
    { key: 'obscureMode', type: 'select', label: 'Como esconder', options: [['blur', 'Borrado'], ['pixel', 'Pixelado'], ['zoom', 'Zoom'], ['mix', 'Misturado']], default: 'mix' },
    { key: 'customLogos', type: 'textarea', label: 'Suas marcas (uma por linha: nome | site.com | apelidos separados por vírgula)', default: '', group: 'Marcas' },
    ...guessRoundSettings(20),
    { key: 'themeColor', type: 'color', label: 'Cor do tema', default: '#f43f5e', group: 'Visual' },
  ],
  actions: [{ id: 'reveal_hint', label: 'Dica', icon: '💡' }],
  bindings: [{ action: 'reveal_hint', trigger: 'gift', minCoins: 1 }],
  init() { loadData('logos').then((d) => { this.data = d; this.reset(); }); },
  prepare() {
    if (!this.data) return false;
    const own = lines(this.s.customLogos).map((l) => l.split('|').map((x) => x.trim())).filter((p) => p.length >= 2).map((p) => ({ name: p[0], domain: p[1], alt: (p[2] || '').split(',').map((x) => x.trim()).filter(Boolean), d: 2 }));
    this.pool = this.rng.shuffle([...own, ...this.data.filter((l) => this.s.difficulty === 'all' || String(l.d) === this.s.difficulty)]); this.idx = 0; return true;
  },
  nextItem() { const it = this.pool[this.idx++ % this.pool.length]; it.mode = this.s.obscureMode === 'mix' ? ['blur', 'pixel', 'zoom'][this.round % 3] : this.s.obscureMode; return it; },
  answers: (l) => [l.name, ...l.alt],
  label: (l) => l.name,
  logoUrl: (l) => `/api/img?u=${encodeURIComponent(`https://www.google.com/s2/favicons?domain=${l.domain}&sz=256`)}`,
  sample() { return this.item && Math.random() < 0.4 ? this.item.name : pick(['google', 'nike', 'netflix', 'apple']); },
  onItem() { getImg(this.logoUrl(this.item)); },
  onAction(id, a) { if (id === 'reveal_hint' && this.ph.name === 'play') { this.hints++; this.feed.push(a.user, '💡 dica', '#ffc93c'); } },
  draw() {
    const col = this.s.themeColor;
    if (!customBackground(this)) stageBg('red');
    if (this.ph.name === 'final') return this.drawFinal(col);
    if (!this.item) return;
    title('ADIVINHE O LOGO', W / 2, 62, 46);
    pill(`RODADA ${this.round} · comente o nome da marca`, W / 2, 106, { size: 15, bg: 'rgba(0,0,0,.5)', color: col });
    const img = getImg(this.logoUrl(this.item));
    const S = 380, x = W / 2 - S / 2, y = 190;
    panel(x - 30, y - 30, S + 60, S + 60, { r: 40, from: '#ffffff', to: '#e5e7eb', border: hexA(col, 0.8), glow: hexA(col, 0.4) });
    if (img) {
      const p = this.ph.name === 'play' ? clamp(this.ph.pct + this.hints * 0.12, 0, 1) : 1;
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, S, S, 24); ctx.clip();
      ctx.imageSmoothingEnabled = this.item.mode !== 'pixel';
      if (this.item.mode === 'blur') { ctx.filter = `blur(${Math.round((1 - p) * 28)}px)`; ctx.drawImage(img, x, y, S, S); }
      else if (this.item.mode === 'pixel') {
        const n = Math.max(4, Math.round(4 + p * p * 60));
        const c = (this._pc = this._pc || document.createElement('canvas')); c.width = c.height = n;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.clearRect(0, 0, n, n); g.drawImage(img, 0, 0, n, n);
        ctx.drawImage(c, x, y, S, S);
      } else { const z = 1 + (1 - p) * 5, cx = 0.3 + (hashStr(this.item.name) % 40) / 100; ctx.drawImage(img, img.width * cx - img.width / z / 2, img.height * cx - img.height / z / 2, img.width / z, img.height / z, x, y, S, S); }
      ctx.restore();
    } else label('carregando…', W / 2, y + S / 2, 22, '#555', 'center', 700);
    if (this.ph.name === 'play' && this.hints) pill(this.hintText(this.item.name), W / 2, 650, { size: 24, bg: 'rgba(0,0,0,.65)', color: '#ffc93c' });
    if (this.ph.name !== 'play') title(this.item.name.toUpperCase(), W / 2, 660, 54, '#7cff6b');
    this.drawCommon(col, 760);
  },
}, GuessBase));

// ---------------- Adivinhe o Desenho ----------------
defineGame(Object.assign({
  id: 'guess-the-drawing', name: 'Adivinhe o Desenho', genre: 'party', icon: '🎨', color: '#f59e0b',
  desc: 'Um Imagem e Ação automático: o desenho aparece traço por traço e o chat corre para adivinhar. Quem acerta aparece sem estragar a resposta.',
  help: '<p>O desenho vai sendo feito na tela. Comente <b>o que é</b>. Quem acerta mais rápido ganha mais pontos, e a resposta só aparece no fim.</p><p>🎁 Presente revela uma <b>letra</b>. No modo <b>Eu desenho</b>, você desenha com o mouse na tela do painel e a palavra secreta aparece só para você.</p>',
  settings: [
    { key: 'controlMode', type: 'select', label: 'Quem desenha', options: [['auto', 'Desenhos automáticos'], ['host', 'Eu desenho com o mouse']], default: 'auto' },
    { key: 'drawSeconds', type: 'slider', label: 'Segundos desenhando', min: 5, max: 40, default: 14 },
    { key: 'showWordLength', type: 'toggle', label: 'Mostrar o número de letras', default: true },
    { key: 'showFirstLetter', type: 'toggle', label: 'Mostrar a primeira letra', default: false },
    { key: 'progressiveHint', type: 'toggle', label: 'Revelar letras com o tempo', default: true },
    { key: 'customWords', type: 'textarea', label: 'Palavras para o modo Eu desenho (uma por linha)', default: 'casa\nsol\ngato\nbola\nárvore\ncarro\npeixe\nflor', group: 'Palavras' },
    ...guessRoundSettings(35),
    { key: 'accentColor', type: 'color', label: 'Cor do tema', default: '#f59e0b', group: 'Visual' },
  ],
  actions: [{ id: 'reveal_letter', label: 'Revelar letra', icon: '🔓' }],
  bindings: [{ action: 'reveal_letter', trigger: 'gift', minCoins: 1 }],
  init() { loadData('drawings').then((d) => { this.data = d; this.reset(); }); },
  prepare() { if (!this.data) return false; this.pool = this.rng.shuffle(Object.keys(this.data)); this.hostWords = this.rng.shuffle(lines(this.s.customWords)); this.idx = 0; this.answersAlias = { 'cachorro': ['cao', 'dog', 'cachorrinho'], 'violão': ['guitarra', 'violao'], 'carro': ['automovel', 'carrinho'], 'casa': ['casinha'], 'gato': ['gatinho'], 'bicicleta': ['bike'], 'notebook': ['computador', 'laptop'], 'xícara': ['caneca', 'copo'], 'barco': ['veleiro', 'navio'] }; return true; },
  nextItem() {
    if (this.s.controlMode === 'host') { const w = this.hostWords[this.idx++ % Math.max(1, this.hostWords.length)] || 'casa'; this.strokes = []; return { w }; }
    const w = this.pool[this.idx++ % this.pool.length];
    const d = this.data[w][Math.floor(this.rng() * this.data[w].length)];
    return { w, d };
  },
  answers(it) { return [it.w, ...(this.answersAlias?.[it.w] || [])]; },
  label: (it) => it.w,
  sample() { return this.item && Math.random() < 0.3 ? this.item.w : pick(['casa', 'gato', 'sol', 'carro', 'peixe']); },
  onItem() { this.strokes = []; },
  onAction(id, a) { if (id === 'reveal_letter' && this.ph.name === 'play') { this.hints++; this.feed.push(a.user, '🔓 revelou letra', '#ffc93c'); } },
  // Modo Eu desenho: o painel manda os traços para as telas
  onPointer(p) { if (this.s.controlMode !== 'host' || isClean || !pointer.down || this.ph.name !== 'play') return; const s = this.strokes[this.strokes.length - 1]; if (s && performance.now() - (this._lastPt || 0) < 400) s.push([p.x, p.y]); else this.strokes.push([[p.x, p.y]]); this._lastPt = performance.now(); busSend({ t: 'host', cmd: 'pt', x: p.x, y: p.y, n: this.strokes.length }); },
  onPress(p) { if (p && this.s.controlMode === 'host' && !isClean) { this.strokes.push([[p.x, p.y]]); this._lastPt = performance.now(); busSend({ t: 'host', cmd: 'pt', x: p.x, y: p.y, n: this.strokes.length, start: true }); } },
  onHostCmd(b) { if (b.cmd !== 'pt') return; if (b.start || this.strokes.length < b.n) this.strokes.push([]); this.strokes[this.strokes.length - 1].push([b.x, b.y]); },
  draw() {
    const col = this.s.accentColor;
    if (!customBackground(this)) stageBg('gold');
    if (this.ph.name === 'final') return this.drawFinal(col);
    if (!this.item) return;
    title('ADIVINHE O DESENHO', W / 2, 60, 44);
    // Folha de papel
    const px = 50, py = 130, pw = W - 100, ph = 600;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 24; ctx.fillStyle = '#fbf7ee'; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 18); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(80,120,200,.15)'; ctx.lineWidth = 1; for (let y = py + 40; y < py + ph; y += 40) { ctx.beginPath(); ctx.moveTo(px + 10, y); ctx.lineTo(px + pw - 10, y); ctx.stroke(); }
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (this.item.d) {
      // Desenho do Quick, Draw! (coordenadas 0–255), animado ponto a ponto
      const total = this.item.d.reduce((n, s) => n + s[0].length, 0);
      const done = this.ph.name === 'play' ? Math.floor(clamp((this.ph.total - this.ph.t) / this.s.drawSeconds, 0, 1) * total) : total;
      const sc = Math.min(pw - 80, ph - 80) / 256, ox = px + (pw - 256 * sc) / 2, oy = py + (ph - 256 * sc) / 2;
      let n = 0;
      for (const [xs, ys] of this.item.d) {
        if (n >= done) break;
        ctx.beginPath();
        for (let i = 0; i < xs.length && n < done; i++, n++) { const X = ox + xs[i] * sc, Y = oy + ys[i] * sc; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
        ctx.stroke();
      }
      if (this.ph.name === 'play' && done < total) { label('✏️', ox + 128 * sc, py + ph - 30, 28, '#000', 'center', 400); }
    } else {
      for (const s of this.strokes || []) { ctx.beginPath(); s.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
      if (!isClean && this.ph.name === 'play') pill(`Só você vê: desenhe "${this.item.w}"`, W / 2, py + 26, { size: 16, bg: '#111', color: '#ffc93c' });
    }
    // Dica de letras
    const w = norm(this.item.w).toUpperCase();
    const elapsed = this.ph.name === 'play' ? 1 - this.ph.t / this.ph.total : 1;
    const auto = this.s.progressiveHint ? Math.floor(Math.max(0, elapsed - 0.45) * w.length * 0.9) : 0;
    const showN = this.hints + auto + (this.s.showFirstLetter ? 1 : 0);
    if (this.ph.name === 'play') {
      if (this.s.showWordLength || showN) pill([...w].map((c, i) => (c === ' ' ? ' ' : i < showN || (i * 5) % w.length < showN - 1 ? c : '_')).join(' ') + (this.s.showWordLength ? `   (${w.replace(/ /g, '').length})` : ''), W / 2, 770, { size: 26, bg: 'rgba(0,0,0,.65)', color: '#ffc93c' });
    } else title(this.item.w.toUpperCase(), W / 2, 775, 54, '#7cff6b');
    this.drawCommon(col, 830);
  },
}, GuessBase));

// ---------------- Onde Fica? (Guess the Location) ----------------
// Decodifica o mapa-múndi em TopoJSON (arcos com coordenadas delta) para polígonos de [lng, lat].
function topoPolys(topo, geom) {
  const tf = topo.transform;
  if (!topo._arcs) topo._arcs = topo.arcs.map((arc) => { let x = 0, y = 0; return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * tf.scale[0] + tf.translate[0], y * tf.scale[1] + tf.translate[1]]; }); });
  const ring = (ids) => { const out = []; for (const id of ids) { const a = id < 0 ? [...topo._arcs[~id]].reverse() : topo._arcs[id]; out.push(...(out.length ? a.slice(1) : a)); } return out; };
  const polys = geom.type === 'Polygon' ? [geom.arcs] : geom.type === 'MultiPolygon' ? geom.arcs : [];
  return polys.map((p) => p.map(ring));
}
defineGame(Object.assign({
  id: 'guess-the-location', name: 'Onde Fica?', genre: 'trivia', icon: '🌍', color: '#22c55e', three: true,
  desc: 'Uma foto de uma cidade vai passando devagar. O chat digita o país (a cidade vale bônus) e o globo 3D mostra onde era.',
  help: '<p>Olhe a foto e comente o <b>país</b>. Acertar a <b>cidade</b> vale bônus. No fim, o globo gira até o lugar certo.</p><p>❤️ Likes mostram o <b>continente</b>; 🎁 presentes revelam <b>letras</b> ou dão <b>mais tempo</b>.</p>',
  settings: [
    { key: 'region', type: 'select', label: 'Região', options: [['easy', 'Países mais conhecidos'], ['all', 'O mundo todo'], ['Américas', 'Américas'], ['Europa', 'Europa'], ['África', 'África'], ['Ásia', 'Ásia'], ['Oceania', 'Oceania']], default: 'easy' },
    { key: 'cityPoints', type: 'number', label: 'Bônus por acertar a cidade', min: 0, max: 500, default: 50 },
    { key: 'autoHints', type: 'toggle', label: 'Dicas automáticas (continente e letras)', default: true },
    { key: 'spinSpeed', type: 'slider', label: 'Velocidade da foto', min: 1, max: 10, default: 4 },
    ...guessRoundSettings(30),
  ],
  actions: [{ id: 'reveal_letter', label: 'Revelar letra', icon: '🔓' }, { id: 'show_continent', label: 'Mostrar continente', icon: '🗺️' }, { id: 'add_time', label: '+10 segundos', icon: '⏱️' }],
  bindings: [{ action: 'reveal_letter', trigger: 'gift', minCoins: 1 }, { action: 'add_time', trigger: 'gift', minCoins: 30 }, { action: 'show_continent', trigger: 'like', likes: 100 }],
  init() { Promise.all([loadData('countries'), loadData('world')]).then(([c, w]) => { this.data = c; this.world = w; this.reset(); }); },
  prepare() { if (!this.data) return false; const r = this.s.region; this.pool = this.rng.shuffle(this.data.filter((c) => c.cap && (r === 'all' || (r === 'easy' ? c.easy : c.cont === r)))); this.idx = 0; return true; },
  nextItem() {
    const c = this.pool[this.idx++ % this.pool.length];
    const it = { ...c, photo: null, cont: c.cont, cityOk: new Set() };
    fetch(`/api/wiki?pt=${encodeURIComponent(c.cap)}&en=${encodeURIComponent(c.capEn || c.cap)}`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.img) { it.photo = proxImgUrl(j.img); getImg(it.photo); } });
    return it;
  },
  answers: (c) => [c.name, ...c.alt],
  label(c) { return `${c.cap}, ${c.name}`; },
  sample() { return this.item && Math.random() < 0.4 ? this.item.name : pick(['brasil', 'frança', 'japão', 'paris', 'egito']); },
  onItem() { this.showCont = false; this.globeAt = null; },
  onWrong(ev) { if (this.item && this.s.cityPoints && answerMatch(ev.text, [this.item.cap, this.item.capEn]) && !this.item.cityOk.has(uid(ev))) { this.item.cityOk.add(uid(ev)); this.points.add(ev.user, this.s.cityPoints); this.feed.push(ev.user, `🏙️ acertou a cidade! +${this.s.cityPoints}`, '#22e3ee'); } },
  onAction(id, a) {
    if (this.ph.name !== 'play') return;
    if (id === 'reveal_letter') { this.hints++; this.feed.push(a.user, '🔓 letra', '#ffc93c'); }
    else if (id === 'show_continent') this.showCont = true;
    else if (id === 'add_time') { this.ph.t += 10; this.ph.total += 10; this.feed.push(a.user, '⏱️ +10s', '#22e3ee'); }
  },
  tick() { if (this.ph.name === 'play' && this.s.autoHints && this.ph.pct > 0.4) this.showCont = true; },
  globeTex() {
    if (this._tex) return this._tex;
    const c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
    this._texCanvas = c;
    this._tex = new THREE.CanvasTexture(c); this._tex.colorSpace = THREE.SRGBColorSpace;
    return this._tex;
  },
  paintGlobe(target) {
    const c = this._texCanvas, g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 1024); gr.addColorStop(0, '#0b3d6e'); gr.addColorStop(0.5, '#1565a8'); gr.addColorStop(1, '#0b3d6e');
    g.fillStyle = gr; g.fillRect(0, 0, 2048, 1024);
    const P = ([lng, lat]) => [(lng + 180) / 360 * 2048, (90 - lat) / 180 * 1024];
    for (const geo of this.world.objects.countries.geometries) {
      const hit = geo.id === target.num;
      g.fillStyle = hit ? '#ff2d55' : '#3f9a52'; g.strokeStyle = hit ? '#fff' : 'rgba(10,40,20,.8)'; g.lineWidth = hit ? 3 : 1.2;
      for (const poly of topoPolys(this.world, geo)) {
        g.beginPath();
        for (const ring of poly) { let prev = null; ring.forEach((pt, i) => { const [x, y] = P(pt); if (i === 0 || (prev && Math.abs(x - prev) > 1000)) g.moveTo(x, y); else g.lineTo(x, y); prev = x; }); g.closePath(); }
        g.fill('evenodd'); g.stroke();
      }
    }
    this._tex.needsUpdate = true;
  },
  scene3d() {
    if (this.r || !G3.ready) return this.r;
    const T = THREE, scene = new T.Scene();
    scene.background = new T.Color('#040817');
    const cam = new T.PerspectiveCamera(36, W / H, 0.1, 100); cam.position.set(0, 0, 9);
    scene.add(new T.AmbientLight(0xffffff, 1.1));
    const sun = new T.DirectionalLight(0xffffff, 1.6); sun.position.set(5, 3, 8); scene.add(sun);
    const globe = new T.Mesh(new T.SphereGeometry(2.4, 64, 48), new T.MeshStandardMaterial({ map: this.globeTex(), roughness: 0.8 }));
    scene.add(globe);
    const glow = new T.Mesh(new T.SphereGeometry(2.55, 48, 32), new T.MeshBasicMaterial({ color: 0x4fb3ff, transparent: true, opacity: 0.12, side: T.BackSide }));
    scene.add(glow);
    const stars = new T.Points(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(Array.from({ length: 1500 }, () => rand(-40, 40)), 3)), new T.PointsMaterial({ color: 0xffffff, size: 0.06 }));
    scene.add(stars);
    const pin = new T.Mesh(new T.ConeGeometry(0.09, 0.4, 16), new T.MeshStandardMaterial({ color: 0xffc93c, emissive: 0x553300 }));
    pin.geometry.translate(0, -0.2, 0); pin.geometry.rotateX(Math.PI / 2); globe.add(pin); // ponta no chão, corpo para fora
    this.r = { scene, cam, globe, pin };
    return this.r;
  },
  draw() {
    if (this.ph.name === 'final') { stageBg('green'); return this.drawFinal('#34d399'); }
    if (!this.item) { stageBg('green'); return; }
    const it = this.item;
    if (this.ph.name === 'play') {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const img = it.photo && getImg(it.photo);
      if (img) {
        // A foto passa devagar de um lado para o outro, como uma câmera girando
        const sc = Math.max(H / img.height, W / img.width) * 1.25, iw = img.width * sc, ih = img.height * sc;
        const span = Math.max(0, iw - W), p = (Math.sin((this.ph.total - this.ph.t) * 0.05 * this.s.spinSpeed) + 1) / 2;
        ctx.drawImage(img, -span * p, (H - ih) / 2, iw, ih);
        const v = ctx.createLinearGradient(0, 0, 0, H); v.addColorStop(0, 'rgba(0,0,0,.65)'); v.addColorStop(0.25, 'rgba(0,0,0,0)'); v.addColorStop(0.7, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.8)');
        ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      } else { stageBg('green'); label('buscando a foto…', W / 2, H / 2, 24, '#fff', 'center', 700); }
      title('ONDE FICA?', W / 2, 62, 50);
      pill(`RODADA ${this.round} · comente o país (cidade vale bônus)`, W / 2, 106, { size: 15, bg: 'rgba(0,0,0,.55)', color: '#34d399' });
      if (this.showCont) pill(`🗺️ ${it.cont}`, W / 2, 160, { size: 22, bg: 'rgba(0,0,0,.65)', color: '#ffc93c' });
      if (this.hints) pill(this.hintText(it.name), W / 2, 214, { size: 24, bg: 'rgba(0,0,0,.65)', color: '#ffc93c' });
    } else {
      // Revelação: globo 3D gira até o país
      const r = this.scene3d();
      if (r) {
        if (this.globeAt !== it.code) { this.globeAt = it.code; this.paintGlobe(it); this.spin0 = r.globe.rotation.y; }
        const lon = it.lng * Math.PI / 180, lat = it.lat * Math.PI / 180;
        const k = clamp((this.s.revealSeconds - this.ph.t) / 1.6, 0, 1), e = 1 - (1 - k) ** 3;
        const targetY = -Math.PI / 2 - lon;
        r.globe.rotation.y = this.spin0 + (targetY - this.spin0 + Math.PI * 2) * e;
        r.globe.rotation.x = lat * e;
        const R = 2.4;
        r.pin.position.set(R * Math.cos(lat) * Math.cos(lon), R * Math.sin(lat), -R * Math.cos(lat) * Math.sin(lon));
        r.pin.lookAt(0, 0, 0);
        r.cam.position.z = 9 - e * 2.4;
        G3.render(r.scene, r.cam);
      } else stageBg('green');
      title(it.name.toUpperCase(), W / 2, 96, 56, '#7cff6b');
      label(`📍 ${it.cap} · ${it.cont}`, W / 2, 146, 24, '#fff', 'center', 800);
    }
    this.drawCommon('#34d399', 900);
  },
}, GuessBase));
