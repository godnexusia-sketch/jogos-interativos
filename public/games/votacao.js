'use strict';

// Escolha do jogo: a live vota pelo número qual jogo vem agora. No fim do tempo, o vencedor abre sozinho.
registerGame({
  id: 'votacao',
  name: 'Escolha o Jogo',
  icon: '🗳️',
  configKey: 'votacao',
  config: store.get('cfg:votacao', { duration: 60, autoSwitch: true }),
  help: '<p>A live escolhe o próximo jogo: comente o <b>número</b> do jogo (1 voto por pessoa, pode trocar).</p><p>🎁 Presente: +10 votos por moeda no jogo que a pessoa escolheu.</p><p>Quando o tempo acaba, o jogo mais votado abre sozinho.</p>',
  getConfig() { return this.config; },
  applyConfig(cfg) { if (!cfg) return; this.config = cfg; store.set('cfg:votacao', cfg); this.reset(); },
  renderSettings(el, save) {
    const c = this.config;
    el.innerHTML = `
      <label>Tempo da votação (segundos) <input data-k="duration" type="number" min="15" max="600" value="${c.duration}"></label>
      <label class="row2"><input data-k="autoSwitch" type="checkbox" ${c.autoSwitch ? 'checked' : ''} style="width:auto"> Abrir o jogo vencedor sozinho</label>
      <button data-save class="primary">Salvar e reiniciar</button>`;
    el.querySelector('[data-save]').addEventListener('click', () => {
      this.applyConfig({ duration: clamp(Number(el.querySelector('[data-k="duration"]').value) || 60, 15, 600), autoSwitch: el.querySelector('[data-k="autoSwitch"]').checked });
      save(this.config);
    });
  },
  options() { return GAMES.filter((g) => g.id !== 'votacao'); },
  reset() {
    const n = this.options().length;
    this.votes = new Array(n).fill(0);
    this.voters = new Map();
    this.pulse = new Array(n).fill(0);
    this.faces = new Array(n).fill(null).map(() => []);
    this.timeLeft = this.config.duration;
    this.phase = 'vote';
    this.endT = 0;
    this.log = [];
  },
  sample() { return String(randInt(1, this.options().length)); },
  vote(user, i, n) {
    this.votes[i] += n;
    this.pulse[i] = 1;
    const f = this.faces[i];
    if (!f.some((u) => u.nick === user.nick)) { f.unshift(user); f.length = Math.min(f.length, 4); }
  },
  onEvent(ev) {
    if (this.phase !== 'vote') return;
    const id = uid(ev), n = this.options().length;
    if (ev.type === 'chat') {
      const m = ev.text.trim().match(/^#?(\d{1,2})\b/);
      const i = m ? Number(m[1]) - 1 : -1;
      if (i < 0 || i >= n) return;
      const prev = this.voters.get(id);
      if (prev === i) return;
      if (prev !== undefined) { this.votes[prev] = Math.max(0, this.votes[prev] - 1); this.faces[prev] = this.faces[prev].filter((u) => u.nick !== ev.user.nick); }
      this.voters.set(id, i);
      this.vote(ev.user, i, 1);
    } else if (ev.type === 'gift') {
      const i = this.voters.get(id);
      if (i === undefined) return;
      const v = 10 * coins(ev);
      this.vote(ev.user, i, v);
      this.log.unshift({ user: ev.user, msg: `+${v} votos em ${this.options()[i].name}`, t: 5 });
      this.log.length = Math.min(this.log.length, 2);
      if (giftTier(ev) >= 3) announcer.show(`@${trim(ev.user.nick, 12)} +${v}`, '#ffc93c', 2, 50);
    }
  },
  leader() {
    const max = Math.max(...this.votes);
    return max > 0 ? this.votes.indexOf(max) : -1;
  },
  update(dt) {
    this.pulse = this.pulse.map((p) => Math.max(0, p - dt * 2));
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    if (this.phase === 'vote') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.phase = 'result'; this.endT = 6; sfx.win();
        const w = this.leader();
        if (w >= 0) for (let k = 0; k < 4; k++) setTimeout(() => burst(rand(100, W - 100), rand(300, 700), ['#ffc93c', '#00e5ff', '#ff2e63', '#fff'], 60, 520), k * 250);
      }
    } else {
      this.endT -= dt;
      if (this.endT <= 0) {
        const w = this.leader();
        if (w >= 0 && this.config.autoSwitch && typeof switchGameById === 'function') { const id = this.options()[w].id; this.reset(); switchGameById(id); }
        else this.reset();
      }
    }
  },
  draw() {
    const t = performance.now() / 1000;
    // Fundo: holofotes de estúdio de TV
    background('#070a14', '#0e1530');
    for (let k = 0; k < 4; k++) {
      ctx.save(); ctx.translate(120 + k * 160, -20); ctx.rotate(Math.sin(t * 0.5 + k) * 0.25);
      const g = ctx.createLinearGradient(0, 0, 0, 900); g.addColorStop(0, 'rgba(0,229,255,.16)'); g.addColorStop(1, 'rgba(0,229,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.lineTo(140, 900); ctx.lineTo(-140, 900); ctx.fill(); ctx.restore();
    }
    const opts = this.options();
    const total = this.votes.reduce((a, b) => a + b, 0) || 1;
    const lead = this.leader();
    title('QUAL JOGO AGORA?', W / 2, 62, 54, '#fff');
    slant(W / 2 - 150, 96, 300, 46, { fill: '#0b0f1c', skew: 10, border: this.timeLeft < 10 ? '#ff2e63' : '#00e5ff' });
    num(this.phase === 'vote' ? fmtTime(this.timeLeft) : 'RESULTADO', W / 2, 120, 32, this.timeLeft < 10 && this.phase === 'vote' ? '#ff2e63' : '#fff');
    // Lista de jogos em duas colunas
    const cols = 2, rows = Math.ceil(opts.length / cols);
    const top = 160, cw = (W - 48) / 2, ch = Math.min(118, (1080 - top) / rows - 8);
    opts.forEach((g, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = 16 + col * (cw + 16), y = top + row * (ch + 8);
      const pct = this.votes[i] / total;
      const isLead = i === lead;
      slant(x, y, cw, ch, { fill: isLead ? 'rgba(255,201,60,.16)' : 'rgba(14,18,32,.92)', skew: 10, border: isLead ? '#ffc93c' : 'rgba(255,255,255,.1)' });
      // Barra de votos dentro do cartão
      ctx.save(); ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.lineTo(x + cw, y); ctx.lineTo(x + cw - 10, y + ch); ctx.lineTo(x, y + ch); ctx.clip();
      ctx.fillStyle = isLead ? 'rgba(255,201,60,.30)' : 'rgba(0,229,255,.16)'; ctx.fillRect(x, y, cw * pct, ch);
      if (this.pulse[i]) { ctx.fillStyle = `rgba(255,255,255,${this.pulse[i] * 0.25})`; ctx.fillRect(x, y, cw, ch); }
      ctx.restore();
      num(String(i + 1), x + 34, y + ch / 2, 46, isLead ? '#ffc93c' : '#00e5ff');
      text(g.icon, x + 82, y + ch / 2 - 2, 30);
      label(trim(g.name, 16), x + 106, y + ch / 2 - 12, 19, '#fff', 'left', 800);
      label(`${this.votes[i]} voto${this.votes[i] === 1 ? '' : 's'}`, x + 106, y + ch / 2 + 14, 14, 'rgba(255,255,255,.65)', 'left', 700);
      this.faces[i].forEach((u, k) => avatar(u, x + cw - 30 - k * 22, y + ch / 2, 13, '#fff'));
    });
    const by = top + rows * (ch + 8) + 20;
    slant(16, by, W - 32, 74, { fill: 'rgba(14,18,32,.92)', skew: 12, border: 'rgba(255,255,255,.14)' });
    title('COMENTE O NÚMERO DO JOGO', W / 2, by + 28, 30, '#fff');
    label(`${this.voters.size} pessoas votaram · presente vale +10 votos por moeda`, W / 2, by + 56, 15, 'rgba(255,255,255,.7)', 'center', 700);
    this.log.forEach((l, k) => toast(l.user, trim(`@${trim(l.user.nick, 10)} ${l.msg}`, 36), W / 2, by + 112 + k * 44, { align: 'center', color: '#ffc93c', alpha: clamp(l.t, 0, 1), size: 16 }));
    if (this.phase === 'result') {
      ctx.fillStyle = 'rgba(0,0,0,.78)'; ctx.fillRect(0, 0, W, H);
      if (lead >= 0) {
        const g = opts[lead];
        title('A LIVE ESCOLHEU', W / 2, 420, 44, 'rgba(255,255,255,.8)');
        text(g.icon, W / 2, 540, 120);
        title(g.name.toUpperCase(), W / 2, 680, 70, '#ffc93c');
        label(`${this.votes[lead]} votos`, W / 2, 740, 26, '#fff', 'center', 800);
        if (this.config.autoSwitch) label(`Começando em ${Math.ceil(this.endT)}s…`, W / 2, 820, 22, 'rgba(255,255,255,.7)', 'center', 700);
      } else title('NINGUÉM VOTOU', W / 2, 600, 56, '#fff');
    }
  },
});
