'use strict';

// Urna: duas urnas em pé na live, em cima de uma mesa. Comentar o número vota; presente vale votos por moeda.
// Cada voto passa pela urna: a mão digita o número, a foto do candidato aparece e ela aperta CONFIRMA.
const URNA_DEFAULT = {
  duration: 7, // minutos; 0 = sem cronômetro
  giftVotes: 10, // votos por moeda de presente
  candidates: [
    { num: '22', name: 'Candidato A', color: '#2f7cf6', photo: '' },
    { num: '13', name: 'Candidato B', color: '#e5383b', photo: '' },
  ],
};
const URNA_COLORS = ['#2f7cf6', '#e5383b', '#1f9d55', '#f59f00'];
const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const TABLE_Y = 860;

registerGame({
  id: 'urna',
  name: 'Urna',
  icon: '🗳️',
  configKey: 'urna',
  help: '<p>Comente o <b>número</b> do candidato para votar (1 voto a cada 3s, até 20 por rodada).</p><p>🎁 Presente: votos por moeda no candidato que a pessoa escolheu. Quanto maior o presente, maior o efeito.</p><p>Configure fotos, números e nomes em <b>Configurar</b>.</p>',
  cd: new Cooldown(3000),
  config: store.get('cfg:urna', URNA_DEFAULT),

  reset() {
    const n = this.config.candidates.length;
    this.votes = new Array(n).fill(0);
    this.gifts = new Array(n).fill(0);
    this.last = new Array(n).fill(null);
    this.choice = new Map();
    this.perUser = new Map();
    this.supporters = new Map();
    this.log = [];
    this.flash = new Array(n).fill(0);
    this.plus = new Array(n).fill(null);
    this.timeLeft = this.config.duration * 60;
    this.phase = 'running';
    this.endT = 0;
    // Com 2 candidatos, uma urna para cada; com 3 ou 4, uma urna grande no meio.
    this.machines = n === 2
      ? [0, 1].map((i) => ({ cands: [i], x: 28 + i * 340, y: 600, w: 324, h: 250 }))
      : [{ cands: this.config.candidates.map((_, i) => i), x: 150, y: 600, w: 420, h: 250 }];
    for (const m of this.machines) { m.queue = []; m.job = null; m.hand = { x: m.x + m.w * 0.8, y: H + 200 }; m.done = 0; }
  },
  getConfig() { return this.config; },
  applyConfig(cfg) {
    if (!cfg?.candidates?.length) return;
    this.config = cfg;
    store.set('cfg:urna', cfg);
    this.reset();
  },
  sample() { return pick(this.config.candidates).num; },
  machineOf(i) { return this.machines.find((m) => m.cands.includes(i)); },

  // ---------- Eventos ----------
  onEvent(ev) {
    if (this.phase !== 'running') return;
    const id = uid(ev);
    const cands = this.config.candidates;
    if (ev.type === 'chat') {
      const m = ev.text.trim().match(/^\D{0,3}(\d{1,5})\b/);
      const i = m ? cands.findIndex((c) => c.num === m[1]) : -1;
      if (i < 0) return;
      this.choice.set(id, i);
      const used = this.perUser.get(id) || 0;
      if (used >= 20 || !this.cd.ok(id)) return;
      this.perUser.set(id, used + 1);
      this.enqueue({ i, user: ev.user, votes: 1, tier: 0, what: 'comentou' });
    } else if (ev.type === 'gift') {
      const i = this.choice.get(id);
      if (i === undefined) { this.addLog(ev.user, 'comente o número antes!', '#ffd23f'); return; }
      this.gifts[i] += ev.count || 1;
      this.enqueue({ i, user: ev.user, votes: this.config.giftVotes * coins(ev), tier: giftTier(ev), what: `${ev.name} x${ev.count || 1}` });
    }
  },
  enqueue(item) {
    const q = this.machineOf(item.i).queue;
    // Com fila grande, junta votos seguidos do mesmo candidato para a urna não ficar para trás.
    const last = q[q.length - 1];
    if (q.length > 6 && last && last.i === item.i && item.tier < 2 && last.tier < 2) { last.votes += item.votes; last.user = item.user; return; }
    q.push(item);
  },
  addLog(user, msg, color = '#fff') {
    this.log.unshift({ user, msg, color, t: 7 });
    this.log.length = Math.min(this.log.length, 3);
  },

  commit(job) {
    const c = this.config.candidates[job.i];
    this.votes[job.i] += job.votes;
    this.last[job.i] = { user: job.user, what: job.what, votes: job.votes };
    addScore(this.supporters, job.user.nick, job.votes);
    this.flash[job.i] = 1;
    this.plus[job.i] = { n: job.votes, t: 1.8 };
    this.addLog(job.user, `votou ${c.num} +${job.votes}`, c.color);
    sfx.confirm();
    const p = this.cardRect(job.i);
    if (job.tier >= 2) burst(p.x + p.w / 2, p.y + p.h / 2, [c.color, '#fff', '#ffd23f'], 30 + job.tier * 20, 400 + job.tier * 80);
    if (job.tier >= 3) announcer.show(`@${trim(job.user.nick, 14)} +${job.votes}`, c.color, 2.5, 58);
    if (job.tier >= 4) { sfx.boom(); for (let k = 0; k < 6; k++) setTimeout(() => burst(rand(80, W - 80), rand(150, 650), COLORS, 60, 520), k * 220); }
  },

  // ---------- Animação ----------
  screenRect(m) { return { x: m.x + 18, y: m.y + 26, w: m.w * 0.5, h: m.h - 70 }; },
  padRect(m) { const s = this.screenRect(m); return { x: s.x + s.w + 14, y: m.y + 26, w: m.x + m.w - (s.x + s.w + 14) - 16, h: m.h - 70 }; },
  keyPos(m, k) {
    const p = this.padRect(m);
    const idx = KEYPAD.indexOf(k);
    const col = idx === 9 ? 1 : idx % 3, row = idx === 9 ? 3 : Math.floor(idx / 3);
    const kw = p.w / 3;
    return { x: p.x + kw * col + kw / 2, y: p.y + 18 + row * (p.h - 70) / 3.4 };
  },
  btnPos(m, which) {
    const p = this.padRect(m);
    const bw = p.w / 3;
    const k = { branco: 0, corrige: 1, confirma: 2 }[which];
    return { x: p.x + bw * k + bw / 2, y: p.y + p.h - 18, w: bw - 6 };
  },
  startJob(m) {
    const item = m.queue.shift();
    if (!item) return;
    const digits = this.config.candidates[item.i].num.split('');
    const steps = digits.map((d) => ({ kind: 'key', d, pos: this.keyPos(m, d) }));
    steps.push({ kind: 'confirm', pos: this.btnPos(m, 'confirma') });
    m.job = { ...item, steps, step: 0, t: 0, typed: '', stage: 'move' };
  },
  updateMachine(m, dt) {
    const speed = m.queue.length > 15 ? 4 : m.queue.length > 5 ? 2.4 : 1.3;
    const restX = m.x + m.w / 2 < W / 2 ? m.x + 40 : m.x + m.w - 40, restY = H + 80;
    if (!m.job) {
      this.startJob(m);
      m.hand.x += (restX - m.hand.x) * Math.min(1, dt * 3);
      m.hand.y += (restY - m.hand.y) * Math.min(1, dt * 3);
      return;
    }
    const j = m.job;
    j.t += dt * speed;
    if (j.stage === 'move') {
      const target = j.steps[j.step].pos;
      m.hand.x += (target.x - m.hand.x) * Math.min(1, dt * 9 * speed);
      m.hand.y += (target.y - m.hand.y) * Math.min(1, dt * 9 * speed);
      if (j.t > 0.3) { j.stage = 'press'; j.t = 0; }
    } else if (j.stage === 'press') {
      if (j.t > 0.14) {
        const s = j.steps[j.step];
        if (s.kind === 'key') { j.typed += s.d; sfx.key(); }
        else { this.commit(j); j.stage = 'fim'; j.t = 0; return; }
        j.step++; j.stage = 'move'; j.t = 0;
      }
    } else if (j.stage === 'fim' && j.t > 0.7) {
      m.job = null;
    }
  },
  update(dt) {
    for (let i = 0; i < this.flash.length; i++) {
      this.flash[i] = Math.max(0, this.flash[i] - dt * 2);
      if (this.plus[i] && (this.plus[i].t -= dt) <= 0) this.plus[i] = null;
    }
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    if (this.phase === 'running') {
      if (this.config.duration > 0) {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) return this.finish();
      }
    } else {
      this.endT -= dt;
      if (this.endT <= 0) this.reset();
      return;
    }
    for (const m of this.machines) this.updateMachine(m, dt);
  },
  finish() {
    // Votos que ainda estavam na fila entram no placar antes do resultado.
    for (const m of this.machines) {
      if (m.job && m.job.stage !== 'fim') this.commit(m.job);
      for (const q of m.queue) { this.votes[q.i] += q.votes; addScore(this.supporters, q.user.nick, q.votes); }
      m.queue = []; m.job = null;
    }
    this.phase = 'ended';
    this.endT = 12;
    sfx.win();
    const w = this.leader();
    if (w >= 0) for (let k = 0; k < 5; k++) setTimeout(() => burst(rand(100, W - 100), rand(250, 700), [this.config.candidates[w].color, '#ffd23f', '#fff'], 70, 550), k * 300);
  },
  leader() {
    const max = Math.max(...this.votes);
    if (max <= 0) return -1;
    return this.votes.filter((v) => v === max).length > 1 ? -1 : this.votes.indexOf(max);
  },

  // ---------- Desenho ----------
  cardRect(i) {
    const n = this.config.candidates.length;
    if (n === 2) return { x: 28 + i * 340, y: 252, w: 324, h: 318, big: true };
    return { x: 28 + (i % 2) * 340, y: 244 + Math.floor(i / 2) * 176, w: 324, h: 164, big: false };
  },
  drawRoom() {
    // Parede
    const g = ctx.createLinearGradient(0, 0, 0, TABLE_Y);
    g.addColorStop(0, '#3a3633'); g.addColorStop(0.5, '#6b625a'); g.addColorStop(1, '#8a8076');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, TABLE_Y);
    const vg = ctx.createRadialGradient(W / 2, 520, 80, W / 2, 520, 700);
    vg.addColorStop(0, 'rgba(255,240,220,.18)'); vg.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, TABLE_Y);
    // Piso em perspectiva
    const fg = ctx.createLinearGradient(0, TABLE_Y, 0, H);
    fg.addColorStop(0, '#6f675f'); fg.addColorStop(1, '#a39a8f');
    ctx.fillStyle = fg; ctx.fillRect(0, TABLE_Y, W, H - TABLE_Y);
    ctx.strokeStyle = 'rgba(40,30,25,.25)'; ctx.lineWidth = 2;
    for (let k = -8; k <= 8; k++) { ctx.beginPath(); ctx.moveTo(W / 2 + k * 40, TABLE_Y + 30); ctx.lineTo(W / 2 + k * 160, H); ctx.stroke(); }
    for (let k = 0; k < 6; k++) { const y = TABLE_Y + 40 + k * k * 14; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // Mesa
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, TABLE_Y + 34, W, 40);
    const tg = ctx.createLinearGradient(0, TABLE_Y - 22, 0, TABLE_Y + 34);
    tg.addColorStop(0, '#c9935a'); tg.addColorStop(0.35, '#a8723f'); tg.addColorStop(1, '#6e4521');
    ctx.fillStyle = tg; ctx.fillRect(0, TABLE_Y - 22, W, 56);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(0, TABLE_Y - 22, W, 4);
    for (let k = 0; k < 9; k++) { ctx.strokeStyle = 'rgba(80,45,20,.25)'; ctx.beginPath(); ctx.moveTo(0, TABLE_Y - 14 + k * 5); ctx.bezierCurveTo(200, TABLE_Y - 18 + k * 6, 500, TABLE_Y - 8 + k * 4, W, TABLE_Y - 14 + k * 5); ctx.stroke(); }
    ctx.fillStyle = '#2a2420';
    for (const x of [40, W - 70]) ctx.fillRect(x, TABLE_Y + 34, 30, 260);
  },
  drawMachine(m) {
    const { x, y, w, h } = m;
    const j = m.job;
    // Sombra e corpo bege com tampa em perspectiva
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 10;
    const bg = ctx.createLinearGradient(0, y, 0, y + h);
    bg.addColorStop(0, '#f1ece2'); bg.addColorStop(0.6, '#d8d0c2'); bg.addColorStop(1, '#b9b0a1');
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.fillStyle = bg; ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.roundRect(x, y, w, 18, [16, 16, 0, 0]); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill();
    ctx.fillStyle = '#a49a8b'; ctx.fillRect(x + 8, y + h - 10, w - 16, 10);
    // Tela
    const s = this.screenRect(m);
    ctx.fillStyle = '#4a4a4a'; ctx.beginPath(); ctx.roundRect(s.x - 5, s.y - 5, s.w + 10, s.h + 10, 8); ctx.fill();
    const sg = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
    const cand = j ? this.config.candidates[j.i] : null;
    const fim = j?.stage === 'fim';
    sg.addColorStop(0, fim ? '#fdf3f3' : '#f3f6fb'); sg.addColorStop(1, fim ? '#f2dede' : '#dfe6f1');
    ctx.fillStyle = sg; ctx.fillRect(s.x, s.y, s.w, s.h);
    if (!j) {
      label('SEU VOTO PARA', s.x + s.w / 2, s.y + 30, 15, '#444', 'center', 800);
      const n = this.config.candidates[m.cands[0]].num.length;
      for (let k = 0; k < n; k++) { const bw = 40, bx = s.x + s.w / 2 - (n * (bw + 8)) / 2 + k * (bw + 8) + 4; ctx.strokeStyle = '#333'; ctx.lineWidth = 2.5; ctx.strokeRect(bx, s.y + 56, bw, 56); }
      label('Comente o número', s.x + s.w / 2, s.y + s.h - 20, 13, '#666', 'center', 700);
    } else if (fim) {
      label('FIM', s.x + s.w / 2, s.y + s.h / 2 - 20, 64, '#151515', 'center', 400, F_NUM);
      label('CONFIRMADO', s.x + s.w / 2, s.y + s.h / 2 + 26, 15, '#c0392b', 'center', 900);
      label(`+${j.votes} VOTO${j.votes > 1 ? 'S' : ''}`, s.x + s.w / 2, s.y + s.h / 2 + 50, 22, '#c0392b', 'center', 400, F_NUM);
    } else {
      const n = cand.num.length;
      const bw = 34;
      for (let k = 0; k < n; k++) {
        const bx = s.x + 10 + k * (bw + 5);
        ctx.fillStyle = '#fff'; ctx.fillRect(bx, s.y + 30, bw, 56);
        ctx.strokeStyle = '#222'; ctx.lineWidth = 2.5; ctx.strokeRect(bx, s.y + 30, bw, 56);
        if (j.typed[k]) label(j.typed[k], bx + bw / 2, s.y + 60, 36, '#111', 'center', 400, F_NUM);
      }
      label('Número:', s.x + 12, s.y + 16, 12, '#555', 'left', 800);
      if (j.typed.length === n) {
        photo(cand.photo, s.x + s.w - 62, s.y + 22, 54, 66, 6, cand.name[0] || '?', cand.color);
        label(trim(cand.name, 14), s.x + 12, s.y + 108, 14, '#111', 'left', 900);
        label('CONFIRMA para confirmar', s.x + 12, s.y + s.h - 16, 11, '#555', 'left', 800);
      } else label(`@${trim(j.user.nick, 12)}`, s.x + 12, s.y + 108, 13, '#555', 'left', 800);
    }
    // Teclado
    const p = this.padRect(m);
    const pg = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    pg.addColorStop(0, '#2b2b2b'); pg.addColorStop(1, '#151515');
    ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 10); ctx.fillStyle = pg; ctx.fill();
    const kw = p.w / 3 - 10, kh = (p.h - 70) / 3.4 - 6;
    for (const k of KEYPAD) {
      const kp = this.keyPos(m, k);
      const pressed = j && j.stage === 'press' && j.steps[j.step]?.d === k;
      ctx.beginPath(); ctx.roundRect(kp.x - kw / 2, kp.y - kh / 2 + (pressed ? 2 : 0), kw, kh, 5);
      ctx.fillStyle = pressed ? '#5a5a5a' : '#0b0b0b'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.stroke();
      label(k, kp.x, kp.y + 1 + (pressed ? 2 : 0), Math.min(18, kh * 0.6), '#f2f2f2', 'center', 800);
    }
    const btns = [['branco', 'BRANCO', '#f6f6f6'], ['corrige', 'CORRIGE', '#f08c00'], ['confirma', 'CONFIRMA', '#2f9e44']];
    for (const [key, txt, col] of btns) {
      const b = this.btnPos(m, key);
      const lit = key === 'confirma' && j && (j.stage === 'fim' || (j.stage === 'press' && j.steps[j.step]?.kind === 'confirm'));
      ctx.save();
      if (lit) { ctx.shadowColor = '#7cff6b'; ctx.shadowBlur = 22; }
      ctx.beginPath(); ctx.roundRect(b.x - b.w / 2, b.y - 13, b.w, 26, 4); ctx.fillStyle = lit ? '#6bff7a' : col; ctx.fill();
      ctx.restore();
      label(txt, b.x, b.y + 1, Math.min(10, b.w / 7), '#111', 'center', 900);
    }
  },
  drawCard(i) {
    const c = this.config.candidates[i];
    const r = this.cardRect(i);
    const total = this.votes.reduce((a, b) => a + b, 0);
    const pct = total ? this.votes[i] / total : 0;
    const lead = this.leader() === i;
    panel(r.x, r.y, r.w, r.h, { r: 18, from: shade(c.color, -70), to: '#0b0e16', border: lead ? '#ffd23f' : shade(c.color, 20), glow: lead ? 'rgba(255,210,63,.45)' : null });
    // Faixa de cima com o número
    ctx.save();
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.big ? 62 : 48, [18, 18, 0, 0]);
    const hg = ctx.createLinearGradient(0, r.y, 0, r.y + 62);
    hg.addColorStop(0, shade(c.color, 30)); hg.addColorStop(1, c.color);
    ctx.fillStyle = hg; ctx.fill();
    ctx.restore();
    num(c.num, r.x + 16, r.y + (r.big ? 33 : 26), r.big ? 44 : 34, '#fff', 'left');
    if (lead) pill('👑 NA FRENTE', r.x + r.w - 74, r.y + (r.big ? 31 : 24), { bg: '#ffd23f', color: '#3a2a00', size: 14 });
    const ph = r.big ? 92 : 64;
    const px = r.x + r.w - ph - 14, py = r.y + (r.big ? 74 : 56);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10;
    photo(c.photo, px, py, ph, ph, 14, (c.name[0] || '?').toUpperCase(), shade(c.color, -20));
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(px, py, ph, ph, 14); ctx.stroke();
    if (r.big) {
      num(String(this.votes[i]), r.x + 22, r.y + 150, 104, '#fff', 'left');
      label('VOTOS', r.x + 24, r.y + 210, 15, 'rgba(255,255,255,.7)', 'left', 900);
      label(trim(c.name, 16), r.x + r.w - 14, r.y + 186, 16, '#fff', 'right', 800);
      glossBar(r.x + 18, r.y + 228, r.w - 36, 14, pct, c.color);
      num(`${(pct * 100).toFixed(1)}%`, r.x + 18, r.y + 264, 28, '#fff', 'left');
      label(`🎁 ${this.gifts[i]} presentes`, r.x + r.w - 18, r.y + 264, 15, '#ddd', 'right', 800);
      const l = this.last[i];
      if (l) {
        ctx.beginPath(); ctx.roundRect(r.x + 10, r.y + r.h - 34, r.w - 20, 26, 13); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
        avatar(l.user, r.x + 24, r.y + r.h - 21, 10, c.color);
        label(trim(`@${trim(l.user.nick, 10)} · ${l.what} · +${l.votes}`, 34), r.x + 40, r.y + r.h - 20, 12, '#fff', 'left', 800);
      }
    } else {
      num(String(this.votes[i]), r.x + 18, r.y + 96, 54, '#fff', 'left');
      label(trim(c.name, 14), r.x + 18, r.y + 130, 14, '#fff', 'left', 800);
      glossBar(r.x + 18, r.y + 142, r.w - 120, 10, pct, c.color);
      label(`${(pct * 100).toFixed(1)}%`, r.x + r.w - 96, r.y + 148, 13, '#fff', 'left', 800);
    }
    if (this.flash[i] > 0) { ctx.globalAlpha = this.flash[i] * 0.3; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1; }
    const p = this.plus[i];
    if (p) { ctx.globalAlpha = clamp(p.t, 0, 1); num(`+${p.n}`, r.x + (r.big ? 190 : 150), r.y + (r.big ? 130 : 90) - (1.8 - p.t) * 30, r.big ? 46 : 32, '#7cff6b'); ctx.globalAlpha = 1; }
  },
  draw() {
    cachedScene('urna-room', () => this.drawRoom());
    const cands = this.config.candidates;
    const total = this.votes.reduce((a, b) => a + b, 0);
    const lead = this.leader();

    // Cronômetro e faixa de status
    const urgent = this.config.duration > 0 && this.timeLeft < 30 && this.phase === 'running';
    panel(176, 22, 368, 118, { r: 26, from: '#1a1d26', to: '#05060a', glow: urgent ? 'rgba(254,44,85,.6)' : null });
    num(this.config.duration > 0 ? fmtTime(this.timeLeft) : 'AO VIVO', W / 2, 84, 96, urgent && Math.floor(this.timeLeft * 2) % 2 ? '#fe2c55' : '#fff');
    panel(28, 154, W - 56, 80, { r: 40, from: '#151821', to: '#07080d' });
    const sorted = [...this.votes].sort((a, b) => b - a);
    label('TOTAL', 110, 176, 13, '#9aa0b4', 'center', 900); num(String(total), 110, 208, 34);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(196, 168, 2, 52);
    label('DIFERENÇA', 270, 176, 13, '#9aa0b4', 'center', 900); num(String((sorted[0] || 0) - (sorted[1] || 0)), 270, 208, 34);
    const lc = lead >= 0 ? cands[lead].color : '#3a4153';
    ctx.save(); ctx.shadowColor = lc; ctx.shadowBlur = lead >= 0 ? 18 : 0;
    ctx.beginPath(); ctx.roundRect(356, 164, W - 56 - 338, 60, 30);
    const lg = ctx.createLinearGradient(0, 164, 0, 224); lg.addColorStop(0, shade(lc, 30)); lg.addColorStop(1, shade(lc, -20));
    ctx.fillStyle = lg; ctx.fill(); ctx.restore();
    num(lead >= 0 ? `${cands[lead].num} NA FRENTE` : total ? 'EMPATE' : 'VOTE AGORA', 356 + (W - 56 - 338) / 2, 195, 34);

    cands.forEach((_, i) => this.drawCard(i));
    for (const m of this.machines) this.drawMachine(m);
    // Avisos de quem votou
    this.log.forEach((l, k) => toast(l.user, trim(`@${trim(l.user.nick, 12)} ${l.msg}`, 30), W / 2, 922 + k * 46, { color: l.color, align: 'center', alpha: clamp(l.t, 0, 1) }));
    leaderboardSmall(this.supporters, W / 2 - 150, 1090);
    // Mãos por cima de tudo
    for (const m of this.machines) {
      const pressing = m.job && m.job.stage === 'press';
      const left = m.x + m.w / 2 < W / 2 || this.machines.length === 1;
      hand(m.hand.x, m.hand.y, { scale: 0.55, angle: left ? 0.42 : -0.42, press: pressing ? 1 : 0, sleeve: m === this.machines[1] ? '#d9d9e3' : '#8fb8de', skin: m === this.machines[1] ? '#c68642' : '#e0ac69' });
    }
    if (this.phase === 'ended') this.drawWinner();
  },
  drawWinner() {
    const w = this.leader();
    ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(0, 0, W, H);
    const rg = ctx.createRadialGradient(W / 2, 480, 20, W / 2, 480, 420);
    rg.addColorStop(0, 'rgba(255,210,63,.35)'); rg.addColorStop(1, 'rgba(255,210,63,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    if (w < 0) {
      title('EMPATE!', W / 2, 480, 80, '#ffd23f');
    } else {
      const c = this.config.candidates[w];
      title('VENCEU', W / 2, 230, 72, '#ffd23f');
      ctx.save(); ctx.shadowColor = c.color; ctx.shadowBlur = 50;
      photo(c.photo, W / 2 - 160, 300, 320, 320, 30, c.num, c.color);
      ctx.restore();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(W / 2 - 160, 300, 320, 320, 30); ctx.stroke();
      pill(`${c.num}`, W / 2, 300, { bg: c.color, size: 30, font: F_NUM });
      text(trim(c.name, 18), W / 2, 670, 50, '#fff', 'center', 900);
      num(`${this.votes[w]} VOTOS`, W / 2, 735, 52, '#7cff6b');
    }
    leaderboard(this.supporters, 'Quem mais votou', W / 2, 830, 3, 30);
    text(`Nova rodada em ${Math.ceil(this.endT)}s`, W / 2, 1150, 30, '#ddd', 'center', 700);
  },

  renderSettings(el, save) {
    const cfg = structuredClone(this.config);
    const draw = () => {
      el.innerHTML = '';
      cfg.candidates.forEach((c, i) => {
        const box = document.createElement('div');
        box.className = 'cand';
        box.innerHTML = `
          <img alt="" src="${c.photo || ''}" ${c.photo ? '' : 'hidden'}>
          <div class="fields">
            <label>Número <input data-k="num" inputmode="numeric" maxlength="5" value="${c.num}"></label>
            <label>Nome <input data-k="name" maxlength="24" value="${c.name.replace(/"/g, '&quot;')}"></label>
            <label class="row2">Cor <input data-k="color" type="color" value="${c.color}">
              <span class="file">📷 Foto<input data-k="photo" type="file" accept="image/*"></span>
              ${cfg.candidates.length > 2 ? '<button data-del>✕</button>' : ''}</label>
          </div>`;
        box.querySelectorAll('input').forEach((inp) => inp.addEventListener('change', async () => {
          if (inp.dataset.k === 'photo') {
            if (!inp.files[0]) return;
            c.photo = await fileToSquareDataUrl(inp.files[0]);
            draw();
          } else if (inp.dataset.k === 'num') c.num = inp.value.replace(/\D/g, '').slice(0, 5) || c.num;
          else c[inp.dataset.k] = inp.value.trim() || c[inp.dataset.k];
        }));
        box.querySelector('[data-del]')?.addEventListener('click', () => { cfg.candidates.splice(i, 1); draw(); });
        el.append(box);
      });
      const extra = document.createElement('div');
      extra.className = 'cfg-extra';
      extra.innerHTML = `
        ${cfg.candidates.length < 4 ? '<button data-add>+ Adicionar candidato</button>' : ''}
        <label>Rodada (minutos, 0 = sem tempo) <input data-k="duration" type="number" min="0" max="120" value="${cfg.duration}"></label>
        <label>Votos por moeda de presente <input data-k="giftVotes" type="number" min="1" max="1000" value="${cfg.giftVotes}"></label>
        <button data-save class="primary">Salvar e reiniciar rodada</button>`;
      extra.querySelector('[data-add]')?.addEventListener('click', () => {
        const n = cfg.candidates.length;
        cfg.candidates.push({ num: String((n + 1) * 11), name: `Candidato ${'ABCD'[n]}`, color: URNA_COLORS[n], photo: '' });
        draw();
      });
      extra.querySelectorAll('input').forEach((inp) => inp.addEventListener('change', () => { cfg[inp.dataset.k] = clamp(Number(inp.value) || 0, Number(inp.min), Number(inp.max)); }));
      extra.querySelector('[data-save]').addEventListener('click', () => {
        const nums = cfg.candidates.map((c) => c.num);
        if (new Set(nums).size !== nums.length) { alert('Cada candidato precisa de um número diferente.'); return; }
        this.applyConfig(structuredClone(cfg));
        save(this.config);
      });
      el.append(extra);
    };
    draw();
  },
});

// Top 3 compacto para o canto da tela.
function leaderboardSmall(map, x, y, w = 300) {
  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (!rows.length) return;
  panel(x, y - 24, w, 44 + rows.length * 36, { r: 16, from: 'rgba(20,24,36,.92)', to: 'rgba(6,8,14,.92)' });
  label('TOP 3', x + 16, y, 15, '#ffd23f', 'left', 900);
  rows.forEach(([name, v], i) => {
    const yy = y + 34 + i * 36;
    posBadge(i + 1, x + 28, yy, 24);
    label(`@${trim(name, 14)}`, x + 50, yy + 1, 16, '#fff', 'left', 800);
    label(String(v), x + w - 16, yy + 1, 16, '#ffd23f', 'right', 900);
  });
}
