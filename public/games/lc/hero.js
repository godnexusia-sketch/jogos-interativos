'use strict';

// Um herói só na tela, e o chat ajuda ou atrapalha: 1000 Degraus, Pato no Tronco, Limpa Vidros e Corta Frutas.
// Modo automático: o jogo joga sozinho. Modo manual: você joga com o mouse/teclado no painel (e a tela da live acompanha).

// Ação de ajuda/sabotagem: emoji voa até o herói e aplica o efeito proporcional às moedas.
function helperActions(list) { return list.map(([id, label, icon]) => ({ id, label, icon })); }
const WIN_ACTIONS = [{ id: 'award_win', label: 'Dar uma vitória', icon: '🏆' }, { id: 'steal_win', label: 'Tirar uma vitória', icon: '🦹' }];
const CONTROL_SETTING = { key: 'controlMode', type: 'select', label: 'Quem joga', options: [['auto', 'O jogo joga sozinho'], ['manual', 'Eu jogo (mouse/teclado no painel)']], default: 'auto' };
class Flyers {
  constructor() { this.list = []; }
  push(emoji, fromX, fromY, toX, toY, user, label, good) { this.list.push({ emoji, x: fromX, y: fromY, fx: fromX, fy: fromY, tx: toX, ty: toY, t: 0, user, label, good }); }
  update(dt, onArrive) { for (const f of this.list) { f.t += dt * 1.6; if (f.t >= 1 && !f.done) { f.done = true; onArrive?.(f); } } this.list = this.list.filter((f) => f.t < 1.4); }
  draw() {
    for (const f of this.list) {
      const k = Math.min(1, f.t), x = f.fx + (f.tx - f.fx) * k, y = f.fy + (f.ty - f.fy) * k - Math.sin(k * Math.PI) * 120;
      ctx.globalAlpha = f.t > 1 ? 1 - (f.t - 1) / 0.4 : 1;
      label(f.emoji, x, y, 56 + (f.t > 1 ? (f.t - 1) * 80 : 0), '#fff', 'center', 400);
      if (f.t < 0.9 && f.user) { avatar(f.user, x - 34, y - 34, 16, f.good ? '#7cff6b' : '#ff6b8a'); }
      ctx.globalAlpha = 1;
    }
  }
}
// Placa com o efeito em letras grandes ("+40 DEGRAUS!").
function heroFeedDraw(feed) { feed.draw(20, 1000); }

// ---------------- 1000 Degraus ----------------
const STAIRS_HELP = [['grandpa', 'Vovô empurra', '👴', 1], ['gym_bro', 'Marombeiro', '💪', 4], ['sumo', 'Lutador de sumô', '🤼', 8], ['magic_wand', 'Varinha mágica', '🪄', 15], ['jetpack', 'Jetpack', '🚀', 30], ['giant_hand', 'Mão gigante', '🫳', 60], ['lightning_ninja', 'Ninja relâmpago', '⚡', 120]];
const STAIRS_SAB = [['banana_peel', 'Casca de banana', '🍌', 2], ['scratching_cat', 'Gato arranhando', '🐈', 5], ['granny', 'Vovó brava', '👵', 10], ['giant_foot', 'Pezão', '🦶', 25], ['bus', 'Ônibus', '🚌', 50], ['minigun', 'Metralhadora de bolinhas', '🔫', 90], ['black_flame_sorcerer', 'Feiticeiro das chamas', '🧙', 160]];
defineGame({
  id: '1000-stairs', name: '1000 Degraus', genre: 'arcade', icon: '🪜', color: '#f59e0b',
  desc: 'Suba 1.000 degraus ao vivo enquanto o chat ajuda e atrapalha. Presentes mandam jetpack e mão gigante para subir, ou ônibus e metralhadora para derrubar.',
  help: '<p>O personagem sobe a escada sozinho (ou você aperta <b>espaço</b>/clica no modo manual). O chat <b>ajuda</b> 👴💪🤼🪄🚀🫳⚡ ou <b>atrapalha</b> 🍌🐈👵🦶🚌🔫🧙. Quanto mais moedas, mais forte.</p><p>Chegar ao topo vale uma vitória.</p>',
  settings: [
    CONTROL_SETTING,
    { key: 'stairCount', type: 'select', label: 'Degraus', options: [['250', '250'], ['500', '500'], ['1000', '1.000'], ['2000', '2.000']], default: '1000' },
    { key: 'autoSpeed', type: 'number', label: 'Degraus por segundo no automático', min: 0, max: 5, step: 0.1, default: 0.8 },
    { key: 'winGoal', type: 'number', label: 'Vitórias para fechar a partida', min: 1, max: 20, default: 3 },
    charSetting('character', 'Personagem que sobe a escada'),
  ],
  hasChars: true,
  kind() { return this.charOverride && CHARACTERS[this.charOverride] ? this.charOverride : pickKind(this.s.character || 'barbaro', 0, '1000-stairs'); },
  onCharPick(user, k) { this.charOverride = k; },
  actions: [...helperActions(STAIRS_HELP), ...helperActions(STAIRS_SAB), ...WIN_ACTIONS],
  bindings: [{ action: 'grandpa', trigger: 'like', likes: 20 }, { action: 'banana_peel', trigger: 'follow' }, ...STAIRS_HELP.slice(1).map(([id], i) => ({ action: id, trigger: 'gift', minCoins: [1, 10, 30, 99, 299, 999][i] })), ...STAIRS_SAB.slice(1).map(([id], i) => ({ action: id, trigger: 'comment', text: ['gato', 'vovo', 'pe', 'onibus', 'tiro', 'feiticeiro'][i], on: false }))],
  reset() { this.pos = 0; this.vis = 0; this.wins = 0; this.fly = new Flyers(); this.feed = new Feed(4); this.hurt = 0; this.cele = 0; this.champT = 0; },
  sample() { return pick(['sobe', 'vai', 'cai']); },
  total() { return Number(this.s.stairCount); },
  onAction(id, a) {
    if (id === 'award_win') return this.win();
    if (id === 'steal_win') { this.wins = Math.max(0, this.wins - 1); return; }
    const h = STAIRS_HELP.find((x) => x[0] === id), sb = STAIRS_SAB.find((x) => x[0] === id), d = h || sb;
    if (!d) return;
    const amt = Math.round(d[3] * (a.gift ? Math.max(1, a.power / 3) : 1));
    this.fly.push(d[2], h ? 60 : W - 60, h ? 1150 : 250, W / 2, 640, a.user, d[1], !!h);
    this.pend = this.pend || [];
    this.pend.push({ amt: h ? amt : -amt, user: a.user, name: d[1], good: !!h });
  },
  onPress() { if (this.s.controlMode === 'manual') this.step(1); },
  step(n) { this.pos = clamp(this.pos + n, 0, this.total()); if (this.pos >= this.total()) this.win(); },
  win() { this.wins++; this.cele = 3; this.pos = 0; sfx.win(); confetti(150); voice.say(this.wins >= this.s.winGoal ? 'Campeão da escada!' : 'Chegou no topo!'); if (this.wins >= this.s.winGoal) { this.champT = 5; this.wins = 0; } },
  update(dt) {
    this.feed.update(dt);
    this.cele = Math.max(0, this.cele - dt); this.hurt = Math.max(0, this.hurt - dt); this.champT = Math.max(0, this.champT - dt);
    this.fly.update(dt, () => {
      const p = this.pend?.shift();
      if (!p) return;
      this.step(p.amt);
      if (!p.good) { this.hurt = 0.6; sfx.boom(); } else sfx.pop();
      this.feed.push(p.user, `${p.name}: ${p.amt > 0 ? '+' : ''}${p.amt} degraus`, p.good ? '#7cff6b' : '#ff6b8a');
    });
    if (this.s.controlMode === 'auto' && !this.cele) this.step(this.s.autoSpeed * dt);
    this.vis += (this.pos - this.vis) * Math.min(1, dt * 5);
  },
  draw() {
    const t = performance.now() / 1000;
    const sky = clamp(this.vis / this.total(), 0, 1);
    if (!customBackground(this)) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `hsl(${210 - sky * 160} 70% ${55 - sky * 40}%)`); g.addColorStop(1, `hsl(${200 - sky * 140} 60% ${75 - sky * 50}%)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse((i * 170 + t * 10) % (W + 200) - 100, 200 + i * 120 + (this.vis * 6) % 300, 70, 22, 0, 0, 7); ctx.fill(); }
    }
    // Escada em zigue-zague que rola conforme sobe
    const stepW = 70, stepH = 36, base = this.vis;
    for (let i = Math.floor(base) - 14; i < base + 22; i++) {
      if (i < 0 || i > this.total()) continue;
      const rel = i - base, x = W / 2 + (((i % 16) < 8 ? (i % 8) : 7 - (i % 8)) - 3.5) * stepW, y = 760 - rel * stepH;
      ctx.fillStyle = i === this.total() ? '#facc15' : i % 100 === 0 ? '#fb923c' : '#78716c'; ctx.fillRect(x - stepW / 2, y, stepW, stepH);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - stepW / 2, y + stepH - 8, stepW, 8);
      if (i % 50 === 0) label(String(i), x, y + 16, 14, '#fff', 'center', 900);
    }
    // Herói: personagem 3D que pula degrau por degrau, apanha nas sabotagens e comemora no topo
    const stairX = (i) => W / 2 + (((i % 16) < 8 ? (i % 8) : 7 - (i % 8)) - 3.5) * stepW;
    const i0 = Math.floor(base), fr = base - i0, hx = stairX(i0) + (stairX(i0 + 1) - stairX(i0)) * fr;
    const c = charLayer.get('climber', this.kind(), { height: 120 });
    if (c) {
      const right = (i0 % 16) < 8, hop = Math.sin(fr * Math.PI) * 18;
      charLayer.place(c, hx + (this.hurt ? rand(-6, 6) : 0), 760 + fr * -stepH - hop, right ? 1.2 : -1.2);
      if (this.lastStep !== i0) { if (this.lastStep !== undefined && !c.busy) c.play(i0 > this.lastStep ? 'jump' : 'hit', { speed: 1.6 }); this.lastStep = i0; }
      if (this.hurt > 0.5 && c.state !== 'hit') c.play('hit', { speed: 1.3 });
      if (this.cele > 2.9 && c.state !== 'victory') c.play('victory', { then: 'taunt' });
      charLayer.draw();
    } else {
      ctx.fillStyle = '#2563eb'; ctx.fillRect(hx - 16, 690, 32, 40); ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(hx, 674, 18, 0, 7); ctx.fill();
    }
    this.fly.draw();
    title('1000 DEGRAUS', W / 2, 54, 46);
    panel(W / 2 - 170, 86, 340, 60, { r: 16 });
    num(`${Math.floor(this.vis)} / ${this.total()}`, W / 2, 116, 40);
    glossBar(40, 160, W - 80, 16, this.vis / this.total(), '#f59e0b');
    label(`🏆 ${this.wins}/${this.s.winGoal}`, W - 40, 198, 20, '#fff', 'right', 900);
    label('ajuda 👴💪🤼🪄🚀🫳⚡  ·  atrapalha 🍌🐈👵🦶🚌🔫🧙', W / 2, 228, 18, '#fff', 'center', 700);
    heroFeedDraw(this.feed);
    if (this.cele) title(this.champT ? 'CAMPEÃO!' : 'CHEGOU NO TOPO!', W / 2, 460, 60, '#ffc93c');
  },
});

// ---------------- Pato no Tronco (Log Rush) ----------------
const LOG_HELP = [['balloon_lift', 'Balões', '🎈', 1], ['tornado', 'Tornado', '🌪️', 4], ['whale_ride', 'Carona de baleia', '🐋', 8], ['rocket_duck', 'Pato foguete', '🚀', 15], ['giant_hand', 'Mão gigante', '🫳', 25]];
const LOG_SAB = [['web_trap', 'Teia', '🕸️', 2], ['croc_log', 'Tronco jacaré', '🐊', 4], ['chainsaw', 'Motosserra', '🪚', 7], ['tnt_launch', 'Dinamite', '🧨', 12], ['meteor_shower', 'Chuva de meteoros', '☄️', 18], ['elephant_drop', 'Elefante caindo', '🐘', 25]];
defineGame({
  id: 'log-rush', name: 'Pato no Tronco', genre: 'arcade', icon: '🦆', color: '#0ea5e9',
  desc: 'Um pato sobe uma torre de troncos flutuando enquanto a água sobe. O chat ajuda com foguete, tornado e baleia, ou atrapalha com motosserra, meteoros e jacaré. Os presentes se somam.',
  help: '<p>O pato sobe os troncos e a <b>água vai subindo</b>. Se ela alcançar o pato, ele volta ao último ponto de controle.</p><p>Ajuda: 🎈🌪️🐋🚀🫳 · Atrapalha: 🕸️🐊🪚🧨☄️🐘. Os efeitos se <b>somam</b>: dois presentes juntos levam mais longe. Chegar ao topo vale uma vitória.</p>',
  settings: [
    CONTROL_SETTING,
    { key: 'targetLogs', type: 'number', label: 'Troncos até o topo', min: 20, max: 500, default: 120 },
    { key: 'checkpointInterval', type: 'number', label: 'Ponto de controle a cada', min: 5, max: 100, default: 20 },
    { key: 'waterEnabled', type: 'toggle', label: 'Água subindo', default: true },
    { key: 'waterSpeed', type: 'select', label: 'Velocidade da água', options: [['0.25', 'Devagar'], ['0.45', 'Normal'], ['0.7', 'Rápida']], default: '0.45' },
  ],
  actions: [...helperActions(LOG_HELP), ...helperActions(LOG_SAB), ...WIN_ACTIONS],
  bindings: [{ action: 'balloon_lift', trigger: 'comment', text: 'sobe,pula' }, { action: 'balloon_lift', trigger: 'gift', minCoins: 1 }, { action: 'tornado', trigger: 'gift', minCoins: 10 }, { action: 'whale_ride', trigger: 'gift', minCoins: 30 }, { action: 'rocket_duck', trigger: 'gift', minCoins: 99 }, { action: 'giant_hand', trigger: 'gift', minCoins: 299 }, { action: 'web_trap', trigger: 'like', likes: 60 }],
  reset() { this.pos = 0; this.vis = 0; this.water = -3; this.check = 0; this.wins = this.wins || 0; this.fly = new Flyers(); this.feed = new Feed(4); this.pend = []; this.cele = 0; this.fall = 0; this.vel = 0; },
  sample() { return pick(['sobe', 'pula', 'vai pato']); },
  onAction(id, a) {
    if (id === 'award_win') return this.win();
    if (id === 'steal_win') { this.wins = Math.max(0, this.wins - 1); return; }
    const h = LOG_HELP.find((x) => x[0] === id), sb = LOG_SAB.find((x) => x[0] === id), d = h || sb;
    if (!d) return;
    const amt = d[3] * (a.gift ? Math.max(1, a.power / 3) : 1);
    this.fly.push(d[2], h ? 60 : W - 60, h ? 1150 : 240, W / 2, 640, a.user, d[1], !!h);
    this.pend.push({ amt: h ? amt : -amt, user: a.user, name: d[1], good: !!h });
  },
  onPress() { if (this.s.controlMode === 'manual') this.vel += 1.2; },
  win() { this.wins++; this.cele = 3.5; sfx.win(); confetti(150); voice.say('O pato chegou ao topo!'); this.pos = 0; this.vis = 0; this.water = -3; this.check = 0; },
  update(dt) {
    this.feed.update(dt);
    this.cele = Math.max(0, this.cele - dt); this.fall = Math.max(0, this.fall - dt);
    this.fly.update(dt, () => { const p = this.pend.shift(); if (!p) return; this.vel += p.amt * 1.4; this.feed.push(p.user, `${p.name} ${p.amt > 0 ? '⬆' : '⬇'} ${Math.abs(Math.round(p.amt))}`, p.good ? '#7cff6b' : '#ff6b8a'); p.good ? sfx.pop() : sfx.boom(); });
    if (this.cele) return;
    if (this.s.controlMode === 'auto') this.vel += dt * 0.6;
    // Os efeitos se somam na velocidade, que vai gastando
    this.pos = Math.max(0, this.pos + this.vel * dt);
    this.vel *= 1 - dt * 1.2;
    if (Math.floor(this.pos / this.s.checkpointInterval) * this.s.checkpointInterval > this.check) { this.check = Math.floor(this.pos / this.s.checkpointInterval) * this.s.checkpointInterval; this.feed.push(null, `🚩 ponto de controle ${this.check}`, '#22e3ee'); }
    if (this.s.waterEnabled) { this.water += Number(this.s.waterSpeed) * dt; if (this.water >= this.pos) { this.fall = 1.5; this.pos = this.check; this.water = this.check - 4; this.vel = 0; sfx.boom(); voice.say('O pato caiu na água!'); } }
    if (this.pos >= this.s.targetLogs) this.win();
    this.vis += (this.pos - this.vis) * Math.min(1, dt * 5);
  },
  draw() {
    const t = performance.now() / 1000, unit = 46, baseY = 780;
    if (!customBackground(this)) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#7dd3fc'); g.addColorStop(1, '#e0f2fe'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); for (let i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(30,64,120,.18)'; ctx.beginPath(); ctx.moveTo(i * 200 - 100, H); ctx.lineTo(i * 200, 500 + (this.vis * 3) % 200); ctx.lineTo(i * 200 + 160, H); ctx.fill(); } }
    for (let i = Math.floor(this.vis) - 10; i < this.vis + 16; i++) {
      if (i < 0 || i > this.s.targetLogs) continue;
      const y = baseY - (i - this.vis) * unit, x = W / 2 + Math.sin(i * 1.7) * 120 + Math.sin(t * 2 + i) * 6;
      ctx.fillStyle = i % this.s.checkpointInterval === 0 ? '#a16207' : '#8b5a2b'; ctx.beginPath(); ctx.roundRect(x - 90, y - 14, 180, 28, 14); ctx.fill();
      ctx.fillStyle = '#d6a067'; ctx.beginPath(); ctx.ellipse(x - 90, y, 9, 14, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + 90, y, 9, 14, 0, 0, 7); ctx.fill();
      if (i % this.s.checkpointInterval === 0 && i) label('🚩', x + 60, y - 30, 30, '#fff', 'center', 400);
      if (i === this.s.targetLogs) label('🏆', x, y - 40, 50, '#fff', 'center', 400);
    }
    const i0 = this.vis, dx = W / 2 + Math.sin(Math.floor(i0) * 1.7) * 120;
    label('🦆', dx, baseY - 40 + Math.sin(t * 8) * 4, 70, '#fff', 'center', 400);
    // Água
    const wy = baseY - (this.water - this.vis) * unit + 14;
    if (wy < H) { const g = ctx.createLinearGradient(0, wy, 0, H); g.addColorStop(0, 'rgba(14,116,224,.85)'); g.addColorStop(1, 'rgba(8,47,120,.95)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, wy + Math.sin(x / 40 + t * 3) * 8); ctx.lineTo(W, H); ctx.fill(); }
    this.fly.draw();
    title('PATO NO TRONCO', W / 2, 54, 46, '#fff');
    panel(W / 2 - 190, 86, 380, 60, { r: 16 });
    num(`${Math.floor(this.vis)} / ${this.s.targetLogs}`, W / 2, 116, 40);
    glossBar(40, 160, W - 80, 16, this.vis / this.s.targetLogs, '#0ea5e9');
    label(`🏆 ${this.wins} · 🌊 ${this.s.waterEnabled ? Math.max(0, Math.round(this.pos - this.water)) + ' troncos de folga' : 'sem água'}`, W / 2, 198, 18, '#0c4a6e', 'center', 900);
    heroFeedDraw(this.feed);
    if (this.fall) title('CAIU NA ÁGUA!', W / 2, 460, 56, '#ef4444');
    if (this.cele) title('CHEGOU NO TOPO!', W / 2, 460, 60, '#ffc93c');
  },
});

// ---------------- Limpa Vidros (Window Wipe) ----------------
const WW_MESS = [['throw_egg', 'Ovo', '🥚', '#fde68a'], ['throw_tomato', 'Tomate', '🍅', '#ef4444'], ['throw_mud', 'Lama', '🟤', '#78350f'], ['throw_paint', 'Tinta', '🎨', '#a855f7'], ['throw_banana', 'Banana', '🍌', '#facc15'], ['throw_poop', 'Cocô', '💩', '#713f12'], ['throw_balloon', 'Balão de água', '🎈', '#38bdf8'], ['throw_brick', 'Tijolo', '🧱', '#b45309'], ['throw_fish', 'Peixe', '🐟', '#64748b'], ['throw_ink', 'Tinta de polvo', '🐙', '#111827']];
defineGame({
  id: 'window-wipe', name: 'Limpa Vidros', genre: 'arcade', icon: '🧽', color: '#38bdf8', syncPointer: true,
  desc: 'Você limpa a janela de um arranha-céu enquanto o chat joga sujeira: ovo, tomate, tinta e cocô sujam o vidro, e bomba, tornado e pássaro pioram tudo. Vidro sujo tira vida.',
  help: '<p>No modo manual, <b>arraste o mouse</b> sobre o vidro para limpar (no automático o rodo limpa sozinho). Limpou tudo, sobe um andar.</p><p>O chat suja com 🥚🍅🟤🎨🍌💩🎈🧱🐟🐙 e manda 💣 bomba, 🧊 gelo, 🌪️ tornado e 🐦 pássaro. Também dá ou tira <b>vidas</b>.</p>',
  settings: [
    CONTROL_SETTING,
    { key: 'autoWipeRate', type: 'number', label: 'Velocidade do rodo automático', min: 0.2, max: 5, step: 0.1, default: 1.2 },
    { key: 'lives', type: 'number', label: 'Vidas', min: 1, max: 20, default: 5 },
    { key: 'goalFloors', type: 'number', label: 'Meta de andares', min: 1, max: 200, default: 30 },
    { key: 'goalReward', type: 'text', label: 'Prêmio da meta (texto)', default: 'Rodada de presentes!' },
    { key: 'demoMode', type: 'toggle', label: 'Sujeira automática quando a live está parada', default: true },
    charSetting('character', 'Personagem que limpa os vidros'),
  ],
  hasChars: true,
  kind() { return this.charOverride && CHARACTERS[this.charOverride] ? this.charOverride : pickKind(this.s.character || 'aventureiro', 0, 'window-wipe'); },
  onCharPick(user, k) { this.charOverride = k; },
  actions: [...WW_MESS.map(([id, label, icon]) => ({ id, label, icon })), { id: 'bomb', label: 'Bomba', icon: '💣' }, { id: 'freeze', label: 'Congelar o rodo', icon: '🧊' }, { id: 'tornado', label: 'Tornado', icon: '🌪️' }, { id: 'bird', label: 'Pássaro', icon: '🐦' }, { id: 'give_life', label: 'Dar vida', icon: '❤️' }, { id: 'take_life', label: 'Tirar vida', icon: '💔' }],
  bindings: [...WW_MESS.map(([id], i) => ({ action: id, trigger: 'gift', minCoins: [1, 1, 5, 5, 10, 10, 30, 30, 99, 99][i] })).filter((b, i) => i % 2 === 0), { action: 'throw_egg', trigger: 'like', likes: 30 }, { action: 'bird', trigger: 'gift', minCoins: 199 }, { action: 'tornado', trigger: 'gift', minCoins: 299 }, { action: 'bomb', trigger: 'gift', minCoins: 499 }, { action: 'give_life', trigger: 'follow' }],
  reset() { this.cols = 4; this.rows = 6; this.dirt = []; this.floor = 0; this.lives = this.s.lives; this.frozen = 0; this.wiper = { x: W / 2, y: 600, tx: W / 2, ty: 600 }; this.fly = new Flyers(); this.feed = new Feed(4); this.pend = []; this.over = 0; this.demoT = 3; this.hpT = 0; this.hurt = 0; this.cele = 0; this.face = Math.PI; this.wiping = 0; },
  sample() { return pick(['ovo', 'sujou', 'limpa']); },
  pane(i) { const pw = 150, ph = 140, ox = W / 2 - this.cols * pw / 2; return { x: ox + (i % this.cols) * pw, y: 240 + Math.floor(i / this.cols) * ph, w: pw, h: ph }; },
  splat(color, emoji, n = 1, big = 1) { for (let k = 0; k < n; k++) { const p = this.pane(randInt(0, this.cols * this.rows - 1)); this.dirt.push({ x: p.x + rand(20, p.w - 20), y: p.y + rand(20, p.h - 20), r: rand(26, 44) * big, c: color, e: emoji, a: 1, rot: rand(0, 7) }); } if (this.dirt.length > 160) this.dirt.splice(0, this.dirt.length - 160); },
  onAction(id, a) {
    if (this.over) return;
    if (id === 'give_life') { this.lives = Math.min(this.s.lives + 5, this.lives + 1); this.feed.push(a.user, '❤️ deu uma vida', '#7cff6b'); return; }
    if (id === 'take_life') { this.lives--; this.feed.push(a.user, '💔 tirou uma vida', '#ff6b8a'); return; }
    const m = WW_MESS.find((x) => x[0] === id);
    const icon = m ? m[2] : { bomb: '💣', freeze: '🧊', tornado: '🌪️', bird: '🐦' }[id];
    this.fly.push(icon, rand(100, W - 100), 1250, rand(150, W - 150), rand(300, 900), a.user, '', false);
    this.pend.push({ id, m, user: a.user, n: clamp(Math.round(a.qty), 1, 8) });
  },
  onPointer(p) { if (this.s.controlMode === 'manual' && pointer.down && !this.frozen) this.wipeAt(p.x, p.y); },
  wipeAt(x, y) { this.wiping = 0.3; for (const d of this.dirt) if (Math.hypot(d.x - x, d.y - y) < d.r + 40) d.a -= 0.12; this.dirt = this.dirt.filter((d) => d.a > 0); },
  update(dt) {
    this.feed.update(dt);
    if (this.over) { this.over -= dt; if (this.over <= 0) this.reset(); return; }
    this.frozen = Math.max(0, this.frozen - dt); this.hurt = Math.max(0, this.hurt - dt); this.cele = Math.max(0, this.cele - dt); this.wiping = Math.max(0, this.wiping - dt);
    this.fly.update(dt, () => {
      const p = this.pend.shift();
      if (!p) return;
      if (p.id !== 'freeze') this.hurt = 0.7;
      if (p.m) { this.splat(p.m[3], p.m[2], p.n); sfx.tone(160, 0.12, 'sawtooth', 0.08); this.feed.push(p.user, `${p.m[2]} ${p.m[1]}`, '#ff6b8a'); }
      else if (p.id === 'bomb') { this.splat('#1f2937', '💥', 14, 1.4); sfx.boom(); this.feed.push(p.user, '💣 BOMBA!', '#ff6b8a'); }
      else if (p.id === 'freeze') { this.frozen = 6; this.feed.push(p.user, '🧊 congelou o rodo', '#38bdf8'); }
      else if (p.id === 'tornado') { this.splat('#78350f', '🍂', 10); this.feed.push(p.user, '🌪️ tornado!', '#ff6b8a'); }
      else if (p.id === 'bird') { this.splat('#e5e7eb', '🐦', 6); this.feed.push(p.user, '🐦 pássaro passou...', '#ff6b8a'); }
    });
    if (this.s.demoMode) { this.demoT -= dt; if (this.demoT <= 0) { this.demoT = rand(2, 5); const m = pick(WW_MESS); this.splat(m[3], m[2]); } }
    if (this.s.controlMode === 'auto' && !this.frozen) {
      const w = this.wiper, target = this.dirt[0];
      if (target) { w.tx = target.x; w.ty = target.y; }
      w.x += (w.tx - w.x) * Math.min(1, dt * 3 * this.s.autoWipeRate); w.y += (w.ty - w.y) * Math.min(1, dt * 3 * this.s.autoWipeRate);
      if (target && Math.hypot(w.x - target.x, w.y - target.y) < 50) { this.wiping = 0.3; target.a -= dt * this.s.autoWipeRate * 1.5; this.dirt = this.dirt.filter((d) => d.a > 0); }
    }
    // Vidro sujo tira vida; vidro limpo sobe um andar
    const dirty = this.dirt.length;
    this.hpT += dt * Math.max(0, dirty - 12) / 30;
    if (this.hpT >= 1) { this.hpT = 0; this.lives--; sfx.tone(120, 0.3, 'square', 0.1); }
    if (this.lives <= 0) { this.over = 6; voice.say(`Fim de jogo! Chegamos ao andar ${this.floor}.`); sfx.boom(); }
    if (dirty === 0) { this.climbT = (this.climbT || 0) + dt; if (this.climbT > 1.5) { this.climbT = 0; this.floor++; this.cele = 2; sfx.pop(); if (this.floor === this.s.goalFloors) { confetti(160); sfx.win(); voice.say(`Meta batida! ${this.s.goalReward}`); } } } else this.climbT = 0;
  },
  draw() {
    const t = performance.now() / 1000;
    if (!customBackground(this)) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#60a5fa'); g.addColorStop(1, '#dbeafe'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = '#475569'; ctx.fillRect(W / 2 - this.cols * 75 - 30, 200, this.cols * 150 + 60, this.rows * 140 + 80);
    for (let i = 0; i < this.cols * this.rows; i++) {
      const p = this.pane(i);
      const g = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h); g.addColorStop(0, '#bae6fd'); g.addColorStop(0.5, '#e0f2fe'); g.addColorStop(1, '#93c5fd');
      ctx.fillStyle = g; ctx.fillRect(p.x + 6, p.y + 6, p.w - 12, p.h - 12);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.moveTo(p.x + 20, p.y + p.h - 10); ctx.lineTo(p.x + 50, p.y + 10); ctx.lineTo(p.x + 64, p.y + 10); ctx.lineTo(p.x + 34, p.y + p.h - 10); ctx.fill();
    }
    for (const d of this.dirt) { ctx.globalAlpha = d.a; ctx.fillStyle = d.c; ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = d.rot + k / 10 * Math.PI * 2, r = d.r * (k % 2 ? 0.7 : 1.1); ctx.lineTo(d.x + Math.cos(a) * r, d.y + Math.sin(a) * r); } ctx.fill(); label(d.e, d.x, d.y, d.r * 0.8, '#fff', 'center', 400); ctx.globalAlpha = 1; }
    // Faxineiro 3D no andaime, segurando o rodo: anda com ele, esfrega, apanha da sujeira e comemora o andar limpo
    const w = this.s.controlMode === 'manual' ? pointer : this.wiper;
    const fy = Math.min(w.y + 195, H - 75), px = this.px ?? w.x, mv = w.x - px; this.px = w.x;
    ctx.fillStyle = '#334155'; ctx.fillRect(W / 2 - 4 - this.cols * 75, 0, 4, fy); ctx.fillRect(W / 2 + this.cols * 75, 0, 4, fy);
    ctx.fillStyle = '#a16207'; ctx.fillRect(W / 2 - this.cols * 75 - 10, fy, this.cols * 150 + 20, 14); ctx.fillStyle = '#facc15'; ctx.fillRect(W / 2 - this.cols * 75 - 10, fy - 34, this.cols * 150 + 20, 5);
    const c = charLayer.get('cleaner', this.kind(), { height: 175 });
    if (c) {
      const want = this.cele || this.hurt ? 0 : Math.abs(mv) > 1.2 ? (mv > 0 ? 1.2 : -1.2) : Math.PI - 0.5;
      this.face += (want - this.face) * 0.15;
      charLayer.place(c, w.x + (this.hurt ? rand(-5, 5) : 0), fy, this.face);
      if (this.hurt > 0.6 && c.state !== 'hit') { c.play('hit', { speed: 1.3 }); c.hitFlash(0xff0000, 1); }
      else if (this.cele > 1.9 && c.state !== 'victory') c.play('victory');
      else if (!c.busy) { const st = Math.abs(mv) > 1.2 ? 'walk' : this.wiping ? 'interact' : 'idle'; if (c.state !== st || st === 'interact') c.play(st, st === 'interact' ? { speed: 1.4 } : {}); }
      charLayer.draw();
    } else {
      ctx.fillStyle = '#2563eb'; ctx.fillRect(w.x - 16, fy - 60, 32, 44); ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(w.x, fy - 78, 18, 0, 7); ctx.fill();
    }
    // Rodo
    ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(Math.sin(t * 6) * 0.2);
    ctx.fillStyle = this.frozen ? '#7dd3fc' : '#f59e0b'; ctx.fillRect(-50, -10, 100, 20); ctx.fillStyle = '#111'; ctx.fillRect(-52, 6, 104, 8); ctx.fillStyle = '#a16207'; ctx.fillRect(-5, 10, 10, 70);
    ctx.restore();
    this.fly.draw();
    title('LIMPA VIDROS', W / 2, 54, 46);
    pill(`ANDAR ${this.floor}/${this.s.goalFloors} · ${'❤️'.repeat(Math.max(0, Math.min(this.lives, 10)))}`, W / 2, 104, { size: 22, bg: 'rgba(0,0,0,.6)' });
    label(this.frozen ? '🧊 rodo congelado!' : `${this.dirt.length} manchas · vidro sujo tira vida`, W / 2, 150, 18, '#0f172a', 'center', 900);
    heroFeedDraw(this.feed);
    if (this.over) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H); title('FIM DE JOGO', W / 2, H / 2 - 40, 64, '#ff6b8a'); text(`Andar ${this.floor}`, W / 2, H / 2 + 30, 36); }
  },
});

// ---------------- Corta Frutas (Fruit Slice) ----------------
const FRUITS = ['🍉', '🍊', '🍎', '🍍', '🥝', '🍋', '🍑', '🍇', '🥭', '🍓'];
defineGame({
  id: 'fruit-slice', name: 'Corta Frutas', genre: 'arcade', icon: '🍉', color: '#22c55e', syncPointer: true,
  desc: 'Corte as frutas voando com o mouse enquanto o chat joga mais frutas e bombas. Chegue à pontuação alvo para vencer a rodada.',
  help: '<p>No modo manual, <b>passe o mouse</b> com o botão apertado sobre as frutas para cortar (no automático a lâmina corta sozinha). Não corte as <b>bombas</b>!</p><p>❤️ Likes e 🎁 presentes jogam <b>frutas</b> (mais pontos); ⭐ seguir e presentes de sabotagem jogam <b>bombas</b>.</p>',
  settings: [
    CONTROL_SETTING,
    { key: 'targetScore', type: 'number', label: 'Pontos para vencer a rodada', min: 20, max: 2000, default: 150 },
    { key: 'lives', type: 'number', label: 'Vidas', min: 1, max: 10, default: 3 },
    { key: 'winGoal', type: 'number', label: 'Vitórias para fechar a partida', min: 1, max: 20, default: 3 },
    { key: 'bgScene', type: 'select', label: 'Cenário', options: [['wood', 'Madeira'], ['dojo', 'Dojô'], ['night', 'Noite']], default: 'wood' },
    charSetting('character', 'Personagem que corta as frutas'),
  ],
  hasChars: true,
  kind() { return this.charOverride && CHARACTERS[this.charOverride] ? this.charOverride : pickKind(this.s.character || 'encapuzado', 0, 'fruit-slice'); },
  onCharPick(user, k) { this.charOverride = k; },
  actions: [{ id: 'fruit', label: 'Jogar frutas', icon: '🍉' }, { id: 'bomb', label: 'Jogar bombas', icon: '💣' }, ...WIN_ACTIONS],
  bindings: [{ action: 'fruit', trigger: 'like', likes: 10 }, { action: 'fruit', trigger: 'gift', minCoins: 1 }, { action: 'bomb', trigger: 'follow' }, { action: 'bomb', trigger: 'gift', minCoins: 99 }],
  reset() { this.items = []; this.score = 0; this.lives = this.s.lives; this.wins = this.wins || 0; this.spawnT = 1; this.trail = []; this.halves = []; this.over = 0; this.feed = new Feed(3); this.blade = { x: W / 2, y: 700 }; this.ninja = { x: W / 2, tx: W / 2, slash: 0, boom: 0 }; },
  sample() { return pick(['fruta', 'corta']); },
  throw(kind, user) { this.items.push({ kind, e: kind === 'bomb' ? '💣' : pick(FRUITS), x: rand(100, W - 100), y: H + 40, vx: rand(-120, 120), vy: rand(-1250, -1000), r: kind === 'bomb' ? 34 : 40, rot: 0, vr: rand(-4, 4), user }); },
  onAction(id, a) {
    if (id === 'award_win') return this.winRound();
    if (id === 'steal_win') { this.wins = Math.max(0, this.wins - 1); return; }
    const n = a.gift ? clamp(Math.round(a.qty), 1, 12) : 1;
    for (let i = 0; i < n; i++) setTimeout(() => this.throw(id === 'bomb' ? 'bomb' : 'fruit', a.user), i * 120);
    if (a.gift) this.feed.push(a.user, id === 'bomb' ? `💣 ×${n}` : `🍉 ×${n}`, id === 'bomb' ? '#ff6b8a' : '#7cff6b');
  },
  onPointer(p) { if (this.s.controlMode === 'manual' && pointer.down) this.cutAt(p.x, p.y); },
  cutAt(x, y) {
    this.trail.push({ x, y, t: 0.25 });
    for (const it of this.items) {
      if (it.cut || Math.hypot(it.x - x, it.y - y) > it.r + 10) continue;
      it.cut = true;
      if (it.kind === 'bomb') { this.ninja.boom = 0.7; this.lives--; sfx.boom(); burst(it.x, it.y, ['#111', '#ff8a3d', '#fde047'], 50, 500); if (this.lives <= 0) { this.over = 5; voice.say('Explodiu! Fim da rodada.'); } }
      else { this.ninja.tx = clamp(it.x, 90, W - 90); this.ninja.slash++; this.score += 10; sfx.pop(); this.halves.push({ ...it, vx: it.vx - 80, side: -1, t: 0 }, { ...it, vx: it.vx + 80, side: 1, t: 0 }); burst(it.x, it.y, ['#fde047', '#ef4444', '#22c55e'], 16, 260); if (this.score >= this.s.targetScore) this.winRound(); }
    }
    this.items = this.items.filter((it) => !it.cut);
  },
  winRound() { this.wins++; sfx.win(); confetti(140); voice.say(this.wins >= this.s.winGoal ? 'Campeão das frutas!' : 'Rodada vencida!'); if (this.wins >= this.s.winGoal) this.wins = 0; this.score = 0; this.lives = this.s.lives; this.cele = 3; },
  update(dt) {
    this.feed.update(dt);
    this.cele = Math.max(0, (this.cele || 0) - dt); this.ninja.boom = Math.max(0, this.ninja.boom - dt);
    this.ninja.x += (this.ninja.tx - this.ninja.x) * Math.min(1, dt * 6);
    if (this.over) { this.over -= dt; if (this.over <= 0) { this.score = 0; this.lives = this.s.lives; this.items = []; } return; }
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawnT = rand(0.7, 1.5); this.throw(Math.random() < 0.12 ? 'bomb' : 'fruit'); }
    for (const it of this.items) { it.vy += 1500 * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.vr * dt; }
    for (const hf of this.halves) { hf.t += dt; hf.vy += 1500 * dt; hf.x += hf.vx * dt; hf.y += hf.vy * dt; }
    this.halves = this.halves.filter((hf) => hf.t < 2);
    this.items = this.items.filter((it) => it.y < H + 100 || it.vy < 0);
    for (const tr of this.trail) tr.t -= dt;
    this.trail = this.trail.filter((tr) => tr.t > 0);
    if (this.s.controlMode === 'auto') {
      // Lâmina automática: vai até a fruta mais alta, desvia das bombas
      const target = this.items.filter((it) => it.kind === 'fruit' && it.y < 1000).sort((a, b) => a.y - b.y)[0];
      if (target) { this.blade.x += (target.x - this.blade.x) * Math.min(1, dt * 8); this.blade.y += (target.y - this.blade.y) * Math.min(1, dt * 8); }
      const nearBomb = this.items.some((it) => it.kind === 'bomb' && Math.hypot(it.x - this.blade.x, it.y - this.blade.y) < 90);
      if (!nearBomb || Math.random() < 0.03) this.cutAt(this.blade.x, this.blade.y);
    }
  },
  draw() {
    if (!customBackground(this)) {
      const sc = this.s.bgScene;
      if (sc === 'wood') { ctx.fillStyle = '#7c4a21'; ctx.fillRect(0, 0, W, H); for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.04)'; ctx.fillRect(i * 80, 0, 80, H); } }
      else if (sc === 'dojo') { ctx.fillStyle = '#f5e6c8'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 6; for (let x = 0; x < W; x += 120) ctx.strokeRect(x, 0, 120, H / 2); ctx.fillStyle = '#c8a46a'; ctx.fillRect(0, H / 2, W, H / 2); }
      else stageBg('night');
    }
    for (const hf of this.halves) { ctx.save(); ctx.beginPath(); ctx.rect(hf.side < 0 ? hf.x - 60 : hf.x, hf.y - 60, 60, 120); ctx.clip(); label(hf.e, hf.x + hf.side * hf.t * 20, hf.y, 76, '#fff', 'center', 400); ctx.restore(); }
    for (const it of this.items) { ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot); label(it.e, 0, 0, it.r * 1.9, '#fff', 'center', 400); ctx.restore(); if (it.user) avatar(it.user, it.x + 30, it.y - 30, 12, '#fff'); }
    // Ninja 3D no pé da tela: corre até o corte e dá o golpe de espada, apanha da bomba e comemora a rodada
    const nj = this.ninja, c = charLayer.get('ninja', this.kind(), { height: 170 }), dx = nj.tx - nj.x;
    if (c) {
      charLayer.place(c, nj.x + (nj.boom ? rand(-6, 6) : 0), H - 72, nj.boom || this.cele ? 0 : Math.abs(dx) > 8 ? Math.sign(dx) * 1.1 : (nj.tx - W / 2) * 0.002);
      if (nj.boom > 0.6 && c.state !== 'hit') { c.play('hit', { speed: 1.3 }); c.hitFlash(0xff0000, 1); }
      else if (this.cele > 2.9 && c.state !== 'victory') c.play('victory', { then: 'taunt' });
      else if (nj.slash !== nj.seen && (!c.busy || c.state === 'slash' && c.stateT > 0.25)) { nj.seen = nj.slash; c.play('slash', { speed: 1.8 }); }
      else if (!c.busy) { const st = Math.abs(dx) > 25 ? 'run' : 'fightIdle'; if (c.state !== st) c.play(st); }
      charLayer.draw();
    } else {
      ctx.fillStyle = '#111827'; ctx.fillRect(nj.x - 18, H - 142, 36, 70); ctx.beginPath(); ctx.arc(nj.x, H - 160, 20, 0, 7); ctx.fill();
    }
    if (this.trail.length > 1) { ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); this.trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); }
    title('CORTA FRUTAS', W / 2, 54, 46);
    pill(`${this.score} / ${this.s.targetScore} pontos · ${'❤️'.repeat(Math.max(0, this.lives))} · 🏆 ${this.wins}/${this.s.winGoal}`, W / 2, 104, { size: 20, bg: 'rgba(0,0,0,.6)' });
    glossBar(60, 136, W - 120, 14, this.score / this.s.targetScore, '#22c55e');
    this.feed.draw(20, 180);
    if (this.cele) title('RODADA VENCIDA!', W / 2, 520, 56, '#ffc93c');
    if (this.over) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H); title('EXPLODIU!', W / 2, H / 2, 70, '#ff6b8a'); }
  },
});
