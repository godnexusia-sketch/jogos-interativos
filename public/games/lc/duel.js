'use strict';

// Jogos de vez em vez: Tome a Coroa, Lutadores de Palito e Arena do Tapa.

// ---------------- Tome a Coroa (Take the Crown) ----------------
defineGame({
  id: 'take-the-crown', name: 'Tome a Coroa', genre: 'battle', icon: '👑', color: '#eab308',
  desc: 'Um espectador fica no trono enquanto os outros fazem fila para tomar. Quem tiver mais vida vence o confronto e fica com a diferença, então a coroa nunca para.',
  help: '<p>Entre na live (ou comente) para entrar na <b>fila</b>. Cada desafiante enfrenta o rei: quem tem mais vida vence e fica com a <b>diferença</b>.</p><p>❤️ Likes, ⭐ seguir e 🎁 presentes dão <b>vida</b> para você (no trono ou na fila).</p>',
  settings: [
    { key: 'queueSpeed', type: 'slider', label: 'Segundos entre confrontos', min: 2, max: 20, default: 5 },
    { key: 'joinHp', type: 'number', label: 'Vida de quem entra', min: 1, max: 1000, default: 50 },
    { key: 'hpPerCoin', type: 'number', label: 'Vida por moeda', min: 1, max: 100, default: 10 },
  ],
  actions: [{ id: 'join', label: 'Entrar na fila', icon: '🚶' }, { id: 'add_hp', label: 'Mais vida', icon: '❤️' }],
  bindings: [{ action: 'join', trigger: 'join' }, { action: 'join', trigger: 'comment' }, { action: 'add_hp', trigger: 'follow' }, { action: 'add_hp', trigger: 'like', likes: 5 }, { action: 'add_hp', trigger: 'gift', minCoins: 1 }],
  reset() { this.king = null; this.q = []; this.t = this.s.queueSpeed; this.clash = null; this.reign = 0; this.best = this.best || { user: null, secs: 0 }; this.feed = new Feed(3); },
  sample() { return pick(['eu', 'bora', 'coroa']); },
  find(user) { const k = user.id || user.nick; if (this.king && this.king.k === k) return this.king; return this.q.find((x) => x.k === k); },
  join(user) { if (this.find(user)) return this.find(user); const e = { k: user.id || user.nick, user, hp: this.s.joinHp }; if (!this.king) { this.king = e; this.reign = 0; } else this.q.push(e); if (this.q.length > 60) this.q.shift(); return e; },
  onAction(id, a) { const e = this.join(a.user); if (id === 'add_hp') { const n = a.gift ? a.coins * this.s.hpPerCoin : a.count; e.hp += n; if (a.gift) this.feed.push(a.user, `+${fmtK(n)} vida`, '#ffc93c'); } },
  update(dt) {
    this.feed.update(dt);
    if (this.king) { this.reign += dt; if (this.reign > this.best.secs) this.best = { user: this.king.user, secs: this.reign }; }
    if (this.clash) {
      this.clash.t += dt;
      if (this.clash.t > 1.6 && !this.clash.done) {
        this.clash.done = true;
        const { ch } = this.clash, k = this.king;
        if (ch.hp > k.hp) { ch.hp -= k.hp; this.king = ch; this.reign = 0; sfx.win(); burst(W / 2, 420, ['#ffc93c', '#fff'], 60, 420); voice.say(`${ch.user.nick} tomou a coroa!`); scores.add(this.id, ch.user, 1, 1); }
        else { k.hp -= ch.hp; if (k.hp <= 0) k.hp = 1; sfx.boom(); }
      }
      if (this.clash.t > 2.6) this.clash = null;
      return;
    }
    this.t -= dt;
    if (this.t <= 0 && this.king && this.q.length) { this.t = this.s.queueSpeed; this.clash = { ch: this.q.shift(), t: 0 }; }
  },
  draw() {
    const t = performance.now() / 1000;
    if (!customBackground(this)) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2b0a3d'); g.addColorStop(1, '#0d0414'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#7f1d1d'; ctx.beginPath(); ctx.moveTo(W / 2 - 70, 1200); ctx.lineTo(W / 2 + 70, 1200); ctx.lineTo(W / 2 + 40, 560); ctx.lineTo(W / 2 - 40, 560); ctx.fill();
      for (let i = 0; i < 9; i++) { ctx.fillStyle = 'rgba(255,215,0,.08)'; ctx.fillRect(0, 600 + i * 70, W, 4); }
    }
    title('TOME A COROA', W / 2, 56, 48, '#facc15');
    pill(`Fila: ${this.q.length} · reinado mais longo: ${this.best.user ? '@' + trim(this.best.user.nick, 10) + ' ' + fmtTime(this.best.secs) : '—'}`, W / 2, 102, { size: 15, bg: 'rgba(0,0,0,.6)' });
    // Trono
    ctx.fillStyle = '#b45309'; ctx.beginPath(); ctx.roundRect(W / 2 - 130, 230, 260, 330, 30); ctx.fill();
    ctx.fillStyle = '#7c2d12'; ctx.beginPath(); ctx.roundRect(W / 2 - 100, 260, 200, 260, 24); ctx.fill();
    ctx.fillStyle = '#facc15'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(W / 2 - 100 + i * 50, 232, 12, 0, 7); ctx.fill(); }
    if (this.king) {
      const k = this.king, shake = this.clash && this.clash.t > 1.2 && this.clash.t < 1.6 ? rand(-6, 6) : 0;
      avatar(k.user, W / 2 + shake, 380, 90, '#facc15');
      label('👑', W / 2, 270 + Math.sin(t * 3) * 4, 70, '#fff', 'center', 400);
      title('@' + trim(k.user.nick, 14), W / 2, 500, 32, '#fff');
      pill(`❤️ ${fmtK(k.hp)} · ${fmtTime(this.reign)}`, W / 2, 545, { size: 22, bg: '#facc15', color: '#1a1000' });
    } else title('TRONO VAZIO', W / 2, 400, 40, 'rgba(255,255,255,.6)');
    if (this.clash) {
      const ch = this.clash.ch, p = Math.min(1, this.clash.t / 1.2), y = 900 - p * 260;
      avatar(ch.user, W / 2, y, 60, '#ef4444');
      pill(`@${trim(ch.user.nick, 12)} ❤️ ${fmtK(ch.hp)}`, W / 2, y + 86, { size: 18, bg: 'rgba(0,0,0,.7)' });
      if (this.clash.t > 1.2 && this.clash.t < 1.8) title('⚔️', W / 2, 640, 120, '#fff');
      if (this.clash.done) title(this.king === ch ? 'NOVO REI!' : 'DEFENDEU!', W / 2, 760, 52, this.king === ch ? '#facc15' : '#ff6b8a');
    }
    // Fila
    label('PRÓXIMOS DESAFIANTES', W / 2, 980, 16, '#facc15', 'center', 900);
    this.q.slice(0, 8).forEach((e, i) => { const x = 70 + i * 82; avatar(e.user, x, 1040, 30, '#fff'); label(fmtK(e.hp), x, 1086, 14, '#fff', 'center', 900); });
    if (!this.q.length) label('entre na live ou comente para entrar na fila', W / 2, 1040, 18, 'rgba(255,255,255,.7)', 'center', 700);
    this.feed.draw(20, 150);
  },
});

// ---------------- Base dos duelos (palito e tapa) ----------------
// Fila → dois no palco → luta até um zerar a vida → o vencedor fica, o perdedor sai.
const DuelBase = {
  reset() { this.q = []; this.a = null; this.b = null; this.streaks = new Map(); this.ph = 'wait'; this.t = 0; this.fx = []; this.feed = new Feed(3); this.botT = 0; },
  entry(user) { return { k: user.id || user.nick, user, hp: this.s.spawnHp, max: this.s.spawnHp, wins: 0, anim: 0, hit: 0, x: 0 }; },
  find(user) { const k = user.id || user.nick; return [this.a, this.b, ...this.q].find((e) => e && e.k === k); },
  join(user) { let e = this.find(user); if (e) return e; e = this.entry(user); this.q.push(e); if (this.q.length > 50) this.q.shift(); return e; },
  addHp(user, n) { const e = this.join(user); e.hp += n; e.max = Math.max(e.max, e.hp); return e; },
  update(dt) {
    this.feed.update(dt);
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.life);
    if (this.s.demoMode && !this.q.length && (!this.a || !this.b)) { this.botT -= dt; if (this.botT <= 0) { this.botT = 3; this.join(botUser('d')); } }
    if (this.ph === 'wait') { if (!this.a && this.q.length) this.a = this.q.shift(); if (!this.b && this.q.length) { this.b = this.q.shift(); this.ph = 'intro'; this.t = 1.5; sfx.confirm(); } return; }
    this.t -= dt;
    if (this.ph === 'intro' && this.t <= 0) { this.ph = 'fight'; this.t = 0; }
    else if (this.ph === 'fight') { this.fight(dt); if (this.a.hp <= 0 || this.b.hp <= 0) this.ko(this.a.hp > 0 ? this.a : this.b); }
    else if (this.ph === 'ko' && this.t <= 0) {
      const w = this.winner;
      w.hp = Math.max(w.hp, w.max * 0.5);
      this.a = w; this.b = null; this.ph = 'wait';
    }
    for (const e of [this.a, this.b]) if (e) { e.anim = Math.max(0, e.anim - dt * 3); e.hit = Math.max(0, e.hit - dt * 3); }
  },
  ko(w) {
    const l = w === this.a ? this.b : this.a;
    this.winner = w; w.wins++;
    if (!w.user.bot) { const s = (this.streaks.get(w.k)?.value || 0) + 1; this.streaks.set(w.k, { user: w.user, value: Math.max(s, this.streaks.get(w.k)?.value || 0) }); scores.add(this.id, w.user, 1, 1); }
    this.ph = 'ko'; this.t = this.s.winHold || 3;
    sfx.boom(); burst(W / 2 + (l === this.a ? -150 : 150), 640, ['#ff2d55', '#fff', '#ffc93c'], 60, 460);
    this.koText = this.finisher?.(w) || 'K.O.!';
    voice.say(`${w.user.nick} venceu! ${w.wins > 1 ? w.wins + ' vitórias seguidas!' : ''}`);
  },
  drawHud(color) {
    const e = [this.a, this.b];
    e.forEach((f, i) => {
      if (!f) return;
      const x = i ? W - 30 - 300 : 30;
      slant(x, 150, 300, 70, { fill: 'rgba(8,10,20,.85)', skew: 14, border: i ? '#ef4444' : '#3b82f6' });
      avatar(f.user, i ? x + 270 : x + 30, 185, 24, '#fff');
      label(trim(f.user.nick, 12), i ? x + 236 : x + 64, 170, 18, '#fff', i ? 'right' : 'left', 900);
      glossBar(x + (i ? 20 : 64), 190, 216, 16, f.hp / f.max, f.hp / f.max > 0.4 ? '#22c55e' : '#ef4444');
      label(`${fmtK(Math.max(0, f.hp))} ❤️ · 🏆${f.wins}`, i ? x + 236 : x + 64, 220, 14, 'rgba(255,255,255,.85)', i ? 'right' : 'left', 800);
    });
    if (this.ph === 'intro') title('LUTEM!', W / 2, 420, 80, color);
    if (this.ph === 'ko') title(this.koText, W / 2, 420, 90, '#ff2d55');
    label(`FILA (${this.q.length})`, 40, 1000, 16, color, 'left', 900);
    this.q.slice(0, 8).forEach((e2, i) => avatar(e2.user, 60 + i * 64, 1048, 26, '#fff'));
    if (this.s.showLeaderboard) hudBoard([...this.streaks.values()].sort((x, y) => y.value - x.value), W - 260, 990, 240, { title: 'MAIS VITÓRIAS', n: this.s.leaderboardSize, rowH: 30 });
    this.feed.draw(20, 260);
  },
};
const DUEL_COMMON = [
  { key: 'spawnHp', type: 'number', label: 'Vida de quem entra', min: 10, max: 2000, default: 100 },
  { key: 'hpPerCoin', type: 'number', label: 'Vida por moeda', min: 1, max: 100, default: 10 },
  { key: 'winHold', type: 'number', label: 'Segundos comemorando a vitória', min: 1, max: 10, default: 3 },
  { key: 'demoMode', type: 'toggle', label: 'Lutadores bots quando a fila está vazia', default: true },
  ...BOARD_SETTINGS(5),
];
// Boneco de palito com a foto na cabeça. pose: 0 parado, 1 soco, 2 chute; weapon: 0 mão, 1 espada, 2 pistola.
function stickFigure(x, y, dir, user, col, { pose = 0, anim = 0, hit = 0, weapon = 0, t = 0 } = {}) {
  ctx.save(); ctx.translate(x + (hit ? -dir * hit * 20 : 0), y); ctx.scale(dir, 1);
  ctx.strokeStyle = col; ctx.lineWidth = 12; ctx.lineCap = 'round';
  const bob = Math.sin(t * 6) * 4;
  // Pernas
  const kick = pose === 2 ? anim : 0;
  ctx.beginPath(); ctx.moveTo(0, 40 + bob); ctx.lineTo(-24, 130); ctx.moveTo(0, 40 + bob); ctx.lineTo(24 + kick * 70, 130 - kick * 70); ctx.stroke();
  // Corpo
  ctx.beginPath(); ctx.moveTo(0, -60 + bob); ctx.lineTo(0, 40 + bob); ctx.stroke();
  // Braços
  const punch = pose === 1 ? anim : 0;
  ctx.beginPath(); ctx.moveTo(0, -40 + bob); ctx.lineTo(-30, 10 + bob); ctx.moveTo(0, -40 + bob); ctx.lineTo(30 + punch * 60, -30 + bob - punch * 10); ctx.stroke();
  const hx = 30 + punch * 60, hy = -30 + bob - punch * 10;
  if (weapon === 1) { ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(-1 + punch * 1.6) * 90, hy + Math.sin(-1 + punch * 1.6) * 90); ctx.stroke(); ctx.strokeStyle = '#a16207'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(hx - 8, hy); ctx.lineTo(hx + 10, hy); ctx.stroke(); }
  if (weapon === 2) { ctx.fillStyle = '#334155'; ctx.fillRect(hx - 4, hy - 12, 40, 14); ctx.fillRect(hx - 4, hy - 4, 12, 22); if (punch > 0.6) { ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(hx + 46, hy - 5, 10, 0, 7); ctx.fill(); } }
  ctx.restore();
  avatar(user, x + (hit ? -dir * hit * 20 : 0), y - 100 + bob, 44, col);
}

// ---------------- Lutadores de Palito (Stick Fighters) ----------------
defineGame(Object.assign({
  id: 'stick-fighters', name: 'Lutadores de Palito', genre: 'party', icon: '🥷', color: '#3b82f6',
  desc: 'Os espectadores fazem fila para duelar um contra um. Presentes dão força e trocam a arma de punhos para espada e pistola. Quem vence fica no palco.',
  help: '<p>Entre na live para entrar na <b>fila</b>. Dois lutam por vez; o vencedor fica no palco. 🎁 Presentes dão <b>vida</b>: com 300+ você luta de <b>espada</b>, com 1.000+ de <b>pistola</b>. ❤️ Likes curam quem está no palco.</p>',
  settings: [
    ...DUEL_COMMON,
    { key: 'fightPace', type: 'slider', label: 'Ritmo da luta', min: 0.5, max: 2, step: 0.1, default: 1 },
    { key: 'swordHpThreshold', type: 'number', label: 'Vida para ganhar espada', min: 50, max: 5000, default: 300 },
    { key: 'pistolHpThreshold', type: 'number', label: 'Vida para ganhar pistola', min: 100, max: 20000, default: 1000 },
  ],
  actions: [{ id: 'join', label: 'Entrar na fila', icon: '🚶' }, { id: 'grow_hp', label: 'Mais vida', icon: '💪' }, { id: 'heal_stage', label: 'Curar o palco', icon: '❤️' }],
  bindings: [{ action: 'join', trigger: 'join' }, { action: 'join', trigger: 'comment' }, { action: 'grow_hp', trigger: 'gift', minCoins: 1 }, { action: 'heal_stage', trigger: 'like', likes: 10 }],
  sample() { return pick(['eu', 'luta', 'bora']); },
  weapon(e) { return e.max >= this.s.pistolHpThreshold ? 2 : e.max >= this.s.swordHpThreshold ? 1 : 0; },
  onAction(id, a) {
    if (id === 'join') this.join(a.user);
    else if (id === 'grow_hp') { const e = this.addHp(a.user, a.coins * this.s.hpPerCoin); this.feed.push(a.user, `💪 +${fmtK(a.coins * this.s.hpPerCoin)} ${['', '🗡️', '🔫'][this.weapon(e)]}`, '#22e3ee'); }
    else if (id === 'heal_stage') for (const e of [this.a, this.b]) if (e) e.hp = Math.min(e.max, e.hp + 5);
  },
  fight(dt) {
    this.t -= dt * this.s.fightPace;
    if (this.t > 0) return;
    this.t = rand(0.45, 0.9);
    const atk = Math.random() < 0.5 ? this.a : this.b, def = atk === this.a ? this.b : this.a, w = this.weapon(atk);
    atk.pose = Math.random() < 0.5 ? 1 : 2; atk.anim = 1;
    if (Math.random() < 0.18) { floatText('DESVIOU', W / 2 + (def === this.a ? -150 : 150), 520, '#fff', 24); return; }
    const dmg = Math.round((8 + Math.sqrt(atk.max) * 0.9) * [1, 1.6, 2.4][w] * rand(0.7, 1.3));
    def.hp -= dmg; def.hit = 1;
    floatText(`-${dmg}`, W / 2 + (def === this.a ? -150 : 150), 520, '#fde047', 34);
    sfx.tone(w === 2 ? 900 : 180, 0.08, w === 2 ? 'square' : 'sawtooth', 0.08);
  },
  finisher() { return 'K.O.!'; },
  draw() {
    const t = performance.now() / 1000;
    if (!customBackground(this)) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0f172a'); g.addColorStop(1, '#1e293b'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#334155'; ctx.fillRect(0, 780, W, 20); ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 800, W, H);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(59,130,246,.08)'; ctx.beginPath(); ctx.moveTo(100 + i * 110, 0); ctx.lineTo(60 + i * 110, 780); ctx.lineTo(140 + i * 110, 780); ctx.fill(); }
    }
    title('LUTADORES DE PALITO', W / 2, 56, 42, '#60a5fa');
    label('entre na live para lutar · presentes dão vida e armas', W / 2, 100, 16, '#fff', 'center', 800);
    if (this.a) stickFigure(W / 2 - 150, 650, 1, this.a.user, '#60a5fa', { pose: this.a.pose, anim: this.a.anim, hit: this.a.hit, weapon: this.weapon(this.a), t });
    if (this.b) stickFigure(W / 2 + 150, 650, -1, this.b.user, '#f87171', { pose: this.b.pose, anim: this.b.anim, hit: this.b.hit, weapon: this.weapon(this.b), t: t + 1 });
    this.drawHud('#60a5fa');
  },
}, DuelBase));

// ---------------- Arena do Tapa (Slap Arena) ----------------
const SLAP_WEAPONS = [{ n: 'Mão', e: '🖐️', m: 1, hp: 0 }, { n: 'Peixe', e: '🐟', m: 1.4, hp: 200 }, { n: 'Frigideira', e: '🍳', m: 1.8, hp: 500 }, { n: 'Taco', e: '🏏', m: 2.3, hp: 1000 }, { n: 'Marreta', e: '🔨', m: 3, hp: 2500 }, { n: 'Antena parabólica', e: '📡', m: 4, hp: 6000 }];
defineGame(Object.assign({
  id: 'slap-arena', name: 'Arena do Tapa', genre: 'party', icon: '🖐️', color: '#f43f5e',
  desc: 'Os espectadores fazem fila e se estapeiam um contra um. Presentes dão força e liberam armas maiores: peixe, frigideira, taco, marreta e antena parabólica. A cada tantas vitórias, um FATALITY.',
  help: '<p>Entre na live para entrar na <b>fila</b>. Um tapa de cada vez! 🎁 Presentes dão <b>vida</b> e armas: 🐟 peixe (200), 🍳 frigideira (500), 🏏 taco (1.000), 🔨 marreta (2.500), 📡 antena (6.000). Também dá para comprar a arma direto com presentes específicos.</p>',
  settings: [
    ...DUEL_COMMON,
    { key: 'slapPace', type: 'slider', label: 'Ritmo dos tapas', min: 0.5, max: 2, step: 0.1, default: 1 },
    { key: 'finisherEveryWins', type: 'number', label: 'FATALITY a cada quantas vitórias', min: 2, max: 20, default: 3 },
  ],
  actions: [{ id: 'join', label: 'Entrar na fila', icon: '🚶' }, { id: 'grow_hp', label: 'Mais vida', icon: '💪' }, { id: 'force_ko', label: 'Nocaute na hora', icon: '💀' },
    ...SLAP_WEAPONS.slice(1).map((w, i) => ({ id: 'give_' + i, label: w.n, icon: w.e }))],
  bindings: [{ action: 'join', trigger: 'join' }, { action: 'join', trigger: 'comment' }, { action: 'grow_hp', trigger: 'gift', minCoins: 1 }, { action: 'grow_hp', trigger: 'like', likes: 10 }],
  sample() { return pick(['eu', 'tapa', 'bora']); },
  weapon(e) { if (e.forced !== undefined) return e.forced; let w = 0; SLAP_WEAPONS.forEach((x, i) => { if (e.max >= x.hp) w = i; }); return w; },
  onAction(id, a) {
    if (id === 'join') this.join(a.user);
    else if (id === 'grow_hp') { const n = a.gift ? a.coins * this.s.hpPerCoin : a.count; const e = this.addHp(a.user, n); if (a.gift) this.feed.push(a.user, `💪 +${fmtK(n)} ${SLAP_WEAPONS[this.weapon(e)].e}`, '#ffc93c'); }
    else if (id === 'force_ko') { const e = this.find(a.user); if (e && this.ph === 'fight' && (e === this.a || e === this.b)) (e === this.a ? this.b : this.a).hp = 0; }
    else if (id.startsWith('give_')) { const e = this.join(a.user); e.forced = Math.max(this.weapon(e), Number(id.slice(5)) + 1); this.feed.push(a.user, `ganhou ${SLAP_WEAPONS[e.forced].e} ${SLAP_WEAPONS[e.forced].n}`, '#ffc93c'); }
  },
  fight(dt) {
    this.t -= dt * this.s.slapPace;
    if (this.t > 0) return;
    this.t = 1.1;
    this.turn = this.turn === this.a ? this.b : this.a;
    const atk = this.turn, def = atk === this.a ? this.b : this.a, w = SLAP_WEAPONS[this.weapon(atk)];
    atk.anim = 1;
    const crit = Math.random() < 0.15;
    const dmg = Math.round((12 + Math.sqrt(atk.max)) * w.m * (crit ? 2 : 1) * rand(0.8, 1.2));
    def.hp -= dmg; def.hit = 1;
    floatText(`${crit ? 'CRÍTICO! ' : ''}-${dmg}`, W / 2 + (def === this.a ? -160 : 160), 470, crit ? '#ff2d55' : '#fde047', crit ? 40 : 32);
    sfx.tone(260, 0.06, 'square', 0.12); sfx.tone(120, 0.12, 'sawtooth', 0.08);
    burst(W / 2 + (def === this.a ? -140 : 140), 560, ['#fff', '#fde047'], 12, 260);
  },
  finisher(w) { return w.wins % this.s.finisherEveryWins === 0 ? 'FATALITY!' : 'NOCAUTE!'; },
  draw() {
    const t = performance.now() / 1000;
    if (!customBackground(this)) {
      stageBg('red', t, { floor: true });
      ctx.fillStyle = '#7f1d1d'; ctx.beginPath(); ctx.ellipse(W / 2, 820, 360, 80, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fca5a5'; ctx.lineWidth = 4; ctx.stroke();
    }
    title('ARENA DO TAPA', W / 2, 56, 46, '#fb7185');
    label('entre na live · presentes dão armas maiores', W / 2, 100, 16, '#fff', 'center', 800);
    [this.a, this.b].forEach((e, i) => {
      if (!e) return;
      const dir = i ? -1 : 1, x = W / 2 + (i ? 160 : -160) - dir * e.hit * 30, y = 600;
      // Corpo de desenho animado
      ctx.save(); ctx.translate(x, y); ctx.rotate(-dir * e.hit * 0.3);
      ctx.fillStyle = i ? '#ef4444' : '#3b82f6'; ctx.beginPath(); ctx.roundRect(-60, 40, 120, 160, 50); ctx.fill();
      ctx.restore();
      avatar(e.user, x, y - 20, 80, i ? '#ef4444' : '#3b82f6');
      const w = SLAP_WEAPONS[this.weapon(e)], sw = e.anim;
      ctx.save(); ctx.translate(x + dir * 70, y + 70); ctx.rotate(dir * (-1.2 + sw * 2.2));
      label(w.e, dir * 70, -20, 70, '#fff', 'center', 400);
      ctx.restore();
      if (e === this.turn && sw > 0.6) label('💥', W / 2 + (i ? -110 : 110), 560, 80, '#fff', 'center', 400);
    });
    this.drawHud('#fb7185');
  },
}, DuelBase));
