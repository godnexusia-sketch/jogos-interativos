'use strict';

// Passarela: quem comenta entra na fila e desfila. Com nick do Roblox, desfila com o avatar real.
// Presente fura a fila e muda o desfile; quem já desfilou senta na plateia.
const WALK_SECS = 7;

registerGame({
  id: 'desfile',
  name: 'Passarela',
  icon: '💃',
  help: '<p>Comente qualquer coisa para entrar na <b>fila do desfile</b>. Se comentar o seu <b>nick do Roblox</b>, desfila com o seu avatar.</p><p>Durante o seu desfile, comentários e ❤️ likes viram aplausos.</p><p>🌹 Fura a fila (2× maior) · 🍩 Desfile dançando (3×) · 🕶️ Salão piscando (6×) · 🌌 O GIGANTE (20×).</p>',
  claps: new Map(),
  reset() {
    this.queue = [];
    this.walking = [];
    this.seats = [];
    this.party = 0;
    this.galaxy = 0;
    this.gap = 0;
    this.recent = new Map();
  },
  sample: () => pick(['eu', 'builderman', 'linda', 'arrasou', '👏']),
  inLine(id) { return this.queue.find((q) => q.id === id) || this.walking.find((w) => w.id === id); },
  enqueue(ev, tier = 0) {
    const id = uid(ev);
    let m = this.inLine(id);
    if (!m) {
      if (!tier && (this.recent.get(id) || 0) > performance.now()) return null;
      m = { id, user: ev.user, rbx: null, tier: 0, claps: 0 };
      this.queue.push(m);
      if (looksLikeNick(ev.text || '')) robloxLookup(ev.text.trim().replace(/^@/, '')).then((r) => { if (r) m.rbx = r; });
    }
    if (tier > m.tier) m.tier = tier;
    if (tier >= 1 && this.queue.includes(m)) {
      // Fura a fila: passa à frente de quem não mandou presente; entre presentes, quem mandou antes vai antes.
      this.queue.splice(this.queue.indexOf(m), 1);
      const pos = this.queue.findIndex((q) => !q.tier);
      this.queue.splice(pos < 0 ? this.queue.length : pos, 0, m);
    }
    return m;
  },
  onEvent(ev) {
    const id = uid(ev);
    const w = this.walking.find((x) => x.id !== id && x.t < WALK_SECS);
    if (ev.type === 'chat') {
      if (w && /👏|linda|lindo|arras|diva|uau|top/i.test(ev.text)) { w.claps++; floatText('👏', rand(200, 520), 700, '#fff', 36); }
      this.enqueue(ev);
    } else if (ev.type === 'like') {
      if (w) { w.claps += ev.count; if (Math.random() < 0.5) floatText('❤️', rand(200, 520), 760, '#fe2c55', 30); }
    } else if (ev.type === 'gift') {
      const tier = giftTier(ev);
      this.enqueue(ev, tier);
      announcer.show(`🎁 @${trim(ev.user.nick, 12)} ${['', 'furou a fila', 'vai desfilar dançando', 'acendeu o salão', 'é O GIGANTE'][tier]}`, ['#fff', '#ffd23f', '#ff6bd6', '#25f4ee', '#b36bff'][tier], 2.2, 40);
    }
  },
  update(dt) {
    this.party = Math.max(0, this.party - dt);
    this.galaxy = Math.max(0, this.galaxy - dt);
    this.gap -= dt;
    // Fila indiana: o próximo entra quando quem está na frente já passou da metade.
    const front = this.walking[this.walking.length - 1];
    if (this.queue.length && this.gap <= 0 && (!front || front.t > WALK_SECS * 0.45)) {
      const m = this.queue.shift();
      m.t = 0;
      this.walking.push(m);
      this.gap = 1;
      if (m.tier >= 3) this.party = 10;
      if (m.tier >= 4) { this.galaxy = 14; sfx.boom(); }
      sfx.pop();
    }
    for (const m of this.walking) m.t += dt;
    for (const m of this.walking.filter((m) => m.t >= WALK_SECS)) {
      addScore(this.claps, m.rbx?.name || m.user.nick, m.claps);
      this.recent.set(m.id, performance.now() + 60000);
      this.seats.push(m);
      if (this.seats.length > 16) this.seats.shift();
    }
    this.walking = this.walking.filter((m) => m.t < WALK_SECS);
  },
  // Posição na passarela: entra pelo fundo (pequeno), vem até a frente (grande), volta pelo outro lado.
  pathAt(p) {
    const backY = 420, frontY = 1000;
    if (p < 0.45) { const k = p / 0.45; return { x: W / 2 - 60, y: backY + (frontY - backY) * k, s: 0.45 + 0.55 * k }; }
    if (p < 0.55) return { x: W / 2, y: frontY, s: 1, pose: true };
    const k = (p - 0.55) / 0.45;
    return { x: W / 2 + 60, y: frontY - (frontY - backY) * k, s: 1 - 0.55 * k };
  },
  drawModel(m, x, y, s) {
    const t = performance.now() / 1000;
    const big = [1, 2, 3, 6, 20][m.tier];
    const size = 150 * s * Math.min(big, m.tier === 4 ? 6 : big);
    const dance = m.tier >= 2;
    const bob = Math.abs(Math.sin(t * (dance ? 8 : 6))) * 10 * s;
    ctx.save();
    ctx.translate(x, y - bob);
    if (dance) ctx.rotate(Math.sin(t * 6) * 0.2);
    if (m.tier >= 2) { ctx.shadowColor = ['#fff', '#ffd23f', '#ff6bd6', '#25f4ee', '#b36bff'][m.tier]; ctx.shadowBlur = 30 + Math.sin(t * 10) * 15; }
    const img = getImg(m.rbx?.img);
    if (img) ctx.drawImage(img, -size / 2, -size, size, size);
    else {
      ctx.fillStyle = colorFor(m.user.nick);
      ctx.beginPath(); ctx.moveTo(-size * 0.28, -size * 0.1); ctx.lineTo(size * 0.28, -size * 0.1); ctx.lineTo(size * 0.16, -size * 0.6); ctx.lineTo(-size * 0.16, -size * 0.6); ctx.fill();
      ctx.fillRect(-size * 0.14, -size * 0.1, size * 0.1, size * 0.1); ctx.fillRect(size * 0.04, -size * 0.1, size * 0.1, size * 0.1);
    }
    ctx.restore();
    if (!img) avatar(m.user, x, y - bob - size * 0.72, size * 0.15, '#fff');
    text(`@${trim(m.rbx?.name || m.user.nick, 12)}`, x, y - bob - size - 10, Math.max(16, 26 * s), m.tier ? '#ffd23f' : '#fff', 'center', 800);
  },
  draw() {
    const t = performance.now() / 1000;
    if (this.galaxy > 0) {
      background('#05010f', '#1b0436');
      for (let k = 0; k < 120; k++) { ctx.fillStyle = '#fff'; ctx.fillRect((k * 97 + t * 10) % W, (k * 53) % 700, 2, 2); }
      ctx.save(); ctx.translate(W / 2, 250); ctx.rotate(t * 0.5);
      for (let k = 0; k < 5; k++) { ctx.rotate(Math.PI * 2 / 5); ctx.fillStyle = 'rgba(179,107,255,.3)'; ctx.beginPath(); ctx.ellipse(80, 0, 160, 30, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    } else background('#2d1b3d', '#120a1a');
    if (this.party > 0) { ctx.fillStyle = `hsla(${(t * 400) % 360},90%,55%,.3)`; ctx.fillRect(0, 0, W, H); }
    // Arco do fundo e passarela em perspectiva
    ctx.fillStyle = '#d4af37'; ctx.beginPath(); ctx.arc(W / 2, 420, 110, Math.PI, 0); ctx.lineTo(W / 2 + 110, 440); ctx.lineTo(W / 2 - 110, 440); ctx.fill();
    ctx.fillStyle = '#120a1a'; ctx.beginPath(); ctx.arc(W / 2, 425, 90, Math.PI, 0); ctx.fill();
    const g = ctx.createLinearGradient(0, 420, 0, 1100);
    g.addColorStop(0, '#5a2d82'); g.addColorStop(1, '#e0c3fc');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(W / 2 - 100, 430); ctx.lineTo(W / 2 + 100, 430); ctx.lineTo(W / 2 + 260, 1100); ctx.lineTo(W / 2 - 260, 1100); ctx.fill();
    for (let k = 0; k < 8; k++) { const y = 460 + k * 80, w = 100 + (k / 8) * 160; ctx.fillStyle = (Math.floor(t * 4) + k) % 2 ? '#fff' : '#ffd23f'; ctx.beginPath(); ctx.arc(W / 2 - w - 10, y, 5, 0, 7); ctx.arc(W / 2 + w + 10, y, 5, 0, 7); ctx.fill(); }
    // Plateia
    this.seats.forEach((m, i) => {
      const left = i % 2 === 0, row = Math.floor(i / 2);
      const x = left ? 70 + (row % 2) * 50 : W - 70 - (row % 2) * 50, y = 560 + row * 64;
      avatar(m.user, x, y + Math.sin(t * 4 + i) * 3, 22, colorFor(m.user.nick));
    });
    const order = [...this.walking].sort((a, b) => this.pathAt(a.t / WALK_SECS).y - this.pathAt(b.t / WALK_SECS).y);
    for (const m of order) { const p = this.pathAt(m.t / WALK_SECS); this.drawModel(m, p.x, p.y, p.s); }

    roundRect(20, 20, W - 40, 150, 22, 'rgba(0,0,0,.6)');
    text('💃 PASSARELA DA LIVE', W / 2, 62, 42, '#ff6bd6', 'center', 900);
    text('Comente para desfilar · nick do Roblox = seu avatar', W / 2, 108, 22, '#fff', 'center', 700);
    text(`Na fila: ${this.queue.length}`, W / 2, 145, 22, '#ffd23f', 'center', 800);
    // Próximos da fila
    this.queue.slice(0, 6).forEach((m, i) => {
      const x = 80 + i * 112;
      avatar(m.user, x, 230, 30, m.tier ? '#ffd23f' : '#fff');
      text(trim(m.rbx?.name || m.user.nick, 7), x, 278, 16, '#fff', 'center', 700);
      if (m.tier) text('🎁', x + 26, 206, 20);
    });
    const now = this.walking.find((m) => this.pathAt(m.t / WALK_SECS).pose) || this.walking[0];
    if (now) { roundRect(140, 1130, W - 280, 60, 30, 'rgba(0,0,0,.65)'); text(`👏 ${now.claps} aplausos para @${trim(now.rbx?.name || now.user.nick, 10)}`, W / 2, 1160, 24, '#fff', 'center', 800); }
    else text('A passarela está esperando você!', W / 2, 760, 36, '#fff');
    const rows = [...this.claps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (rows.length) text(`🏆 ${rows.map(([n, v], i) => `${i + 1}. ${trim(n, 8)} ${v}`).join('  ')}`, W / 2, 1230, 20, '#ffd23f', 'center', 800);
  },
});
