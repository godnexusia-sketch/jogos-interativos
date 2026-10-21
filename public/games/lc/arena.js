'use strict';

// Arenas onde cada espectador é um personagem: Batalha de Bolhas, Serra Elétrica, Monstro Evolutivo e Cobrinha.

const ARENA_TOP = 190, ARENA_BOTTOM = H - 80;
function arenaBg(theme, grid = true) {
  const g = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 900);
  g.addColorStop(0, theme[0]); g.addColorStop(1, theme[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (grid) { ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1; for (let x = 0; x <= W; x += 36) { ctx.beginPath(); ctx.moveTo(x, ARENA_TOP); ctx.lineTo(x, ARENA_BOTTOM); ctx.stroke(); } for (let y = ARENA_TOP; y <= ARENA_BOTTOM; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } }
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 3; ctx.strokeRect(6, ARENA_TOP, W - 12, ARENA_BOTTOM - ARENA_TOP);
}
const ROUND_SETTINGS = (mins = 10) => [
  { key: 'roundMode', type: 'select', label: 'Rodada', options: [['countdown', 'Com tempo'], ['infinite', 'Infinita']], default: 'countdown' },
  { key: 'roundMinutes', type: 'number', label: 'Minutos por rodada', min: 1, max: 30, default: mins, showIf: { key: 'roundMode', value: 'countdown' } },
];
const FILLER_SETTINGS = [
  { key: 'fillerBlobs', type: 'toggle', label: 'Bots de enchimento (arena animada sem espectadores)', default: true },
  { key: 'fillerInterval', type: 'number', label: 'Segundos entre bots', min: 2, max: 60, default: 8, showIf: { key: 'fillerBlobs', value: true } },
];
const BOT_NAMES = ['Bolota', 'Gelatina', 'Pudim', 'Tico', 'Zezé', 'Baleia', 'Nuvem', 'Pipoca', 'Jujuba', 'Biscoito', 'Trovão', 'Fumaça', 'Cometa', 'Pingo', 'Bala'];
const botUser = (tag) => { const n = pick(BOT_NAMES) + randInt(1, 99); return { id: 'bot_' + tag + n, nick: n, pic: fakeFace(n), bot: true }; };

// ---------------- Batalha de Bolhas (Blob Battle) ----------------
defineGame({
  id: 'blob-battle', name: 'Batalha de Bolhas', genre: 'royale', icon: '🫧', color: '#06b6d4',
  desc: 'Cada espectador entra como uma bolha com o nome e come quem for menor até sobrar um. Likes e presentes fazem a bolha crescer; vírus encolhem as grandes demais.',
  help: '<p>Entre na live (ou comente) para virar uma <b>bolha</b> com a sua foto. Bolhas maiores comem as menores.</p><p>❤️ Likes e 🎁 presentes fazem a <b>sua</b> bolha crescer (presente maior, crescimento maior). Os vírus verdes encolhem quem é grande demais.</p>',
  settings: [
    ...ROUND_SETTINGS(10),
    { key: 'startRadius', type: 'number', label: 'Tamanho inicial', min: 10, max: 40, step: 5, default: 22 },
    { key: 'maxBlobs', type: 'number', label: 'Máximo de bolhas', min: 20, max: 200, step: 10, default: 80 },
    { key: 'growPerGift', type: 'number', label: 'Crescimento por moeda', min: 0.01, max: 2, step: 0.01, default: 0.2 },
    { key: 'growPerLike', type: 'number', label: 'Crescimento por like', min: 0.5, max: 20, step: 0.5, default: 1 },
    { key: 'maxViruses', type: 'number', label: 'Vírus na arena', min: 0, max: 30, default: 8 },
    { key: 'shrinkPerSecond', type: 'number', label: 'Encolhimento (0 = não encolhe)', min: 0, max: 1, step: 0.05, default: 0.15 },
    ...FILLER_SETTINGS, ...BOARD_SETTINGS(5),
  ],
  actions: [{ id: 'join_blob', label: 'Entrar', icon: '🫧' }, { id: 'grow', label: 'Crescer', icon: '⬆️' }, { id: 'spawn_virus', label: 'Soltar vírus', icon: '🦠' }],
  bindings: [{ action: 'join_blob', trigger: 'join' }, { action: 'join_blob', trigger: 'comment' }, { action: 'grow', trigger: 'like', likes: 1 }, { action: 'grow', trigger: 'gift', minCoins: 0 }],
  reset() { this.b = []; this.food = Array.from({ length: 60 }, () => this.dot()); this.vir = []; this.ph = new Phases(); this.ph.go('play', this.s.roundMode === 'countdown' ? this.s.roundMinutes * 60 : 1e9); this.fillT = 0; this.feed = new Feed(3); },
  dot() { return { x: rand(20, W - 20), y: rand(ARENA_TOP + 20, ARENA_BOTTOM - 20), c: pick(COLORS) }; },
  sample() { return pick(['oi', 'entrei', 'bora']); },
  spawn(user) {
    const k = user.id || user.nick;
    let bl = this.b.find((x) => x.k === k);
    if (bl) return bl;
    if (this.b.length >= this.s.maxBlobs) { const bot = this.b.filter((x) => x.user.bot).sort((a, c) => a.r - c.r)[0]; if (!bot || user.bot) return null; this.b.splice(this.b.indexOf(bot), 1); }
    bl = { k, user, x: rand(40, W - 40), y: rand(ARENA_TOP + 40, ARENA_BOTTOM - 40), r: this.s.startRadius, tx: 0, ty: 0, think: 0, kills: 0, born: performance.now() };
    this.b.push(bl);
    return bl;
  },
  onAction(id, a) {
    if (id === 'join_blob') this.spawn(a.user);
    else if (id === 'grow') { const bl = this.spawn(a.user); if (!bl) return; const add = a.gift ? a.coins * this.s.growPerGift * 4 : this.s.growPerLike * a.count * 0.3; bl.r = Math.sqrt(bl.r * bl.r + add * 20); if (a.gift && a.coins >= 10) this.feed.push(a.user, `⬆️ cresceu (${fmtK(a.coins)} 🪙)`, '#22e3ee'); }
    else if (id === 'spawn_virus') this.vir.push({ x: rand(60, W - 60), y: rand(ARENA_TOP + 60, ARENA_BOTTOM - 60), r: 30 });
  },
  update(dt) {
    this.feed.update(dt);
    if (this.s.fillerBlobs) { this.fillT -= dt; if (this.fillT <= 0 && this.b.length < 12) { this.fillT = this.s.fillerInterval; this.spawn(botUser('b')); } }
    while (this.vir.length < this.s.maxViruses) this.vir.push({ x: rand(60, W - 60), y: rand(ARENA_TOP + 60, ARENA_BOTTOM - 60), r: 30 });
    while (this.food.length < 60) this.food.push(this.dot());
    for (const bl of this.b) {
      bl.think -= dt;
      if (bl.think <= 0) {
        bl.think = rand(0.4, 1.2);
        // Persegue o menor que estiver perto, foge do maior, senão come bolinhas
        let tgt = null, flee = null, bd = 260, fd = 200;
        for (const o of this.b) { if (o === bl) continue; const d = Math.hypot(o.x - bl.x, o.y - bl.y); if (o.r * 1.15 < bl.r && d < bd) { bd = d; tgt = o; } if (o.r > bl.r * 1.15 && d < fd) { fd = d; flee = o; } }
        if (flee) { bl.tx = bl.x + (bl.x - flee.x); bl.ty = bl.y + (bl.y - flee.y); }
        else if (tgt) { bl.tx = tgt.x; bl.ty = tgt.y; }
        else { const f = this.food[Math.floor(Math.random() * this.food.length)]; bl.tx = f.x; bl.ty = f.y; }
      }
      const sp = 160 / Math.pow(bl.r, 0.35) * 2.2;
      const dx = bl.tx - bl.x, dy = bl.ty - bl.y, d = Math.hypot(dx, dy) || 1;
      bl.x = clamp(bl.x + dx / d * sp * dt, bl.r * 0.6, W - bl.r * 0.6); bl.y = clamp(bl.y + dy / d * sp * dt, ARENA_TOP + bl.r * 0.6, ARENA_BOTTOM - bl.r * 0.6);
      if (this.s.shrinkPerSecond && bl.r > 40) bl.r -= this.s.shrinkPerSecond * dt * (bl.r / 40);
      for (let i = this.food.length - 1; i >= 0; i--) { const f = this.food[i]; if (Math.hypot(f.x - bl.x, f.y - bl.y) < bl.r) { this.food.splice(i, 1); bl.r = Math.sqrt(bl.r * bl.r + 6); } }
      for (let i = this.vir.length - 1; i >= 0; i--) { const v = this.vir[i]; if (bl.r > 60 && Math.hypot(v.x - bl.x, v.y - bl.y) < bl.r) { this.vir.splice(i, 1); bl.r *= 0.6; burst(bl.x, bl.y, ['#4ade80', '#fff'], 30, 300); sfx.pop(); } }
    }
    // Comer bolhas menores
    for (const a of this.b) for (const c of this.b) {
      if (a === c || a.dead || c.dead) continue;
      if (a.r > c.r * 1.15 && Math.hypot(a.x - c.x, a.y - c.y) < a.r - c.r * 0.4) {
        c.dead = true; a.r = Math.sqrt(a.r * a.r + c.r * c.r * 0.8); a.kills++;
        burst(c.x, c.y, [colorFor(c.user.nick), '#fff'], 20, 260);
        if (!c.user.bot) this.feed.push(a.user, `comeu @${trim(c.user.nick, 10)}`, '#ff6b8a');
      }
    }
    this.b = this.b.filter((x) => !x.dead);
    if (this.ph.update(dt)) {
      if (this.ph.name === 'play') { const w = [...this.b].sort((a, c) => c.r - a.r)[0]; this.champ = w; if (w && !w.user.bot) { scores.add(this.id, w.user, Math.round(w.r), 1); voice.say(`${w.user.nick} é a maior bolha da rodada!`); } confetti(120); sfx.win(); this.ph.go('end', 7); }
      else this.reset();
    }
  },
  draw() {
    if (!customBackground(this)) arenaBg(['#0b2540', '#03101e']);
    for (const f of this.food) { ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x, f.y, 5, 0, 7); ctx.fill(); }
    for (const v of this.vir) {
      ctx.fillStyle = '#22c55e'; ctx.beginPath();
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2 + performance.now() / 2000, r = i % 2 ? v.r : v.r * 1.18; ctx.lineTo(v.x + Math.cos(a) * r, v.y + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#15803d'; ctx.lineWidth = 3; ctx.stroke();
    }
    const sorted = [...this.b].sort((a, c) => a.r - c.r);
    for (const bl of sorted) {
      const col = colorFor(bl.user.nick);
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(bl.x, bl.y, bl.r + 3, 0, 7); ctx.fill(); ctx.restore();
      avatar(bl.user, bl.x, bl.y, bl.r, col);
      if (bl.r > 18) label(trim(bl.user.nick, 12), bl.x, bl.y + bl.r + 12, clamp(bl.r * 0.35, 11, 20), '#fff', 'center', 800);
    }
    title('BATALHA DE BOLHAS', W / 2, 46, 40);
    pill(this.s.roundMode === 'countdown' && this.ph.name === 'play' ? `⏱ ${fmtTime(this.ph.t)} · ${this.b.length} bolhas` : `${this.b.length} bolhas`, W / 2, 88, { size: 16, bg: 'rgba(0,0,0,.6)' });
    label('entre na live para virar uma bolha · likes e presentes fazem crescer', W / 2, 120, 15, 'rgba(255,255,255,.85)', 'center', 700);
    if (this.s.showLeaderboard) hudBoard([...this.b].sort((a, c) => c.r - a.r).map((bl) => ({ user: bl.user, value: Math.round(bl.r) })), W - 250, 140, 230, { title: 'MAIORES', n: this.s.leaderboardSize, rowH: 30, bg: 'rgba(8,10,20,.6)' });
    this.feed.draw(20, ARENA_BOTTOM - 140);
    if (this.ph.name === 'end' && this.champ) winnerSpot(this.champ.user, 560, { title: 'MAIOR BOLHA' });
  },
});

// ---------------- Serra Elétrica (Chainsaw Clash) ----------------
const SAW_TIERS = [{ name: 'Serra', col: '#94a3b8', teeth: 8, hp: 0 }, { name: 'Disco', col: '#f59e0b', teeth: 14, hp: 400 }, { name: 'Raio', col: '#22e3ee', teeth: 20, hp: 1500 }];
defineGame({
  id: 'chainsaw-clash', name: 'Serra Elétrica', genre: 'royale', icon: '🪚', color: '#f97316',
  desc: 'Todo espectador é uma bolha com casco giratório numa arena caótica. As serras cortam no contato e os presentes melhoram o casco de serra para disco e para raio.',
  help: '<p>Entre para virar uma bolha com <b>serra giratória</b>. Encostar em outra bolha tira vida das duas; quem tem mais vida corta mais.</p><p>❤️ Likes e 🎁 presentes dão <b>vida</b>. Com vida alta a serra vira <b>disco</b> (400) e <b>raio</b> (1.500). Sequências de abates aparecem na tela e o líder tem <b>recompensa</b> pela cabeça.</p>',
  settings: [
    ...ROUND_SETTINGS(8),
    { key: 'startHp', type: 'number', label: 'Vida inicial', min: 50, max: 1000, default: 100 },
    { key: 'maxBlobs', type: 'number', label: 'Máximo de bolhas', min: 10, max: 120, default: 60 },
    { key: 'hpPerCoin', type: 'number', label: 'Vida por moeda', min: 1, max: 100, default: 15 },
    { key: 'hpPerLike', type: 'number', label: 'Vida por like', min: 0, max: 20, default: 1 },
    { key: 'idleRetireSeconds', type: 'number', label: 'Sai depois de quantos segundos parado (0 = nunca)', min: 0, max: 900, default: 0 },
    { key: 'streakCallouts', type: 'toggle', label: 'Anunciar sequências de abates', default: true },
    { key: 'bounties', type: 'toggle', label: 'Recompensa pela cabeça do líder', default: true },
    { key: 'chaosEvents', type: 'toggle', label: 'Eventos de caos', default: true },
    ...FILLER_SETTINGS, ...BOARD_SETTINGS(5),
  ],
  actions: [{ id: 'join', label: 'Entrar', icon: '🪚' }, { id: 'grow', label: 'Mais vida', icon: '❤️' }],
  bindings: [{ action: 'join', trigger: 'join' }, { action: 'join', trigger: 'comment' }, { action: 'grow', trigger: 'like', likes: 1 }, { action: 'grow', trigger: 'gift', minCoins: 1 }],
  reset() { this.b = []; this.ph = new Phases(); this.ph.go('play', this.s.roundMode === 'countdown' ? this.s.roundMinutes * 60 : 1e9); this.fillT = 0; this.feed = new Feed(4); this.chaosT = 40; this.chaos = null; this.kills = new Map(); },
  sample() { return pick(['bora', 'entrei', 'serra']); },
  spawn(user) {
    const k = user.id || user.nick;
    let bl = this.b.find((x) => x.k === k);
    if (bl) return bl;
    if (this.b.length >= this.s.maxBlobs) { const bot = this.b.find((x) => x.user.bot); if (!bot || user.bot) return null; this.b.splice(this.b.indexOf(bot), 1); }
    const a = rand(0, 7);
    bl = { k, user, x: rand(60, W - 60), y: rand(ARENA_TOP + 60, ARENA_BOTTOM - 60), vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, hp: this.s.startHp, streak: 0, spin: 0, hit: 0, last: performance.now() };
    this.b.push(bl);
    return bl;
  },
  tier(bl) { return bl.hp >= SAW_TIERS[2].hp ? 2 : bl.hp >= SAW_TIERS[1].hp ? 1 : 0; },
  rad(bl) { return clamp(18 + Math.sqrt(bl.hp) * 1.1, 20, 90); },
  onAction(id, a) {
    if (id === 'join') this.spawn(a.user);
    else { const bl = this.spawn(a.user); if (!bl) return; bl.last = performance.now(); const before = this.tier(bl); bl.hp += a.gift ? a.coins * this.s.hpPerCoin : this.s.hpPerLike * a.count; if (this.tier(bl) > before) { this.feed.push(a.user, `⚙️ virou ${SAW_TIERS[this.tier(bl)].name}!`, SAW_TIERS[this.tier(bl)].col); sfx.pop(); } }
  },
  update(dt) {
    this.feed.update(dt);
    if (this.s.fillerBlobs) { this.fillT -= dt; if (this.fillT <= 0 && this.b.length < 10) { this.fillT = this.s.fillerInterval; this.spawn(botUser('c')); } }
    if (this.s.chaosEvents) { this.chaosT -= dt; if (this.chaosT <= 0) { this.chaosT = rand(45, 80); this.chaos = { kind: pick(['speed', 'shrink', 'heal']), t: 8 }; const msg = { speed: '⚡ VELOCIDADE MÁXIMA!', shrink: '🌀 A ARENA ENCOLHEU!', heal: '💚 CURA PARA TODOS!' }[this.chaos.kind]; announcer.show(msg, '#ffc93c', 2.5, 46); if (this.chaos.kind === 'heal') for (const bl of this.b) bl.hp += 50; } }
    if (this.chaos && (this.chaos.t -= dt) <= 0) this.chaos = null;
    const top = ARENA_TOP + (this.chaos?.kind === 'shrink' ? 120 : 0), bot = ARENA_BOTTOM - (this.chaos?.kind === 'shrink' ? 120 : 0);
    const spd = this.chaos?.kind === 'speed' ? 1.8 : 1;
    const leader = this.b.reduce((m, x) => (!m || x.hp > m.hp ? x : m), null);
    for (const bl of this.b) {
      const r = this.rad(bl);
      bl.spin += dt * (6 + this.tier(bl) * 4); bl.hit = Math.max(0, bl.hit - dt);
      bl.x += bl.vx * dt * spd; bl.y += bl.vy * dt * spd;
      if (bl.x < r || bl.x > W - r) { bl.vx = -bl.vx; bl.x = clamp(bl.x, r, W - r); }
      if (bl.y < top + r || bl.y > bot - r) { bl.vy = -bl.vy; bl.y = clamp(bl.y, top + r, bot - r); }
      if (this.s.idleRetireSeconds && !bl.user.bot && performance.now() - bl.last > this.s.idleRetireSeconds * 1000) bl.hp = 0;
    }
    for (let i = 0; i < this.b.length; i++) for (let j = i + 1; j < this.b.length; j++) {
      const a = this.b[i], c = this.b[j], ra = this.rad(a), rc = this.rad(c);
      const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 1;
      if (d < ra + rc) {
        const nx = dx / d, ny = dy / d, p = (ra + rc - d) / 2;
        a.x -= nx * p; a.y -= ny * p; c.x += nx * p; c.y += ny * p;
        [a.vx, c.vx] = [c.vx, a.vx]; [a.vy, c.vy] = [c.vy, a.vy];
        const da = 10 + c.hp * 0.06 * (1 + this.tier(c) * 0.5), dc = 10 + a.hp * 0.06 * (1 + this.tier(a) * 0.5);
        a.hp -= da; c.hp -= dc; a.hit = c.hit = 0.2;
        floatText(`-${Math.round(da)}`, a.x, a.y - ra, '#fde047', 20); floatText(`-${Math.round(dc)}`, c.x, c.y - rc, '#fde047', 20);
        sfx.tone(rand(600, 900), 0.05, 'sawtooth', 0.03);
        for (const [dead, killer] of [[a, c], [c, a]]) if (dead.hp <= 0 && !dead.dead) {
          dead.dead = true; killer.streak++;
          if (this.s.bounties && dead === leader && !killer.user.bot) { killer.hp += 300; this.feed.push(killer.user, '💰 pegou a recompensa! +300', '#ffc93c'); }
          if (!killer.user.bot) { const k = killer.k; this.kills.set(k, { user: killer.user, value: (this.kills.get(k)?.value || 0) + 1 }); }
          burst(dead.x, dead.y, [colorFor(dead.user.nick), '#fff', '#fde047'], 36, 380);
          if (this.s.streakCallouts && killer.streak >= 3 && !killer.user.bot) announcer.show(`@${trim(killer.user.nick, 12)} ${killer.streak >= 7 ? 'IMPARÁVEL' : killer.streak >= 5 ? 'MASSACRE' : 'TRIPLO'}!`, '#ff6b8a', 2, 40);
        }
      }
    }
    this.b = this.b.filter((x) => !x.dead);
    if (this.ph.update(dt)) {
      if (this.ph.name === 'play') { const w = [...this.b].sort((a, c) => c.hp - a.hp)[0]; this.champ = w; if (w && !w.user.bot) scores.add(this.id, w.user, Math.round(w.hp), 1); confetti(120); sfx.win(); this.ph.go('end', 7); }
      else this.reset();
    }
  },
  draw() {
    if (!customBackground(this)) arenaBg(['#2a1406', '#0c0602']);
    if (this.chaos?.kind === 'shrink') { ctx.fillStyle = 'rgba(255,60,60,.15)'; ctx.fillRect(0, ARENA_TOP, W, 120); ctx.fillRect(0, ARENA_BOTTOM - 120, W, 120); }
    for (const bl of this.b) {
      const r = this.rad(bl), tr = SAW_TIERS[this.tier(bl)];
      ctx.save(); ctx.translate(bl.x, bl.y); ctx.rotate(bl.spin);
      ctx.fillStyle = tr.col; ctx.beginPath();
      for (let i = 0; i < tr.teeth * 2; i++) { const a = i / (tr.teeth * 2) * Math.PI * 2, rr = i % 2 ? r + 4 : r + 14; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
      if (this.tier(bl) === 2) { ctx.strokeStyle = 'rgba(165,243,252,.8)'; ctx.lineWidth = 3; for (let k = 0; k < 4; k++) { const a = k * 1.57 + bl.spin * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a + 0.3) * (r + 26), Math.sin(a + 0.3) * (r + 26)); ctx.stroke(); } }
      ctx.restore();
      avatar(bl.user, bl.x, bl.y, r, bl.hit > 0 ? '#fff' : tr.col);
      label(fmtK(bl.hp), bl.x, bl.y + r + 22, 15, '#fde047', 'center', 900, F_NUM);
      if (!bl.user.bot && r > 26) label(trim(bl.user.nick, 10), bl.x, bl.y - r - 22, 13, '#fff', 'center', 800);
    }
    title('SERRA ELÉTRICA', W / 2, 46, 42, '#fb923c');
    pill(this.s.roundMode === 'countdown' && this.ph.name === 'play' ? `⏱ ${fmtTime(this.ph.t)} · ${this.b.length} na arena` : `${this.b.length} na arena`, W / 2, 88, { size: 16, bg: 'rgba(0,0,0,.6)' });
    label('entre na live · presentes melhoram a serra', W / 2, 120, 15, 'rgba(255,255,255,.85)', 'center', 700);
    if (this.s.showLeaderboard) hudBoard([...this.b].sort((a, c) => c.hp - a.hp).map((bl) => ({ user: bl.user, value: Math.round(bl.hp) })), W - 250, 140, 230, { title: 'MAIS VIDA', n: this.s.leaderboardSize, rowH: 30, bg: 'rgba(8,10,20,.6)' });
    this.feed.draw(20, ARENA_BOTTOM - 190);
    if (this.ph.name === 'end' && this.champ) winnerSpot(this.champ.user, 560, { title: 'SOBREVIVENTE' });
  },
});

// ---------------- Monstro Evolutivo (Evo Monster) ----------------
const EVO = [
  { name: 'Gosma', e: '🟢', xp: 0 }, { name: 'Goblin', e: '👺', xp: 60 }, { name: 'Ogro', e: '👹', xp: 200 }, { name: 'Golem', e: '🗿', xp: 500 },
  { name: 'Dragão', e: '🐉', xp: 1200 }, { name: 'Senhor Demônio', e: '😈', xp: 3000 }, { name: 'Lendário', e: '🌟', xp: 8000 },
];
const LEGEND = [{ n: 'Fogo', c: '#f97316' }, { n: 'Gelo', c: '#38bdf8' }, { n: 'Tempestade', c: '#facc15' }, { n: 'Trevas', c: '#a855f7' }];
defineGame({
  id: 'evo-monster', name: 'Monstro Evolutivo', genre: 'royale', icon: '👹', color: '#a855f7',
  desc: 'Uma arena de evolução: cada espectador ganha o seu monstro e os presentes alimentam ele, que evolui de Gosma até Senhor Demônio e formas lendárias com armas girando.',
  help: '<p>Entre na live para ganhar um <b>monstro</b>. Ele luta sozinho com as armas que giram em volta dele e evolui ganhando experiência.</p><p>🎁 Presentes e ❤️ likes <b>alimentam</b> o monstro: Gosma → Goblin → Ogro → Golem → Dragão → Senhor Demônio → <b>Lendário</b> (fogo, gelo, tempestade ou trevas).</p>',
  settings: [
    ...ROUND_SETTINGS(10),
    { key: 'maxMonsters', type: 'number', label: 'Máximo de monstros', min: 10, max: 100, default: 50 },
    { key: 'orbCount', type: 'number', label: 'Bolinhas de experiência na arena', min: 0, max: 120, default: 50 },
    { key: 'aiRivals', type: 'number', label: 'Monstros rivais (bots)', min: 0, max: 20, default: 6 },
    { key: 'xpPerGift', type: 'number', label: 'Experiência por moeda', min: 1, max: 100, default: 12 },
    { key: 'xpPerLike', type: 'number', label: 'Experiência por like', min: 0, max: 20, default: 1 },
    ...BOARD_SETTINGS(5),
  ],
  actions: [{ id: 'join', label: 'Entrar', icon: '👹' }, { id: 'feed', label: 'Alimentar', icon: '🍖' }],
  bindings: [{ action: 'join', trigger: 'join' }, { action: 'join', trigger: 'comment' }, { action: 'feed', trigger: 'gift', minCoins: 1 }, { action: 'feed', trigger: 'like', likes: 1 }],
  reset() { this.m = []; this.orbs = []; this.ph = new Phases(); this.ph.go('play', this.s.roundMode === 'countdown' ? this.s.roundMinutes * 60 : 1e9); this.feedL = new Feed(4); },
  sample() { return pick(['bora', 'entrei']); },
  stage(mo) { let s = 0; for (let i = 0; i < EVO.length; i++) if (mo.xp >= EVO[i].xp) s = i; return s; },
  spawn(user) {
    const k = user.id || user.nick;
    let mo = this.m.find((x) => x.k === k);
    if (mo) return mo;
    if (this.m.length >= this.s.maxMonsters) { const bot = this.m.find((x) => x.user.bot); if (!bot || user.bot) return null; this.m.splice(this.m.indexOf(bot), 1); }
    mo = { k, user, x: rand(60, W - 60), y: rand(ARENA_TOP + 60, ARENA_BOTTOM - 60), xp: 0, hp: 100, tx: 0, ty: 0, think: 0, spin: rand(0, 7), legend: LEGEND[hashStr(k) % 4], stageShown: 0, inv: 0 };
    this.m.push(mo);
    return mo;
  },
  gain(mo, xp) {
    const before = this.stage(mo);
    mo.xp += xp; mo.hp = Math.min(this.maxHp(mo), mo.hp + xp);
    const now = this.stage(mo);
    if (now > before) { mo.evolve = 1.2; burst(mo.x, mo.y, [mo.legend.c, '#fff', '#ffc93c'], 40, 360); sfx.win(); if (!mo.user.bot) { this.feedL.push(mo.user, `${EVO[now].e} virou ${now === 6 ? 'Lendário de ' + mo.legend.n : EVO[now].name}!`, '#ffc93c'); if (now >= 4) voice.say(`${mo.user.nick} evoluiu para ${EVO[now].name}!`); } }
  },
  maxHp(mo) { return 100 + this.stage(mo) * 120 + Math.sqrt(mo.xp) * 4; },
  onAction(id, a) {
    const mo = this.spawn(a.user);
    if (!mo || id !== 'feed') return;
    this.gain(mo, a.gift ? a.coins * this.s.xpPerGift : this.s.xpPerLike * a.count);
  },
  update(dt) {
    this.feedL.update(dt);
    while (this.orbs.length < this.s.orbCount) this.orbs.push({ x: rand(20, W - 20), y: rand(ARENA_TOP + 20, ARENA_BOTTOM - 20) });
    while (this.m.filter((x) => x.user.bot).length < this.s.aiRivals && this.m.length < this.s.maxMonsters) { const mo = this.spawn(botUser('e')); if (!mo) break; mo.xp = rand(0, 150); }
    for (const mo of this.m) {
      const st = this.stage(mo), r = 22 + st * 6;
      mo.spin += dt * 3; mo.inv = Math.max(0, mo.inv - dt); mo.evolve = Math.max(0, (mo.evolve || 0) - dt);
      mo.think -= dt;
      if (mo.think <= 0) {
        mo.think = rand(0.5, 1.5);
        const prey = this.m.filter((o) => o !== mo && this.stage(o) <= st).sort((a, c) => Math.hypot(a.x - mo.x, a.y - mo.y) - Math.hypot(c.x - mo.x, c.y - mo.y))[0];
        const orb = this.orbs[Math.floor(Math.random() * this.orbs.length)];
        const t = prey && Math.hypot(prey.x - mo.x, prey.y - mo.y) < 220 ? prey : orb;
        if (t) { mo.tx = t.x; mo.ty = t.y; }
      }
      const sp = 110 - st * 8, dx = mo.tx - mo.x, dy = mo.ty - mo.y, d = Math.hypot(dx, dy) || 1;
      mo.x = clamp(mo.x + dx / d * sp * dt, r, W - r); mo.y = clamp(mo.y + dy / d * sp * dt, ARENA_TOP + r, ARENA_BOTTOM - r);
      for (let i = this.orbs.length - 1; i >= 0; i--) if (Math.hypot(this.orbs[i].x - mo.x, this.orbs[i].y - mo.y) < r + 6) { this.orbs.splice(i, 1); this.gain(mo, mo.user.bot ? 3 : 5); }
      // Armas girando acertam os outros
      const n = 1 + Math.min(st, 5), wr = r + 26;
      for (let k = 0; k < n; k++) {
        const a = mo.spin + k / n * Math.PI * 2, wx = mo.x + Math.cos(a) * wr, wy = mo.y + Math.sin(a) * wr;
        for (const o of this.m) {
          if (o === mo || o.inv > 0) continue;
          const ro = 22 + this.stage(o) * 6;
          if (Math.hypot(o.x - wx, o.y - wy) < ro + 8) {
            o.hp -= 10 + st * 6; o.inv = 0.35; floatText(`-${10 + st * 6}`, o.x, o.y - ro, '#fde047', 18);
            if (o.hp <= 0 && !o.dead) { o.dead = true; this.gain(mo, 20 + o.xp * 0.3); burst(o.x, o.y, ['#fff', o.legend.c], 30, 320); if (!o.user.bot && !mo.user.bot) this.feedL.push(mo.user, `derrotou @${trim(o.user.nick, 10)}`, '#ff6b8a'); }
          }
        }
      }
    }
    // Quem perde volta como Gosma (não sai da live)
    for (const mo of this.m) if (mo.dead) { mo.dead = false; mo.xp = Math.floor(mo.xp * 0.3); mo.hp = this.maxHp(mo); mo.x = rand(60, W - 60); mo.y = rand(ARENA_TOP + 60, ARENA_BOTTOM - 60); mo.inv = 2; }
    if (this.ph.update(dt)) {
      if (this.ph.name === 'play') { const w = [...this.m].sort((a, c) => c.xp - a.xp)[0]; this.champ = w; if (w && !w.user.bot) scores.add(this.id, w.user, Math.round(w.xp / 10), 1); confetti(120); sfx.win(); this.ph.go('end', 7); }
      else this.reset();
    }
  },
  draw() {
    if (!customBackground(this)) arenaBg(['#1b0d33', '#07020f']);
    for (const o of this.orbs) { ctx.fillStyle = '#a78bfa'; ctx.beginPath(); ctx.arc(o.x, o.y, 4 + Math.sin(performance.now() / 300 + o.x) * 1.5, 0, 7); ctx.fill(); }
    for (const mo of [...this.m].sort((a, c) => a.xp - c.xp)) {
      const st = this.stage(mo), r = 22 + st * 6, col = st >= 6 ? mo.legend.c : ['#4ade80', '#84cc16', '#f97316', '#a8a29e', '#ef4444', '#a855f7'][st];
      if (st >= 4) { const g = ctx.createRadialGradient(mo.x, mo.y, r * 0.5, mo.x, mo.y, r * 2.2); g.addColorStop(0, hexA(col, 0.45)); g.addColorStop(1, hexA(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mo.x, mo.y, r * 2.2, 0, 7); ctx.fill(); }
      const n = 1 + Math.min(st, 5), wr = r + 26;
      for (let k = 0; k < n; k++) { const a = mo.spin + k / n * Math.PI * 2; label(st >= 6 ? ['🔥', '❄️', '⚡', '🌑'][LEGEND.indexOf(mo.legend)] : ['🗡️', '🪓', '🔨', '⚔️', '🔱', '🌀'][Math.min(st, 5)], mo.x + Math.cos(a) * wr, mo.y + Math.sin(a) * wr, 18 + st * 2, '#fff', 'center', 400); }
      ctx.globalAlpha = mo.inv > 0 ? 0.6 : 1;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mo.x, mo.y, r, 0, 7); ctx.fill();
      label(EVO[st].e, mo.x, mo.y + 2, r * 1.3, '#fff', 'center', 400);
      avatar(mo.user, mo.x + r * 0.75, mo.y - r * 0.75, Math.max(10, r * 0.38), '#fff');
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(mo.x - r, mo.y + r + 6, r * 2, 5); ctx.fillStyle = '#22c55e'; ctx.fillRect(mo.x - r, mo.y + r + 6, r * 2 * clamp(mo.hp / this.maxHp(mo), 0, 1), 5);
      if (!mo.user.bot) label(trim(mo.user.nick, 10), mo.x, mo.y + r + 22, 12, '#fff', 'center', 800);
      if (mo.evolve > 0) { ctx.globalAlpha = mo.evolve / 1.2; ctx.strokeStyle = '#ffc93c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(mo.x, mo.y, r + (1.2 - mo.evolve) * 60, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    }
    title('MONSTRO EVOLUTIVO', W / 2, 46, 40, '#c084fc');
    pill(this.s.roundMode === 'countdown' && this.ph.name === 'play' ? `⏱ ${fmtTime(this.ph.t)} · ${this.m.length} monstros` : `${this.m.length} monstros`, W / 2, 88, { size: 16, bg: 'rgba(0,0,0,.6)' });
    label(EVO.slice(0, 7).map((e) => e.e).join(' → '), W / 2, 122, 18, '#fff', 'center', 400);
    if (this.s.showLeaderboard) hudBoard([...this.m].sort((a, c) => c.xp - a.xp).map((mo) => ({ user: mo.user, value: `${EVO[this.stage(mo)].e} ${fmtK(mo.xp)}` })), W - 260, 140, 240, { title: 'MAIS EVOLUÍDOS', n: this.s.leaderboardSize, rowH: 30, bg: 'rgba(8,10,20,.6)' });
    this.feedL.draw(20, ARENA_BOTTOM - 190);
    if (this.ph.name === 'end' && this.champ) winnerSpot(this.champ.user, 560, { title: 'MONSTRO SUPREMO' });
  },
});

// ---------------- Cobrinha (Snake que joga sozinha) ----------------
defineGame({
  id: 'snake', name: 'Cobrinha', genre: 'arcade', icon: '🐍', color: '#22c55e',
  desc: 'Uma cobrinha joga sozinha enquanto os espectadores dão maçãs e jogam bombas. Cada presente faz a cobra crescer ou encolher na tela.',
  help: '<p>A cobra anda sozinha atrás das maçãs. ❤️ Likes, ⭐ seguir e 🎁 presentes colocam <b>maçãs</b> (mais moedas, mais maçãs). Presentes de sabotagem jogam <b>bombas</b> que encolhem a cobra.</p><p>Se ela bater nela mesma, a rodada acaba e mostra o recorde.</p>',
  settings: [
    { key: 'speed', type: 'select', label: 'Velocidade', options: [['0.16', 'Devagar'], ['0.11', 'Normal'], ['0.07', 'Rápida']], default: '0.11' },
    { key: 'snakeColor', type: 'color', label: 'Cor da cobra', default: '#22c55e' },
    { key: 'boardMap', type: 'select', label: 'Tabuleiro', options: [['grass', 'Grama'], ['neon', 'Neon'], ['sand', 'Areia']], default: 'grass' },
    { key: 'bombShrinkAmount', type: 'slider', label: 'Quanto a bomba encolhe', min: 1, max: 10, default: 3 },
    { key: 'minSnakeLength', type: 'slider', label: 'Tamanho mínimo', min: 2, max: 10, default: 3 },
    { key: 'resultDuration', type: 'slider', label: 'Segundos do resultado', min: 3, max: 15, default: 5 },
  ],
  actions: [{ id: 'add_apples', label: 'Maçãs', icon: '🍎' }, { id: 'add_bombs', label: 'Bombas', icon: '💣' }],
  bindings: [{ action: 'add_apples', trigger: 'like', likes: 10 }, { action: 'add_apples', trigger: 'follow' }, { action: 'add_apples', trigger: 'gift', minCoins: 1 }, { action: 'add_bombs', trigger: 'gift', minCoins: 30 }],
  reset() {
    this.C = 20; this.R = 30;
    this.body = [[10, 15], [9, 15], [8, 15]]; this.dir = [1, 0]; this.apples = [this.free()]; this.bombs = []; this.t = 0; this.dead = 0; this.best = Math.max(this.best || 0, 0); this.eaten = 0; this.feed = new Feed(3);
  },
  free() { for (let k = 0; k < 200; k++) { const p = [randInt(0, this.C - 1), randInt(0, this.R - 1)]; if (!this.body?.some((b) => b[0] === p[0] && b[1] === p[1]) && !this.apples?.some((a) => a.p[0] === p[0] && a.p[1] === p[1])) return { p, user: null }; } return { p: [0, 0] }; },
  sample() { return 'bora'; },
  onAction(id, a) {
    if (this.dead) return;
    const n = a.gift ? clamp(Math.round(a.qty), 1, 12) : 1;
    for (let i = 0; i < n; i++) { const f = this.free(); f.user = a.user; (id === 'add_apples' ? this.apples : this.bombs).push(f); }
    if (a.gift) this.feed.push(a.user, id === 'add_apples' ? `🍎 ×${n}` : `💣 ×${n}`, id === 'add_apples' ? '#7cff6b' : '#ff6b8a');
  },
  // Caminho até a maçã mais perto (busca em largura), evitando o próprio corpo e bombas.
  think() {
    const C = this.C, R = this.R, head = this.body[0];
    const blocked = new Set(this.body.slice(0, -1).map((b) => b[0] + ',' + b[1]));
    for (const b of this.bombs) blocked.add(b.p[0] + ',' + b.p[1]);
    const goals = new Set(this.apples.map((a) => a.p[0] + ',' + a.p[1]));
    const prev = new Map([[head[0] + ',' + head[1], null]]);
    const q = [head];
    let found = null;
    while (q.length && !found) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx >= C || ny >= R || blocked.has(k) || prev.has(k)) continue;
        prev.set(k, x + ',' + y);
        if (goals.has(k)) { found = k; break; }
        q.push([nx, ny]);
      }
    }
    if (found) { let k = found; while (prev.get(k) !== head[0] + ',' + head[1]) k = prev.get(k); const [nx, ny] = k.split(',').map(Number); this.dir = [nx - head[0], ny - head[1]]; return; }
    // Sem caminho: vai para onde tiver espaço livre
    const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => { const nx = head[0] + dx, ny = head[1] + dy; return nx >= 0 && ny >= 0 && nx < C && ny < R && !blocked.has(nx + ',' + ny); });
    if (opts.length) this.dir = opts[0];
  },
  update(dt) {
    this.feed.update(dt);
    if (this.dead) { this.dead -= dt; if (this.dead <= 0) this.reset(); return; }
    this.t += dt;
    const step = Number(this.s.speed);
    while (this.t >= step) {
      this.t -= step;
      this.think();
      const h = this.body[0], n = [h[0] + this.dir[0], h[1] + this.dir[1]];
      if (n[0] < 0 || n[1] < 0 || n[0] >= this.C || n[1] >= this.R || this.body.slice(0, -1).some((b) => b[0] === n[0] && b[1] === n[1])) { this.die(); return; }
      this.body.unshift(n);
      const ai = this.apples.findIndex((a) => a.p[0] === n[0] && a.p[1] === n[1]);
      if (ai >= 0) { const ap = this.apples.splice(ai, 1)[0]; this.eaten++; sfx.pop(); if (ap.user) scores.add(this.id, ap.user, 1); if (!this.apples.length) this.apples.push(this.free()); }
      else this.body.pop();
      const bi = this.bombs.findIndex((b) => b.p[0] === n[0] && b.p[1] === n[1]);
      if (bi >= 0) { this.bombs.splice(bi, 1); sfx.boom(); const k = Math.min(this.s.bombShrinkAmount, this.body.length - this.s.minSnakeLength); if (k > 0) this.body.splice(-k); }
      this.best = Math.max(this.best, this.body.length);
    }
  },
  die() { this.dead = this.s.resultDuration; sfx.boom(); burst(W / 2, 600, ['#22c55e', '#fff'], 60, 420); voice.say(`A cobra bateu! Ela chegou a ${this.body.length} de tamanho.`); },
  draw() {
    const theme = { grass: ['#86c34a', '#7ab840', '#3f6b1f'], neon: ['#0b1024', '#0e1530', '#22e3ee'], sand: ['#e9cf8f', '#e1c47f', '#a1793a'] }[this.s.boardMap];
    if (!customBackground(this)) { ctx.fillStyle = theme[2]; ctx.fillRect(0, 0, W, H); }
    const cs = Math.min((W - 40) / this.C, (H - 260) / this.R), ox = (W - this.C * cs) / 2, oy = 190;
    for (let y = 0; y < this.R; y++) for (let x = 0; x < this.C; x++) { ctx.fillStyle = (x + y) % 2 ? theme[0] : theme[1]; ctx.fillRect(ox + x * cs, oy + y * cs, cs, cs); }
    for (const a of this.apples) { label('🍎', ox + (a.p[0] + 0.5) * cs, oy + (a.p[1] + 0.55) * cs, cs * 0.9, '#fff', 'center', 400); }
    for (const b of this.bombs) label('💣', ox + (b.p[0] + 0.5) * cs, oy + (b.p[1] + 0.55) * cs, cs * 0.9, '#fff', 'center', 400);
    const col = this.s.snakeColor;
    this.body.forEach(([x, y], i) => {
      const k = 1 - i / this.body.length * 0.5;
      ctx.fillStyle = i === 0 ? shade(col, 20) : i % 2 ? col : shade(col, -18);
      ctx.beginPath(); ctx.roundRect(ox + x * cs + cs * (1 - k) / 2, oy + y * cs + cs * (1 - k) / 2, cs * k, cs * k, cs * 0.3); ctx.fill();
    });
    const [hx, hy] = this.body[0];
    ctx.fillStyle = '#fff'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(ox + (hx + 0.5) * cs + this.dir[1] * s * cs * 0.22 + this.dir[0] * cs * 0.15, oy + (hy + 0.5) * cs + this.dir[0] * s * cs * 0.22 + this.dir[1] * cs * 0.15, cs * 0.16, 0, 7); ctx.fill(); }
    title('COBRINHA', W / 2, 52, 48, '#fff');
    pill(`Tamanho ${this.body.length} · Recorde ${this.best} · ${this.eaten} maçãs`, W / 2, 100, { size: 18, bg: 'rgba(0,0,0,.6)' });
    label('likes e presentes dão maçãs 🍎 · presentes grandes jogam bombas 💣', W / 2, 140, 16, '#fff', 'center', 800);
    this.feed.draw(20, 1000);
    if (this.dead) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H); title('A COBRA BATEU!', W / 2, H / 2 - 40, 60, '#ff6b8a'); text(`Tamanho final: ${this.body.length}`, W / 2, H / 2 + 30, 32); }
  },
});
