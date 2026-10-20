'use strict';

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

if (params.get('clean') === '1') document.body.classList.add('clean');

// ---------- Conexão com o servidor ----------
let ws = null;
let wantedUser = '';
let reconnectTimer = null;

function setStatus(state, msg) {
  const el = $('status');
  el.className = 'status ' + state;
  el.textContent = msg;
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
      // Conta fora do ar: tenta de novo a cada 30s até a live começar.
      if (msg.state === 'offline' && wantedUser) { $('connectBtn').textContent = 'Desconectar'; retry(30000); }
      if (msg.state === 'error' || msg.state === 'ended') wantedUser = '';
      if (msg.state === 'connected') pushConfigs();
    } else if (msg.type === 'config') {
      GAMES.find((g) => g.configKey === msg.key)?.applyConfig(msg.data);
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

// A configuração (fotos, nomes) vai para o servidor e chega às outras telas conectadas no mesmo @,
// como a fonte do OBS. A tela limpa (?clean=1) só recebe, nunca envia.
const isClean = params.get('clean') === '1';
function shareConfig(key, data) {
  if (!isClean && ws && ws.readyState === WebSocket.OPEN && wantedUser) ws.send(JSON.stringify({ type: 'config', key, data }));
}
function pushConfigs() {
  if (isClean) return;
  for (const g of GAMES) if (g.configKey && store.get('cfg:' + g.configKey, null)) shareConfig(g.configKey, g.getConfig());
}

// ---------- Eventos ----------
function addFeed(str) {
  const li = document.createElement('li');
  li.textContent = str;
  const feed = $('feed');
  feed.prepend(li);
  while (feed.children.length > 60) feed.lastChild.remove();
}

function handleEvent(ev) {
  const who = ev.user?.nick || 'anônimo';
  if (ev.type === 'chat') addFeed(`💬 ${who}: ${ev.text}`);
  else if (ev.type === 'like') addFeed(`❤️ ${who} curtiu ×${ev.count}`);
  else if (ev.type === 'gift') addFeed(`🎁 ${who} enviou ${ev.name} ×${ev.count} (${ev.diamonds} moedas)`);
  else if (ev.type === 'social') addFeed(`⭐ ${who} seguiu/compartilhou`);
  else return; // entradas na sala não vão para o feed nem para o jogo
  current.onEvent(ev);
}

// ---------- Troca de jogo ----------
let current = GAMES.find((g) => g.id === params.get('game')) || GAMES[0];
GAMES.forEach((g) => g.reset());

const tabs = $('tabs');
for (const g of GAMES) {
  const b = document.createElement('button');
  b.dataset.game = g.id;
  b.innerHTML = `<span>${g.icon}</span>${g.name}`;
  b.addEventListener('click', () => selectGame(g));
  tabs.append(b);
}

function selectGame(game) {
  current = game;
  particles.length = 0;
  announcer.items.length = 0;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.game === game.id));
  $('help').innerHTML = game.help;
  $('editGame').hidden = !game.edit;
  $('settingsPanel').hidden = !game.renderSettings;
  if (game.renderSettings) game.renderSettings($('settings'), (cfg) => shareConfig(game.configKey, cfg));
  updateObsUrl();
}
// Usado pela votação para abrir o jogo escolhido pela live.
function switchGameById(id) { const g = GAMES.find((x) => x.id === id); if (g) { g.reset(); selectGame(g); } }
$('resetGame').addEventListener('click', () => { current.reset(); particles.length = 0; });
$('editGame').addEventListener('click', () => current.edit?.());

// Jogos em que você também joga (Flappy) usam espaço, clique ou toque na tela.
const press = () => current.onPress?.();
canvas.addEventListener('pointerdown', press);
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { e.preventDefault(); press(); }
});

function updateObsUrl() {
  const u = new URL(location.origin + location.pathname);
  u.searchParams.set('clean', '1');
  u.searchParams.set('game', current.id);
  const user = (wantedUser || $('user').value).replace(/^@/, '');
  if (user) u.searchParams.set('user', user);
  $('obsUrl').textContent = u.toString();
}
$('user').addEventListener('input', updateObsUrl);

// ---------- Simulador ----------
const FAKE = ['ana', 'bruno', 'carla', 'davi', 'enzo', 'fernanda', 'gabi', 'heitor', 'isa', 'joao', 'lara', 'miguel', 'nina', 'otavio', 'paula', 'rafa'];
function fakeUser() { const n = pick(FAKE); return { id: 'sim_' + n, nick: n, pic: fakeFace(n) }; }
const GIFTS = { 1: ['Rosa', 1], 2: ['Rosquinha', 30], 3: ['Óculos', 199], 4: ['Galáxia', 1000] };
function simChat(str, user = fakeUser()) { handleEvent({ type: 'chat', user, text: str }); }
function simGift(tier, user = fakeUser()) {
  const [name, diamonds] = GIFTS[tier];
  handleEvent({ type: 'gift', user, name, count: 1, diamonds });
}
$('simChat').addEventListener('click', () => simChat($('simText').value || current.sample?.() || 'oi'));
$('simText').addEventListener('keydown', (e) => { if (e.key === 'Enter') simChat($('simText').value || current.sample?.() || 'oi'); });
$('simLike').addEventListener('click', () => handleEvent({ type: 'like', user: fakeUser(), count: 5 }));
document.querySelectorAll('[data-gift]').forEach((b) => b.addEventListener('click', () => simGift(Number(b.dataset.gift))));
let autoTimer = null;
$('simAuto').addEventListener('click', () => {
  $('simAuto').classList.toggle('on');
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; return; }
  autoTimer = setInterval(() => {
    const r = Math.random();
    if (r < 0.7) simChat(current.sample?.() || 'oi');
    else if (r < 0.92) handleEvent({ type: 'like', user: fakeUser(), count: 3 });
    else simGift(r < 0.97 ? 1 : r < 0.99 ? 2 : 3);
  }, 350);
});

// ---------- Tela sempre em 9:16 ----------
// O canvas é encaixado no espaço disponível mantendo 9:16: nunca estica nem achata.
function fitStage() {
  const stage = $('stage');
  let maxW, maxH;
  if (isClean) { maxW = window.innerWidth; maxH = window.innerHeight; }
  else {
    const top = stage.getBoundingClientRect().top + window.scrollY;
    maxW = stage.clientWidth;
    maxH = window.innerWidth <= 900 ? Infinity : window.innerHeight - top - 18;
    maxH = Math.max(maxH, 420);
  }
  let w = maxW, h = (w * 16) / 9;
  if (h > maxH) { h = maxH; w = (h * 9) / 16; }
  canvas.style.width = `${Math.floor(w)}px`;
  canvas.style.height = `${Math.floor(h)}px`;
}
window.addEventListener('resize', fitStage);
new ResizeObserver(fitStage).observe($('stage'));
fitStage();

// ---------- Loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  current.update(dt);
  updateParticles(dt);
  announcer.update(dt);
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.clearRect(0, 0, W, H);
  current.draw();
  drawParticles();
  announcer.draw();
  requestAnimationFrame(loop);
}
selectGame(current);
requestAnimationFrame(loop);

if (params.get('user')) { $('user').value = params.get('user'); connect(params.get('user')); }
