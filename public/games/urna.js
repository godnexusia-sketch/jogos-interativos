'use strict';

// Urna: candidatos com foto e número escolhidos por você. Comentar o número vota;
// presente vale votos por moeda. Cada voto passa pela urna: a mão digita, a foto aparece, CONFIRMA.
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
    this.choice = new Map();
    this.perUser = new Map();
    this.supporters = new Map();
    this.queue = [];
    this.job = null;
    this.log = [];
    this.flash = new Array(n).fill(0);
    this.plus = new Array(n).fill(null);
    this.timeLeft = this.config.duration * 60;
    this.phase = 'running';
    this.endT = 0;
    this.hand = { x: W / 2, y: H + 100 };
  },
  getConfig() { return this.config; },
  applyConfig(cfg) {
    if (!cfg?.candidates?.length) return;
    this.config = cfg;
    store.set('cfg:urna', cfg);
    this.reset();
  },
  sample() { return pick(this.config.candidates).num; },

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
      this.enqueue({ i, user: ev.user, votes: 1, tier: 0 });
    } else if (ev.type === 'gift') {
      const i = this.choice.get(id);
      if (i === undefined) { this.addLog(ev.user, 'comente o número antes!', '#ffd23f'); return; }
      this.gifts[i] += ev.count || 1;
      this.enqueue({ i, user: ev.user, votes: this.config.giftVotes * coins(ev), tier: giftTier(ev), gift: ev.name });
    }
  },
  enqueue(item) {
    // Com fila grande, junta votos seguidos do mesmo candidato para a urna não ficar para trás.
    const last = this.queue[this.queue.length - 1];
    if (this.queue.length > 8 && last && last.i === item.i && item.tier < 2 && last.tier < 2) { last.votes += item.votes; last.user = item.user; return; }
    this.queue.push(item);
  },
  addLog(user, msg, color = '#fff') {
    this.log.unshift({ user, msg, color, t: 8 });
    this.log.length = Math.min(this.log.length, 4);
  },

  // Aplica o voto quando a urna confirma.
  commit(job) {
    const c = this.config.candidates[job.i];
    this.votes[job.i] += job.votes;
    addScore(this.supporters, job.user.nick, job.votes);
    this.flash[job.i] = 1;
    this.plus[job.i] = { n: job.votes, t: 1.6 };
    this.addLog(job.user, `votou ${c.num} +${job.votes}`, c.color);
    sfx.confirm();
    const cx = this.cardCenter(job.i);
    if (job.tier >= 2) burst(cx.x, cx.y, [c.color, '#fff', '#ffd23f'], 30 + job.tier * 20, 400 + job.tier * 80);
    if (job.tier >= 3) announcer.show(`${trim(job.user.nick, 14)} +${job.votes}`, c.color, 2.5, 60);
    if (job.tier >= 4) { sfx.boom(); for (let k = 0; k < 6; k++) setTimeout(() => burst(rand(80, W - 80), rand(150, 650), COLORS, 60, 520), k * 220); }
  },

  // ---------- Animação da urna ----------
  keyPos(k) {
    const idx = KEYPAD.indexOf(k);
    const col = idx === 9 ? 1 : idx % 3, row = idx === 9 ? 3 : Math.floor(idx / 3);
    return { x: 494 + col * 70, y: 978 + row * 44 };
  },
  confirmPos() { return { x: 614, y: 1172 }; },
  startJob() {
    const item = this.queue.shift();
    if (!item) return;
    const digits = this.config.candidates[item.i].num.split('');
    const steps = digits.map((d) => ({ kind: 'key', d, pos: this.keyPos(d) }));
    steps.push({ kind: 'confirm', pos: this.confirmPos() });
    this.job = { ...item, steps, step: 0, t: 0, typed: '', stage: 'move', done: 0 };
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
        if (this.timeLeft <= 0) this.finish();
      }
    } else if (this.phase === 'ended') {
      this.endT -= dt;
      if (this.endT <= 0) this.reset();
      return;
    }

    // A mão anda mais rápido quando tem fila.
    const speed = this.queue.length > 15 ? 4 : this.queue.length > 5 ? 2.2 : 1.2;
    if (!this.job) {
      this.startJob();
      const rest = { x: 640, y: H + 60 };
      this.hand.x += (rest.x - this.hand.x) * Math.min(1, dt * 4);
      this.hand.y += (rest.y - this.hand.y) * Math.min(1, dt * 4);
      return;
    }
    const j = this.job;
    j.t += dt * speed;
    if (j.stage === 'move') {
      const target = j.steps[j.step].pos;
      this.hand.x += (target.x - this.hand.x) * Math.min(1, dt * 10 * speed);
      this.hand.y += (target.y - this.hand.y) * Math.min(1, dt * 10 * speed);
      if (j.t > 0.28) { j.stage = 'press'; j.t = 0; }
    } else if (j.stage === 'press') {
      if (j.t > 0.12) {
        const s = j.steps[j.step];
        if (s.kind === 'key') { j.typed += s.d; sfx.key(); }
        else { this.commit(j); j.stage = 'fim'; j.t = 0; return; }
        j.step++; j.stage = 'move'; j.t = 0;
      }
    } else if (j.stage === 'fim' && j.t > 0.55) {
      this.job = null;
    }
  },
  finish() {
    // Votos que ainda estavam na fila entram no placar antes do resultado.
    if (this.job && this.job.stage !== 'fim') this.commit(this.job);
    for (const q of this.queue) { this.votes[q.i] += q.votes; addScore(this.supporters, q.user.nick, q.votes); }
    this.queue = []; this.job = null;
    this.phase = 'ended';
    this.endT = 12;
    sfx.win();
    const w = this.leader();
    if (w >= 0) for (let k = 0; k < 5; k++) setTimeout(() => burst(rand(100, W - 100), rand(250, 700), [this.config.candidates[w].color, '#ffd23f', '#fff'], 70, 550), k * 300);
  },
  leader() {
    const max = Math.max(...this.votes);
    if (max <= 0) return -1;
    const tied = this.votes.filter((v) => v === max).length > 1;
    return tied ? -1 : this.votes.indexOf(max);
  },

  // ---------- Desenho ----------
  layout() {
    const n = this.config.candidates.length;
    if (n <= 2) return { cols: 2, w: 318, h: 470, top: 300 };
    return { cols: 2, w: 318, h: 300, top: 290 };
  },
  cardCenter(i) {
    const L = this.layout();
    const col = i % L.cols, row = Math.floor(i / L.cols);
    return { x: 30 + col * (L.w + 24) + L.w / 2, y: L.top + row * (L.h + 16) + L.h / 2 };
  },
  draw() {
    background('#1a1f2e', '#0b0e16');
    const cands = this.config.candidates;
    const total = this.votes.reduce((a, b) => a + b, 0);
    const lead = this.leader();

    // Cronômetro
    roundRect(200, 26, 320, 104, 22, '#05070c');
    const urgent = this.config.duration > 0 && this.timeLeft < 30 && this.phase === 'running';
    text(this.config.duration > 0 ? fmtTime(this.timeLeft) : 'AO VIVO', W / 2, 80, 76, urgent && Math.floor(this.timeLeft * 2) % 2 ? '#fe2c55' : '#fff');

    // Faixa: total, diferença, quem está na frente
    roundRect(30, 150, W - 60, 120, 20, '#05070c');
    const sorted = [...this.votes].sort((a, b) => b - a);
    const diff = (sorted[0] || 0) - (sorted[1] || 0);
    text('TOTAL', 110, 182, 22, '#9aa0b4', 'center', 700);
    text(String(total), 110, 228, 46);
    text('DIFERENÇA', 270, 182, 22, '#9aa0b4', 'center', 700);
    text(String(diff), 270, 228, 46);
    if (lead >= 0) {
      roundRect(370, 168, 320, 84, 18, cands[lead].color);
      text(`${cands[lead].num} NA FRENTE`, 530, 211, 40);
    } else {
      roundRect(370, 168, 320, 84, 18, '#333a4d');
      text(total ? 'EMPATE' : 'VOTE AGORA', 530, 211, 40);
    }

    // Cartões dos candidatos
    const L = this.layout();
    cands.forEach((c, i) => {
      const col = i % L.cols, row = Math.floor(i / L.cols);
      const x = 30 + col * (L.w + 24), y = L.top + row * (L.h + 16);
      const pct = total ? this.votes[i] / total : 0;
      const big = L.h > 400;
      roundRect(x - 4, y - 4, L.w + 8, L.h + 8, 24, lead === i ? '#ffd23f' : 'rgba(255,255,255,.12)');
      roundRect(x, y, L.w, L.h, 20, '#10141f');
      roundRect(x, y, L.w, 64, [20, 20, 0, 0], c.color);
      text(c.num, x + 18, y + 34, 44, '#fff', 'left', 800);
      if (lead === i) text('👑 NA FRENTE', x + L.w - 14, y + 34, 20, '#fff', 'right', 800);
      const ph = big ? 190 : 120;
      photo(c.photo, x + (L.w - ph) / 2, y + 76, ph, ph, 18, c.num, c.color + '88');
      text(trim(c.name, 14), x + L.w / 2, y + 76 + ph + 28, big ? 32 : 26);
      text(String(this.votes[i]), x + L.w / 2, y + 76 + ph + (big ? 90 : 70), big ? 76 : 52, '#fff', 'center', 800);
      if (big) text('VOTOS', x + L.w / 2, y + 76 + ph + 138, 20, '#9aa0b4');
      const by = y + L.h - (big ? 52 : 34);
      roundRect(x + 16, by, L.w - 32, 12, 6, 'rgba(255,255,255,.12)');
      if (pct > 0) roundRect(x + 16, by, Math.max(12, (L.w - 32) * pct), 12, 6, c.color);
      text(`${(pct * 100).toFixed(1)}%`, x + 18, by + (big ? 32 : 24), big ? 26 : 20, '#fff', 'left');
      text(`🎁 ${this.gifts[i]}`, x + L.w - 18, by + (big ? 32 : 24), big ? 22 : 18, '#ddd', 'right', 600);
      if (this.flash[i] > 0) { ctx.globalAlpha = this.flash[i] * 0.35; roundRect(x, y, L.w, L.h, 20, '#fff'); ctx.globalAlpha = 1; }
      const p = this.plus[i];
      if (p) { ctx.globalAlpha = clamp(p.t, 0, 1); text(`+${p.n}`, x + L.w - 50, y + 130 - (1.6 - p.t) * 40, 56, '#7cff6b'); ctx.globalAlpha = 1; }
    });

    // Quem votou por último (com foto do perfil)
    const logTop = cands.length <= 2 ? 790 : 924;
    this.log.slice(0, cands.length <= 2 ? 3 : 1).forEach((l, k) => {
      const y = logTop + k * 50;
      ctx.globalAlpha = clamp(l.t, 0, 1);
      roundRect(30, y - 22, 400, 44, 22, 'rgba(0,0,0,.6)');
      avatar(l.user, 52, y, 18, l.color);
      text(trim(`@${trim(l.user.nick, 12)} ${l.msg}`, 30), 80, y, 20, '#fff', 'left', 700);
      ctx.globalAlpha = 1;
    });

    this.drawMachine();
    leaderboardSmall(this.supporters, 30, cands.length <= 2 ? 960 : 990);
    if (this.queue.length > 3) text(`fila: ${this.queue.length}`, 220, 1240, 22, '#9aa0b4');

    if (this.phase === 'ended') this.drawWinner();
  },
  drawMachine() {
    const j = this.job;
    const x = 440, y = 780, w = 250, h = 470;
    roundRect(x, y, w, h, 22, '#d9d4c7');
    roundRect(x + 14, y + 14, w - 28, 140, 10, '#f4f1e8');
    const cand = j ? this.config.candidates[j.i] : null;
    if (!j) {
      label('SEU VOTO PARA', x + w / 2, y + 60, 22, '#555', 'center', 800);
      label('_ _', x + w / 2, y + 105, 34, '#777');
    } else if (j.stage === 'fim') {
      label('FIM', x + w / 2, y + 70, 72, '#111', 'center', 900);
      label(`+${j.votes} VOTO${j.votes > 1 ? 'S' : ''}`, x + w / 2, y + 125, 24, '#1f9d55', 'center', 800);
    } else {
      const shown = cand.num.length === j.typed.length;
      ctx.save();
      ctx.font = '800 46px ui-monospace, monospace';
      const boxes = cand.num.length;
      for (let k = 0; k < boxes; k++) {
        const bx = x + 26 + k * 46;
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.strokeRect(bx, y + 40, 40, 56);
        if (j.typed[k]) label(j.typed[k], bx + 20, y + 70, 40, '#111', 'center', 800);
      }
      ctx.restore();
      if (shown) {
        photo(cand.photo, x + w - 100, y + 24, 76, 92, 8, cand.num, cand.color);
        label(trim(cand.name, 12), x + 26, y + 116, 18, '#111', 'left', 800);
      }
      label(`@${trim(j.user.nick, 12)}`, x + 26, y + 138, 15, '#555', 'left', 700);
    }
    // Teclado
    roundRect(x + 14, y + 170, w - 28, h - 184, 12, '#2a2a2a');
    for (const k of KEYPAD) {
      const p = this.keyPos(k);
      const pressed = j && j.stage === 'press' && j.steps[j.step]?.d === k;
      roundRect(p.x - 28, p.y - 19, 56, 38, 8, pressed ? '#555' : '#111');
      text(k, p.x, p.y, 26, '#fff');
    }
    const by = 1172;
    roundRect(x + 22, by - 22, 64, 44, 8, '#f4f4f4'); label('BRANCO', x + 54, by, 12, '#111', 'center', 800);
    roundRect(x + 92, by - 22, 64, 44, 8, '#e8590c'); label('CORRIGE', x + 124, by, 12, '#111', 'center', 800);
    const pressedC = j && j.stage === 'press' && j.steps[j.step]?.kind === 'confirm';
    roundRect(x + 162, by - 22, 72, 44, 8, pressedC ? '#7cff6b' : '#2f9e44'); label('CONFIRMA', x + 198, by, 12, '#111', 'center', 800);
    // Mão
    if (this.hand.y < H + 40) {
      const pressing = j && j.stage === 'press';
      text('👆', this.hand.x + 8, this.hand.y + (pressing ? 34 : 44), 70);
    }
  },
  drawWinner() {
    const w = this.leader();
    ctx.fillStyle = 'rgba(0,0,0,.78)';
    ctx.fillRect(0, 0, W, H);
    if (w < 0) {
      text('EMPATE!', W / 2, 480, 90, '#ffd23f');
    } else {
      const c = this.config.candidates[w];
      text('🏆 VENCEU', W / 2, 260, 70, '#ffd23f');
      roundRect(W / 2 - 170, 330, 340, 340, 30, c.color);
      photo(c.photo, W / 2 - 160, 340, 320, 320, 24, c.num, c.color);
      text(`${c.num} · ${trim(c.name, 16)}`, W / 2, 730, 52);
      text(`${this.votes[w]} votos`, W / 2, 800, 44, '#7cff6b');
    }
    leaderboard(this.supporters, 'Quem mais votou', W / 2, 900, 3, 30);
    text(`Nova rodada em ${Math.ceil(this.endT)}s`, W / 2, 1150, 34, '#ddd', 'center', 600);
  },

  // ---------- Painel de configuração ----------
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
function leaderboardSmall(map, x, y) {
  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (!rows.length) return;
  roundRect(x, y - 26, 390, 40 + rows.length * 40, 16, 'rgba(0,0,0,.55)');
  text('TOP APOIADORES', x + 16, y - 4, 20, '#ffd23f', 'left', 800);
  rows.forEach(([name, v], i) => text(`${i + 1}. @${trim(name, 14)} — ${v}`, x + 16, y + 34 + i * 40, 22, '#fff', 'left', 700));
}
