'use strict';

// Bola no Ursinho: um personagem (pode ser a sua foto) segura um ursinho de pelúcia. Presentes lançam bolas nele.
// O ursinho tem barra de vida; quando zera, a rodada acaba e recomeça sozinha.
const BEAR = { x: 470, y: 690 };

registerGame(withConfig({
  id: 'chute',
  name: 'Bola no Ursinho',
  icon: '⚽',
  help: '<p>Comente <b>chuta</b> para lançar uma bola (1 a cada 4s); algumas erram.</p><p>🌹 1 bola · 🍩 sequência de 3 · 🕶️ bola de fogo gigante (5×) · 🌌 chuva de 12 bolas de ouro.</p><p>Quando a vida do ursinho zera, a rodada acaba. Ponha a foto do personagem em <b>Configurar</b>.</p>',
  cd: new Cooldown(4000),
  kickers: new Map(),
  round: 1,
  reset() {
    this.life = this.config.life;
    this.balls = [];
    this.pending = [];
    this.hits = 0;
    this.gray = 0;
    this.shake = 0;
    this.booms = [];
    this.phase = 'play';
    this.endT = 0;
    this.lastGift = null;
  },
  renderSettings(el, save) {
    renderItemsSettings(el, structuredClone(this.config), {
      min: 1, max: 1, itemLabel: 'Nome do personagem',
      extras: [{ key: 'life', label: 'Vida do ursinho', min: 10, max: 100000 }],
    }, (cfg) => { this.applyConfig(cfg); save(this.config); });
  },
  sample: () => pick(['chuta', 'chuta!', 'gol']),
  kick(user, kind, delay = 0) { this.pending.push({ user, kind, at: delay }); },
  onEvent(ev) {
    if (this.phase !== 'play') return;
    if (ev.type === 'chat' && /chut|gol|⚽|bola/i.test(ev.text) && this.cd.ok(uid(ev))) this.kick(ev.user, 'normal');
    else if (ev.type === 'gift') {
      const tier = giftTier(ev), n = Math.min(10, ev.count || 1);
      for (let r = 0; r < n; r++) {
        if (tier === 1) this.kick(ev.user, 'gift', r * 0.25);
        else if (tier === 2) for (let k = 0; k < 3; k++) this.kick(ev.user, 'gift', r * 0.9 + k * 0.28);
        else if (tier === 3) this.kick(ev.user, 'fire', r * 0.8);
        else for (let k = 0; k < 12; k++) this.kick(ev.user, 'gold', r * 2 + k * 0.15);
      }
      this.lastGift = { user: ev.user, name: ev.name, n: { 1: n, 2: 3 * n, 3: n, 4: 12 * n }[tier], t: 6 };
      if (tier >= 3) announcer.show(`${tier === 4 ? '🌟' : '🔥'} @${trim(ev.user.nick, 12)}`, tier === 4 ? '#ffd23f' : '#ff8a3d', 2, 58);
    }
  },
  launch({ user, kind }) {
    if (this.balls.length > 40) return;
    const miss = kind === 'normal' && Math.random() < 0.35;
    const tx = BEAR.x + rand(-40, 40) + (miss ? pick([-170, 170]) : 0), ty = BEAR.y + rand(-50, 40) + (miss ? -80 : 0);
    this.balls.push({ user, kind, miss, sx: rand(60, W - 60), sy: H + 40, tx, ty, t: 0, dur: kind === 'gold' ? 0.55 : kind === 'fire' ? 1.0 : 0.8, spin: rand(-8, 8) });
    sfx.tone(160, 0.08, 'sine', 0.15);
  },
  update(dt) {
    this.gray = Math.max(0, this.gray - dt);
    this.shake = Math.max(0, this.shake - dt);
    if (this.lastGift && (this.lastGift.t -= dt) <= 0) this.lastGift = null;
    for (const b of this.booms) b.t -= dt;
    this.booms = this.booms.filter((b) => b.t > 0);
    if (this.phase === 'over') { this.endT -= dt; if (this.endT <= 0) { this.round++; this.reset(); } return; }
    for (const p of this.pending) p.at -= dt;
    for (const p of this.pending.filter((p) => p.at <= 0)) this.launch(p);
    this.pending = this.pending.filter((p) => p.at > 0);
    for (const b of this.balls) {
      b.t += dt;
      if (b.t < b.dur || b.done) continue;
      b.done = true;
      if (b.miss) { floatText('errou!', b.tx, b.ty - 30, '#fff', 26); continue; }
      const dmg = b.kind === 'fire' ? 5 : b.kind === 'gold' ? 2 : 1;
      this.life = Math.max(0, this.life - dmg);
      this.hits++;
      addScore(this.kickers, b.user.nick, dmg);
      this.gray = 0.16;
      this.shake = 0.35;
      this.booms.push({ x: b.tx + rand(-30, 30), y: b.ty - 40, t: 0.7, big: b.kind === 'fire', n: dmg });
      burst(b.tx, b.ty, b.kind === 'gold' ? ['#ffd23f', '#fff'] : b.kind === 'fire' ? ['#ff8a3d', '#fe2c55'] : ['#fff', '#c8a27a'], 22, 320);
      sfx.tone(b.kind === 'fire' ? 90 : 220, 0.12, 'square', 0.1);
      if (this.life <= 0) {
        this.phase = 'over'; this.endT = 9;
        this.balls = []; this.pending = [];
        sfx.win();
        for (let i = 0; i < 5; i++) setTimeout(() => burst(rand(100, W - 100), rand(250, 700), COLORS, 70, 550), i * 250);
        return;
      }
    }
    this.balls = this.balls.filter((b) => !b.done || (b.miss && b.t < b.dur + 0.4));
  },
  drawKitchen() {
    // Parede de tijolos
    ctx.fillStyle = '#7a4a32'; ctx.fillRect(0, 0, W, H);
    for (let y = 0, row = 0; y < 1000; y += 34, row++) for (let x = (row % 2) * -40; x < W; x += 80) {
      const c = ['#a0603f', '#9a5638', '#b36b47', '#8f5034'][(x * 7 + y * 3) % 4 & 3];
      ctx.fillStyle = c; ctx.fillRect(x + 3, y + 3, 74, 28);
    }
    const vg = ctx.createRadialGradient(W / 2, 560, 100, W / 2, 560, 760);
    vg.addColorStop(0, 'rgba(255,220,180,.15)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // Armário e bancada
    ctx.fillStyle = '#3b2a20'; ctx.fillRect(560, 420, 160, 340);
    ctx.fillStyle = '#d9d3c7'; ctx.fillRect(540, 560, 180, 22);
    ctx.fillStyle = '#2b1f18'; ctx.fillRect(560, 582, 160, 260);
    for (let k = 0; k < 2; k++) { ctx.fillStyle = '#4a3528'; ctx.fillRect(570 + k * 76, 600, 70, 220); ctx.fillStyle = '#c9b38a'; ctx.fillRect(620 + k * 76 - 30 + (k ? -30 : 0) + 36, 700, 4, 30); }
    // Piso
    const fg = ctx.createLinearGradient(0, 1000, 0, H);
    fg.addColorStop(0, '#d8d2c8'); fg.addColorStop(1, '#a9a196');
    ctx.fillStyle = fg; ctx.fillRect(0, 1000, W, H - 1000);
    ctx.strokeStyle = 'rgba(0,0,0,.12)';
    for (let k = -6; k <= 6; k++) { ctx.beginPath(); ctx.moveTo(W / 2 + k * 70, 1000); ctx.lineTo(W / 2 + k * 200, H); ctx.stroke(); }
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(0, 1010 + k * k * 12); ctx.lineTo(W, 1010 + k * k * 12); ctx.stroke(); }
  },
  drawBear(x, y, s, hurt) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const fur = '#a4703f', light = '#d9a066', dark = '#6b4423';
    const ball = (bx, by, r, col) => { const g = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.3, r * 0.1, bx, by, r); g.addColorStop(0, shade(col, 30)); g.addColorStop(1, shade(col, -25)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill(); };
    ball(-36, 70, 24, fur); ball(36, 70, 24, fur);
    ball(0, 30, 52, fur);
    ball(0, 36, 30, light);
    ball(-54, 10, 20, fur); ball(54, 10, 20, fur);
    ball(-34, -66, 20, fur); ball(34, -66, 20, fur); ball(-34, -66, 10, light); ball(34, -66, 10, light);
    ball(0, -36, 46, fur);
    ball(0, -22, 20, light);
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(0, -28, 8, 6, 0, 0, 7); ctx.fill();
    if (hurt) { ctx.strokeStyle = '#111'; ctx.lineWidth = 4; for (const ex of [-16, 16]) { ctx.beginPath(); ctx.moveTo(ex - 6, -50); ctx.lineTo(ex + 6, -40); ctx.moveTo(ex + 6, -50); ctx.lineTo(ex - 6, -40); ctx.stroke(); } }
    else { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-16, -46, 6, 0, 7); ctx.arc(16, -46, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-14, -48, 2, 0, 7); ctx.arc(18, -48, 2, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#e11d48'; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(-20, -12); ctx.lineTo(-20, 8); ctx.closePath(); ctx.moveTo(0, -2); ctx.lineTo(20, -12); ctx.lineTo(20, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  },
  drawCharacter(t) {
    const it = this.config.items[0];
    const x = 290, base = 1060;
    const shirt = it.color, dark = shade(it.color, -50), skin = '#c68642';
    const limb = (x0, y0, x1, y1, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, base + 6, 130, 18, 0, 0, 7); ctx.fill();
    // Pernas e tênis
    limb(x - 36, 840, x - 58, base - 22, 46, skin); limb(x + 36, 840, x + 66, base - 22, 46, skin);
    for (const [fx, flip] of [[x - 60, -1], [x + 70, 1]]) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(fx - 30 + flip * 8, base - 34, 70, 30, 12); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(fx - 26 + flip * 8, base - 12, 62, 6); }
    // Short
    ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.moveTo(x - 80, 740); ctx.lineTo(x + 80, 740); ctx.lineTo(x + 96, 890); ctx.lineTo(x + 8, 890); ctx.lineTo(x, 850); ctx.lineTo(x - 8, 890); ctx.lineTo(x - 96, 890); ctx.closePath(); ctx.fill();
    // Camisa
    const sg = ctx.createLinearGradient(x - 90, 0, x + 90, 0);
    sg.addColorStop(0, dark); sg.addColorStop(0.5, shirt); sg.addColorStop(1, dark);
    ctx.fillStyle = sg; ctx.beginPath(); ctx.roundRect(x - 88, 520, 176, 240, [40, 40, 16, 16]); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(x - 88, 600, 176, 10);
    // Braço segurando o ursinho
    limb(x + 70, 560, BEAR.x - 60, BEAR.y + 20, 30, skin);
    // Braço com a mão na cabeça (provocando)
    const wave = Math.sin(t * 3) * 6;
    limb(x - 78, 552, x - 150, 430 + wave, 32, skin);
    limb(x - 150, 430 + wave, x - 78, 350, 28, skin);
    // Cabeça com a foto
    avatar({ nick: it.name, pic: it.photo || fakeFace('personagem') }, x, 430, 88, '#fff');
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x - 74, 352, 22, 0, 7); ctx.fill();
    pill(`@${trim(it.name, 14)}`, x, 1086, { size: 18, bg: 'rgba(0,0,0,.75)' });
  },
  draw() {
    const t = performance.now() / 1000;
    cachedScene('cozinha', () => this.drawKitchen());
    const sx = this.shake ? rand(-6, 6) : 0;
    ctx.save(); ctx.translate(sx, 0);
    this.drawCharacter(t);
    const hurt = this.life / this.config.life < 0.25;
    this.drawBear(BEAR.x + (this.shake ? rand(-8, 8) : 0), BEAR.y, 1.1, hurt || this.shake > 0.2);
    ctx.restore();
    for (const b of this.balls) {
      const k = clamp(b.t / b.dur, 0, 1.4);
      const x = b.sx + (b.tx - b.sx) * k, y = b.sy + (b.ty - b.sy) * k - Math.sin(Math.min(1, k) * Math.PI) * 140;
      const size = (b.kind === 'fire' ? 110 : 60) * (1.3 - 0.5 * Math.min(1, k));
      if (b.kind === 'fire') { ctx.globalAlpha = 0.75; text('🔥', x - 10, y + size * 0.25, size * 1.15); ctx.globalAlpha = 1; }
      ctx.save(); ctx.translate(x, y); ctx.rotate(b.t * b.spin);
      text(b.kind === 'gold' ? '🪙' : '⚽', 0, 0, size);
      ctx.restore();
      if (k < 0.55) pill(`@${trim(b.user.nick, 10)}`, x, y + size * 0.75, { size: 13 });
    }
    for (const b of this.booms) {
      const s = (b.big ? 1.6 : 1) * (1 + (0.7 - b.t) * 0.8);
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(-0.2); ctx.scale(s, s); ctx.globalAlpha = clamp(b.t * 2, 0, 1);
      ctx.beginPath();
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, r = k % 2 ? 34 : 58; ctx.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r); }
      ctx.closePath(); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#b91c1c'; ctx.stroke();
      label('BOOM!', 0, 2, 26, '#b91c1c', 'center', 400, F_TITLE);
      ctx.restore();
    }
    // Corte em preto e branco a cada acerto: uma camada de dessaturação, barata em Full HD.
    if (this.gray > 0) { ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    this.drawHud();
    if (this.phase === 'over') this.drawOver();
  },
  drawHud() {
    title('ACERTE O URSINHO!', W / 2, 54, 34, '#fff');
    panel(16, 90, W - 32, 120, { r: 14, from: 'rgba(10,12,20,.9)', to: 'rgba(4,5,10,.9)' });
    label('ACERTOS', 40, 116, 13, '#9aa0b4', 'left', 900); num(String(this.hits), 40, 160, 46, '#fff', 'left');
    if (this.lastGift) {
      const g = this.lastGift;
      panel(160, 104, 330, 56, { r: 10, from: 'rgba(40,30,80,.95)', to: 'rgba(20,14,40,.95)', border: '#8b5cf6', shadow: false });
      avatar(g.user, 188, 132, 18, '#8b5cf6');
      label(`@${trim(g.user.nick, 12)}`, 214, 122, 15, '#fff', 'left', 900);
      label(`${trim(g.name, 12)} · ${g.n} bola${g.n > 1 ? 's' : ''}`, 214, 144, 13, '#c4b5fd', 'left', 800);
    } else label('Comente CHUTA ⚽ · 🎁 = mais bolas', 330, 132, 16, '#fff', 'center', 800);
    label('RODADA', W - 40, 116, 13, '#9aa0b4', 'right', 900); num(String(this.round), W - 40, 160, 46, '#fff', 'right');
    const pct = this.life / this.config.life;
    text('🧸', 44, 186, 26);
    glossBar(70, 176, W - 200, 20, pct, pct > 0.5 ? '#22c55e' : pct > 0.2 ? '#f59e0b' : '#ef4444');
    label(`${this.life}/${this.config.life}`, W - 40, 187, 15, '#fff', 'right', 900);
    leaderboardSmall(this.kickers, W - 270, 260, 250);
  },
  drawOver() {
    ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(0, 0, W, H);
    title('URSINHO NOCAUTE!', W / 2, 300, 50, '#ffd23f');
    this.drawBear(W / 2, 520, 1.4, true);
    leaderboard(this.kickers, 'Quem mais acertou', W / 2, 720, 3, 32);
    text(`Rodada ${this.round + 1} em ${Math.ceil(this.endT)}s`, W / 2, 1060, 32, '#ddd', 'center', 700);
  },
}, { life: 100, items: [{ name: 'Personagem', color: '#1d4ed8', photo: '' }] }));
