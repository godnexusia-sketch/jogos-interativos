'use strict';

// Escolha do jogo: a live vota pelo número qual jogo vem agora. No fim do tempo, o vencedor abre sozinho.
// Jogos que entram na votação (até 16 cabem na tela). O admin escolhe em Configurar.
const VOTE_DEFAULT = ['pipa', 'combate', 'kart', 'cobra', 'trivia-time', 'million-quiz', 'boys-vs-girls', 'blob-battle', 'tower-war', 'zombie-hill', 'car-race', 'guess-the-flag', 'five-letters', 'ai-host'];
registerGame({
  id: 'votacao',
  meterY: 900, // posição do medidor de presentes (livre de HUD)
  name: 'Escolha o Jogo',
  icon: '🗳️',
  configKey: 'votacao',
  config: { duration: 60, autoSwitch: true, games: VOTE_DEFAULT, ...store.get('cfg:votacao', {}) },
  help: '<p>A live escolhe o próximo jogo: comente o <b>número</b> do jogo (1 voto por pessoa, pode trocar).</p><p>🎁 Presente: +10 votos por moeda (preço × combo) no jogo que a pessoa escolheu. ❤️ 25 likes = +10 votos · ⭐ seguir +50 · 🔁 compartilhar +100.</p>' + TIER_HELP + '<p>Quando o tempo acaba, o jogo mais votado abre sozinho. Se ninguém votar, abre o <b>Céu de Pipas</b>.</p>',
  getConfig() { return this.config; },
  applyConfig(cfg) { if (!cfg) return; this.config = { games: VOTE_DEFAULT, ...cfg }; store.set('cfg:votacao', this.config); this.reset(); },
  renderSettings(el, save) {
    const c = this.config;
    el.innerHTML = `
      <label>Tempo da votação (segundos) <input data-k="duration" type="number" min="15" max="600" value="${c.duration}"></label>
      <label class="row2"><input data-k="autoSwitch" type="checkbox" ${c.autoSwitch ? 'checked' : ''} style="width:auto"> Abrir o jogo vencedor sozinho</label>
      <p class="small">Jogos na votação (até 16):</p>
      <div class="vote-pick" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;max-height:260px;overflow:auto">${GAMES.filter((g) => g.id !== 'votacao').map((g) => `<label class="row2" style="font-size:12px"><input type="checkbox" data-g="${g.id}" ${c.games.includes(g.id) ? 'checked' : ''} style="width:auto"> ${g.icon} ${g.name}</label>`).join('')}</div>
      <button data-save class="primary">Salvar e reiniciar</button>`;
    el.querySelector('[data-save]').addEventListener('click', () => {
      const games = [...el.querySelectorAll('[data-g]:checked')].map((x) => x.dataset.g).slice(0, 16);
      this.applyConfig({ duration: clamp(Number(el.querySelector('[data-k="duration"]').value) || 60, 15, 600), autoSwitch: el.querySelector('[data-k="autoSwitch"]').checked, games: games.length >= 2 ? games : VOTE_DEFAULT });
      save(this.config);
    });
  },
  options() { const ids = this.config.games || VOTE_DEFAULT; const list = ids.map((id) => GAMES.find((g) => g.id === id)).filter(Boolean); return list.length >= 2 ? list : GAMES.filter((g) => g.id !== 'votacao').slice(0, 14); },
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
    } else if (ev.type === 'like' || ev.type === 'social') {
      const i = this.voters.get(id);
      if (i === undefined) return;
      const v = Math.floor(10 * (ev.type === 'like' ? ev.count / 25 : SOCIAL_COINS[isFollow(ev) ? 'follow' : 'share']));
      if (v <= 0) return;
      this.vote(ev.user, i, v);
      if (ev.type === 'social') { this.log.unshift({ user: ev.user, msg: `${isFollow(ev) ? 'seguiu' : 'compartilhou'}: +${v} votos`, t: 4 }); this.log.length = Math.min(this.log.length, 2); }
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
        this.phase = 'result'; this.endT = 6; this.revealT = 0; sfx.win(); confetti(120);
        const w = this.leader();
        if (w >= 0) for (let k = 0; k < 4; k++) setTimeout(() => burst(rand(100, W - 100), rand(300, 700), ['#ffc93c', '#00e5ff', '#ff2e63', '#fff'], 60, 520), k * 250);
      }
    } else {
      this.endT -= dt;
      if (this.endT <= 0) {
        const w = this.leader();
        // Abre o mais votado; se ninguém votou, abre o Céu de Pipas.
        const id = w >= 0 ? this.options()[w].id : 'pipa';
        this.reset();
        if (this.config.autoSwitch && typeof switchGameById === 'function') switchGameById(id);
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
      num(String(i + 1), x + 30, y + ch / 2, 42, isLead ? '#ffc93c' : '#00e5ff');
      // Capa do jogo (tirada do próprio jogo); sem capa, o ícone
      const cov = getImg(`/assets/capas/${g.id}.webp`), cwid = Math.min(ch - 14, 70) * 0.75, chh = Math.min(ch - 14, 70);
      if (cov) { ctx.save(); ctx.beginPath(); ctx.roundRect(x + 58, y + (ch - chh) / 2, cwid, chh, 8); ctx.clip(); ctx.drawImage(cov, 0, cov.naturalHeight * 0.12, cov.naturalWidth, cov.naturalWidth / 0.75, x + 58, y + (ch - chh) / 2, cwid, chh); ctx.restore(); ctx.strokeStyle = isLead ? '#ffc93c' : 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x + 58, y + (ch - chh) / 2, cwid, chh, 8); ctx.stroke(); }
      else text(g.icon, x + 58 + cwid / 2, y + ch / 2 - 2, 30);
      const tx = x + 66 + cwid;
      label(trim(g.name, 13), tx, y + ch / 2 - 12, 18, '#fff', 'left', 800);
      label(`${this.votes[i]} voto${this.votes[i] === 1 ? '' : 's'}`, tx, y + ch / 2 + 14, 14, 'rgba(255,255,255,.65)', 'left', 700);
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
        // Revelação: a capa do vencedor cresce girando, com brilho atrás
        this.revealT = (this.revealT || 0) + 1 / 60;
        const k = Math.min(1, this.revealT / 0.6), e = 1 - Math.pow(1 - k, 3);
        title('A LIVE ESCOLHEU', W / 2, 250, 44, 'rgba(255,255,255,.8)');
        const cov = getImg(`/assets/capas/${g.id}.webp`), cw2 = 300 * e, ch2 = 533 * e;
        ctx.save(); ctx.translate(W / 2, 600); ctx.rotate((1 - e) * -0.6);
        const glow = ctx.createRadialGradient(0, 0, 50, 0, 0, 420); glow.addColorStop(0, 'rgba(255,201,60,.45)'); glow.addColorStop(1, 'rgba(255,201,60,0)'); ctx.fillStyle = glow; ctx.fillRect(-420, -420, 840, 840);
        if (cov) { ctx.beginPath(); ctx.roundRect(-cw2 / 2, -ch2 / 2, cw2, ch2, 24); ctx.save(); ctx.clip(); ctx.drawImage(cov, -cw2 / 2, -ch2 / 2, cw2, ch2); ctx.restore(); ctx.lineWidth = 6; ctx.strokeStyle = '#ffc93c'; ctx.stroke(); }
        else text(g.icon, 0, 0, 160 * e);
        ctx.restore();
        title(g.name.toUpperCase(), W / 2, 930, 62, '#ffc93c');
        label(`${this.votes[lead]} votos`, W / 2, 985, 26, '#fff', 'center', 800);
        if (this.config.autoSwitch) label(`Começando em ${Math.ceil(this.endT)}s…`, W / 2, 1040, 22, 'rgba(255,255,255,.7)', 'center', 700);
      } else {
        title('NINGUÉM VOTOU', W / 2, 520, 56, '#fff');
        if (this.config.autoSwitch) { title('ABRINDO O CÉU DE PIPAS', W / 2, 600, 40, '#00e5ff'); label(`em ${Math.ceil(this.endT)}s…`, W / 2, 660, 22, 'rgba(255,255,255,.7)', 'center', 700); }
      }
    }
  },
});
