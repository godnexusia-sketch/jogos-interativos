'use strict';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const $ = (id) => document.getElementById(id);

if (params.get('clean') === '1') document.body.classList.add('clean');

// ---------- Conexão com o servidor ----------
let ws = null;
let wantedUser = '';
let reconnectTimer = null;

function setStatus(state, text) {
  const el = $('status');
  el.className = 'status ' + state;
  el.textContent = text;
  $('connectBtn').textContent = state === 'connected' || state === 'connecting' ? 'Desconectar' : 'Conectar';
}

function openSocket() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/ws`);
  ws.onopen = () => { if (wantedUser) ws.send(JSON.stringify({ type: 'connect', user: wantedUser })); };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'status') {
      setStatus(msg.state, msg.message);
      // Se a conexão com o TikTok caiu (não a live acabou), tenta de novo em 10s.
      if (msg.state === 'disconnected' && wantedUser) retry(10000);
      if (msg.state === 'error' || msg.state === 'ended') wantedUser = '';
    } else if (msg.type === 'viewers') {
      $('viewers').textContent = `👀 ${msg.count}`;
    } else {
      handleEvent(msg);
    }
  };
  ws.onclose = () => {
    if (wantedUser) { setStatus('connecting', 'Reconectando ao servidor…'); retry(3000); }
  };
}

function retry(ms) {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    if (!wantedUser) return;
    if (!ws || ws.readyState === WebSocket.CLOSED) openSocket();
    else if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'connect', user: wantedUser }));
  }, ms);
}

function connect(user) {
  wantedUser = user.trim().replace(/^@/, '');
  if (!wantedUser) return;
  setStatus('connecting', `Conectando a @${wantedUser}…`);
  if (!ws || ws.readyState === WebSocket.CLOSED) openSocket();
  else if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'connect', user: wantedUser }));
  updateObsUrl();
}

function disconnect() {
  wantedUser = '';
  clearTimeout(reconnectTimer);
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'disconnect' }));
  setStatus('idle', 'Desconectado');
  $('viewers').textContent = '';
}

$('connectForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if ($('connectBtn').textContent === 'Desconectar') disconnect();
  else connect($('user').value);
});

// ---------- Eventos ----------
function addFeed(text) {
  const li = document.createElement('li');
  li.textContent = text;
  const feed = $('feed');
  feed.prepend(li);
  while (feed.children.length > 60) feed.lastChild.remove();
}

function handleEvent(ev) {
  const who = ev.user?.nick || 'anônimo';
  if (ev.type === 'chat') addFeed(`💬 ${who}: ${ev.text}`);
  else if (ev.type === 'like') addFeed(`❤️ ${who} curtiu ×${ev.count}`);
  else if (ev.type === 'gift') addFeed(`🎁 ${who} enviou ${ev.name} ×${ev.count}`);
  else if (ev.type === 'social') addFeed(`⭐ ${who} seguiu/compartilhou`);
  else return; // entradas não vão para o feed nem para o jogo
  games[current].onEvent(ev);
}

// ---------- Utilidades de desenho ----------
const COLORS = ['#fe2c55', '#25f4ee', '#ffd23f', '#7cff6b', '#b36bff', '#ff8a3d', '#4d9bff', '#ff6bd6'];

function text(str, x, y, size = 40, color = '#fff', align = 'center', weight = 700) {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(4, size / 8);
  ctx.strokeStyle = 'rgba(0,0,0,.75)';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function roundRect(x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function trim(str, n) { return str.length > n ? str.slice(0, n - 1) + '…' : str; }

// ---------- Jogo 1: Votação ----------
const votacao = {
  help: '<p>Comente <b>1</b>, <b>2</b>, <b>3</b> ou <b>4</b> para votar (cada pessoa tem 1 voto e pode trocar).</p><p>🎁 Presente: +5 votos na sua opção.</p>',
  question: 'Qual jogo agora?',
  options: ['Corrida', 'Flappy', 'Votação de novo', 'Surpresa'],
  reset() { this.votes = [0, 0, 0, 0]; this.voters = new Map(); this.bonus = [0, 0, 0, 0]; this.pulse = [0, 0, 0, 0]; },
  vote(user, i) {
    const prev = this.voters.get(user);
    if (prev === i) return;
    if (prev !== undefined) this.votes[prev]--;
    this.voters.set(user, i);
    this.votes[i]++;
    this.pulse[i] = 1;
  },
  onEvent(ev) {
    const id = ev.user?.id || ev.user?.nick;
    if (ev.type === 'chat') {
      const m = ev.text.trim().match(/^([1-4])\b/);
      if (m) this.vote(id, Number(m[1]) - 1);
    } else if (ev.type === 'gift') {
      const i = this.voters.get(id);
      if (i !== undefined) { this.bonus[i] += 5 * ev.count; this.pulse[i] = 1; }
    }
  },
  update(dt) { this.pulse = this.pulse.map((p) => Math.max(0, p - dt * 2)); },
  draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1b1036'); g.addColorStop(1, '#0a2a3a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    text('🗳️ VOTAÇÃO', W / 2, 110, 64, '#25f4ee');
    wrapText(this.question, W / 2, 230, W - 80, 52);
    const totals = this.votes.map((v, i) => v + this.bonus[i]);
    const sum = totals.reduce((a, b) => a + b, 0) || 1;
    const lead = Math.max(...totals);
    this.options.forEach((opt, i) => {
      const y = 360 + i * 185, x = 50, w = W - 100, h = 140;
      roundRect(x, y, w, h, 24, 'rgba(255,255,255,.08)');
      const pct = totals[i] / sum;
      if (pct > 0) roundRect(x, y, Math.max(48, w * pct), h, 24, COLORS[i] + 'cc');
      if (this.pulse[i] > 0) { ctx.globalAlpha = this.pulse[i] * 0.5; roundRect(x, y, w, h, 24, '#fff'); ctx.globalAlpha = 1; }
      text(`${i + 1}`, x + 50, y + h / 2, 72);
      text(trim(opt, 18), x + 110, y + h / 2 - 18, 44, '#fff', 'left');
      text(`${totals[i]} votos · ${Math.round(pct * 100)}%`, x + 110, y + h / 2 + 34, 30, '#eee', 'left', 500);
      if (totals[i] === lead && lead > 0) text('👑', x + w - 50, y + h / 2, 60);
    });
    text(`Comente o número da opção!`, W / 2, H - 150, 40, '#ffd23f');
    text(`${this.voters.size} pessoas votaram`, W / 2, H - 90, 30, '#ccc', 'center', 500);
  },
};

function wrapText(str, x, y, maxW, size) {
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  const words = str.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  lines.push(line);
  lines.slice(0, 2).forEach((l, i) => text(l, x, y + i * size * 1.15, size));
}

// ---------- Jogo 2: Corrida ----------
const MAX_PILOTS = 8;
const corrida = {
  help: '<p>Comente <b>!entrar</b> para ganhar um carro (máx. 8). Com 2 pilotos a contagem começa.</p><p>💬 Comentário: acelera · ❤️ Like: acelera um pouco · 🎁 Presente: turbo.</p>',
  wins: new Map(),
  reset() { this.pilots = []; this.phase = 'lobby'; this.timer = 0; this.winner = null; },
  pilot(id) { return this.pilots.find((p) => p.id === id); },
  boost(id, amount) {
    const p = this.pilot(id);
    if (p && this.phase === 'race') { p.pos = Math.min(100, p.pos + amount); p.flash = 1; }
  },
  onEvent(ev) {
    const id = ev.user?.id || ev.user?.nick;
    if (ev.type === 'chat' && /^!?entrar\b/i.test(ev.text.trim())) {
      if (this.phase !== 'race' && this.phase !== 'finish' && !this.pilot(id) && this.pilots.length < MAX_PILOTS) {
        this.pilots.push({ id, nick: ev.user.nick, pos: 0, flash: 0, color: COLORS[this.pilots.length % COLORS.length] });
        if (this.pilots.length >= 2 && this.phase === 'lobby') { this.phase = 'countdown'; this.timer = 10; }
      }
      return;
    }
    if (ev.type === 'chat') this.boost(id, 1.5);
    else if (ev.type === 'like') this.boost(id, Math.min(5, 0.4 * ev.count));
    else if (ev.type === 'gift') this.boost(id, Math.min(30, 3 + ev.diamonds * ev.count * 0.5));
  },
  update(dt) {
    for (const p of this.pilots) p.flash = Math.max(0, p.flash - dt * 3);
    if (this.phase === 'countdown') {
      this.timer -= dt;
      if (this.timer <= 0) { this.phase = 'race'; this.timer = 0; }
    } else if (this.phase === 'race') {
      this.timer += dt;
      for (const p of this.pilots) p.pos = Math.min(100, p.pos + dt * 0.3); // anda devagar sozinho
      const w = this.pilots.find((p) => p.pos >= 100);
      if (w) {
        this.winner = w; this.phase = 'finish'; this.timer = 8;
        this.wins.set(w.nick, (this.wins.get(w.nick) || 0) + 1);
      }
    } else if (this.phase === 'finish') {
      this.timer -= dt;
      if (this.timer <= 0) this.reset();
    }
  },
  draw() {
    ctx.fillStyle = '#1d3b1f'; ctx.fillRect(0, 0, W, H);
    text('🏁 CORRIDA', W / 2, 90, 64, '#ffd23f');
    const top = 180, laneH = 100, x0 = 80, x1 = W - 80;
    ctx.fillStyle = '#333'; ctx.fillRect(40, top - 10, W - 80, MAX_PILOTS * laneH + 20);
    for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#000'; ctx.fillRect(x1 + 10, top - 10 + i * (MAX_PILOTS * laneH + 20) / 12, 20, (MAX_PILOTS * laneH + 20) / 12); }
    for (let i = 0; i < MAX_PILOTS; i++) {
      const y = top + i * laneH;
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.setLineDash([20, 20]); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(40, y + laneH); ctx.lineTo(W - 40, y + laneH); ctx.stroke(); ctx.setLineDash([]);
      const p = this.pilots[i];
      if (!p) { text('— vaga livre —', W / 2, y + laneH / 2, 26, 'rgba(255,255,255,.3)', 'center', 500); continue; }
      const cx = x0 + (x1 - x0 - 60) * (p.pos / 100);
      if (p.flash > 0) { ctx.globalAlpha = p.flash; text('🔥', cx - 40, y + laneH / 2, 44); ctx.globalAlpha = 1; }
      roundRect(cx, y + 25, 70, 50, 12, p.color);
      text('🚗', cx + 35, y + 50, 40);
      text(trim(p.nick, 14), x0 - 30, y + 14, 22, '#fff', 'left', 600);
    }
    const by = top + MAX_PILOTS * laneH + 70;
    if (this.phase === 'lobby') {
      text('Comente !entrar para correr', W / 2, by, 44, '#25f4ee');
      text(`${this.pilots.length}/${MAX_PILOTS} pilotos · mínimo 2`, W / 2, by + 60, 32, '#ddd', 'center', 500);
    } else if (this.phase === 'countdown') {
      text(`Largada em ${Math.ceil(this.timer)}…`, W / 2, by, 52, '#ffd23f');
      text('Ainda dá tempo: !entrar', W / 2, by + 60, 32, '#ddd', 'center', 500);
    } else if (this.phase === 'race') {
      text('Comente, curta e mande presentes!', W / 2, by, 38, '#fff');
      text(`⏱ ${this.timer.toFixed(1)}s`, W / 2, by + 60, 34, '#ddd', 'center', 500);
    } else if (this.phase === 'finish') {
      roundRect(60, 420, W - 120, 340, 30, 'rgba(0,0,0,.8)');
      text('🏆 VENCEDOR', W / 2, 500, 56, '#ffd23f');
      text(trim(this.winner.nick, 18), W / 2, 590, 54, this.winner.color);
      text(`Nova corrida em ${Math.ceil(this.timer)}s`, W / 2, 690, 32, '#ddd', 'center', 500);
    }
    const ranking = [...this.wins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (ranking.length) {
      text('Ranking de vitórias', W / 2, H - 200, 30, '#ffd23f');
      ranking.forEach(([n, c], i) => text(`${['🥇', '🥈', '🥉'][i]} ${trim(n, 16)} — ${c}`, W / 2, H - 150 + i * 44, 28, '#fff', 'center', 500));
    }
  },
};

// ---------- Jogo 3: Flappy ----------
const flappy = {
  help: '<p>Comente <b>pula</b> (ou qualquer coisa com "pula") ou mande ❤️ like para o passarinho voar.</p><p>🎁 Presente: escudo de 5 segundos.</p>',
  best: 0,
  reset() {
    this.y = H / 2; this.vy = 0; this.pipes = []; this.spawn = 0; this.score = 0;
    this.shield = 0; this.dead = 0; this.lastHelper = ''; this.flapCooldown = 0;
  },
  flap(nick) {
    if (this.dead > 0 || this.flapCooldown > 0) return;
    this.vy = -520; this.lastHelper = nick; this.flapCooldown = 0.25;
  },
  onEvent(ev) {
    if (ev.type === 'chat' && /pula|pulo|jump|sobe|^\s*!?p\s*$/i.test(ev.text)) this.flap(ev.user.nick);
    else if (ev.type === 'like') this.flap(ev.user.nick);
    else if (ev.type === 'gift') { this.shield = 5; this.lastHelper = ev.user.nick; }
  },
  update(dt) {
    this.flapCooldown = Math.max(0, this.flapCooldown - dt);
    if (this.dead > 0) { this.dead -= dt; if (this.dead <= 0) this.reset(); return; }
    this.shield = Math.max(0, this.shield - dt);
    this.vy += 1400 * dt; this.y += this.vy * dt;
    this.spawn -= dt;
    if (this.spawn <= 0) { this.spawn = 2.4; this.pipes.push({ x: W + 60, gap: 300 + Math.random() * (H - 700), passed: false }); }
    const speed = 240 + Math.min(160, this.score * 6);
    for (const p of this.pipes) p.x -= speed * dt;
    this.pipes = this.pipes.filter((p) => p.x > -160);
    const bx = 200, r = 34, gapH = 380;
    for (const p of this.pipes) {
      if (!p.passed && p.x + 120 < bx) { p.passed = true; this.score++; this.best = Math.max(this.best, this.score); }
      const inX = bx + r > p.x && bx - r < p.x + 120;
      const hit = inX && (this.y - r < p.gap || this.y + r > p.gap + gapH);
      if (hit && this.shield <= 0) this.dead = 3;
    }
    // O teto só segura o passarinho; quem derruba é o chão.
    if (this.y < r) { this.y = r; this.vy = Math.max(0, this.vy); }
    if (this.y > H - 80 - r) {
      if (this.shield > 0) { this.y = Math.min(Math.max(this.y, r), H - 80 - r); this.vy = -500; }
      else this.dead = 3;
    }
  },
  draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#4fc3f7'); g.addColorStop(1, '#b3e5fc');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const p of this.pipes) {
      ctx.fillStyle = '#2e7d32';
      ctx.fillRect(p.x, 0, 120, p.gap); ctx.fillRect(p.x, p.gap + 380, 120, H);
      ctx.fillStyle = '#43a047';
      ctx.fillRect(p.x - 10, p.gap - 40, 140, 40); ctx.fillRect(p.x - 10, p.gap + 380, 140, 40);
    }
    ctx.fillStyle = '#8d6e63'; ctx.fillRect(0, H - 80, W, 80);
    ctx.fillStyle = '#7cb342'; ctx.fillRect(0, H - 80, W, 16);
    if (this.shield > 0) {
      ctx.beginPath(); ctx.arc(200, this.y, 56, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(37,244,238,.35)'; ctx.fill();
    }
    ctx.save(); ctx.translate(200, this.y); ctx.rotate(Math.max(-0.5, Math.min(0.9, this.vy / 900)));
    text('🐤', 0, 0, 72); ctx.restore();
    text(`${this.score}`, W / 2, 140, 110);
    text(`Recorde: ${this.best}`, W / 2, 230, 34, '#fff', 'center', 600);
    if (this.lastHelper) text(`último pulo: ${trim(this.lastHelper, 18)}`, W / 2, H - 140, 30, '#fff', 'center', 600);
    if (this.shield > 0) text(`🛡️ ${this.shield.toFixed(1)}s`, W / 2, 300, 40, '#25f4ee');
    if (this.dead > 0) {
      roundRect(80, H / 2 - 160, W - 160, 300, 30, 'rgba(0,0,0,.75)');
      text('💥 Bateu!', W / 2, H / 2 - 70, 64, '#fe2c55');
      text(`Pontos: ${this.score}`, W / 2, H / 2 + 10, 44);
      text('Comente "pula" para salvar o próximo!', W / 2, H / 2 + 80, 28, '#ddd', 'center', 500);
    } else if (this.score === 0 && this.pipes.length < 2) {
      text('Comente "pula" ou curta ❤️', W / 2, H / 2 + 160, 40, '#fff');
    }
  },
};

// ---------- Troca de jogo ----------
const games = { votacao, corrida, flappy };
let current = games[params.get('game')] ? params.get('game') : 'votacao';
Object.values(games).forEach((g) => g.reset());

function selectGame(name) {
  current = name;
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.game === name));
  $('help').innerHTML = games[name].help;
  $('editPoll').hidden = name !== 'votacao';
  updateObsUrl();
}
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => selectGame(b.dataset.game)));
$('resetGame').addEventListener('click', () => games[current].reset());
$('editPoll').addEventListener('click', () => {
  const q = prompt('Pergunta da votação:', votacao.question);
  if (q === null) return;
  const opts = [];
  for (let i = 0; i < 4; i++) {
    const o = prompt(`Opção ${i + 1}:`, votacao.options[i]);
    if (o === null) return;
    opts.push(o.trim() || `Opção ${i + 1}`);
  }
  votacao.question = q.trim() || votacao.question;
  votacao.options = opts;
  votacao.reset();
});

function updateObsUrl() {
  const u = new URL(location.origin + location.pathname);
  u.searchParams.set('clean', '1');
  u.searchParams.set('game', current);
  if (wantedUser || $('user').value) u.searchParams.set('user', (wantedUser || $('user').value).replace(/^@/, ''));
  $('obsUrl').textContent = u.toString();
}
$('user').addEventListener('input', updateObsUrl);

// ---------- Simulador ----------
const FAKE = ['ana', 'bruno', 'carla', 'davi', 'enzo', 'fernanda', 'gabi', 'heitor', 'isa', 'joao'];
function fakeUser() { const n = FAKE[Math.floor(Math.random() * FAKE.length)]; return { id: 'sim_' + n, nick: n, pic: '' }; }
function simChat(textStr) { handleEvent({ type: 'chat', user: fakeUser(), text: textStr }); }
$('simChat').addEventListener('click', () => simChat($('simText').value || 'pula'));
$('simText').addEventListener('keydown', (e) => { if (e.key === 'Enter') simChat($('simText').value || 'pula'); });
$('simLike').addEventListener('click', () => handleEvent({ type: 'like', user: fakeUser(), count: 5 }));
$('simGift').addEventListener('click', () => handleEvent({ type: 'gift', user: fakeUser(), name: 'Rosa', count: 1, diamonds: 1 }));
let autoTimer = null;
$('simAuto').addEventListener('click', () => {
  $('simAuto').classList.toggle('on');
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; return; }
  autoTimer = setInterval(() => {
    const r = Math.random();
    const samples = { votacao: () => String(1 + Math.floor(Math.random() * 4)), corrida: () => (Math.random() < 0.3 ? '!entrar' : 'vai!'), flappy: () => 'pula' };
    if (r < 0.7) simChat(samples[current]());
    else if (r < 0.95) handleEvent({ type: 'like', user: fakeUser(), count: 3 });
    else handleEvent({ type: 'gift', user: fakeUser(), name: 'Rosa', count: 1, diamonds: 1 });
  }, 350);
});

// ---------- Loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  games[current].update(dt);
  ctx.clearRect(0, 0, W, H);
  games[current].draw();
  requestAnimationFrame(loop);
}
selectGame(current);
requestAnimationFrame(loop);

if (params.get('user')) { $('user').value = params.get('user'); connect(params.get('user')); }
