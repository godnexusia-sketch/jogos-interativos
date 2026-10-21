'use strict';

// Jogos de dois times (ou mais): cabo de guerra, futebol de torcida, arena, territórios, cavalos, flappy e ponte.

// Time de cada pessoa: o último lado que ela escolheu no chat.
class Teams {
  constructor() { this.map = new Map(); }
  set(user, side) { this.map.set(user.id || user.nick, side); }
  get(user) { return this.map.get(user.id || user.nick); }
  count(side) { let n = 0; for (const v of this.map.values()) if (v === side) n++; return n; }
}
function sideSettings(l, lc, r, rc) {
  return [
    { key: 'leftLabel', type: 'text', label: 'Nome do lado esquerdo', default: l, group: 'Times' },
    { key: 'leftColor', type: 'color', label: 'Cor do lado esquerdo', default: lc, group: 'Times' },
    { key: 'leftImage', type: 'media', accept: 'image', label: 'Imagem do lado esquerdo', default: '', group: 'Times' },
    { key: 'rightLabel', type: 'text', label: 'Nome do lado direito', default: r, group: 'Times' },
    { key: 'rightColor', type: 'color', label: 'Cor do lado direito', default: rc, group: 'Times' },
    { key: 'rightImage', type: 'media', accept: 'image', label: 'Imagem do lado direito', default: '', group: 'Times' },
  ];
}
// Escudo do time: imagem do admin ou círculo com a inicial.
function teamBadge(g, side, x, y, r) {
  const img = getImg(side ? g.s.rightImage : g.s.leftImage), col = side ? g.s.rightColor : g.s.leftColor;
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = col; ctx.fill(); ctx.clip();
  if (img) coverImg(img, x - r, y - r, r * 2, r * 2); else title((side ? g.s.rightLabel : g.s.leftLabel)[0]?.toUpperCase() || '?', x, y + r * 0.06, r * 1.1, '#fff');
  ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
}
// Placar de vitórias no topo (estilo transmissão esportiva).
function teamScoreboard(g, wl, wr, y = 40, sub = '') {
  slant(30, y, 300, 70, { fill: hexA(g.s.leftColor, 0.95), skew: 16 });
  slant(W - 330, y, 300, 70, { fill: hexA(g.s.rightColor, 0.95), skew: 16 });
  teamBadge(g, 0, 70, y + 35, 26); teamBadge(g, 1, W - 70, y + 35, 26);
  label(trim(g.s.leftLabel, 12).toUpperCase(), 106, y + 36, 24, '#fff', 'left', 900, F_TITLE);
  label(trim(g.s.rightLabel, 12).toUpperCase(), W - 106, y + 36, 24, '#fff', 'right', 900, F_TITLE);
  panel(W / 2 - 70, y - 4, 140, 78, { r: 14, from: '#141a2c', to: '#070a12' });
  num(`${wl} - ${wr}`, W / 2, y + 36, 44);
  if (sub) pill(sub, W / 2, y + 96, { size: 15, bg: 'rgba(0,0,0,.6)' });
}
function bestOf(g, wl, wr) { const need = Math.ceil(g.s.roundsBestOf / 2); return g.s.matchMode === 'bestof' && (wl >= need || wr >= need); }

// ---------------- Cabo de guerra (Meninos x Meninas) e futebol (Messi x Ronaldo) ----------------
function pushGame(o) {
  return defineGame({
    id: o.id, name: o.name, genre: 'party', icon: o.icon, color: o.color,
    desc: o.desc,
    help: `<p>Comente <b>${o.kl.split(',')[0]}</b> ou <b>${o.kr.split(',')[0]}</b> para escolher o seu lado e empurrar. ❤️ Likes e 🎁 presentes empurram para o lado que você escolheu: quanto maior o presente, maior o empurrão.</p><p>${o.football ? 'Levar a bola até o gol adversário' : 'Encher a barra até o fim'} vence a rodada.</p>`,
    settings: [
      ...sideSettings(o.l, o.lc, o.r, o.rc),
      { key: 'matchMode', type: 'select', label: 'Partida', options: [['endless', 'Rodadas sem fim'], ['bestof', 'Melhor de N']], default: 'bestof' },
      { key: 'roundsBestOf', type: 'number', label: 'Melhor de quantas', min: 1, max: 15, default: 3, showIf: { key: 'matchMode', value: 'bestof' } },
      { key: 'pushToWin', type: 'number', label: 'Força para vencer (quanto maior, mais longa a rodada)', min: 50, max: 5000, default: 600 },
      { key: 'barDecay', type: 'toggle', label: 'A barra volta devagar para o meio', default: true },
      { key: 'showCrowd', type: 'toggle', label: 'Mostrar a torcida (fotos)', default: true },
    ],
    actions: [
      { id: 'push_left', label: `Empurrar ${o.l}`, icon: '⬅️' }, { id: 'push_right', label: `Empurrar ${o.r}`, icon: '➡️' },
      { id: 'push_mine', label: 'Empurrar pelo meu lado', icon: '💪' },
      { id: 'win_left', label: `Vitória ${o.l}`, icon: '🏆' }, { id: 'win_right', label: `Vitória ${o.r}`, icon: '🏆' },
    ],
    bindings: [{ action: 'push_left', trigger: 'comment', text: o.kl }, { action: 'push_right', trigger: 'comment', text: o.kr }, { action: 'push_mine', trigger: 'like', likes: 5 }, { action: 'push_mine', trigger: 'gift', minCoins: 1 }],
    reset() { this.p = 0; this.wl = 0; this.wr = 0; this.teams = new Teams(); this.crowd = [[], []]; this.ph = new Phases(); this.ph.go('play', 0); this.pulse = [0, 0]; this.feed = new Feed(3); this.ballX = W / 2; this.spin = 0; },
    sample() { return pick([o.kl.split(',')[0], o.kr.split(',')[0]]); },
    join(user, side) {
      this.teams.set(user, side);
      const c = this.crowd[side];
      if (!c.some((u) => (u.id || u.nick) === (user.id || user.nick))) { c.unshift(user); if (c.length > 24) c.pop(); }
      this.crowd[1 - side] = this.crowd[1 - side].filter((u) => (u.id || u.nick) !== (user.id || user.nick));
    },
    push(side, amount, user) {
      if (this.ph.name !== 'play') return;
      this.p = clamp(this.p + (side ? 1 : -1) * amount / this.s.pushToWin, -1, 1);
      this.pulse[side] = 1;
      if (Math.abs(this.p) >= 1) this.winRound(this.p > 0 ? 1 : 0);
    },
    onAction(id, a) {
      if (id === 'push_left' || id === 'push_right') { const s = id === 'push_left' ? 0 : 1; this.join(a.user, s); this.push(s, 6, a.user); }
      else if (id === 'push_mine') {
        let s = this.teams.get(a.user);
        if (s === undefined) { s = this.crowd[0].length <= this.crowd[1].length ? 0 : 1; this.join(a.user, s); }
        const amt = a.gift ? 10 * a.power * Math.sqrt(a.coins) : 3 * a.count / 5;
        this.push(s, amt, a.user);
        if (a.gift) this.feed.push(a.user, `💪 +${Math.round(amt)} ${s ? this.s.rightLabel : this.s.leftLabel}`, s ? this.s.rightColor : this.s.leftColor);
      } else if (id === 'win_left' || id === 'win_right') this.winRound(id === 'win_left' ? 0 : 1);
    },
    winRound(side) {
      if (this.ph.name !== 'play') return;
      side ? this.wr++ : this.wl++;
      this.roundWin = side;
      sfx.win(); confetti(120);
      const name = side ? this.s.rightLabel : this.s.leftLabel;
      voice.say(`${o.football ? 'Gol' : 'Ponto'} do ${name}!`);
      this.ph.go(bestOf(this, this.wl, this.wr) ? 'match' : 'round', bestOf(this, this.wl, this.wr) ? 7 : 3.5);
    },
    update(dt) {
      this.feed.update(dt);
      this.pulse = this.pulse.map((v) => Math.max(0, v - dt * 3));
      if (this.ph.name === 'play' && this.s.barDecay) this.p *= 1 - dt * 0.03;
      const tx = W / 2 + this.p * (W / 2 - 90);
      this.spin += (tx - this.ballX) * dt * 0.08;
      this.ballX += (tx - this.ballX) * Math.min(1, dt * 6);
      if (this.ph.update(dt)) { if (this.ph.name === 'match') { this.wl = 0; this.wr = 0; } this.p = 0; this.ph.go('play', 0); }
    },
    draw() {
      const L = this.s.leftColor, R = this.s.rightColor, t = performance.now() / 1000;
      if (!customBackground(this)) {
        if (o.football) {
          // Campo de futebol visto de cima
          for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? '#2f8f3a' : '#33a043'; ctx.fillRect(0, i * H / 12, W, H / 12 + 1); }
          ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 5;
          ctx.strokeRect(30, 200, W - 60, 760); ctx.beginPath(); ctx.moveTo(W / 2, 200); ctx.lineTo(W / 2, 960); ctx.stroke();
          ctx.beginPath(); ctx.arc(W / 2, 580, 90, 0, 7); ctx.stroke();
          ctx.strokeRect(30, 440, 90, 280); ctx.strokeRect(W - 120, 440, 90, 280);
          ctx.fillStyle = hexA(L, 0.9); ctx.fillRect(4, 500, 26, 160); ctx.fillStyle = hexA(R, 0.9); ctx.fillRect(W - 30, 500, 26, 160);
        } else {
          const g1 = ctx.createLinearGradient(0, 0, W, 0); g1.addColorStop(0, shade(L, -60)); g1.addColorStop(0.5, '#0b0e18'); g1.addColorStop(1, shade(R, -60));
          ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
        }
      }
      teamScoreboard(this, this.wl, this.wr, 30, this.s.matchMode === 'bestof' ? `MELHOR DE ${this.s.roundsBestOf}` : '');
      const cy = o.football ? 580 : 560;
      if (o.football) {
        // Bola
        ctx.save(); ctx.translate(this.ballX, cy); ctx.rotate(this.spin);
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(6, 40, 40, 12, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 38, 0, 7); ctx.fill();
        ctx.fillStyle = '#111'; for (let i = 0; i < 5; i++) { const a = i * 1.2566; ctx.beginPath(); ctx.arc(Math.cos(a) * 22, Math.sin(a) * 22, 9, 0, 7); ctx.fill(); }
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fill();
        ctx.restore();
      } else {
        // Corda com o marcador
        const x = W / 2 + this.p * (W / 2 - 70);
        glossBar(40, cy - 18, W - 80, 36, (this.p + 1) / 2, R, hexA(L, 0.85));
        ctx.fillStyle = '#fff'; ctx.fillRect(W / 2 - 2, cy - 40, 4, 80);
        ctx.save(); ctx.translate(x, cy); ctx.rotate(Math.sin(t * 8) * 0.08);
        ctx.fillStyle = '#ffc93c'; ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(22, -30); ctx.lineTo(0, 60); ctx.lineTo(-22, -30); ctx.closePath(); ctx.fill();
        ctx.restore();
        label(`${Math.round((1 - this.p) * 50)}%`, 80, cy + 60, 30, L, 'left', 900, F_NUM);
        label(`${Math.round((1 + this.p) * 50)}%`, W - 80, cy + 60, 30, R, 'right', 900, F_NUM);
      }
      // Torcidas
      if (this.s.showCrowd) [0, 1].forEach((s) => {
        const list = this.crowd[s];
        list.forEach((u, i) => {
          const col = i % 4, row = Math.floor(i / 4), x = (s ? W / 2 + 40 : 40) + col * 72 + 34, y = 1000 + row * 64 + Math.sin(t * 6 + i) * 4 * (this.pulse[s] + 0.2);
          avatar(u, x, y, 26, s ? R : L);
        });
        label(`${this.teams.count(s)} na torcida`, s ? W * 0.75 : W * 0.25, 970, 18, '#fff', 'center', 800);
      });
      label(`comente ${o.kl.split(',')[0]} ou ${o.kr.split(',')[0]} · presentes empurram mais`, W / 2, o.football ? 180 : 440, 18, '#fff', 'center', 800);
      if (this.ph.name !== 'play') {
        const side = this.roundWin, name = side ? this.s.rightLabel : this.s.leftLabel;
        ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 300, W, 200);
        title(this.ph.name === 'match' ? `${name.toUpperCase()} CAMPEÃO!` : o.football ? `GOL DO ${name.toUpperCase()}!` : `PONTO ${name.toUpperCase()}!`, W / 2, 400, 54, side ? R : L);
      }
      this.feed.draw(20, 200);
    },
  });
}
pushGame({ id: 'boys-vs-girls', name: 'Meninos x Meninas', icon: '🚹', color: '#ec4899', l: 'Meninas', lc: '#ec4899', r: 'Meninos', rc: '#3b82f6', kl: 'meninas,menina,girls,1', kr: 'meninos,menino,boys,2',
  desc: 'Cada torcida empurra a linha do meio para o seu lado com comentários, likes e presentes. Presente maior, empurrão maior; encher a barra vence a rodada.' });
pushGame({ id: 'messi-vs-ronaldo', name: 'Messi x Ronaldo', icon: '⚽', color: '#22c55e', football: true, l: 'Messi', lc: '#60a5fa', r: 'Ronaldo', rc: '#ef4444', kl: 'messi,m,1', kr: 'ronaldo,cr7,r,2',
  desc: 'A torcida empurra a bola até o gol adversário com comentários, likes e presentes. Quanto maior o presente, maior o chute; melhor de N leva a taça.' });

// ---------------- Arena de Batalha (Battle Arena) ----------------
defineGame({
  id: 'battle-arena', name: 'Arena de Batalha', genre: 'party', icon: '⚔️', color: '#ef4444',
  desc: 'O chat comenta a ou b para entrar num lado e lutar como bolinha. Presentes aumentam a vida ou bombardeiam o time inimigo, até com bomba nuclear.',
  help: '<p>Comente <b>a</b> ou <b>b</b> para entrar com a sua foto. Os lutadores brigam sozinhos.</p><p>❤️ Likes aumentam a vida. 🎁 Presentes atacam o time inimigo com armas aleatórias: quanto mais moedas, mais forte (flechas, bombas, raios… até a <b>bomba nuclear</b> com 1.000+).</p>',
  settings: [
    ...sideSettings('Time A', '#3b82f6', 'Time B', '#ef4444'),
    { key: 'winMode', type: 'select', label: 'Como vence a rodada', options: [['last', 'Último time de pé'], ['kills', 'Número de abates']], default: 'last' },
    { key: 'killTarget', type: 'number', label: 'Abates para vencer', min: 5, max: 500, default: 30, showIf: { key: 'winMode', value: 'kills' } },
    { key: 'matchMode', type: 'select', label: 'Partida', options: [['endless', 'Rodadas sem fim'], ['bestof', 'Melhor de N']], default: 'endless' },
    { key: 'roundsBestOf', type: 'number', label: 'Melhor de quantas', min: 1, max: 15, default: 3, showIf: { key: 'matchMode', value: 'bestof' } },
    { key: 'roundDuration', type: 'number', label: 'Segundos por rodada', min: 30, max: 900, default: 180 },
    { key: 'fighterSpeed', type: 'select', label: 'Velocidade', options: [['0.7', 'Devagar'], ['1', 'Normal'], ['1.4', 'Rápida']], default: '1' },
    { key: 'maxFightersPerSide', type: 'number', label: 'Lutadores por lado', min: 5, max: 60, default: 25 },
    { key: 'hpPerCoin', type: 'number', label: 'Vida por moeda', min: 1, max: 100, default: 10 },
    { key: 'demoMode', type: 'toggle', label: 'Bots de enchimento quando tem pouca gente', default: true },
    { key: 'anyCommentJoins', type: 'toggle', label: 'Qualquer comentário entra (no menor time)', default: false },
    { key: 'screenShake', type: 'toggle', label: 'Tela tremendo nas explosões', default: true },
    { key: 'showDamageNumbers', type: 'toggle', label: 'Mostrar números de dano', default: true },
    { key: 'showNames', type: 'toggle', label: 'Mostrar nomes', default: true },
    ...BOARD_SETTINGS(5),
  ],
  actions: [{ id: 'join_left', label: 'Entrar no A', icon: '🅰️' }, { id: 'join_right', label: 'Entrar no B', icon: '🅱️' }, { id: 'grow_hp', label: 'Mais vida', icon: '❤️' }, { id: 'attack_enemy', label: 'Atacar o inimigo', icon: '💣' }, { id: 'attack_left', label: 'Atacar o A', icon: '💥' }, { id: 'attack_right', label: 'Atacar o B', icon: '💥' }],
  bindings: [{ action: 'join_left', trigger: 'comment', text: 'a,1' }, { action: 'join_right', trigger: 'comment', text: 'b,2' }, { action: 'grow_hp', trigger: 'like', likes: 5 }, { action: 'attack_enemy', trigger: 'gift', minCoins: 1 }],
  reset() { this.f = []; this.fx = []; this.wl = this.wl || 0; this.wr = this.wr || 0; this.kills = [0, 0]; this.killers = new Map(); this.ph = new Phases(); this.ph.go('play', this.s.roundDuration); this.shake = 0; this.botT = 0; this.feed = new Feed(3); },
  sample() { return pick(['a', 'b', 'a', 'b', 'bora']); },
  sideOf(user) { return this.f.find((x) => x.k === (user.id || user.nick))?.side; },
  spawn(user, side, bot = false) {
    const k = user.id || user.nick;
    const ex = this.f.find((x) => x.k === k);
    if (ex) return ex;
    if (this.f.filter((x) => x.side === side).length >= this.s.maxFightersPerSide) {
      const bot2 = this.f.find((x) => x.side === side && x.bot);
      if (!bot2 || bot) return null;
      this.f.splice(this.f.indexOf(bot2), 1);
    }
    const fi = { k, user, side, bot, x: side ? rand(W / 2 + 40, W - 60) : rand(60, W / 2 - 40), y: rand(260, 1000), vx: 0, vy: 0, hp: 100, max: 100, r: 26, cd: rand(0, 1), hit: 0 };
    this.f.push(fi);
    return fi;
  },
  onAction(id, a) {
    if (this.ph.name !== 'play') return;
    if (id === 'join_left' || id === 'join_right') this.spawn(a.user, id === 'join_left' ? 0 : 1);
    else if (id === 'grow_hp') { const fi = this.f.find((x) => x.k === (a.user.id || a.user.nick)); if (fi) { fi.hp = Math.min(fi.max * 3, fi.hp + a.count * 2); fi.max = Math.max(fi.max, fi.hp); } }
    else if (id.startsWith('attack')) {
      let target = id === 'attack_left' ? 0 : id === 'attack_right' ? 1 : null;
      if (target === null) { const s = this.sideOf(a.user); target = s === undefined ? (Math.random() < 0.5 ? 0 : 1) : 1 - s; if (s === undefined) this.spawn(a.user, 1 - target); }
      const me = this.f.find((x) => x.k === (a.user.id || a.user.nick));
      if (me && a.gift) { me.hp += a.coins * this.s.hpPerCoin * 0.3; me.max = Math.max(me.max, me.hp); }
      this.weapon(a.coins, target, a.user);
    }
  },
  // Arma proporcional às moedas
  weapon(c, side, user) {
    const foes = this.f.filter((x) => x.side === side);
    const name = c >= 1000 ? '☢️ BOMBA NUCLEAR' : c >= 100 ? '⚡ TEMPESTADE DE RAIOS' : c >= 30 ? '💣 BOMBARDEIO' : c >= 10 ? '🔥 BOLA DE FOGO' : '🏹 FLECHAS';
    this.feed.push(user, name, side ? this.s.leftColor : this.s.rightColor);
    if (c >= 1000) { this.fx.push({ k: 'nuke', x: side ? W * 0.75 : W * 0.25, y: 620, t: 0, life: 2 }); for (const fo of foes) this.damage(fo, 400 + c * 0.1, user); this.shake = 1.5; sfx.boom(); return; }
    const n = c >= 100 ? 10 : c >= 30 ? 6 : c >= 10 ? 3 : 2, dmg = 20 + Math.sqrt(c) * 12;
    for (let i = 0; i < n; i++) {
      const fo = foes[Math.floor(Math.random() * foes.length)];
      const x = fo ? fo.x : (side ? W * 0.75 : W * 0.25) + rand(-120, 120), y = fo ? fo.y : rand(300, 900);
      this.fx.push({ k: c >= 100 ? 'bolt' : c >= 10 ? 'boom' : 'arrow', x, y, t: -i * 0.12, life: 0.6, dmg, user, done: false, side });
    }
    if (c >= 30) this.shake = 0.6;
  },
  damage(fo, d, user) {
    if (fo.hp <= 0) return;
    fo.hp -= d; fo.hit = 0.25;
    if (this.s.showDamageNumbers) floatText(`-${Math.round(d)}`, fo.x, fo.y - fo.r, '#ffd23f', 22);
    if (fo.hp <= 0) {
      this.kills[1 - fo.side]++;
      if (user) { const k = user.id || user.nick; this.killers.set(k, { user, value: (this.killers.get(k)?.value || 0) + 1 }); }
      burst(fo.x, fo.y, [fo.side ? this.s.rightColor : this.s.leftColor, '#fff'], 24, 320);
    }
  },
  update(dt) {
    this.feed.update(dt);
    this.shake = Math.max(0, this.shake - dt);
    if (this.ph.name === 'play') {
      if (this.s.demoMode) { this.botT -= dt; if (this.botT <= 0) { this.botT = 2.5; for (const s of [0, 1]) if (this.f.filter((x) => x.side === s).length < 6) { const n = pick(['bot', 'robô', 'npc', 'cpu']) + randInt(1, 99); this.spawn({ id: 'bot_' + n + s, nick: n, pic: fakeFace(n) }, s, true); } } }
      const sp = Number(this.s.fighterSpeed) * 90;
      for (const fi of this.f) {
        if (fi.hp <= 0) continue;
        fi.hit = Math.max(0, fi.hit - dt);
        let best = null, bd = 1e9;
        for (const o of this.f) if (o.side !== fi.side && o.hp > 0) { const d = Math.hypot(o.x - fi.x, o.y - fi.y); if (d < bd) { bd = d; best = o; } }
        if (best) {
          const dx = best.x - fi.x, dy = best.y - fi.y, d = Math.max(1, bd);
          if (d > fi.r + best.r + 4) { fi.x += dx / d * sp * dt; fi.y += dy / d * sp * dt; }
          else { fi.cd -= dt; if (fi.cd <= 0) { fi.cd = 0.7; this.damage(best, 8 + Math.sqrt(fi.max) * 0.8, fi.bot ? null : fi.user); fi.x -= dx / d * 10; } }
        }
        fi.x = clamp(fi.x, 30, W - 30); fi.y = clamp(fi.y, 240, 1100);
        fi.r = clamp(20 + Math.sqrt(fi.max) * 0.8, 22, 60);
      }
      // Separação entre lutadores
      for (let i = 0; i < this.f.length; i++) for (let j = i + 1; j < this.f.length; j++) { const a = this.f[i], b = this.f[j]; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, m = a.r + b.r; if (d < m) { const p = (m - d) / 2; a.x -= dx / d * p; a.y -= dy / d * p; b.x += dx / d * p; b.y += dy / d * p; } }
      for (const e of this.fx) { e.t += dt; if (!e.done && e.t >= 0.25 && e.k !== 'nuke') { e.done = true; for (const fo of this.f) if (fo.side === e.side && Math.hypot(fo.x - e.x, fo.y - e.y) < (e.k === 'arrow' ? 40 : 90)) this.damage(fo, e.dmg, e.user); if (e.k !== 'arrow') sfx.tone(80, 0.2, 'sawtooth', 0.06); } }
      this.fx = this.fx.filter((e) => e.t < e.life);
      this.f = this.f.filter((x) => x.hp > 0);
      const alive = [0, 1].map((s) => this.f.some((x) => x.side === s));
      const realBoth = this.f.length >= 2;
      if (this.s.winMode === 'kills') { if (this.kills[0] >= this.s.killTarget) this.end(0); else if (this.kills[1] >= this.s.killTarget) this.end(1); }
      else if (realBoth && (!alive[0] || !alive[1])) this.end(alive[0] ? 0 : 1);
    }
    if (this.ph.update(dt)) {
      if (this.ph.name === 'play') this.end(this.kills[0] === this.kills[1] ? (this.f.filter((x) => !x.side).length >= this.f.filter((x) => x.side).length ? 0 : 1) : this.kills[0] > this.kills[1] ? 0 : 1);
      else { if (this.ph.name === 'match') { this.wl = 0; this.wr = 0; } this.reset(); }
    }
  },
  end(side) {
    if (this.ph.name !== 'play') return;
    side ? this.wr++ : this.wl++;
    this.winSide = side; sfx.win(); confetti(100);
    voice.say(`${side ? this.s.rightLabel : this.s.leftLabel} venceu a rodada!`);
    this.ph.go(bestOf(this, this.wl, this.wr) ? 'match' : 'round', 5);
  },
  draw() {
    const t = performance.now() / 1000;
    ctx.save();
    if (this.shake > 0 && this.s.screenShake) ctx.translate(rand(-8, 8) * this.shake, rand(-8, 8) * this.shake);
    if (!customBackground(this)) {
      ctx.fillStyle = '#151a28'; ctx.fillRect(-20, -20, W + 40, H + 40);
      ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      const gl = ctx.createLinearGradient(0, 0, W, 0); gl.addColorStop(0, hexA(this.s.leftColor, 0.18)); gl.addColorStop(0.5, 'rgba(0,0,0,0)'); gl.addColorStop(1, hexA(this.s.rightColor, 0.18));
      ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    }
    for (const fi of this.f) {
      const col = fi.side ? this.s.rightColor : this.s.leftColor;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(fi.x, fi.y + fi.r * 0.9, fi.r, fi.r * 0.3, 0, 0, 7); ctx.fill();
      avatar(fi.user, fi.x, fi.y, fi.r, fi.hit > 0 ? '#fff' : col);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(fi.x - fi.r, fi.y - fi.r - 12, fi.r * 2, 6);
      ctx.fillStyle = fi.hp / fi.max > 0.5 ? '#22c55e' : fi.hp / fi.max > 0.25 ? '#facc15' : '#ef4444'; ctx.fillRect(fi.x - fi.r, fi.y - fi.r - 12, fi.r * 2 * clamp(fi.hp / fi.max, 0, 1), 6);
      if (this.s.showNames && !fi.bot) label(trim(fi.user.nick, 10), fi.x, fi.y + fi.r + 12, 12, '#fff', 'center', 800);
    }
    for (const e of this.fx) {
      if (e.t < 0) continue;
      const k = e.t / e.life;
      if (e.k === 'arrow') { ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 4; const y0 = e.y - 300 * (1 - Math.min(1, e.t / 0.25)); ctx.beginPath(); ctx.moveTo(e.x - 10, y0 - 40); ctx.lineTo(e.x, y0); ctx.stroke(); }
      else if (e.k === 'boom') { if (e.t < 0.25) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(e.x, e.y - 300 * (1 - e.t / 0.25), 12, 0, 7); ctx.fill(); } else { ctx.fillStyle = `rgba(255,${Math.round(160 * (1 - k))},40,${1 - k})`; ctx.beginPath(); ctx.arc(e.x, e.y, 30 + 80 * k, 0, 7); ctx.fill(); } }
      else if (e.k === 'bolt') { if (e.t >= 0.15 && e.t < 0.45) { ctx.strokeStyle = '#a5f3fc'; ctx.lineWidth = 6; ctx.shadowColor = '#22e3ee'; ctx.shadowBlur = 20; ctx.beginPath(); let x = e.x + rand(-30, 30); ctx.moveTo(x, 0); for (let y = 0; y < e.y; y += 60) { x += rand(-25, 25); ctx.lineTo(x, y); } ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.shadowBlur = 0; } }
      else if (e.k === 'nuke') { const r = 50 + 700 * k; const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r); g.addColorStop(0, `rgba(255,255,220,${1 - k})`); g.addColorStop(0.4, `rgba(255,150,40,${0.8 * (1 - k)})`); g.addColorStop(1, 'rgba(120,20,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, 7); ctx.fill(); }
    }
    ctx.restore();
    teamScoreboard(this, this.wl, this.wr, 30, this.s.winMode === 'kills' ? `ABATES ${this.kills[0]} x ${this.kills[1]} · meta ${this.s.killTarget}` : `${this.f.filter((x) => !x.side).length} x ${this.f.filter((x) => x.side).length} vivos · ${fmtTime(this.ph.t)}`);
    label('comente a ou b para lutar · presente ataca o inimigo', W / 2, 186, 17, '#fff', 'center', 800);
    if (this.s.showLeaderboard) hudBoard([...this.killers.values()].sort((a, b) => b.value - a.value), W - 250, 1080, 230, { title: 'ABATES', n: 3, rowH: 30 });
    this.feed.draw(20, 1090);
    if (this.ph.name !== 'play') { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 520, W, 140); title(`${(this.winSide ? this.s.rightLabel : this.s.leftLabel).toUpperCase()} ${this.ph.name === 'match' ? 'CAMPEÃO!' : 'VENCEU!'}`, W / 2, 590, 54, this.winSide ? this.s.rightColor : this.s.leftColor); }
    void t;
  },
});

// ---------------- Guerra de Territórios ----------------
const TW_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#64748b', '#eab308'];
const TW_NAMES = ['Vermelho', 'Azul', 'Verde', 'Amarelo', 'Roxo', 'Rosa', 'Turquesa', 'Laranja', 'Cinza', 'Ouro'];
defineGame({
  id: 'territory-war', name: 'Guerra de Territórios', genre: 'party', icon: '🏰', color: '#64748b',
  desc: 'O chat digita um número para escolher um castelo, e cada like e presente faz o território do time crescer pelo mapa. Quem tiver o maior império no fim vence.',
  help: '<p>Comente o <b>número do castelo</b> (1, 2, 3…) para entrar no time. As bolinhas do time pintam o mapa: ❤️ likes deixam <b>mais rápidas</b>, 🎁 presentes dão <b>mais bolinhas</b>, um <b>chefão</b> gigante ou um <b>escudo</b>.</p>',
  settings: [
    { key: 'teamCount', type: 'number', label: 'Quantos times', min: 2, max: 10, default: 4 },
    { key: 'teamNames', type: 'textarea', label: 'Nomes dos times (um por linha)', default: TW_NAMES.join('\n'), group: 'Times' },
    { key: 'winMode', type: 'select', label: 'Como vence', options: [['time', 'Maior território no fim do tempo'], ['domination', 'Dominar uma porcentagem do mapa']], default: 'time' },
    { key: 'matchDuration', type: 'number', label: 'Segundos por rodada', min: 30, max: 1800, default: 240 },
    { key: 'dominationTarget', type: 'number', label: 'Porcentagem para dominar', min: 30, max: 100, default: 60, showIf: { key: 'winMode', value: 'domination' } },
    { key: 'gridSize', type: 'select', label: 'Tamanho do mapa', options: [['30', 'Pequeno'], ['45', 'Médio'], ['60', 'Grande']], default: '45' },
    { key: 'ballsPerJoin', type: 'number', label: 'Bolinhas por pessoa que entra', min: 0, max: 5, default: 1 },
    { key: 'ballSpeed', type: 'number', label: 'Velocidade das bolinhas', min: 50, max: 500, default: 180 },
    { key: 'showTeamNumbers', type: 'toggle', label: 'Mostrar o número de cada castelo', default: true },
  ],
  actions: [{ id: 'speed_up', label: 'Mais rápido', icon: '⚡' }, { id: 'add_balls', label: 'Mais bolinhas', icon: '⚪' }, { id: 'boss', label: 'Chefão', icon: '👾' }, { id: 'shield', label: 'Escudo', icon: '🛡️' }],
  bindings: [{ action: 'speed_up', trigger: 'like', likes: 10 }, { action: 'add_balls', trigger: 'follow' }, { action: 'add_balls', trigger: 'share' }, { action: 'add_balls', trigger: 'gift', minCoins: 1 }, { action: 'boss', trigger: 'gift', minCoins: 299 }, { action: 'shield', trigger: 'gift', minCoins: 99 }],
  reset() {
    const n = this.s.teamCount, G = Number(this.s.gridSize);
    this.G = G; this.cell = W / G; this.rowsN = Math.floor((H - 300) / this.cell);
    this.grid = new Int8Array(G * this.rowsN).fill(-1);
    const names = lines(this.s.teamNames);
    this.teamsI = Array.from({ length: n }, (_, i) => ({ i, name: names[i] || TW_NAMES[i], color: TW_COLORS[i], speed: 1, shield: 0, wins: this.teamsI?.[i]?.wins || 0, members: 0 }));
    // Castelos em volta do mapa
    this.castles = this.teamsI.map((tm, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return { x: Math.round(G / 2 + Math.cos(a) * G * 0.36), y: Math.round(this.rowsN / 2 + Math.sin(a) * this.rowsN * 0.38) }; });
    this.castles.forEach((c, i) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) this.set(c.x + dx, c.y + dy, i); });
    this.balls = [];
    this.teamsI.forEach((tm, i) => { for (let k = 0; k < 2; k++) this.addBall(i); });
    this.who = new Teams(); this.ph = new Phases(); this.ph.go('play', this.s.matchDuration); this.feed = new Feed(3);
  },
  set(x, y, v) { if (x >= 0 && y >= 0 && x < this.G && y < this.rowsN) this.grid[y * this.G + x] = v; },
  getc(x, y) { return x >= 0 && y >= 0 && x < this.G && y < this.rowsN ? this.grid[y * this.G + x] : -2; },
  addBall(team, boss = false) {
    if (this.balls.filter((b) => b.team === team).length > 40 && !boss) return;
    const c = this.castles[team], a = rand(0, Math.PI * 2);
    this.balls.push({ team, x: (c.x + 0.5) * this.cell, y: (c.y + 0.5) * this.cell, vx: Math.cos(a), vy: Math.sin(a), r: boss ? 3 : 1, life: boss ? 25 : Infinity });
  },
  sample() { return String(randInt(1, this.s.teamCount)); },
  onChat(ev) { const m = norm(ev.text).match(/^(\d{1,2})$/); if (!m) return; const i = Number(m[1]) - 1; if (i < 0 || i >= this.teamsI.length) return; if (this.who.get(ev.user) !== i) { this.who.set(ev.user, i); for (let k = 0; k < this.s.ballsPerJoin; k++) this.addBall(i); } },
  teamOf(user) { let t = this.who.get(user); if (t === undefined) { t = Math.floor(Math.random() * this.teamsI.length); this.who.set(user, t); } return t; },
  onAction(id, a) {
    if (this.ph.name !== 'play') return;
    const t = this.teamOf(a.user), tm = this.teamsI[t];
    if (id === 'speed_up') tm.speed = Math.min(3, tm.speed + 0.04 * a.count / 10);
    else if (id === 'add_balls') { const n = a.gift ? clamp(Math.round(a.qty), 1, 15) : 1; for (let i = 0; i < n; i++) this.addBall(t); if (a.gift) this.feed.push(a.user, `+${n} bolinhas ${tm.name}`, tm.color); }
    else if (id === 'boss') { this.addBall(t, true); this.feed.push(a.user, `👾 chefão ${tm.name}`, tm.color); sfx.boom(); }
    else if (id === 'shield') { tm.shield = 15; this.feed.push(a.user, `🛡️ escudo ${tm.name}`, tm.color); }
  },
  update(dt) {
    this.feed.update(dt);
    if (this.ph.name === 'play') {
      for (const tm of this.teamsI) { tm.speed = Math.max(1, tm.speed - dt * 0.02); tm.shield = Math.max(0, tm.shield - dt); }
      const cs = this.cell;
      for (const b of this.balls) {
        b.life -= dt;
        const sp = this.s.ballSpeed * this.teamsI[b.team].speed * dt;
        const steps = Math.ceil(sp / (cs * 0.5));
        for (let s = 0; s < steps; s++) {
          const nx = b.x + b.vx * sp / steps, ny = b.y + b.vy * sp / steps;
          const cx = Math.floor(nx / cs), cy = Math.floor(ny / cs), c = this.getc(cx, cy);
          if (c === -2) { if (nx < 0 || nx >= W) b.vx = -b.vx; else b.vy = -b.vy; continue; }
          if (c === -1) {
            // Casa vazia: pinta um pedaço em volta (cresce em bloco) e quica
            const rr = b.r;
            for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) if (Math.abs(dx) + Math.abs(dy) <= rr && this.getc(cx + dx, cy + dy) === -1) this.set(cx + dx, cy + dy, b.team);
          }
          if (c !== b.team) {
            // Casa inimiga: pinta (o castelo e times com escudo resistem) e quica
            const own = c >= 0 ? this.teamsI[c] : null;
            const isCastle = c >= 0 && Math.abs(cx - this.castles[c].x) <= 1 && Math.abs(cy - this.castles[c].y) <= 1;
            if (c >= 0 && !isCastle && !(own && own.shield > 0)) for (let dy = -(b.r - 1); dy <= b.r - 1; dy++) for (let dx = -(b.r - 1); dx <= b.r - 1; dx++) if (this.getc(cx + dx, cy + dy) >= -1) this.set(cx + dx, cy + dy, b.team);
            const ox = Math.floor(b.x / cs), oy = Math.floor(b.y / cs);
            if (ox !== cx) b.vx = -b.vx; if (oy !== cy) b.vy = -b.vy; if (ox === cx && oy === cy) { b.vx = -b.vx; b.vy = -b.vy; }
            const a = Math.atan2(b.vy, b.vx) + rand(-0.15, 0.15); b.vx = Math.cos(a); b.vy = Math.sin(a);
            break;
          }
          b.x = nx; b.y = ny;
        }
      }
      this.balls = this.balls.filter((b) => b.life > 0);
      this.areaT = (this.areaT || 0) - dt;
      if (this.areaT <= 0) {
        this.areaT = 0.5; const cnt = new Array(this.teamsI.length).fill(0);
        for (const v of this.grid) if (v >= 0) cnt[v]++;
        this.area = cnt.map((c) => c / this.grid.length);
        if (this.s.winMode === 'domination') { const i = this.area.findIndex((p) => p * 100 >= this.s.dominationTarget); if (i >= 0) this.finish(i); }
      }
    }
    if (this.ph.update(dt)) {
      if (this.ph.name === 'play') this.finish(this.area ? this.area.indexOf(Math.max(...this.area)) : 0);
      else this.reset();
    }
  },
  finish(i) { if (this.ph.name !== 'play') return; this.teamsI[i].wins++; this.winner = i; sfx.win(); confetti(140); voice.say(`O time ${this.teamsI[i].name} conquistou o mapa!`); this.ph.go('end', 7); },
  draw() {
    if (!customBackground(this)) { ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, W, H); }
    const cs = this.cell, oy = 220;
    ctx.save(); ctx.translate(0, oy);
    for (let y = 0; y < this.rowsN; y++) for (let x = 0; x < this.G; x++) { const v = this.grid[y * this.G + x]; ctx.fillStyle = v >= 0 ? this.teamsI[v].color : '#1c2230'; ctx.fillRect(x * cs, y * cs, cs + 0.5, cs + 0.5); }
    ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < this.rowsN; y += 2) ctx.fillRect(0, y * cs, W, cs);
    for (const b of this.balls) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, cs * 0.45 * b.r, 0, 7); ctx.fill(); ctx.strokeStyle = shade(this.teamsI[b.team].color, -60); ctx.lineWidth = 2; ctx.stroke(); }
    this.castles.forEach((c, i) => {
      const tm = this.teamsI[i], x = (c.x + 0.5) * cs, y = (c.y + 0.5) * cs;
      ctx.fillStyle = shade(tm.color, -50); ctx.fillRect(x - 22, y - 16, 44, 32);
      for (let k = 0; k < 3; k++) ctx.fillRect(x - 22 + k * 17, y - 26, 10, 12);
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, y + 16, 8, Math.PI, 0); ctx.fill();
      if (tm.shield > 0) { ctx.strokeStyle = 'rgba(160,230,255,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 34, 0, 7); ctx.stroke(); }
      if (this.s.showTeamNumbers) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 24, y - 24, 14, 0, 7); ctx.fill(); label(String(i + 1), x + 24, y - 23, 16, '#111', 'center', 900); }
    });
    ctx.restore();
    title('GUERRA DE TERRITÓRIOS', W / 2, 44, 40);
    pill(this.ph.name === 'play' ? `⏱ ${fmtTime(this.ph.t)} · comente o número do castelo` : 'FIM DA RODADA', W / 2, 84, { size: 16, bg: 'rgba(0,0,0,.6)' });
    // Barras de porcentagem
    const ord = this.teamsI.map((tm, i) => ({ tm, p: this.area?.[i] || 0 })).sort((a, b) => b.p - a.p);
    ord.slice(0, 5).forEach((o, k) => { const x = 20 + k * ((W - 40) / Math.min(5, ord.length)), w = (W - 40) / Math.min(5, ord.length) - 8; panel(x, 112, w, 86, { r: 14, from: shade(o.tm.color, -20), to: shade(o.tm.color, -80) }); label(trim(o.tm.name, 9), x + w / 2, 134, 15, '#fff', 'center', 900); num(`${Math.round(o.p * 100)}%`, x + w / 2, 166, 30, '#fff'); label(`🏆${o.tm.wins}`, x + w / 2, 190, 12, 'rgba(255,255,255,.8)', 'center', 800); });
    this.feed.draw(20, H - 160);
    if (this.ph.name === 'end') { const tm = this.teamsI[this.winner]; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 520, W, 160); title(`${tm.name.toUpperCase()} VENCEU!`, W / 2, 600, 56, tm.color); }
  },
});

// ---------------- Corrida de Cavalos ----------------
defineGame({
  id: 'horse-race', name: 'Corrida de Cavalos', genre: 'racing', icon: '🏇', color: '#a16207',
  desc: 'Uma corrida de cavalos entre países. Cada espectador escolhe o país comentando o nome, e os presentes empurram o cavalo. Quem cruza a linha marca uma volta para o país.',
  help: '<p>Comente o <b>nome do seu país</b> para torcer por ele. 🎁 Presentes fazem o cavalo do seu país <b>galopar mais</b> (proporcional às moedas). Cada chegada marca uma volta, e o ranking de países não para.</p>',
  settings: [
    { key: 'lanes', type: 'textarea', label: 'Países na pista (códigos, um por linha)', default: 'BR\nPT\nAR\nMX\nUS\nES\nAO\nCO', group: 'Pista' },
    { key: 'pushToFinish', type: 'number', label: 'Força para chegar ao fim', min: 50, max: 5000, default: 500 },
    { key: 'pushPerCoin', type: 'number', label: 'Empurrão por moeda', min: 1, max: 100, default: 10 },
    { key: 'idleDrift', type: 'toggle', label: 'Cavalos andam sozinhos devagar', default: true },
    { key: 'showLeaderboard', type: 'toggle', label: 'Mostrar ranking de países', default: true },
  ],
  actions: [{ id: 'push_horse', label: 'Empurrar meu cavalo', icon: '🐎' }],
  bindings: [{ action: 'push_horse', trigger: 'gift', minCoins: 1 }, { action: 'push_horse', trigger: 'like', likes: 25 }],
  init() { loadData('countries').then((d) => { this.countries = d; this.reset(); }); },
  reset() {
    const codes = lines(this.s.lanes).map((c) => c.toUpperCase()).slice(0, 10);
    this.horses = codes.map((code, i) => ({ code, name: this.countries?.find((c) => c.code === code)?.name || code, p: 0, laps: this.horses?.find((h) => h.code === code)?.laps || 0, run: rand(0, 10), boost: 0, lane: i }));
    this.fans = new Teams(); this.feed = new Feed(3); this.flash = null;
  },
  sample() { return pick(['brasil', 'portugal', 'argentina', 'mexico', 'colombia']); },
  onChat(ev) { const h = this.horses.find((x) => { const c = this.countries?.find((k) => k.code === x.code); return c && answerMatch(ev.text, [c.name, ...c.alt, c.code]); }); if (h) this.fans.set(ev.user, h.code); },
  onAction(id, a) {
    let code = this.fans.get(a.user);
    if (!code) { code = pick(this.horses).code; this.fans.set(a.user, code); }
    const h = this.horses.find((x) => x.code === code);
    if (!h) return;
    const amt = a.gift ? a.coins * this.s.pushPerCoin : 4;
    h.p += amt / this.s.pushToFinish; h.boost = Math.min(3, h.boost + (a.gift ? 0.5 + a.power * 0.1 : 0.15));
    if (a.gift) this.feed.push(a.user, `🐎 +${fmtK(amt)} ${h.name}`, '#ffc93c');
  },
  update(dt) {
    this.feed.update(dt);
    if (this.flash && (this.flash.t -= dt) <= 0) this.flash = null;
    for (const h of this.horses) {
      if (this.s.idleDrift) h.p += dt * 0.004;
      h.boost = Math.max(0, h.boost - dt * 0.6);
      h.run += dt * (6 + h.boost * 8);
      if (h.p >= 1) { h.p = 0; h.laps++; this.flash = { h, t: 3 }; sfx.win(); confetti(60); voice.say(`${h.name} cruzou a linha!`); }
    }
  },
  draw() {
    const t = performance.now() / 1000;
    if (!customBackground(this)) {
      const g = ctx.createLinearGradient(0, 0, 0, 260); g.addColorStop(0, '#5ab0f0'); g.addColorStop(1, '#bfe3ff'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 260);
      ctx.fillStyle = '#3d8b3d'; ctx.fillRect(0, 230, W, 40);
      // Arquibancada
      for (let i = 0; i < 26; i++) { ctx.fillStyle = COLORS[i % COLORS.length]; ctx.beginPath(); ctx.arc(14 + i * 28, 214 + Math.sin(t * 5 + i) * 2, 9, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#a0703a'; ctx.fillRect(0, 270, W, H - 270);
    }
    title('CORRIDA DE CAVALOS', W / 2, 54, 44, '#fff');
    pill('comente o seu país · presente faz o cavalo galopar', W / 2, 98, { size: 15, bg: 'rgba(0,0,0,.6)' });
    const n = this.horses.length, lh = Math.min(90, 650 / Math.max(1, n)), y0 = 290;
    const fx = W - 70;
    ctx.fillStyle = '#fff'; for (let y = y0; y < y0 + n * lh; y += 16) ctx.fillRect(fx, y, 8, 8);
    this.horses.forEach((h, i) => {
      const y = y0 + i * lh;
      ctx.fillStyle = i % 2 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.06)'; ctx.fillRect(0, y, W, lh);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(0, y + lh - 2, W, 2);
      const x = 70 + h.p * (fx - 140);
      drawHorse(x, y + lh * 0.62, lh / 96, h.run, flagUrl(h.code, 80));
      const img = getImg(flagUrl(h.code, 80));
      if (img) ctx.drawImage(img, 10, y + lh / 2 - 13, 36, 26);
      label(`${trim(h.name, 10)} · ${h.laps}`, 54, y + 14, 13, '#fff', 'left', 900);
      if (h.boost > 0.3) for (let k = 0; k < 3; k++) { ctx.fillStyle = `rgba(255,220,150,${0.4 - k * 0.12})`; ctx.beginPath(); ctx.arc(x - 50 - k * 18, y + lh * 0.82, 8 - k * 2, 0, 7); ctx.fill(); }
    });
    if (this.s.showLeaderboard) {
      const ord = [...this.horses].sort((a, b) => b.laps - a.laps || b.p - a.p).slice(0, 5);
      panel(60, 960, W - 120, 220, { r: 18 });
      label('RANKING DE PAÍSES (voltas)', W / 2, 984, 16, '#ffc93c', 'center', 900);
      ord.forEach((h, i) => { const y = 1018 + i * 32; posBadge(i + 1, 90, y, 22); const img = getImg(flagUrl(h.code, 80)); if (img) ctx.drawImage(img, 110, y - 10, 30, 20); label(h.name, 150, y + 1, 17, '#fff', 'left', 800); label(String(h.laps), W - 84, y + 1, 18, '#ffc93c', 'right', 900); });
    }
    this.feed.draw(20, 140);
    if (this.flash) { ctx.globalAlpha = clamp(this.flash.t, 0, 1); title(`${this.flash.h.name.toUpperCase()} CHEGOU!`, W / 2, 600, 54, '#ffc93c'); ctx.globalAlpha = 1; }
  },
});
// Cavalo de perfil galopando (desenhado com formas), com a bandeira na sela.
function drawHorse(x, y, s, run, flag) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const b = Math.sin(run) * 4;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 28, 46, 8, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#4a2c14'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  [[-26, 0], [-16, 1.5], [18, 3], [28, 4.5]].forEach(([lx, ph]) => { const a = Math.sin(run + ph) * 0.7; ctx.beginPath(); ctx.moveTo(lx, 4 + b); ctx.lineTo(lx + Math.sin(a) * 18, 26); ctx.stroke(); });
  ctx.fillStyle = '#7a4a24'; ctx.beginPath(); ctx.ellipse(0, -2 + b, 38, 18, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(26, -10 + b); ctx.lineTo(44, -34 + b); ctx.lineTo(56, -30 + b); ctx.lineTo(38, -2 + b); ctx.fill();
  ctx.beginPath(); ctx.ellipse(54, -30 + b, 12, 7, 0.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#2b1709'; ctx.beginPath(); ctx.moveTo(30, -18 + b); ctx.lineTo(44, -38 + b); ctx.lineTo(40, -22 + b); ctx.fill();
  ctx.strokeStyle = '#2b1709'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-36, -6 + b); ctx.quadraticCurveTo(-56, 0 + b, -52, 16 + Math.sin(run * 2) * 4); ctx.stroke();
  const img = getImg(flag);
  if (img) ctx.drawImage(img, -16, -22 + b, 28, 18);
  // Jóquei
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(4, -36 + b, 8, 0, 7); ctx.fill();
  ctx.fillStyle = '#e11d48'; ctx.fillRect(-4, -30 + b, 14, 12);
  ctx.restore();
}

// ---------------- Flappy Batalha ----------------
defineGame({
  id: 'flappy-battle', name: 'Flappy Batalha', genre: 'party', icon: '🐦', color: '#facc15',
  desc: 'Dois passarinhos voando sozinhos, um de cada lado. Presentes dão pontos para o seu lado, derrubam o inimigo ou roubam pontos. Só o vencedor zera.',
  help: '<p>Comente <b>1</b> ou <b>2</b> para torcer. Os passarinhos voam sozinhos e cada cano vale 1 ponto.</p><p>🎁 Presentes: <b>impulso</b> (pontos para o seu lado), <b>derrubar</b> o outro, <b>roubar pontos</b>, <b>zerar</b> o outro. Chegar à meta vence a rodada e só o vencedor volta ao zero.</p>',
  settings: [
    ...sideSettings('Amarelo', '#facc15', 'Azul', '#38bdf8'),
    { key: 'targetScore', type: 'number', label: 'Meta de pontos', min: 10, max: 1000, default: 50 },
    { key: 'background', type: 'select', label: 'Cenário', options: [['day', 'Dia'], ['night', 'Noite']], default: 'day' },
  ],
  actions: [{ id: 'grow_left', label: 'Pontos para o 1', icon: '⬆️' }, { id: 'grow_right', label: 'Pontos para o 2', icon: '⬆️' }, { id: 'grow_mine', label: 'Pontos para o meu lado', icon: '💪' }, { id: 'wreck', label: 'Derrubar o outro', icon: '💥' }, { id: 'steal', label: 'Roubar pontos', icon: '🦹' }, { id: 'reset_other', label: 'Zerar o outro', icon: '0️⃣' }],
  bindings: [{ action: 'grow_left', trigger: 'comment', text: '1' }, { action: 'grow_right', trigger: 'comment', text: '2' }, { action: 'grow_mine', trigger: 'like', likes: 20 }, { action: 'grow_mine', trigger: 'gift', minCoins: 1 }, { action: 'wreck', trigger: 'gift', minCoins: 30 }, { action: 'steal', trigger: 'gift', minCoins: 99 }, { action: 'reset_other', trigger: 'gift', minCoins: 500 }],
  reset() { this.b = [0, 1].map((s) => ({ s, y: 300, vy: 0, score: 0, wins: this.b?.[s]?.wins || 0, pipes: [], t: 0, dead: 0 })); this.fans = new Teams(); this.feed = new Feed(3); this.win = null; },
  sample() { return pick(['1', '2']); },
  side(a) { let s = this.fans.get(a.user); if (s === undefined) { s = Math.random() < 0.5 ? 0 : 1; this.fans.set(a.user, s); } return s; },
  onAction(id, a) {
    if (this.win) return;
    if (id === 'grow_left' || id === 'grow_right') { const s = id === 'grow_left' ? 0 : 1; this.fans.set(a.user, s); this.add(s, 0.2); return; }
    const s = this.side(a), o = 1 - s;
    if (id === 'grow_mine') { const n = a.gift ? Math.max(1, Math.round(a.qty)) : 0.5; this.add(s, n); if (a.gift) this.feed.push(a.user, `+${n} ${s ? this.s.rightLabel : this.s.leftLabel}`, s ? this.s.rightColor : this.s.leftColor); }
    else if (id === 'wreck') { this.b[o].dead = 1.5; this.b[o].score = Math.max(0, this.b[o].score - Math.round(a.qty)); this.feed.push(a.user, '💥 derrubou!', '#ff6b8a'); sfx.boom(); }
    else if (id === 'steal') { const n = Math.min(this.b[o].score, Math.round(a.qty * 2)); this.b[o].score -= n; this.add(s, n); this.feed.push(a.user, `🦹 roubou ${n}`, '#c084fc'); }
    else if (id === 'reset_other') { this.b[o].score = 0; this.feed.push(a.user, '0️⃣ zerou o outro!', '#ff6b8a'); }
  },
  add(s, n) { this.b[s].score += n; if (this.b[s].score >= this.s.targetScore) { this.b[s].wins++; this.win = { s, t: 4 }; sfx.win(); confetti(120); voice.say(`${s ? this.s.rightLabel : this.s.leftLabel} venceu a rodada!`); } },
  update(dt) {
    this.feed.update(dt);
    if (this.win && (this.win.t -= dt) <= 0) { this.b[this.win.s].score = 0; this.win = null; }
    const LH = 560;
    for (const b of this.b) {
      b.t += dt;
      if (b.dead > 0) { b.dead -= dt; b.vy += 900 * dt; b.y = Math.min(LH - 30, b.y + b.vy * dt); if (b.dead <= 0) { b.y = 280; b.vy = 0; b.pipes = []; } continue; }
      if (b.t > 1.6) { b.t = 0; const gap = rand(150, LH - 170); b.pipes.push({ x: W + 40, gap, passed: false }); }
      for (const p of b.pipes) { p.x -= 170 * dt; if (!p.passed && p.x < 200) { p.passed = true; if (!this.win) this.add(b.s, 1); } }
      b.pipes = b.pipes.filter((p) => p.x > -80);
      // Piloto automático: mira o meio do próximo cano
      const next = b.pipes.find((p) => p.x > 150);
      const target = next ? next.gap : LH / 2;
      if (b.y > target + 10 && b.vy > -50) b.vy = -330;
      b.vy += 900 * dt; b.y = clamp(b.y + b.vy * dt, 30, LH - 30);
    }
  },
  draw() {
    const LH = 560, night = this.s.background === 'night';
    this.b.forEach((b, i) => {
      const oy = 80 + i * (LH + 30), col = i ? this.s.rightColor : this.s.leftColor;
      ctx.save(); ctx.beginPath(); ctx.rect(0, oy, W, LH); ctx.clip(); ctx.translate(0, oy);
      const g = ctx.createLinearGradient(0, 0, 0, LH); g.addColorStop(0, night ? '#0b1440' : '#4ec0ff'); g.addColorStop(1, night ? '#27306b' : '#bdf0ff'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, LH);
      ctx.fillStyle = night ? '#1e3a2b' : '#7ed957'; ctx.fillRect(0, LH - 40, W, 40);
      for (const p of b.pipes) { ctx.fillStyle = '#22a34a'; ctx.fillRect(p.x, 0, 70, p.gap - 75); ctx.fillRect(p.x, p.gap + 75, 70, LH); ctx.fillStyle = '#16803a'; ctx.fillRect(p.x - 6, p.gap - 95, 82, 20); ctx.fillRect(p.x - 6, p.gap + 75, 82, 20); }
      ctx.translate(200, b.y); ctx.rotate(clamp(b.vy / 600, -0.5, 1.2));
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, 26, 21, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(10, -6, 8, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(12, -6, 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.moveTo(18, 2); ctx.lineTo(34, 6); ctx.lineTo(18, 10); ctx.fill();
      ctx.fillStyle = shade(col, -40); ctx.beginPath(); ctx.ellipse(-8, 4 + Math.sin(performance.now() / 60) * 4, 12, 7, -0.3, 0, 7); ctx.fill();
      ctx.restore();
      teamBadge(this, i, 50, oy + 44, 26);
      label((i ? this.s.rightLabel : this.s.leftLabel).toUpperCase(), 86, oy + 34, 20, '#fff', 'left', 900, F_TITLE);
      label(`🏆 ${b.wins}`, 86, oy + 58, 14, '#fff', 'left', 800);
      num(`${Math.floor(b.score)} / ${this.s.targetScore}`, W - 30, oy + 44, 40, '#fff', 'right');
      glossBar(20, oy + LH - 26, W - 40, 14, b.score / this.s.targetScore, col);
    });
    title('FLAPPY BATALHA', W / 2, 40, 38);
    this.feed.draw(20, 1230 - 46 * 3);
    if (this.win) title(`${(this.win.s ? this.s.rightLabel : this.s.leftLabel).toUpperCase()} VENCEU!`, W / 2, H / 2, 56, '#ffc93c');
  },
});

// ---------------- Ponte de Batalha (Bridge Brawl) ----------------
const BB_UNITS = {
  barbarian: { name: 'Bárbaro', hp: 160, dmg: 22, range: 30, speed: 55, r: 16, emoji: '🪓', cost: 1 },
  archer: { name: 'Arqueira', hp: 90, dmg: 16, range: 150, speed: 50, r: 14, emoji: '🏹', cost: 5 },
  valkyrie: { name: 'Valquíria', hp: 420, dmg: 30, range: 34, speed: 45, r: 19, emoji: '🌀', cost: 10, splash: 50 },
  knight: { name: 'Cavaleiro', hp: 520, dmg: 40, range: 30, speed: 50, r: 20, emoji: '🛡️', cost: 30 },
  wizard: { name: 'Mago', hp: 260, dmg: 45, range: 140, speed: 45, r: 17, emoji: '🔥', cost: 99, splash: 60 },
  dragon: { name: 'Dragão', hp: 900, dmg: 60, range: 110, speed: 60, r: 26, emoji: '🐉', cost: 299, fly: true, splash: 60 },
  giant: { name: 'Gigante', hp: 3200, dmg: 120, range: 34, speed: 32, r: 34, emoji: '🗿', cost: 999, towersOnly: true },
};
defineGame({
  id: 'bridge-brawl', name: 'Ponte de Batalha', genre: 'battle', icon: '🌉', color: '#dc2626',
  desc: 'A live escolhe vermelho ou azul, e os presentes mandam tropas pela ponte: bárbaros, arqueiras, magos, dragões e gigantes. Derrube o rei inimigo para vencer.',
  help: '<p>Comente <b>vermelho</b> ou <b>azul</b> para escolher o lado. ❤️ Likes e ⭐ seguir mandam bárbaros. 🎁 Presentes mandam tropas mais fortes conforme o valor: 5 🪙 arqueira, 10 valquíria, 30 cavaleiro, 99 mago, 299 dragão, 999 gigante.</p>',
  settings: [
    { key: 'redName', type: 'text', label: 'Nome do vermelho', default: 'Vermelho', group: 'Times' },
    { key: 'blueName', type: 'text', label: 'Nome do azul', default: 'Azul', group: 'Times' },
    { key: 'matchMinutes', type: 'number', label: 'Minutos por partida', min: 1, max: 20, default: 4 },
    { key: 'towerHpMultiplier', type: 'number', label: 'Vida das torres (×)', min: 0.2, max: 5, step: 0.1, default: 1 },
    { key: 'unitSpeedMultiplier', type: 'number', label: 'Velocidade das tropas (×)', min: 0.5, max: 3, step: 0.1, default: 1 },
    { key: 'maxUnitsPerSide', type: 'number', label: 'Tropas por lado', min: 10, max: 120, default: 50 },
    { key: 'autoFill', type: 'toggle', label: 'Tropas automáticas quando a live está parada', default: true },
  ],
  actions: Object.entries(BB_UNITS).map(([k, u]) => ({ id: 'spawn_' + k, label: u.name, icon: u.emoji })).concat([{ id: 'spawn_by_value', label: 'Tropa pelo valor', icon: '🎁' }, { id: 'join_red', label: 'Entrar no vermelho', icon: '🔴', hidden: true }, { id: 'join_blue', label: 'Entrar no azul', icon: '🔵', hidden: true }]),
  bindings: [{ action: 'join_red', trigger: 'comment', text: 'vermelho,red,1' }, { action: 'join_blue', trigger: 'comment', text: 'azul,blue,2' }, { action: 'spawn_barbarian', trigger: 'like', likes: 30 }, { action: 'spawn_barbarian', trigger: 'follow' }, { action: 'spawn_by_value', trigger: 'gift', minCoins: 1 }],
  reset() {
    const hp = 3000 * this.s.towerHpMultiplier;
    this.towers = [0, 1].flatMap((s) => [{ s, x: W / 2, y: s ? 210 : 1070, hp: hp * 1.6, max: hp * 1.6, king: true, r: 46, cd: 0 }, { s, x: 160, y: s ? 330 : 950, hp, max: hp, r: 34, cd: 0 }, { s, x: W - 160, y: s ? 330 : 950, hp, max: hp, r: 34, cd: 0 }]);
    this.units = []; this.shots = []; this.fans = new Teams(); this.ph = new Phases(); this.ph.go('play', this.s.matchMinutes * 60); this.feed = new Feed(3); this.autoT = 0; this.wins = this.wins || [0, 0];
  },
  sample() { return pick(['vermelho', 'azul']); },
  side(a) { let s = this.fans.get(a.user); if (s === undefined) { s = this.units.filter((u) => u.s === 0).length <= this.units.filter((u) => u.s === 1).length ? 0 : 1; this.fans.set(a.user, s); } return s; },
  spawn(kind, s, user) {
    if (this.ph.name !== 'play' || this.units.filter((u) => u.s === s).length >= this.s.maxUnitsPerSide) return;
    const u = BB_UNITS[kind], lane = Math.random() < 0.5 ? 0 : 1;
    this.units.push({ kind, ...u, s, user, lane, x: lane ? W - 160 + rand(-30, 30) : 160 + rand(-30, 30), y: s ? 400 : 880, hp: u.hp, max: u.hp, cd: 0 });
  },
  onAction(id, a) {
    if (id === 'join_red' || id === 'join_blue') { this.fans.set(a.user, id === 'join_red' ? 0 : 1); return; }
    const s = this.side(a);
    if (id === 'spawn_by_value') {
      const kinds = Object.entries(BB_UNITS).filter(([, u]) => a.coins >= u.cost).map(([k]) => k);
      const k = kinds[kinds.length - 1] || 'barbarian';
      const n = clamp(Math.floor(a.coins / BB_UNITS[k].cost), 1, 5);
      for (let i = 0; i < n; i++) this.spawn(k, s, a.user);
      this.feed.push(a.user, `${BB_UNITS[k].emoji} ${n > 1 ? n + '× ' : ''}${BB_UNITS[k].name}`, s ? '#60a5fa' : '#f87171');
    } else this.spawn(id.replace('spawn_', ''), s, a.user);
  },
  update(dt) {
    this.feed.update(dt);
    if (this.ph.name === 'play') {
      if (this.s.autoFill) { this.autoT -= dt; if (this.autoT <= 0) { this.autoT = 3; for (const s of [0, 1]) if (this.units.filter((u) => u.s === s).length < 3) this.spawn('barbarian', s, null); } }
      const sp = this.s.unitSpeedMultiplier;
      for (const u of this.units) {
        const foesU = this.units.filter((o) => o.s !== u.s && o.hp > 0 && (!o.fly || u.range > 60 || u.fly));
        const foesT = this.towers.filter((t) => t.s !== u.s && t.hp > 0 && (!t.king || this.towers.filter((x) => x.s === t.s && !x.king && x.hp > 0).length < 2 || Math.abs(t.x - u.x) < 120));
        const cands = [...(u.towersOnly ? [] : foesU), ...foesT];
        let best = null, bd = 1e9;
        for (const c of cands) { const d = Math.hypot(c.x - u.x, c.y - u.y); if (d < bd && (c.r === undefined || foesT.includes(c) || d < 220)) { bd = d; best = c; } }
        if (!best) continue;
        const reach = u.range + (best.r || 0) + u.r;
        if (bd > reach) {
          // Caminho: até a ponte, depois atravessa e segue o alvo
          let tx = best.x, ty = best.y;
          const onMySide = u.s ? u.y < 600 : u.y > 680;
          if (!u.fly && onMySide && Math.abs(u.y - 640) > 30) { tx = u.lane ? W - 160 : 160; ty = 640; }
          const d = Math.hypot(tx - u.x, ty - u.y) || 1;
          u.x += (tx - u.x) / d * u.speed * sp * dt; u.y += (ty - u.y) / d * u.speed * sp * dt;
        } else {
          u.cd -= dt;
          if (u.cd <= 0) {
            u.cd = 1;
            if (u.range > 60) this.shots.push({ x: u.x, y: u.y, tx: best.x, ty: best.y, t: 0, col: u.kind === 'wizard' || u.kind === 'dragon' ? '#ff8a3d' : '#fde68a' });
            const hits = u.splash ? [...foesU, ...foesT].filter((o) => Math.hypot(o.x - best.x, o.y - best.y) < u.splash) : [best];
            for (const h of hits) h.hp -= u.dmg;
          }
        }
      }
      for (const t of this.towers) {
        if (t.hp <= 0) continue;
        t.cd -= dt;
        const tg = this.units.filter((u) => u.s !== t.s && u.hp > 0 && Math.hypot(u.x - t.x, u.y - t.y) < 200).sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0];
        if (tg && t.cd <= 0) { t.cd = 0.8; tg.hp -= t.king ? 60 : 40; this.shots.push({ x: t.x, y: t.y - 20, tx: tg.x, ty: tg.y, t: 0, col: '#fff' }); }
      }
      for (const u of this.units) if (u.hp <= 0) burst(u.x, u.y, [u.s ? '#60a5fa' : '#f87171', '#fff'], 10, 200);
      this.units = this.units.filter((u) => u.hp > 0);
      for (const t of this.towers) if (t.hp <= 0 && !t.dead) { t.dead = true; sfx.boom(); burst(t.x, t.y, ['#ffc93c', '#888'], 40, 400); if (t.king) this.end(1 - t.s); }
      for (const sh of this.shots) sh.t += dt * 4;
      this.shots = this.shots.filter((sh) => sh.t < 1);
    }
    if (this.ph.update(dt)) {
      if (this.ph.name === 'play') { const hp = [0, 1].map((s) => this.towers.filter((t) => t.s === s).reduce((n, t) => n + Math.max(0, t.hp) / t.max, 0)); this.end(hp[0] >= hp[1] ? 0 : 1); }
      else this.reset();
    }
  },
  end(s) { if (this.ph.name !== 'play') return; this.wins[s]++; this.winner = s; sfx.win(); confetti(140); voice.say(`${s ? this.s.blueName : this.s.redName} derrubou o rei!`); this.ph.go('end', 7); },
  draw() {
    if (!customBackground(this)) {
      ctx.fillStyle = '#5aa846'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(0,0,0,.05)'; ctx.fillRect((i * 97) % W, (i * 211) % H, 40, 40); }
      ctx.fillStyle = '#3b82c4'; ctx.fillRect(0, 610, W, 60);
      ctx.fillStyle = 'rgba(255,255,255,.2)'; for (let x = 0; x < W; x += 30) ctx.fillRect(x + (performance.now() / 40) % 30, 630, 14, 3);
      ctx.fillStyle = '#8b5a2b'; ctx.fillRect(120, 596, 80, 88); ctx.fillRect(W - 200, 596, 80, 88);
      ctx.fillStyle = '#6b4220'; for (let y = 600; y < 684; y += 14) { ctx.fillRect(120, y, 80, 3); ctx.fillRect(W - 200, y, 80, 3); }
      ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(140, 0, 40, H); ctx.fillRect(W - 180, 0, 40, H);
    }
    for (const t of this.towers) {
      const col = t.s ? '#2563eb' : '#dc2626';
      if (t.dead) { ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r * 0.8, 0, 7); ctx.fill(); continue; }
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(t.x, t.y + t.r * 0.7, t.r * 1.1, t.r * 0.4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#9ca3af'; ctx.fillRect(t.x - t.r, t.y - t.r, t.r * 2, t.r * 1.6);
      ctx.fillStyle = col; ctx.fillRect(t.x - t.r - 4, t.y - t.r - 10, t.r * 2 + 8, 14);
      for (let k = 0; k < 4; k++) ctx.fillRect(t.x - t.r + k * t.r * 0.62, t.y - t.r - 22, t.r * 0.36, 14);
      if (t.king) label('👑', t.x, t.y - t.r - 36, 26, '#fff', 'center', 400);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(t.x - t.r, t.y + t.r * 0.8, t.r * 2, 7);
      ctx.fillStyle = col; ctx.fillRect(t.x - t.r, t.y + t.r * 0.8, t.r * 2 * clamp(t.hp / t.max, 0, 1), 7);
    }
    for (const u of this.units) {
      const col = u.s ? '#3b82f6' : '#ef4444';
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(u.x, u.y + u.r + (u.fly ? 18 : 0), u.r, u.r * 0.35, 0, 0, 7); ctx.fill();
      const y = u.y - (u.fly ? 14 + Math.sin(performance.now() / 150) * 4 : 0);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(u.x, y, u.r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      label(u.emoji, u.x, y + 1, u.r * 1.2, '#fff', 'center', 400);
      if (u.hp < u.max) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(u.x - u.r, y - u.r - 8, u.r * 2, 4); ctx.fillStyle = '#22c55e'; ctx.fillRect(u.x - u.r, y - u.r - 8, u.r * 2 * u.hp / u.max, 4); }
    }
    for (const sh of this.shots) { const x = sh.x + (sh.tx - sh.x) * sh.t, y = sh.y + (sh.ty - sh.y) * sh.t - Math.sin(sh.t * Math.PI) * 30; ctx.fillStyle = sh.col; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); }
    slant(20, 18, 250, 56, { fill: 'rgba(220,38,38,.95)' }); slant(W - 270, 18, 250, 56, { fill: 'rgba(37,99,235,.95)' });
    label(`${this.s.redName.toUpperCase()} 🏆${this.wins[0]}`, 40, 47, 22, '#fff', 'left', 900, F_TITLE);
    label(`🏆${this.wins[1]} ${this.s.blueName.toUpperCase()}`, W - 40, 47, 22, '#fff', 'right', 900, F_TITLE);
    pill(fmtTime(this.ph.name === 'play' ? this.ph.t : 0), W / 2, 46, { size: 22, bg: '#0b0f1c' });
    label('comente vermelho ou azul · presentes mandam tropas', W / 2, 96, 16, '#fff', 'center', 800);
    this.feed.draw(20, 720);
    if (this.ph.name === 'end') { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 560, W, 160); title(`${(this.winner ? this.s.blueName : this.s.redName).toUpperCase()} VENCEU!`, W / 2, 640, 56, this.winner ? '#60a5fa' : '#f87171'); }
  },
});
