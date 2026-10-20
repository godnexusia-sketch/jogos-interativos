'use strict';

// Corrida de Torcidas: 2 a 4 corredores com foto e nome escolhidos por você.
// O público escolhe por quem torce comentando o nome ou o número; presentes viram efeitos na pista.
const TORCIDA_COLORS = ['#2f7cf6', '#e5383b', '#1f9d55', '#f59f00'];

registerGame(withConfig({
  id: 'torcida',
  name: 'Corrida de Torcidas',
  icon: '🏃',
  help: '<p>Comente o <b>nome</b> ou o <b>número</b> (1, 2…) do corredor para torcer por ele. Cada comentário depois disso empurra um pouco.</p><p>🌹 Impulso · 🍩 Casca de banana no rival da frente · 🕶️ Superarrancada · 🌌 Tropeço em todos os rivais + escudo.</p><p>❤️ Likes enchem a <b>meta coletiva</b>: quando completa, quem está em último ganha uma arrancada.</p>',
  cd: new Cooldown(1500),
  wins: new Map(),
  reset() {
    const n = this.config.items.length;
    this.runners = this.config.items.map((it, i) => ({ ...it, i, pos: 0, boost: 0, mult: 1, slip: 0, shield: 0, fans: 0 }));
    this.fan = new Map();
    this.top = new Map();
    this.phase = 'countdown';
    this.timer = 5;
    this.log = [];
    this.goal = { n: 0, need: 100, t: 30 };
    this.winner = null;
    this.speedFx = new Array(n).fill(0);
  },
  renderSettings(el, save) {
    renderItemsSettings(el, structuredClone(this.config), {
      min: 2, max: 4, itemLabel: 'Corredor',
      extras: [{ key: 'length', label: 'Tamanho da pista (100 = uns 2 min)', min: 30, max: 1000 }],
      newItem: (n) => ({ name: `Corredor ${n + 1}`, color: TORCIDA_COLORS[n], photo: '' }),
    }, (cfg) => { this.applyConfig(cfg); save(this.config); });
  },
  sample() { return Math.random() < 0.4 ? String(randInt(1, this.runners.length)) : pick(['vai!', 'corre', 'bora']); },
  pickRunner(t) {
    t = t.trim().toLowerCase();
    const m = t.match(/^([1-4])\b/);
    if (m && Number(m[1]) <= this.runners.length) return this.runners[Number(m[1]) - 1];
    return this.runners.find((r) => t.includes(r.name.toLowerCase()));
  },
  addLog(user, msg, color) { this.log.unshift({ user, msg, color, t: 7 }); this.log.length = Math.min(this.log.length, 4); },
  leaderOf(except) { return [...this.runners].filter((r) => r !== except).sort((a, b) => b.pos - a.pos)[0]; },
  apply(r, kind, secs, user) {
    if (kind === 'boost') { r.boost = Math.max(r.boost, secs); r.mult = Math.max(r.mult, 2); }
    if (kind === 'super') { r.boost = Math.max(r.boost, secs); r.mult = 3.5; }
    if (kind === 'slip') {
      if (r.shield > 0) { r.shield = 0; this.addLog(user, `bateu no escudo de ${r.name}`, '#25f4ee'); return; }
      r.slip = Math.max(r.slip, secs); r.boost = 0;
      { const q = this.runnerXY(r); burst(q.x, q.y - 120, ['#ffd23f', '#fff'], 20, 250); }
    }
  },
  onEvent(ev) {
    if (this.phase === 'finish') return;
    const id = uid(ev);
    if (ev.type === 'chat') {
      const r = this.pickRunner(ev.text);
      if (r && this.fan.get(id) !== r.i) {
        if (this.fan.has(id)) this.runners[this.fan.get(id)].fans--;
        this.fan.set(id, r.i); r.fans++;
        this.addLog(ev.user, `torce por ${r.name}`, r.color);
        return;
      }
      const mine = this.fan.has(id) ? this.runners[this.fan.get(id)] : null;
      if (mine && this.phase === 'race' && this.cd.ok(id)) { mine.pos += 0.35; addScore(this.top, ev.user.nick, 1); }
    } else if (ev.type === 'like') {
      this.goal.n += ev.count;
      const mine = this.fan.has(id) ? this.runners[this.fan.get(id)] : null;
      if (mine && this.phase === 'race') mine.pos += Math.min(1, 0.04 * ev.count);
    } else if (ev.type === 'social') {
      const mine = this.fan.has(id) ? this.runners[this.fan.get(id)] : null;
      if (mine) { mine.pos += 2; this.addLog(ev.user, `seguiu/compartilhou: +2 para ${mine.name}`, mine.color); }
    } else if (ev.type === 'gift') {
      if (!this.fan.has(id)) { this.addLog(ev.user, 'comente o nome do corredor antes!', '#ffd23f'); return; }
      const r = this.runners[this.fan.get(id)];
      const tier = giftTier(ev);
      addScore(this.top, ev.user.nick, coins(ev) * 5);
      if (tier === 1) { this.apply(r, 'boost', 3 + ev.count, ev.user); this.addLog(ev.user, `deu IMPULSO em ${r.name}`, r.color); }
      else if (tier === 2) {
        const rival = this.leaderOf(r);
        this.apply(rival, 'slip', 2.5, ev.user);
        this.addLog(ev.user, `jogou 🍌 em ${rival.name}`, '#ffd23f');
      } else if (tier === 3) { this.apply(r, 'super', 5, ev.user); this.addLog(ev.user, `SUPERARRANCADA em ${r.name}`, r.color); announcer.show(`⚡ ${trim(ev.user.nick, 12)}`, r.color, 2, 56); }
      else {
        for (const o of this.runners) if (o !== r) this.apply(o, 'slip', 3, ev.user);
        r.shield = 15;
        this.apply(r, 'super', 4, ev.user);
        this.addLog(ev.user, `derrubou todo mundo! 🛡️ ${r.name}`, r.color);
        announcer.show(`🌪️ ${trim(ev.user.nick, 12)}`, r.color, 2.5, 64);
        sfx.boom();
      }
    }
  },
  update(dt) {
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    if (this.phase === 'countdown') {
      this.timer -= dt;
      if (this.timer <= 0) { this.phase = 'race'; this.timer = 0; announcer.show('LARGADA!', '#7cff6b', 1.2, 90); sfx.win(); }
      return;
    }
    if (this.phase === 'finish') {
      this.timer -= dt;
      if (this.timer <= 0) { const fans = this.fan; this.reset(); this.fan = fans; for (const [, i] of fans) if (this.runners[i]) this.runners[i].fans++; }
      return;
    }
    this.timer += dt;
    // Meta coletiva de likes
    this.goal.t -= dt;
    if (this.goal.n >= this.goal.need) {
      const last = [...this.runners].sort((a, b) => a.pos - b.pos)[0];
      this.apply(last, 'super', 5);
      announcer.show(`META BATIDA! ⚡ ${last.name}`, '#7cff6b', 2.5, 50);
      sfx.win();
      this.goal = { n: 0, need: Math.round(this.goal.need * 1.3), t: 30 };
    } else if (this.goal.t <= 0) this.goal = { n: 0, need: this.goal.need, t: 30 };

    const L = this.config.length;
    for (const r of this.runners) {
      r.boost = Math.max(0, r.boost - dt);
      if (r.boost <= 0) r.mult = 1;
      r.slip = Math.max(0, r.slip - dt);
      r.shield = Math.max(0, r.shield - dt);
      const v = r.slip > 0 ? 0.1 : 0.8 * r.mult;
      r.pos = Math.min(L, r.pos + v * dt);
    }
    const w = this.runners.find((r) => r.pos >= L);
    if (w) {
      this.winner = w;
      this.phase = 'finish';
      this.timer = 15;
      addScore(this.wins, w.name);
      sfx.win();
      for (let k = 0; k < 5; k++) setTimeout(() => burst(rand(100, W - 100), rand(250, 700), [w.color, '#ffd23f', '#fff'], 70, 550), k * 250);
    }
  },
  // ---------- Desenho ----------
  // Pistas em profundidade: a de trás mais alta e menor, a da frente mais baixa e maior.
  laneY(i) { return this.runners.length > 2 ? 800 + i * 96 : 880 + i * 200; },
  laneScale(i) { return this.runners.length > 2 ? 0.7 + i * 0.12 : 1.0 + i * 0.28; },
  // Câmera segue o líder: 1 unidade de pista = 4 m, 18 px por metro.
  runnerXY(r) {
    const lead = Math.max(...this.runners.map((o) => o.pos));
    const spread = Math.max(1, (lead - Math.min(...this.runners.map((o) => o.pos))) * 4 * 18 / 380);
    return { x: 520 - ((lead - r.pos) * 4 * 18) / spread, y: this.laneY(r.i) };
  },
  drawStadium() {
    const g = ctx.createLinearGradient(0, 0, 0, 560);
    g.addColorStop(0, '#2563eb'); g.addColorStop(1, '#93c5fd');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 560);
    // Arquibancada desfocada: desenhada pequena e ampliada
    const c = document.createElement('canvas'); c.width = 120; c.height = 60;
    const cg = c.getContext('2d');
    cg.fillStyle = '#1e293b'; cg.fillRect(0, 0, 120, 60);
    for (let i = 0; i < 900; i++) { cg.fillStyle = ['#f87171', '#facc15', '#60a5fa', '#f1f5f9', '#4ade80', '#fb923c'][i % 6]; cg.fillRect(Math.random() * 120, 6 + Math.random() * 54, 1.5, 1.5); }
    ctx.save(); ctx.filter = 'blur(3px)'; ctx.drawImage(c, -10, 296, W + 20, 310); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(0, 300, W, 300);
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 596, W, 14);
    for (let i = 0; i < 20; i++) { ctx.fillStyle = i % 2 ? '#facc15' : '#f97316'; ctx.fillRect(i * 36, 596, 30, 14); }
    // Pista
    const tg = ctx.createLinearGradient(0, 610, 0, 1110);
    tg.addColorStop(0, '#c2410c'); tg.addColorStop(1, '#9a3412');
    ctx.fillStyle = tg; ctx.fillRect(0, 610, W, 500);
    for (let i = 0; i < 2000; i++) { ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(Math.random() * W, 610 + Math.random() * 500, 2, 2); }
    // Grama e faixa de velocidade em primeiro plano
    ctx.fillStyle = '#16a34a'; ctx.fillRect(0, 1110, W, H - 1110);
    for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? '#15803d' : '#22c55e'; ctx.fillRect(0, 1110 + i * 26, W, 13); }
  },
  drawRunner(r, x, y, t, s = 1, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    ctx.scale(s, s);
    const fallen = r.slip > 0;
    if (fallen) { ctx.rotate(-1.2); ctx.translate(-30, -10); }
    const ph = fallen ? 0 : t * (9 + r.mult * 3) + r.i;
    const skin = '#c68642', shorts = shade(r.color, -70), shoe = '#f8fafc';
    const seg = (x0, y0, a, len, w, col) => {
      const x1 = x0 + Math.sin(a) * len, y1 = y0 + Math.cos(a) * len;
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      return [x1, y1];
    };
    const leg = (p, dark) => {
      const th = Math.sin(p) * 0.85;
      const kneeBend = 0.25 + Math.max(0, Math.sin(p + 1.4)) * 1.5;
      const [kx, ky] = seg(0, -92, th, 46, 17, dark ? shade(skin, -30) : skin);
      const [fx, fy] = seg(kx, ky, th - kneeBend, 44, 14, dark ? shade(skin, -30) : skin);
      ctx.fillStyle = dark ? '#cbd5e1' : shoe; ctx.beginPath(); ctx.roundRect(fx - 8, fy - 6, 26, 12, 6); ctx.fill();
      ctx.fillStyle = r.color; ctx.fillRect(fx - 4, fy - 2, 14, 3);
    };
    const arm = (p, dark) => {
      const ua = -Math.sin(p) * 0.9 + Math.PI;
      const [ex, ey] = seg(0, -150, ua, 34, 12, dark ? shade(skin, -30) : skin);
      seg(ex, ey, ua - 1.6 * (Math.sin(p) > 0 ? 1 : 0.6), 30, 11, dark ? shade(skin, -30) : skin);
    };
    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(6, 0, 46, 8, 0, 0, 7); ctx.fill();
    arm(ph + Math.PI, true); leg(ph + Math.PI, true);
    // Short e camisa
    ctx.fillStyle = shorts; ctx.beginPath(); ctx.roundRect(-20, -110, 42, 30, 8); ctx.fill();
    const jg = ctx.createLinearGradient(-22, 0, 24, 0);
    jg.addColorStop(0, shade(r.color, -30)); jg.addColorStop(0.5, shade(r.color, 25)); jg.addColorStop(1, shade(r.color, -40));
    ctx.fillStyle = jg; ctx.beginPath(); ctx.roundRect(-22, -166, 46, 62, 14); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(-22, -140, 46, 6);
    leg(ph, false); arm(ph, false);
    ctx.restore();
    // Cabeça grande com a foto (fica de fora da rotação para não distorcer)
    const hx = fallen ? x - 70 * s : x + 2 * s, hy = fallen ? y - 30 * s : y - 202 * s;
    ctx.save(); ctx.globalAlpha *= alpha;
    avatar({ nick: r.name, pic: r.photo }, hx, hy, 40 * s, '#fff');
    ctx.restore();
  },
  draw() {
    cachedScene('estadio', () => this.drawStadium());
    const L = this.config.length;
    const t = performance.now() / 1000;
    const lead = Math.max(...this.runners.map((o) => o.pos));
    // Linhas da pista andando com a câmera
    const off = -((lead * 4 * 18) % 120);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillRect(0, 640, W, 3);
    for (let i = 0; i < this.runners.length; i++) ctx.fillRect(0, this.laneY(i) + 16, W, 3);
    for (let x = off; x < W; x += 120) { ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x, 640, 4, 470); }
    // Faixas de velocidade no primeiro plano
    for (let k = 0; k < 6; k++) { const x = ((-(lead * 4 * 40) + k * 260) % (W + 300) + W + 300) % (W + 300) - 150; ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x, 1124 + k * 24, 140, 8); }
    const order = [...this.runners].sort((a, b) => b.pos - a.pos);
    // Marcador de distância entre 1º e 2º
    if (order.length > 1 && this.phase === 'race') {
      const a = this.runnerXY(order[0]), b = this.runnerXY(order[1]);
      const y = Math.max(a.y, b.y) + 40;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.x, y); ctx.lineTo(a.x, y); ctx.moveTo(b.x, y - 10); ctx.lineTo(b.x, y + 10); ctx.moveTo(a.x, y - 10); ctx.lineTo(a.x, y + 10); ctx.stroke();
      pill(`+${((order[0].pos - order[1].pos) * 4).toFixed(1).replace('.', ',')} m`, (a.x + b.x) / 2, y, { bg: '#dc2626', size: 16, font: F_NUM });
    }
    for (const r of [...this.runners].sort((a, b) => a.i - b.i)) {
      const p = this.runnerXY(r);
      const s = this.laneScale(r.i);
      if (r.boost > 0) for (let k = 3; k >= 1; k--) this.drawRunner(r, p.x - k * 34, p.y, t - k * 0.05, s, 0.18 * (4 - k));
      if (r.shield > 0) { ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y - 120 * s, 150 * s, 0, 7); const sg = ctx.createRadialGradient(p.x, p.y - 120 * s, 40, p.x, p.y - 120 * s, 150 * s); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(165,243,252,.45)'); ctx.fillStyle = sg; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); }
      this.drawRunner(r, p.x, p.y, t, s);
      const rank = order.indexOf(r) + 1;
      const ty = p.y - 268 * s;
      const w = pill(trim(r.name, 10).toUpperCase(), p.x + 16, ty, { bg: shade(r.color, -50), border: r.color, size: 18, font: F_TITLE });
      posBadge(rank, p.x + 16 - w / 2 - 18, ty, 28);
      if (r.slip > 0) text('🍌💫', p.x - 40, p.y - 120, 30);
    }
    this.drawHud(order);
    if (this.phase === 'finish' && this.winner) this.drawWinner();
  },
  drawHud(order) {
    const L = this.config.length;
    title('CORRIDA DE TORCIDAS', 24, 46, 26, '#fff', 'left');
    panel(W - 170, 18, 150, 58, { r: 10, from: '#111827', to: '#030712', border: '#facc15' });
    num(this.phase === 'race' ? fmtTime(this.timer) : this.phase === 'countdown' ? `0:0${Math.ceil(this.timer)}` : 'FIM', W - 95, 48, 36, '#facc15');
    const rowsH = 18 + order.length * 50;
    panel(16, 88, W - 32, rowsH, { r: 12, from: 'rgba(10,15,40,.92)', to: 'rgba(5,8,20,.92)', border: '#fff' });
    order.forEach((r, k) => {
      const y = 116 + k * 50;
      posBadge(k + 1, 42, y, 28);
      label(trim(r.name, 9).toUpperCase(), 66, y + 1, 20, r.color === '#ffffff' ? '#fff' : shade(r.color, 40), 'left', 400, F_TITLE);
      const bx = 250, bw = 300;
      ctx.fillStyle = '#7f1d1d'; ctx.fillRect(bx, y - 5, bw, 10);
      ctx.fillStyle = r.color; ctx.fillRect(bx, y - 5, bw * clamp(r.pos / L, 0, 1), 10);
      photo(r.photo, bx + bw * clamp(r.pos / L, 0, 1) - 18, y - 18, 36, 36, 6, (r.name[0] || '?').toUpperCase(), r.color);
      text('🏁', bx + bw + 16, y, 18);
      num(`${Math.round((r.pos / L) * 100)}%`, W - 30, y - 8, 24, '#fff', 'right');
      const kmh = (r.slip > 0 ? 0.1 : 0.8 * r.mult) * 4 * 3.6 * (this.phase === 'race' ? 1 : 0);
      label(`${kmh.toFixed(0)} KM/H`, W - 30, y + 14, 11, '#9aa0b4', 'right', 800);
    });
    // Cartões de evento e meta coletiva
    const cy = 88 + rowsH + 14;
    this.log.slice(0, 2).forEach((l, k) => {
      const y = cy + k * 58;
      ctx.globalAlpha = clamp(l.t, 0, 1);
      panel(16, y, 404, 50, { r: 8, from: 'rgba(10,15,40,.92)', to: 'rgba(5,8,20,.92)', border: l.color, shadow: false });
      avatar(l.user, 42, y + 25, 17, l.color);
      label(`@${trim(l.user.nick, 12)}`, 68, y + 16, 15, '#fff', 'left', 900);
      label(trim(l.msg, 34), 68, y + 36, 13, l.color, 'left', 800);
      ctx.globalAlpha = 1;
    });
    panel(432, cy, W - 448, 108, { r: 8, from: 'rgba(10,15,40,.92)', to: 'rgba(5,8,20,.92)', border: '#fff', shadow: false });
    label('META COLETIVA', 446, cy + 18, 12, '#cbd5e1', 'left', 900);
    label(`${Math.ceil(this.goal.t)}s`, W - 28, cy + 18, 12, '#cbd5e1', 'right', 900);
    text('❤️', 462, cy + 56, 30);
    num(`${this.goal.n}/${this.goal.need}`, 492, cy + 52, 30, '#facc15', 'left');
    label('likes → ajuda quem está atrás', 446, cy + 84, 11, '#cbd5e1', 'left', 800);
    glossBar(446, cy + 94, W - 476, 8, this.goal.n / this.goal.need, '#facc15');
    if (this.phase === 'countdown') { panel(W / 2 - 230, 1080, 460, 90, { r: 20, from: 'rgba(10,15,40,.92)', to: 'rgba(5,8,20,.92)', border: '#facc15' }); title(`LARGADA EM ${Math.ceil(this.timer)}`, W / 2, 1112, 28, '#facc15'); label('Comente o nome ou o número do seu corredor', W / 2, 1148, 16, '#fff', 'center', 800); }
    else { pill(`💬 Comente ${this.runners.map((r, i) => `${i + 1} = ${trim(r.name, 8)}`).join(' · ')}`, W / 2, 1190, { size: 18, bg: 'rgba(10,15,40,.9)', border: '#fff' }); }
  },
  drawWinner() {
    const w = this.winner;
    ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(0, 0, W, H);
    title('VENCEU', W / 2, 230, 70, '#ffd23f');
    ctx.save(); ctx.shadowColor = w.color; ctx.shadowBlur = 40;
    avatar({ nick: w.name, pic: w.photo }, W / 2, 440, 150, w.color);
    ctx.restore();
    title(trim(w.name, 14).toUpperCase(), W / 2, 640, 50, '#fff');
    text(`${w.fans} torcedores`, W / 2, 704, 30, '#ddd', 'center', 700);
    leaderboard(this.top, 'Quem mais empurrou', W / 2, 790, 3, 30);
    text(`Nova corrida em ${Math.ceil(this.timer)}s`, W / 2, 1100, 30, '#ddd', 'center', 700);
  },
}, {
  length: 100,
  items: [
    { name: 'Azul', color: '#2f7cf6', photo: '' },
    { name: 'Vermelho', color: '#e5383b', photo: '' },
  ],
}));
