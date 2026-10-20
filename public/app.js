'use strict';

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

if (params.get('clean') === '1') document.body.classList.add('clean');

// ---------- Conexão com o servidor ----------
let ws = null;
let wantedUser = '';
let reconnectTimer = null;
let viewerCount = 0; // espectadores na live agora (vem do TikTok)
const isMirror = params.get('mirror') === '1'; // esta página é a Tela da Live (janela separada)
const bc = 'BroadcastChannel' in window ? new BroadcastChannel('jogos-live') : null;
let mirrorAlive = 0; // painel: último sinal recebido da Tela da Live
const mirrorOn = () => !isMirror && performance.now() - mirrorAlive < 5000;
function toMirror(msg) { if (bc && mirrorOn()) bc.postMessage(msg); }

function setStatus(state, msg) {
  const el = $('status');
  el.className = 'status ' + state;
  el.textContent = msg;
  el.title = msg; // mensagem longa fica numa linha só (a barra não muda de altura e a tela do jogo não se mexe)
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
      viewerCount = msg.count;
      if (mirrorOn()) toMirror({ t: 'viewers', n: msg.count });
      else if (current.wantsPresence) current.onViewers?.(msg.count);
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
  toMirror({ t: 'config', key, data });
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
  while (feed.children.length > 150) feed.lastChild.remove();
}

function handleEvent(ev) {
  const who = ev.user?.nick || 'anônimo';
  if (ev.type === 'chat') addFeed(`💬 ${who}: ${ev.text}`);
  else if (ev.type === 'like') addFeed(`❤️ ${who} curtiu ×${ev.count}`);
  else if (ev.type === 'gift') addFeed(`🎁 ${who} enviou ${ev.name} ×${ev.count} (${ev.diamonds} moedas)`);
  else if (ev.type === 'social') addFeed(ev.action === 'share' ? `🔁 ${who} compartilhou a live` : `⭐ ${who} seguiu`);
  else if (ev.type === 'join') {
    if (current.wantsPresence) addFeed(`👋 ${who} entrou na live`);
    if (mirrorOn()) return toMirror({ t: 'ev', ev });
    if (current.wantsPresence) current.onEvent(ev);
    return;
  } else return;
  // Com a Tela da Live aberta, quem roda o jogo é ela: o painel só repassa o evento.
  if (mirrorOn()) return toMirror({ t: 'ev', ev });
  if (ev.type === 'gift' || ev.type === 'social') giftMeter.push(ev);
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

let followingMirror = false;
function selectGame(game) {
  current = game;
  if (isMirror) bc?.postMessage({ t: 'current', id: game.id });
  else if (!followingMirror) toMirror({ t: 'game', id: game.id });
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
function switchGameById(id) { const g = GAMES.find((x) => x.id === id); if (g) { g.reset(); selectGame(g); toMirror({ t: 'reset' }); } }
$('resetGame').addEventListener('click', () => { current.reset(); particles.length = 0; toMirror({ t: 'reset' }); });
$('editGame').addEventListener('click', () => current.edit?.());

// Jogos em que você também joga (Flappy) usam espaço, clique ou toque na tela.
const press = () => (mirrorOn() ? toMirror({ t: 'press' }) : current.onPress?.());
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
// Presentes reais da loja do TikTok (preço em moedas). As teclas 1–4 antigas continuam valendo uma de cada faixa.
const GIFTS = { 1: ['Rosa', 1], 2: ['Rosquinha', 30], 3: ['Mãos em coração', 100], 4: ['Bons Presságios', 1500] };
const GIFT_SHOP = [['🌹', 'Rosa', 1], ['⚽', 'Bola de futebol', 5], ['❤️', 'Coração', 10], ['🍩', 'Rosquinha', 30], ['🤠', 'Chapéu e Bigode', 99], ['🫶', 'Mãos em coração', 100], ['🍬', 'Festa dos Doces', 3999], ['🌟', 'Estrelas do TikTok', 39999]];
function simChat(str, user = fakeUser()) { handleEvent({ type: 'chat', user, text: str }); }
function simGift(tier, user = fakeUser(), count = 1) {
  const [name, diamonds] = typeof tier === 'object' ? tier : GIFTS[tier];
  handleEvent({ type: 'gift', user, name, count, diamonds });
}
$('simChat').addEventListener('click', () => simChat($('simText').value || current.sample?.() || 'oi'));
$('simText').addEventListener('keydown', (e) => { if (e.key === 'Enter') simChat($('simText').value || current.sample?.() || 'oi'); });
$('simLike').addEventListener('click', () => handleEvent({ type: 'like', user: fakeUser(), count: 5 }));
$('simJoin').addEventListener('click', () => handleEvent({ type: 'join', user: fakeUser() }));
document.querySelectorAll('[data-gift]').forEach((b) => b.addEventListener('click', () => simGift(Number(b.dataset.gift))));
$('simShop').innerHTML = GIFT_SHOP.map(([e, n, c], i) => `<button data-shop="${i}" title="${n} (${c} moedas)">${e}<small>${c >= 1000 ? Math.round(c / 1000) + 'k' : c}</small></button>`).join('');
document.querySelectorAll('[data-shop]').forEach((b) => b.addEventListener('click', () => {
  const [, n, c] = GIFT_SHOP[b.dataset.shop];
  simGift([n, c], fakeUser(), Math.max(1, Number($('simCombo').value) || 1));
}));
$('simFollow').addEventListener('click', () => handleEvent({ type: 'social', user: fakeUser(), action: 'follow' }));
$('simShare').addEventListener('click', () => handleEvent({ type: 'social', user: fakeUser(), action: 'share' }));
let autoTimer = null;
$('simAuto').addEventListener('click', () => {
  $('simAuto').classList.toggle('on');
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; return; }
  autoTimer = setInterval(() => {
    const r = Math.random();
    if (r < 0.06) handleEvent({ type: 'join', user: fakeUser() });
    else if (r < 0.7) simChat(current.sample?.() || 'oi');
    else if (r < 0.9) handleEvent({ type: 'like', user: fakeUser(), count: randInt(1, 15) });
    else if (r < 0.92) handleEvent({ type: 'social', user: fakeUser(), action: r < 0.91 ? 'follow' : 'share' });
    else { const g = GIFT_SHOP[r < 0.96 ? randInt(0, 2) : r < 0.99 ? randInt(3, 5) : randInt(6, 7)]; simGift([g[1], g[2]], fakeUser(), r < 0.95 && Math.random() < 0.3 ? randInt(2, 10) : 1); }
  }, 350);
});

// ---------- Tela sempre em 9:16 ----------
// O canvas é encaixado no espaço disponível mantendo 9:16: nunca estica nem achata.
// No computador a tela do jogo fica fixa à esquerda: só a coluna da direita rola.
// O tamanho depende apenas da janela, então nada na página (avisos, painéis, rolagem) a move durante o espelhamento.
const ASIDE_W = 640, GAP = 18; // espaço mínimo para as colunas de controle à direita
function fitStage() {
  const stage = $('stage');
  let maxW, maxH;
  if (isClean) { maxW = window.innerWidth; maxH = window.innerHeight; }
  else if (window.innerWidth <= 900) { maxW = stage.clientWidth; maxH = Infinity; }
  else {
    maxW = window.innerWidth - ASIDE_W - GAP * 3;
    maxH = window.innerHeight - $('stage').getBoundingClientRect().top - GAP;
    maxH = Math.max(maxH, 420);
  }
  let w = maxW, h = (w * 16) / 9;
  if (h > maxH) { h = maxH; w = (h * 9) / 16; }
  canvas.style.width = `${Math.floor(w)}px`;
  canvas.style.height = `${Math.floor(h)}px`;
}
// A roda do mouse em cima do jogo não faz nada (nem rola a página).
$('stage').addEventListener('wheel', (e) => { if (window.innerWidth > 900 || isClean) e.preventDefault(); }, { passive: false });
window.addEventListener('resize', fitStage);
fitStage();

// ---------- Loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  // Tela da Live aberta: o painel não desenha o jogo (deixa a placa de vídeo livre para ela e para a live)
  if (mirrorOn()) { if (!pausedDrawn) drawPaused(); requestAnimationFrame(loop); return; }
  pausedDrawn = false;
  current.update(dt);
  updateParticles(dt);
  announcer.update(dt);
  giftMeter.update(dt);
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.clearRect(0, 0, W, H);
  current.draw();
  drawParticles();
  announcer.draw();
  giftMeter.draw(current.meterY ?? 200);
  requestAnimationFrame(loop);
}
// ---------- Tela da Live: janela separada só com o jogo ----------
// O painel (esta página) recebe a live e manda tudo para a janela da live pelo BroadcastChannel.
// A janela roda o jogo sozinha; o painel para de desenhar enquanto ela estiver aberta.
let pausedDrawn = false;
function drawPaused() {
  pausedDrawn = true;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.fillStyle = '#07080d'; ctx.fillRect(0, 0, W, H);
  title('TELA DA LIVE ABERTA', W / 2, H / 2 - 60, 54, '#22e3ee');
  label('O jogo está rodando na outra janela.', W / 2, H / 2 + 10, 24, '#fff', 'center', 700);
  label('Comentários, presentes, simulador e configurações', W / 2, H / 2 + 56, 20, 'rgba(255,255,255,.7)', 'center', 600);
  label('daqui vão direto para ela.', W / 2, H / 2 + 86, 20, 'rgba(255,255,255,.7)', 'center', 600);
  label('Feche a janela para voltar a jogar aqui.', W / 2, H / 2 + 150, 18, 'rgba(255,255,255,.5)', 'center', 600);
}
function syncMirror() {
  for (const g of GAMES) if (g.configKey && g.getConfig) bc.postMessage({ t: 'config', key: g.configKey, data: g.getConfig() });
  bc.postMessage({ t: 'game', id: current.id, reset: true });
  if (viewerCount) bc.postMessage({ t: 'viewers', n: viewerCount });
}
if (bc) bc.onmessage = ({ data: m }) => {
  if (isMirror) {
    if (m.t === 'ev') handleEvent(m.ev);
    else if (m.t === 'game') { const g = GAMES.find((x) => x.id === m.id); if (g) { if (m.reset) g.reset(); if (g !== current) selectGame(g); } }
    else if (m.t === 'reset') { current.reset(); particles.length = 0; }
    else if (m.t === 'config') GAMES.find((g) => g.configKey === m.key)?.applyConfig(m.data);
    else if (m.t === 'viewers') { viewerCount = m.n; if (current.wantsPresence) current.onViewers?.(m.n); }
    else if (m.t === 'press') current.onPress?.();
    return;
  }
  if (m.t === 'hello' || m.t === 'beat') {
    const was = mirrorOn();
    mirrorAlive = performance.now();
    if (!was || m.t === 'hello') { syncMirror(); $('mirrorBtn').textContent = '✅ Tela da Live aberta'; }
  } else if (m.t === 'bye') { mirrorAlive = 0; $('mirrorBtn').textContent = '🖥️ Abrir Tela da Live'; }
  else if (m.t === 'current') {
    // A janela trocou de jogo sozinha (ex.: fim da votação): o painel acompanha
    const g = GAMES.find((x) => x.id === m.id);
    if (g && g !== current) { followingMirror = true; selectGame(g); followingMirror = false; }
  }
};
if (isMirror && bc) {
  document.title = 'Tela da Live';
  bc.postMessage({ t: 'hello' });
  setInterval(() => bc.postMessage({ t: 'beat' }), 1000);
  addEventListener('pagehide', () => bc.postMessage({ t: 'bye' }));
}
setInterval(() => { if (!isMirror && mirrorAlive && !mirrorOn()) { mirrorAlive = 0; $('mirrorBtn').textContent = '🖥️ Abrir Tela da Live'; } }, 1000);
$('mirrorBtn').addEventListener('click', () => {
  const u = new URL(location.origin + location.pathname);
  u.searchParams.set('clean', '1'); u.searchParams.set('mirror', '1'); u.searchParams.set('game', current.id);
  if ($('mirrorLight').checked) u.searchParams.set('leve', '1');
  const win = window.open(u.toString(), 'telaDaLive', 'popup=yes,width=540,height=960');
  if (!win) toast2('O navegador bloqueou a janela. Permita pop-ups para este site.');
  else win.focus();
});
function toast2(msg) { setStatus('error', msg); }

selectGame(current);
requestAnimationFrame(loop);

if (params.get('user')) { $('user').value = params.get('user'); connect(params.get('user')); }
