'use strict';

// Chute ao Gol: o goleiro (pode ser a sua foto) tem barra de vida; o público chuta com comentários e presentes.
registerGame(withConfig({
  id: 'chute',
  name: 'Chute ao Gol',
  icon: '⚽',
  help: '<p>Comente <b>chuta</b> para chutar uma bola (1 a cada 4s). O goleiro defende algumas.</p><p>🌹 1 bola · 🍩 sequência de 3 · 🕶️ bola de fogo (5× e indefensável) · 🌌 chuva de 12 bolas de ouro.</p><p>Quando a vida do goleiro zera, a rodada acaba. Ponha a foto do goleiro em <b>Configurar</b>.</p>',
  cd: new Cooldown(4000),
  kickers: new Map(),
  round: 1,
  reset() {
    this.life = this.config.life;
    this.balls = [];
    this.goals = 0;
    this.saves = 0;
    this.keeper = { x: W / 2, target: W / 2, dive: 0 };
    this.gray = 0;
    this.net = 0;
    this.phase = 'play';
    this.endT = 0;
    this.log = [];
    this.pending = [];
  },
  renderSettings(el, save) {
    renderItemsSettings(el, structuredClone(this.config), {
      min: 1, max: 1, itemLabel: 'Nome do goleiro',
      extras: [{ key: 'life', label: 'Vida do goleiro', min: 10, max: 100000 }],
    }, (cfg) => { this.applyConfig(cfg); save(this.config); });
  },
  sample: () => pick(['chuta', 'chuta!', 'gol']),
  kick(user, kind, delay = 0) {
    this.pending.push({ user, kind, at: delay });
  },
  onEvent(ev) {
    if (this.phase !== 'play') return;
    if (ev.type === 'chat' && /chut|gol|⚽/i.test(ev.text) && this.cd.ok(uid(ev))) this.kick(ev.user, 'normal');
    else if (ev.type === 'gift') {
      const tier = giftTier(ev), n = Math.min(10, ev.count || 1);
      for (let r = 0; r < n; r++) {
        if (tier === 1) this.kick(ev.user, 'gift', r * 0.25);
        else if (tier === 2) for (let k = 0; k < 3; k++) this.kick(ev.user, 'gift', r * 0.9 + k * 0.28);
        else if (tier === 3) this.kick(ev.user, 'fire', r * 0.8);
        else for (let k = 0; k < 12; k++) this.kick(ev.user, 'gold', r * 2 + k * 0.15);
      }
      if (tier >= 3) announcer.show(`${tier === 4 ? '🌟' : '🔥'} @${trim(ev.user.nick, 12)}`, tier === 4 ? '#ffd23f' : '#ff8a3d', 2, 58);
    }
  },
  launch({ user, kind }) {
    if (this.balls.length > 40) return;
    const tx = rand(170, W - 170), ty = rand(360, 600);
    this.balls.push({ user, kind, sx: rand(120, W - 120), sy: 1180, tx, ty, t: 0, dur: kind === 'gold' ? 0.6 : kind === 'fire' ? 1.1 : 0.9, done: false });
    this.keeper.target = clamp(tx + rand(-120, 120), 170, W - 170);
    sfx.tone(160, 0.08, 'sine', 0.15);
  },
  addLog(msg, color) { this.log.unshift({ msg, color, t: 6 }); this.log.length = Math.min(this.log.length, 3); },
  update(dt) {
    this.gray = Math.max(0, this.gray - dt);
    this.net = Math.max(0, this.net - dt);
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    if (this.phase === 'over') {
      this.endT -= dt;
      if (this.endT <= 0) { this.round++; this.reset(); }
      return;
    }
    for (const p of this.pending) p.at -= dt;
    for (const p of this.pending.filter((p) => p.at <= 0)) this.launch(p);
    this.pending = this.pending.filter((p) => p.at > 0);

    const k = this.keeper;
    k.x += (k.target - k.x) * Math.min(1, dt * 3.5);
    k.dive = Math.max(0, k.dive - dt);
    if (!this.balls.length && Math.random() < dt) k.target = rand(220, W - 220);

    for (const b of this.balls) {
      b.t += dt;
      if (b.done || b.t < b.dur) continue;
      b.done = true;
      const reach = Math.abs(b.tx - k.x) < 120;
      const blockable = b.kind === 'normal' || b.kind === 'gift';
      const chance = b.kind === 'normal' ? 0.5 : 0.3;
      if (blockable && reach && Math.random() < chance) {
        this.saves++;
        k.dive = 0.4;
        b.saved = true; b.t = 0; b.sx = b.tx; b.sy = b.ty; b.tx = b.tx + rand(-300, 300); b.ty = 1300; b.dur = 0.7; b.done = false; b.kind = 'saved';
        this.addLog(`🧤 ${this.config.items[0].name} defendeu @${trim(b.user.nick, 10)}`, '#25f4ee');
        sfx.tone(300, 0.1, 'square', 0.08);
        continue;
      }
      if (b.kind === 'saved') { b.gone = true; continue; }
      const dmg = b.kind === 'fire' ? 5 : b.kind === 'gold' ? 2 : 1;
      this.life = Math.max(0, this.life - dmg);
      this.goals++;
      addScore(this.kickers, b.user.nick, dmg);
      this.gray = 0.18;
      this.net = 0.4;
      b.gone = true;
      burst(b.tx, b.ty, b.kind === 'gold' ? ['#ffd23f', '#fff'] : b.kind === 'fire' ? ['#ff8a3d', '#fe2c55'] : ['#fff', '#7cff6b'], 26, 320);
      floatText(`-${dmg}`, b.tx, b.ty - 40, '#fe2c55', 44);
      this.addLog(`⚽ GOL de @${trim(b.user.nick, 12)}`, '#7cff6b');
      sfx.tone(880, 0.12, 'triangle', 0.1);
      if (this.life <= 0) {
        this.phase = 'over';
        this.endT = 9;
        this.balls = []; this.pending = [];
        sfx.win();
        for (let i = 0; i < 5; i++) setTimeout(() => burst(rand(100, W - 100), rand(250, 700), COLORS, 70, 550), i * 250);
        return;
      }
    }
    this.balls = this.balls.filter((b) => !b.gone);
  },
  draw() {
    if (this.gray > 0) ctx.filter = 'grayscale(1) contrast(1.3)';
    background('#0d5c2e', '#1f8f4a');
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.04)' : 'transparent'; ctx.fillRect(0, 700 + i * 75, W, 75); }
    const keeperCfg = this.config.items[0];

    // Topo: frase, placar e vida
    text('QUEM FAZ O GOL?', W / 2, 60, 52, '#fff', 'center', 900);
    roundRect(20, 100, W - 40, 150, 18, 'rgba(0,0,0,.55)');
    text('GOLS', 90, 132, 20, '#9aa0b4'); text(String(this.goals), 90, 170, 40);
    text('DEFESAS', 210, 132, 20, '#9aa0b4'); text(String(this.saves), 210, 170, 40);
    text('RODADA', 330, 132, 20, '#9aa0b4'); text(String(this.round), 330, 170, 40);
    avatar({ nick: keeperCfg.name, pic: keeperCfg.photo }, 430, 170, 36, keeperCfg.color);
    text(trim(keeperCfg.name, 12), 480, 140, 24, '#fff', 'left', 800);
    const pct = this.life / this.config.life;
    roundRect(480, 165, 210, 26, 13, 'rgba(255,255,255,.15)');
    roundRect(480, 165, Math.max(26, 210 * pct), 26, 13, pct > 0.5 ? '#7cff6b' : pct > 0.2 ? '#ffd23f' : '#fe2c55');
    text(`${this.life}/${this.config.life}`, 585, 222, 22, '#fff', 'center', 700);

    // Gol
    const gx = 90, gy = 300, gw = W - 180, gh = 340;
    const shake = this.net > 0 ? rand(-4, 4) : 0;
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
    for (let x = gx; x <= gx + gw; x += 30) { ctx.beginPath(); ctx.moveTo(x + shake, gy); ctx.lineTo(x, gy + gh); ctx.stroke(); }
    for (let y = gy; y <= gy + gh; y += 30) { ctx.beginPath(); ctx.moveTo(gx, y + shake); ctx.lineTo(gx + gw, y); ctx.stroke(); }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(gx, gy + gh); ctx.lineTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();

    // Goleiro
    const k = this.keeper;
    const ky = gy + gh - 150;
    ctx.save();
    ctx.translate(k.x, ky);
    if (k.dive > 0) ctx.rotate((k.target > k.x ? 1 : -1) * 0.6);
    roundRect(-55, 40, 110, 120, 20, keeperCfg.color);
    text('🧤', -80, 70, 46); text('🧤', 80, 70, 46);
    ctx.restore();
    avatar({ nick: keeperCfg.name, pic: keeperCfg.photo }, k.x, ky + 2, 50, '#fff');

    // Bolas
    for (const b of this.balls) {
      const t = clamp(b.t / b.dur, 0, 1);
      const x = b.sx + (b.tx - b.sx) * t;
      const y = b.sy + (b.ty - b.sy) * t - Math.sin(t * Math.PI) * 120;
      const size = (b.kind === 'saved' ? 50 : 90 - 50 * t) * (b.kind === 'fire' ? 2.2 : 1);
      if (b.kind === 'fire') { ctx.globalAlpha = 0.7; text('🔥', x, y + size * 0.3, size * 1.2); ctx.globalAlpha = 1; }
      text(b.kind === 'gold' ? '🟡' : '⚽', x, y, size);
      if (t < 0.5 && b.kind !== 'saved') text(`@${trim(b.user.nick, 10)}`, x, y + size * 0.7, 18, '#fff', 'center', 700);
    }
    ctx.filter = 'none';

    if (this.gray > 0) text('GOL!', W / 2, 760, 120, '#ffd23f');
    this.log.forEach((l, i) => {
      ctx.globalAlpha = clamp(l.t, 0, 1);
      roundRect(30, 860 + i * 48 - 20, W - 60, 40, 20, 'rgba(0,0,0,.6)');
      text(trim(l.msg, 40), 50, 860 + i * 48, 22, l.color, 'left', 700);
      ctx.globalAlpha = 1;
    });
    leaderboardSmall(this.kickers, 30, 1040);
    text('Comente CHUTA ⚽', W - 160, 1080, 30, '#fff', 'center', 900);
    text('🎁 = mais bolas', W - 160, 1120, 24, '#ffd23f', 'center', 700);

    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(0, 0, W, H);
      text('GOLEIRO VENCIDO!', W / 2, 300, 62, '#ffd23f');
      avatar({ nick: keeperCfg.name, pic: keeperCfg.photo }, W / 2, 470, 100, '#fe2c55');
      text('😵', W / 2 + 80, 400, 70);
      leaderboard(this.kickers, 'Artilheiros', W / 2, 660, 3, 32);
      text(`Rodada ${this.round + 1} em ${Math.ceil(this.endT)}s`, W / 2, 1000, 32, '#ddd', 'center', 600);
    }
  },
}, { life: 100, items: [{ name: 'Goleiro', color: '#f59f00', photo: '' }] }));
