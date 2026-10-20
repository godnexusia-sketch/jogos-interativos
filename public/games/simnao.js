'use strict';

// SIM ou NÃO num plenário: telão com o resultado e um tablet onde a mão aperta o botão a cada voto.
const SIMNAO_DEFAULT = { question: 'Você é a favor do fim da', highlight: 'ESCALA 6x1?', duration: 10, giftVotes: 10 };

registerGame({
  id: 'simnao',
  name: 'Sim ou Não',
  icon: '🏛️',
  configKey: 'simnao',
  help: '<p>Comente <b>SIM</b> ou <b>NÃO</b>. Cada comentário é 1 voto (1 a cada 3s, até 10 por votação).</p><p>🎁 Presente: votos por moeda no lado que a pessoa votou por último.</p><p>Troque a pergunta em <b>Configurar</b>.</p>',
  cd: new Cooldown(3000),
  config: store.get('cfg:simnao', SIMNAO_DEFAULT),
  reset() {
    this.yes = 0; this.no = 0;
    this.side = new Map(); this.perUser = new Map();
    this.queue = []; this.job = null;
    this.log = [];
    this.hand = { x: W - 80, y: H + 100 };
    this.plus = [];
    this.timeLeft = this.config.duration * 60;
    this.phase = 'running';
    this.endT = 0;
    this.voters = new Set();
  },
  getConfig() { return this.config; },
  applyConfig(cfg) { if (!cfg?.question) return; this.config = cfg; store.set('cfg:simnao', cfg); this.reset(); },
  renderSettings(el, save) {
    const c = this.config;
    el.innerHTML = `
      <label>Pergunta (começo) <input data-k="question" maxlength="60" value="${c.question.replace(/"/g, '&quot;')}"></label>
      <label>Destaque (fim, em azul) <input data-k="highlight" maxlength="30" value="${c.highlight.replace(/"/g, '&quot;')}"></label>
      <label>Duração (minutos, 0 = sem tempo) <input data-k="duration" type="number" min="0" max="120" value="${c.duration}"></label>
      <label>Votos por moeda de presente <input data-k="giftVotes" type="number" min="1" max="1000" value="${c.giftVotes}"></label>
      <button data-save class="primary">Salvar e reiniciar</button>`;
    el.querySelector('[data-save]').addEventListener('click', () => {
      const v = (k) => el.querySelector(`[data-k="${k}"]`).value;
      this.applyConfig({ question: v('question').trim() || c.question, highlight: v('highlight').trim(), duration: clamp(Number(v('duration')) || 0, 0, 120), giftVotes: clamp(Number(v('giftVotes')) || 1, 1, 1000) });
      save(this.config);
    });
  },
  sample: () => (Math.random() < 0.55 ? 'sim' : 'não'),
  addLog(user, msg, color) { this.log.unshift({ user, msg, color, t: 6 }); this.log.length = Math.min(this.log.length, 3); },
  onEvent(ev) {
    if (this.phase !== 'running') return;
    const id = uid(ev);
    if (ev.type === 'chat') {
      const t = ev.text.trim().toLowerCase();
      const isYes = /^(sim|s|yes|👍)\b/.test(t), isNo = /^(n[aã]o|n|no|👎)\b/.test(t);
      if (!isYes && !isNo) return;
      this.side.set(id, isYes);
      const used = this.perUser.get(id) || 0;
      if (used >= 10 || !this.cd.ok(id)) return;
      this.perUser.set(id, used + 1);
      this.queue.push({ yes: isYes, user: ev.user, n: 1, tier: 0 });
    } else if (ev.type === 'gift') {
      if (!this.side.has(id)) { this.addLog(ev.user, 'comente SIM ou NÃO antes!', '#ffd23f'); return; }
      this.queue.push({ yes: this.side.get(id), user: ev.user, n: this.config.giftVotes * coins(ev), tier: giftTier(ev) });
    }
    // Com fila longa, junta votos seguidos do mesmo lado.
    if (this.queue.length > 12) {
      const a = this.queue[this.queue.length - 2], b = this.queue[this.queue.length - 1];
      if (a && a.yes === b.yes && a.tier < 2 && b.tier < 2) { a.n += b.n; a.user = b.user; this.queue.pop(); }
    }
  },
  btn(yes) { return yes ? { x: 110, y: 880, w: 230, h: 100 } : { x: 380, y: 880, w: 230, h: 100 }; },
  commit(j) {
    if (j.yes) this.yes += j.n; else this.no += j.n;
    this.voters.add(j.user.nick);
    this.addLog(j.user, `votou ${j.yes ? 'SIM' : 'NÃO'} +${j.n}`, j.yes ? '#37d67a' : '#ff4d5e');
    const b = this.btn(j.yes);
    this.plus.push({ x: b.x + b.w + 10, y: b.y + 20, n: j.n, t: 1.4, color: j.yes ? '#37d67a' : '#ff4d5e' });
    sfx.key();
    if (j.tier >= 2) burst(b.x + b.w / 2, b.y, j.yes ? ['#37d67a', '#fff'] : ['#ff4d5e', '#fff'], 30 + j.tier * 15, 420);
    if (j.tier >= 3) announcer.show(`@${trim(j.user.nick, 12)} +${j.n}`, j.yes ? '#37d67a' : '#ff4d5e', 2.2, 56);
    if (j.tier >= 4) { sfx.boom(); for (let k = 0; k < 5; k++) setTimeout(() => burst(rand(80, W - 80), rand(100, 400), COLORS, 60, 500), k * 220); }
  },
  update(dt) {
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    for (const p of this.plus) p.t -= dt;
    this.plus = this.plus.filter((p) => p.t > 0);
    if (this.phase === 'ended') { this.endT -= dt; if (this.endT <= 0) this.reset(); return; }
    if (this.config.duration > 0) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        for (const q of this.queue) { if (q.yes) this.yes += q.n; else this.no += q.n; }
        this.queue = []; this.job = null;
        this.phase = 'ended'; this.endT = 12; sfx.win();
        return;
      }
    }
    const speed = this.queue.length > 15 ? 4 : this.queue.length > 5 ? 2.4 : 1.3;
    if (!this.job && this.queue.length) this.job = { ...this.queue.shift(), t: 0, stage: 'move' };
    const j = this.job;
    const target = j ? (() => { const b = this.btn(j.yes); return { x: b.x + b.w * 0.62, y: b.y + b.h * 0.55 }; })() : { x: W - 70, y: H + 120 };
    this.hand.x += (target.x - this.hand.x) * Math.min(1, dt * (j ? 9 * speed : 3));
    this.hand.y += (target.y - this.hand.y) * Math.min(1, dt * (j ? 9 * speed : 3));
    if (!j) return;
    j.t += dt * speed;
    if (j.stage === 'move' && j.t > 0.3) { j.stage = 'press'; j.t = 0; }
    else if (j.stage === 'press' && j.t > 0.14) { this.commit(j); j.stage = 'back'; j.t = 0; }
    else if (j.stage === 'back' && j.t > 0.2) this.job = null;
  },
  drawChamber() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05070f'); g.addColorStop(0.45, '#0d1a33'); g.addColorStop(1, '#03050a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Luzes do teto
    for (let k = 0; k < 6; k++) {
      const x = 60 + k * 120;
      const lg = ctx.createRadialGradient(x, 20, 2, x, 20, 60);
      lg.addColorStop(0, 'rgba(255,255,240,.95)'); lg.addColorStop(1, 'rgba(255,255,240,0)');
      ctx.fillStyle = lg; ctx.fillRect(x - 60, 0, 120, 90);
    }
    // Parede do fundo com ripas
    ctx.fillStyle = '#16233d'; ctx.fillRect(0, 250, W, 230);
    for (let x = 0; x < W; x += 14) { ctx.fillStyle = x % 28 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.25)'; ctx.fillRect(x, 250, 7, 230); }
    // Mesa diretora
    const dg = ctx.createLinearGradient(0, 400, 0, 470);
    dg.addColorStop(0, '#2b4a7a'); dg.addColorStop(1, '#14233f');
    ctx.fillStyle = dg; ctx.fillRect(140, 410, 440, 60);
    // Fileiras de cadeiras em arco
    for (let row = 0; row < 7; row++) {
      const y = 500 + row * 34 + row * row * 3, rw = 380 + row * 70;
      ctx.fillStyle = row % 2 ? '#0f2a44' : '#13355a';
      ctx.beginPath(); ctx.ellipse(W / 2, y + 60, rw, 60, 0, Math.PI, 0); ctx.ellipse(W / 2, y + 74, rw, 64, 0, 0, Math.PI, true); ctx.fill();
      for (let k = -9; k <= 9; k++) {
        const a = Math.PI + (k + 9.5) / 19.5 * Math.PI;
        ctx.fillStyle = 'rgba(40,90,140,.9)';
        ctx.fillRect(W / 2 + Math.cos(a) * rw - 9, y + 60 + Math.sin(a) * 60 - 14, 18, 16);
      }
    }
    // Bancada de madeira em primeiro plano
    const bg = ctx.createLinearGradient(0, 700, 0, 820);
    bg.addColorStop(0, '#5a3a22'); bg.addColorStop(1, '#2a1a0e');
    ctx.fillStyle = bg; ctx.fillRect(0, 720, W, 120);
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(0, 720, W, 3);
    ctx.fillStyle = '#05060a'; ctx.fillRect(0, 840, W, H - 840);
  },
  draw() {
    cachedScene('plenario', () => this.drawChamber());
    const total = this.yes + this.no;
    const py = total ? this.yes / total : 0, pn = total ? this.no / total : 0;
    // Telão
    panel(40, 58, W - 80, 196, { r: 14, from: 'rgba(14,40,90,.94)', to: 'rgba(6,16,40,.96)', border: '#3d8bff', glow: 'rgba(61,139,255,.55)' });
    label('RESULTADO DA VOTAÇÃO', W / 2, 92, 22, '#e8f0ff', 'center', 900);
    const rows = [['SIM', py, '#37d67a', this.yes], ['NÃO', pn, '#ff4d5e', this.no]];
    rows.forEach(([name, p, col, n], i) => {
      const y = 140 + i * 58;
      label(name, 70, y, 30, col, 'left', 900);
      glossBar(150, y - 13, 360, 26, p, col, 'rgba(255,255,255,.08)');
      num(`${Math.round(p * 100)}%`, W - 70, y, 40, col, 'right');
      if ((i === 0 ? this.yes > this.no : this.no > this.yes)) pill('NA FRENTE', 460, y - 26, { bg: 'rgba(0,0,0,.6)', color: col, size: 12, border: col });
    });
    // Status
    const status = this.phase === 'ended' ? 'VOTAÇÃO ENCERRADA' : 'VOTAÇÃO ABERTA';
    pill(`${status} • ${this.config.duration > 0 ? fmtTime(this.timeLeft) : 'AO VIVO'} • ${total} VOTOS VÁLIDOS`, W / 2, 284, { bg: 'rgba(8,20,45,.9)', color: '#cfe0ff', size: 16, border: '#2d5fb3' });
    pill('● AO VIVO', 70, 26, { bg: '#e11d48', size: 13 });
    // Avisos
    this.log.forEach((l, k) => toast(l.user, trim(`@${trim(l.user.nick, 14)} ${l.msg}`, 32), W / 2, 338 + k * 46, { color: l.color, align: 'center', alpha: clamp(l.t, 0, 1) }));
    this.drawTablet();
    pill('💬 Comente SIM ou NÃO', 230, 1130, { bg: 'rgba(20,40,80,.9)', size: 24, border: '#3d8bff' });
    pill('🎁 presente = mais votos', 230, 1186, { bg: 'rgba(60,40,0,.9)', color: '#ffd23f', size: 20, border: '#ffd23f' });
    for (const p of this.plus) { ctx.globalAlpha = clamp(p.t, 0, 1); num(`+${p.n}`, p.x, p.y - (1.4 - p.t) * 40, 34, p.color, 'left'); ctx.globalAlpha = 1; }
    hand(this.hand.x, this.hand.y, { scale: 0.75, angle: -0.35, press: this.job?.stage === 'press' ? 1 : 0, skin: '#e8b98a', sleeve: '#e9e4da' });
    if (this.phase === 'ended') this.drawResult();
  },
  drawTablet() {
    const x = 50, y = 600, w = W - 100, h = 470;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 16;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 36); ctx.fillStyle = '#0b0d12'; ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 36); ctx.lineWidth = 3; ctx.strokeStyle = '#3a3f4b'; ctx.stroke();
    const sx = x + 22, sy = y + 22, sw = w - 44, sh = h - 44;
    const sg = ctx.createLinearGradient(0, sy, 0, sy + sh);
    sg.addColorStop(0, '#0d1f3c'); sg.addColorStop(1, '#060d1c');
    ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, 18); ctx.fillStyle = sg; ctx.fill();
    // Ícone e linhas
    text('🏛️', W / 2, sy + 40, 30);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(W / 2 - 170, sy + 40, 120, 2); ctx.fillRect(W / 2 + 50, sy + 40, 120, 2);
    // Pergunta: começo em branco, destaque grande em azul
    const words = this.config.question.toUpperCase();
    ctx.font = `900 34px ${F_TEXT}`;
    const lines = [];
    let line = '';
    for (const wd of words.split(' ')) { const t = line ? line + ' ' + wd : wd; if (ctx.measureText(t).width > sw - 60 && line) { lines.push(line); line = wd; } else line = t; }
    lines.push(line);
    const last = lines.length > 1 ? lines.pop() : null;
    let yy = sy + 96;
    for (const l of lines) { text(l, W / 2, yy, 32, '#fff', 'center', 900); yy += 42; }
    if (last) { text(last, W / 2, yy + 6, 50, '#fff', 'center', 900); yy += 58; }
    if (this.config.highlight) text(this.config.highlight.toUpperCase(), W / 2, yy + 18, 60, '#3fa9ff', 'center', 900);
    // Botões
    for (const yes of [true, false]) {
      const b = this.btn(yes);
      const pressed = this.job && this.job.yes === yes && this.job.stage === 'press';
      const col = yes ? '#1f9d55' : '#d62839';
      ctx.save();
      ctx.shadowColor = yes ? 'rgba(55,214,122,.6)' : 'rgba(255,77,94,.6)'; ctx.shadowBlur = pressed ? 30 : 14;
      ctx.beginPath(); ctx.roundRect(b.x, b.y + (pressed ? 4 : 0), b.w, b.h, 18);
      const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      g.addColorStop(0, shade(col, pressed ? 50 : 30)); g.addColorStop(1, shade(col, -30));
      ctx.fillStyle = g; ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.roundRect(b.x, b.y + (pressed ? 4 : 0), b.w, b.h, 18); ctx.lineWidth = 3; ctx.strokeStyle = shade(col, 60); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(b.x + 6, b.y + 6 + (pressed ? 4 : 0), b.w - 12, b.h * 0.38, 14); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill();
      text(yes ? '✔ SIM' : '✖ NÃO', b.x + b.w / 2, b.y + b.h / 2 + (pressed ? 4 : 0), 42, '#fff', 'center', 900);
    }
    label('SELECIONE SUA OPINIÃO', W / 2, sy + sh - 46, 15, 'rgba(255,255,255,.45)', 'center', 800);
    label('Votação entre participantes da live • não é pesquisa', W / 2, sy + sh - 22, 13, 'rgba(255,255,255,.4)', 'center', 600);
  },
  drawResult() {
    ctx.fillStyle = 'rgba(0,0,0,.78)'; ctx.fillRect(0, 0, W, H);
    const yesWin = this.yes > this.no, tie = this.yes === this.no;
    title(tie ? 'EMPATE' : 'RESULTADO', W / 2, 360, 60, '#ffd23f');
    if (!tie) {
      const col = yesWin ? '#37d67a' : '#ff4d5e';
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 40;
      num(yesWin ? 'SIM VENCEU' : 'NÃO VENCEU', W / 2, 500, 110, col);
      ctx.restore();
    }
    num(`${this.yes} × ${this.no}`, W / 2, 640, 70, '#fff');
    text(`${this.voters.size} pessoas votaram`, W / 2, 720, 30, '#ddd', 'center', 700);
    text(`Nova votação em ${Math.ceil(this.endT)}s`, W / 2, 1100, 30, '#ddd', 'center', 700);
  },
});
