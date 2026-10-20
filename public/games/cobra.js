'use strict';

// Cobra IA: a cobra joga sozinha atrás das maçãs; o chat solta bombas para matá-la.
const COLS = 18, ROWS = 24, CELL = 36, GX = 36, GY = 230;

registerGame({
  id: 'cobra',
  name: 'Cobra IA',
  icon: '🐍',
  help: '<p>A IA joga sozinha. Comente <b>bomba</b> para soltar uma bomba na arena (1 a cada 5s). Se a cobra encostar, você matou!</p><p>🌹 +1 maçã · 🍩 +10 maçãs · 🕶️ +20 maçãs (a cobra cresce e fica mais fácil de se enrolar) · 🌌 30 bombas de uma vez.</p>',
  cd: new Cooldown(5000),
  killers: new Map(),
  record: 0,
  deaths: 0,
  reset() {
    const cx = Math.floor(COLS / 2), cy = Math.floor(ROWS / 2);
    this.snake = [{ x: cx, y: cy }, { x: cx, y: cy + 1 }, { x: cx, y: cy + 2 }, { x: cx, y: cy + 3 }];
    this.dir = { x: 0, y: -1 };
    this.apples = [];
    this.bombs = [];
    this.step = 0;
    this.dead = 0;
    this.killMsg = null;
    this.log = [];
    this.addApple();
  },
  sample: () => (Math.random() < 0.7 ? 'bomba' : 'kkk'),
  occupied(x, y) {
    return this.snake.some((s) => s.x === x && s.y === y) || this.apples.some((a) => a.x === x && a.y === y) || this.bombs.some((b) => b.x === x && b.y === y);
  },
  freeCell(avoidHead = 3) {
    const h = this.snake[0];
    for (let k = 0; k < 200; k++) {
      const x = randInt(0, COLS - 1), y = randInt(0, ROWS - 1);
      if (!this.occupied(x, y) && Math.abs(x - h.x) + Math.abs(y - h.y) > avoidHead) return { x, y };
    }
    return null;
  },
  addApple(user) { const c = this.freeCell(1); if (c && this.apples.length < 60) this.apples.push({ ...c, user }); },
  addBomb(user, ahead = false) {
    if (this.bombs.length >= 90) return;
    let c = null;
    if (ahead) {
      // Às vezes a bomba cai no caminho da cobra.
      const h = this.snake[0], d = randInt(3, 6);
      const x = h.x + this.dir.x * d, y = h.y + this.dir.y * d;
      if (x >= 0 && y >= 0 && x < COLS && y < ROWS && !this.occupied(x, y)) c = { x, y };
    }
    c = c || this.freeCell(2);
    // "seen": a IA só desvia das bombas que percebeu.
    if (c) this.bombs.push({ ...c, user, t: 25, seen: Math.random() < 0.7, born: 0 });
  },
  addLog(msg, color) { this.log.unshift({ msg, color, t: 6 }); this.log.length = Math.min(this.log.length, 3); },
  onEvent(ev) {
    if (this.dead > 0) return;
    if (ev.type === 'chat' && /bomba|💣|mata|morre/i.test(ev.text) && this.cd.ok(uid(ev))) {
      this.addBomb(ev.user, Math.random() < 0.35);
    } else if (ev.type === 'gift') {
      const tier = giftTier(ev), n = Math.min(5, ev.count || 1);
      if (tier === 4) { for (let k = 0; k < 30 * n; k++) this.addBomb(ev.user, k < 3); this.addLog(`💣 @${trim(ev.user.nick, 12)} soltou ${30 * n} bombas!`, '#fe2c55'); announcer.show(`💣×${30 * n} ${trim(ev.user.nick, 12)}`, '#fe2c55', 2.5, 56); sfx.boom(); }
      else {
        const apples = [1, 10, 20][tier - 1] * n;
        for (let k = 0; k < apples; k++) this.addApple(ev.user);
        this.addLog(`🍎 @${trim(ev.user.nick, 12)} deu ${apples} maçã${apples > 1 ? 's' : ''}`, '#7cff6b');
      }
    }
  },
  // Busca em largura até a maçã mais próxima, evitando o corpo e as bombas que a IA viu.
  think() {
    const h = this.snake[0];
    const blocked = new Set(this.snake.slice(0, -1).map((s) => s.x + ',' + s.y));
    for (const b of this.bombs) if (b.seen) blocked.add(b.x + ',' + b.y);
    const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    const ok = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && !blocked.has(x + ',' + y);
    const goal = new Set(this.apples.map((a) => a.x + ',' + a.y));
    const prev = new Map([[h.x + ',' + h.y, null]]);
    const q = [h];
    let found = null;
    while (q.length && !found) {
      const c = q.shift();
      for (const d of dirs) {
        const nx = c.x + d.x, ny = c.y + d.y, k = nx + ',' + ny;
        if (!ok(nx, ny) || prev.has(k)) continue;
        prev.set(k, c.x + ',' + c.y);
        if (goal.has(k)) { found = k; break; }
        q.push({ x: nx, y: ny });
      }
    }
    if (found) {
      let k = found;
      while (prev.get(k) !== h.x + ',' + h.y) k = prev.get(k);
      const [x, y] = k.split(',').map(Number);
      const d = { x: x - h.x, y: y - h.y };
      if (this.space(x, y, blocked) > this.snake.length) return d;
    }
    // Sem caminho seguro: vai para onde tem mais espaço livre.
    let best = this.dir, bestSpace = -1;
    for (const d of dirs) {
      const nx = h.x + d.x, ny = h.y + d.y;
      if (!ok(nx, ny)) continue;
      const s = this.space(nx, ny, blocked);
      if (s > bestSpace) { bestSpace = s; best = d; }
    }
    return best;
  },
  space(x, y, blocked) {
    const seen = new Set([x + ',' + y]);
    const q = [[x, y]];
    while (q.length && seen.size < 200) {
      const [cx, cy] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, k = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || blocked.has(k) || seen.has(k)) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    return seen.size;
  },
  die(msg, user) {
    this.dead = 4;
    this.deaths++;
    this.killMsg = { msg, user, len: this.snake.length };
    if (user) addScore(this.killers, user.nick);
    const h = this.snake[0];
    burst(GX + h.x * CELL + CELL / 2, GY + h.y * CELL + CELL / 2, ['#fe2c55', '#ffd23f', '#7cff6b'], 80, 500);
    sfx.boom();
  },
  update(dt) {
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    for (const b of this.bombs) { b.t -= dt; b.born += dt; }
    this.bombs = this.bombs.filter((b) => b.t > 0);
    if (this.dead > 0) { this.dead -= dt; if (this.dead <= 0) this.reset(); return; }
    if (!this.apples.length) this.addApple();
    this.step += dt;
    const rate = 1 / clamp(7 + this.snake.length / 10, 7, 14);
    if (this.step < rate) return;
    this.step = 0;
    this.dir = this.think();
    const h = this.snake[0];
    const nx = h.x + this.dir.x, ny = h.y + this.dir.y;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || this.snake.slice(0, -1).some((s) => s.x === nx && s.y === ny)) return this.die('A IA se enrolou sozinha! 🤡');
    const bomb = this.bombs.find((b) => b.x === nx && b.y === ny);
    this.snake.unshift({ x: nx, y: ny });
    if (bomb) return this.die('MATOU A COBRA! 💀', bomb.user);
    const ai = this.apples.findIndex((a) => a.x === nx && a.y === ny);
    if (ai >= 0) { this.apples.splice(ai, 1); this.record = Math.max(this.record, this.snake.length); sfx.tone(1000, 0.04, 'sine', 0.05); }
    else this.snake.pop();
  },
  draw() {
    background('#0b1a10', '#06100a');
    roundRect(20, 20, W - 40, 190, 20, 'rgba(0,0,0,.55)');
    text('🐍 COBRA IA', W / 2, 60, 46, '#7cff6b', 'center', 900);
    text('A IA joga. O chat tenta matar.', W / 2, 105, 24, '#ddd', 'center', 600);
    [['TAMANHO', this.snake.length], ['RECORDE', this.record], ['MORTES', this.deaths], ['BOMBAS', this.bombs.length]].forEach(([l, v], i) => {
      const x = 110 + i * 167;
      text(l, x, 145, 18, '#9aa0b4', 'center', 700);
      text(String(v), x, 182, 36);
    });
    // Arena
    roundRect(GX - 6, GY - 6, COLS * CELL + 12, ROWS * CELL + 12, 12, '#1d3b24');
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#14301b' : '#18381f';
      ctx.fillRect(GX + x * CELL, GY + y * CELL, CELL, CELL);
    }
    for (const a of this.apples) text('🍎', GX + a.x * CELL + CELL / 2, GY + a.y * CELL + CELL / 2 + 2, 28);
    for (const b of this.bombs) {
      const s = b.born < 0.3 ? 28 + (0.3 - b.born) * 80 : 28;
      ctx.globalAlpha = b.t < 3 ? 0.4 + 0.6 * Math.abs(Math.sin(b.t * 6)) : 1;
      text('💣', GX + b.x * CELL + CELL / 2, GY + b.y * CELL + CELL / 2 + 2, s);
      ctx.globalAlpha = 1;
    }
    this.snake.forEach((s, i) => {
      const k = 1 - i / (this.snake.length + 4);
      roundRect(GX + s.x * CELL + 2, GY + s.y * CELL + 2, CELL - 4, CELL - 4, i === 0 ? 12 : 8, `rgb(${Math.round(40 + 80 * k)},${Math.round(160 + 90 * k)},${Math.round(60 + 40 * k)})`);
    });
    const h = this.snake[0];
    text('👀', GX + h.x * CELL + CELL / 2, GY + h.y * CELL + CELL / 2, 22);

    this.log.forEach((l, k) => {
      const y = 1130 + k * 44;
      ctx.globalAlpha = clamp(l.t, 0, 1);
      roundRect(20, y - 20, 430, 40, 20, 'rgba(0,0,0,.6)');
      text(trim(l.msg, 30), 36, y, 20, l.color, 'left', 700);
      ctx.globalAlpha = 1;
    });
    text('Comente BOMBA 💣', W - 140, 1140, 28, '#fe2c55', 'center', 900);
    text('🎁 🍎 ajuda a IA', W - 140, 1180, 22, '#7cff6b', 'center', 700);
    text('🌌 = 30 bombas', W - 140, 1215, 22, '#ffd23f', 'center', 700);

    if (this.dead > 0 && this.killMsg) {
      const m = this.killMsg;
      roundRect(50, 480, W - 100, m.user ? 420 : 240, 30, 'rgba(0,0,0,.85)');
      text(m.msg, W / 2, 550, 46, m.user ? '#fe2c55' : '#ffd23f');
      text(`Tamanho final: ${m.len}`, W / 2, 610, 30, '#fff', 'center', 600);
      if (m.user) {
        avatar(m.user, W / 2, 720, 70, '#fe2c55');
        text(`@${trim(m.user.nick, 16)}`, W / 2, 835, 40, '#fff');
      }
      leaderboardSmall(this.killers, 160, m.user ? 940 : 760);
    }
  },
});
