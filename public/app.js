'use strict';

// Execução: conexão com o servidor, eventos da live, troca de jogo, sincronização entre o painel e as telas da live
// (fonte Link do LIVE Studio, OBS e a janela "Tela da Live") e o laço de desenho. O painel de controle fica em lc/panel.js.

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const isClean = params.get('clean') === '1'; // só o jogo (OBS, fonte Link, janela Tela da Live)
const isMirror = params.get('mirror') === '1'; // janela Tela da Live aberta pelo painel
if (isClean) document.body.classList.add('clean');

// ---------- Conexão com o servidor ----------
let ws = null;
let wantedUser = '';
let reconnectTimer = null;
let viewerCount = 0;
let peers = { panels: 0, screens: 0 };
const bc = 'BroadcastChannel' in window ? new BroadcastChannel('jogos-live') : null;
let mirrorAlive = 0;
const mirrorOn = () => !isMirror && mirrorAlive > 0 && performance.now() - mirrorAlive < 5000;
function toMirror(msg) { if (bc && mirrorOn()) bc.postMessage(msg); }

function setStatus(state, msg) {
  const el = $('status');
  el.className = 'status ' + state;
  el.textContent = msg;
  el.title = msg;
  $('connectBtn').textContent = wantedUser ? 'Desconectar' : 'Conectar';
  window.onStatus?.(state);
}

function openSocket() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/ws`);
  ws.onopen = () => { if (wantedUser) ws.send(JSON.stringify({ type: 'connect', user: wantedUser, role: isClean ? 'screen' : 'panel' })); };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'status') {
      setStatus(msg.state, msg.message);
      if (msg.state === 'error') { wantedUser = ''; setStatus('error', msg.message); }
    } else if (msg.type === 'peers') {
      peers = msg;
      ai.leader = isMirror || msg.leader;
      updateAudioHere();
      window.onPeers?.(msg);
      // Chegou uma tela nova: o painel manda tudo de novo para ela
      if (!isClean) { pushConfigs(); sendControl({ action: 'game', id: current.id, seed: RNG.seed }); }
    } else if (msg.type === 'config') {
      applyConfigMsg(msg.key, msg.data);
    } else if (msg.type === 'control') {
      onControl(msg);
    } else if (msg.type === 'viewers') {
      viewerCount = msg.count;
      window.onViewers?.(msg.count);
      if (mirrorOn()) toMirror({ t: 'viewers', n: msg.count });
      else if (current.wantsPresence) current.onViewers?.(msg.count);
    } else {
      handleEvent(msg);
    }
  };
  ws.onclose = () => { if (wantedUser) { setStatus('connecting', 'Reconectando ao servidor…'); retry(3000); } };
}
function retry(ms) {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    if (!wantedUser) return;
    if (!ws || ws.readyState === WebSocket.CLOSED) openSocket();
    else if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'connect', user: wantedUser, role: isClean ? 'screen' : 'panel' }));
  }, ms);
}
function connect(user) {
  wantedUser = user.trim().replace(/^@/, '');
  if (!wantedUser) return;
  store.set('lastUser', wantedUser);
  setStatus('connecting', `Conectando a @${wantedUser}…`);
  if (!ws || ws.readyState === WebSocket.CLOSED) openSocket();
  else if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'connect', user: wantedUser, role: isClean ? 'screen' : 'panel' }));
  window.onConnectChange?.();
}
function disconnect() {
  wantedUser = '';
  clearTimeout(reconnectTimer);
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'disconnect' }));
  setStatus('idle', 'Desconectado');
  peers = { panels: 0, screens: 0 };
  ai.leader = true;
  updateAudioHere();
  window.onPeers?.(peers);
  window.onConnectChange?.();
}
$('connectForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (wantedUser) disconnect(); else connect($('user').value);
});

// Comandos do painel para as telas da live (servidor) e para a janela Tela da Live (BroadcastChannel).
function sendControl(msg) { if (ws && ws.readyState === WebSocket.OPEN && wantedUser) ws.send(JSON.stringify({ type: 'control', ...msg })); }
function busSend(bus) { sendControl({ action: 'bus', bus }); toMirror({ t: 'bus', bus }); if (isMirror) bc?.postMessage({ t: 'bus', bus }); }
// Executa aqui e manda para as outras telas.
function busDo(bus) { onBus(bus); busSend(bus); }

// Configurações: o painel guarda e repassa; a tela limpa só recebe.
function shareConfig(key, data) {
  toMirror({ t: 'config', key, data });
  if (!isClean && ws && ws.readyState === WebSocket.OPEN && wantedUser) ws.send(JSON.stringify({ type: 'config', key, data }));
}
function pushConfigs() {
  if (isClean) return;
  for (const g of GAMES) {
    if (g.v2) { shareConfig('set:' + g.id, g.s); shareConfig('bind:' + g.id, g.binds); }
    else if (g.configKey && store.get('cfg:' + g.configKey, null)) shareConfig(g.configKey, g.getConfig());
  }
  for (const k of ['alerts', 'effects', 'widgets', 'stream', 'dj', 'music']) if (liveCfg[k]) shareConfig('live:' + k, liveCfg[k]);
}
function applyConfigMsg(key, data) {
  if (applyRemoteConfig(key, data)) return;
  GAMES.find((g) => g.configKey === key)?.applyConfig(data);
}

function onControl(m) {
  const g = m.id && GAMES.find((x) => x.id === m.id);
  if (isClean) {
    if (m.action === 'game' && g) {
      // Mesmo jogo e mesma semente: nada muda (o painel reenvia isso quando alguém entra na sala).
      const fresh = g !== current || (Number.isInteger(m.seed) && m.seed !== RNG.seed);
      if (Number.isInteger(m.seed)) RNG.seed = m.seed;
      if (fresh) { g.reset(); selectGame(g, true); }
    }
    else if (m.action === 'reset') { if (Number.isInteger(m.seed)) RNG.seed = m.seed; resetCurrent(true); }
    else if (m.action === 'sim' && m.ev) handleEvent(m.ev);
    else if (m.action === 'press') current.onPress?.();
    else if (m.action === 'bus' && m.bus) onBus(m.bus);
  } else if (m.action === 'current' && g && g !== current && !m.join) selectGame(g, true);
  else if (m.action === 'bus' && m.bus) onBus(m.bus, true);
}

// Pacotes do painel: pausar, testar ação, DJ, música, alertas, shoutout, timer, pânico, respostas da IA.
let paused = false;
function onBus(b, fromScreen = false) {
  if (b.t === 'ai') return ai.receive(b.key, b.text);
  if (fromScreen) return; // a tela só manda respostas da IA para o painel
  if (b.t === 'pause') { paused = b.on; $('pausedTag').hidden = !paused; window.onPause?.(paused); }
  else if (b.t === 'action') { const g = GAMES.find((x) => x.id === b.game); if (g === current) testAction(g, b.id, b.coins || 1, b.user); }
  else if (b.t === 'fx') fx.test(b.kind);
  else if (b.t === 'alertTest') alerts.onEvent(b.ev);
  else if (b.t === 'shout') shoutout(b.user, b.msg);
  else if (b.t === 'say') voice.say(b.text, { voice: b.voice, prio: 'high' });
  else if (b.t === 'dj') djPad.play(b.id);
  else if (b.t === 'sound') playSound(b.src, b.ch || 'fx');
  else if (b.t === 'music') { if (b.cmd === 'play') music.start(); else if (b.cmd === 'stop') music.stop(); else if (b.cmd === 'next') music.next(); }
  else if (b.t === 'timer') widgets.timerCmd(b.id, b.cmd, b.v);
  else if (b.t === 'panic') { overlay.panic(); window.onPanic?.(); }
  else if (b.t === 'stats') stats.reset();
  else if (b.t === 'host') current.onHostCmd?.(b);
}

// O som sai só onde a live é capturada: com uma tela da live aberta, o painel fica mudo (a não ser que você peça).
function updateAudioHere() {
  if (isClean) return mixer.setHere(true);
  mixer.setHere(!(peers.screens > 0 || mirrorOn()) || Boolean(liveCfg.stream.audioOnPanel));
}

// ---------- Eventos ----------
function handleEvent(ev) {
  window.onFeed?.(ev);
  // Com a Tela da Live aberta, quem roda o jogo é ela: o painel só repassa o evento.
  if (mirrorOn()) { overlayOnly(ev); return toMirror({ t: 'ev', ev }); }
  overlay.onEvent(ev);
  if (ev.type === 'join') { if (current.wantsPresence || current.v2) current.v2 ? dispatchV2(ev) : current.onEvent(ev); return; }
  if (!current.v2 && (ev.type === 'gift' || ev.type === 'social')) giftMeter.push(ev);
  if (current.v2) dispatchV2(ev);
  else current.onEvent(ev);
}
// Painel com a janela Tela da Live aberta: conta a sessão, mas não desenha nem toca nada.
function overlayOnly(ev) { stats.onEvent(ev); }
function dispatchV2(ev) {
  if (paused) return;
  if (ev.type === 'chat' && current.onChat && canPlay(current, ev.user)) current.onChat(ev);
  current.onEvent?.(ev);
  runTriggers(current, ev);
}

// ---------- Troca de jogo ----------
let current = GAMES.find((g) => g.id === params.get('game')) || GAMES.find((g) => g.id === store.get('lastGame', '')) || GAMES[0];
for (const g of GAMES) { try { g.init?.(); g.reset(); } catch (err) { console.error('jogo', g.id, err); } }

function selectGame(game, remote = false) {
  const prev = current;
  current = game;
  if (prev !== game) prev?.leave?.();
  if (!isClean) store.set('lastGame', game.id);
  if (!remote && !isClean) RNG.seed = (Math.random() * 1e9) | 0;
  if (!remote && !isClean && prev !== game) game.reset();
  if (isMirror) bc?.postMessage({ t: 'current', id: game.id });
  else if (!remote) toMirror({ t: 'game', id: game.id, seed: RNG.seed, reset: true });
  if (isClean && !isMirror && !remote) sendControl({ action: 'current', id: game.id });
  else if (!isClean && !remote) sendControl({ action: 'game', id: game.id, seed: RNG.seed });
  particles.length = 0;
  announcer.items.length = 0;
  game.enter?.();
  window.onGameChange?.(game);
}
function resetCurrent(remote = false) {
  if (!remote && !isClean) { RNG.seed = (Math.random() * 1e9) | 0; toMirror({ t: 'reset', seed: RNG.seed }); sendControl({ action: 'reset', seed: RNG.seed }); }
  current.reset();
  particles.length = 0;
}
// Usado pela votação (e por jogos que trocam sozinhos).
function switchGameById(id) { const g = GAMES.find((x) => x.id === id); if (g) { g.reset(); selectGame(g); } }
$('resetGame').addEventListener('click', () => resetCurrent());

// Jogos em que você também joga (Flappy, Fruit Slice…) usam espaço, clique ou toque na tela.
const press = (e) => {
  if (!isClean) sendControl({ action: 'press' });
  if (mirrorOn()) return toMirror({ t: 'press' });
  current.onPress?.(e);
};
canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect();
  const p = { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  pointer.down = true; pointer.x = p.x; pointer.y = p.y;
  press(p);
});
const pointer = { down: false, x: 0, y: 0 };
canvas.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); pointer.x = (e.clientX - r.left) / r.width * W; pointer.y = (e.clientY - r.top) / r.height * H; current.onPointer?.(pointer); });
window.addEventListener('pointerup', () => { pointer.down = false; });
document.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); press(null); }
  current.onKey?.(e.code, true);
});
document.addEventListener('keyup', (e) => current.onKey?.(e.code, false));

// ---------- Simulador ----------
const FAKE = ['ana', 'bruno', 'carla', 'davi', 'enzo', 'fernanda', 'gabi', 'heitor', 'isa', 'joao', 'lara', 'miguel', 'nina', 'otavio', 'paula', 'rafa', 'sofia', 'theo', 'vitoria', 'yasmin', 'lucas_gamer', 'bia.oficial', 'pedrinho', 'mari_ss'];
function fakeUser() { const n = pick(FAKE); return { id: 'sim_' + n, nick: n, pic: fakeFace(n), fol: Math.random() < 0.6 }; }
const GIFTS = { 1: ['Rosa', 1], 2: ['Rosquinha', 30], 3: ['Mãos em coração', 100], 4: ['Bons Presságios', 1500] };
const GIFT_SHOP = [['🌹', 'Rosa', 1, '5655'], ['⚽', 'Bola de futebol', 5], ['❤️', 'Coração', 10], ['🍩', 'Rosquinha', 30, '5879'], ['🤠', 'Chapéu e Bigode', 99], ['🫶', 'Mãos em coração', 100], ['🍬', 'Festa dos Doces', 3999], ['🌟', 'Estrelas do TikTok', 39999]];
function sim(ev) { handleEvent(ev); sendControl({ action: 'sim', ev }); }
function simChat(str, user = fakeUser()) { sim({ type: 'chat', user, text: str }); }
function simGift(tier, user = fakeUser(), count = 1) {
  const [name, diamonds, giftId] = typeof tier === 'object' ? tier : GIFTS[tier];
  sim({ type: 'gift', user, name, count, diamonds, giftId: giftId || '' });
}
let autoTimer = null;
function simAuto(on) {
  clearInterval(autoTimer); autoTimer = null;
  if (!on) return;
  autoTimer = setInterval(() => {
    const r = Math.random();
    if (r < 0.06) sim({ type: 'join', user: fakeUser() });
    else if (r < 0.7) simChat(current.sample?.() || pick(['oi', 'bora', 'kkkk', 'top demais', 'manda mais']));
    else if (r < 0.9) sim({ type: 'like', user: fakeUser(), count: randInt(1, 15) });
    else if (r < 0.92) sim({ type: 'social', user: fakeUser(), action: r < 0.91 ? 'follow' : 'share' });
    else { const g = GIFT_SHOP[r < 0.96 ? randInt(0, 2) : r < 0.99 ? randInt(3, 5) : randInt(6, 7)]; simGift([g[1], g[2], g[3]], fakeUser(), r < 0.95 && Math.random() < 0.3 ? randInt(2, 10) : 1); }
  }, 350);
}

// ---------- Tela sempre em 9:16 ----------
const SIDE_W = 330, VIEW_MIN = 420, RAIL_W = 74, GAP = 16;
function fitStage() {
  const box = $('stageBox');
  let maxW, maxH;
  if (isClean) { maxW = window.innerWidth; maxH = window.innerHeight; }
  else if (window.innerWidth <= 900) { maxW = Math.min(window.innerWidth - 32, 540); maxH = Infinity; }
  else {
    const sideW = window.innerWidth >= 1500 ? SIDE_W : 0;
    maxW = window.innerWidth - RAIL_W - VIEW_MIN - sideW - GAP * 4;
    maxH = window.innerHeight - box.getBoundingClientRect().top - 60;
    maxH = Math.max(maxH, 420);
  }
  let w = maxW, h = (w * 16) / 9;
  if (h > maxH) { h = maxH; w = (h * 9) / 16; }
  w = Math.floor(w); h = Math.floor(h);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  box.style.width = `${w}px`;
  box.style.height = `${h}px`;
  $('ovl').style.transform = `scale(${w / W})`;
}
$('stage').addEventListener('wheel', (e) => { if (e.target.closest('#stageBox') && (window.innerWidth > 900 || isClean)) e.preventDefault(); }, { passive: false });
window.addEventListener('resize', fitStage);
fitStage();

// ---------- Laço ----------
let last = performance.now();
let pausedDrawn = false;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (mirrorOn()) { if (!pausedDrawn) drawPaused(); requestAnimationFrame(loop); return; }
  pausedDrawn = false;
  try {
    if (!paused) { current.update(dt); updateParticles(dt); announcer.update(dt); giftMeter.update(dt); }
    overlay.update(dt);
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, W, H);
    current.draw();
    drawParticles();
    announcer.draw();
    if (!current.v2) giftMeter.draw(current.meterY ?? 200);
    else drawGuide(current);
    overlay.draw();
  } catch (err) { console.error(err); }
  requestAnimationFrame(loop);
}
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

// ---------- Janela Tela da Live ----------
function syncMirror() {
  for (const g of GAMES) {
    if (g.v2) { bc.postMessage({ t: 'config', key: 'set:' + g.id, data: g.s }); bc.postMessage({ t: 'config', key: 'bind:' + g.id, data: g.binds }); }
    else if (g.configKey && g.getConfig) bc.postMessage({ t: 'config', key: g.configKey, data: g.getConfig() });
  }
  for (const k of ['alerts', 'effects', 'widgets', 'stream', 'dj', 'music']) if (liveCfg[k]) bc.postMessage({ t: 'config', key: 'live:' + k, data: liveCfg[k] });
  bc.postMessage({ t: 'game', id: current.id, seed: RNG.seed, reset: true });
  if (viewerCount) bc.postMessage({ t: 'viewers', n: viewerCount });
  if (paused) bc.postMessage({ t: 'bus', bus: { t: 'pause', on: true } });
}
if (bc) bc.onmessage = ({ data: m }) => {
  if (isMirror) {
    if (m.t === 'ev') handleEvent(m.ev);
    else if (m.t === 'game') { const g = GAMES.find((x) => x.id === m.id); if (g) { if (Number.isInteger(m.seed)) RNG.seed = m.seed; if (m.reset) g.reset(); if (g !== current) selectGame(g, true); } }
    else if (m.t === 'reset') { if (Number.isInteger(m.seed)) RNG.seed = m.seed; resetCurrent(true); }
    else if (m.t === 'config') applyConfigMsg(m.key, m.data);
    else if (m.t === 'viewers') { viewerCount = m.n; if (current.wantsPresence) current.onViewers?.(m.n); }
    else if (m.t === 'press') current.onPress?.();
    else if (m.t === 'bus') onBus(m.bus);
    return;
  }
  if (m.t === 'hello' || m.t === 'beat') {
    const was = mirrorOn();
    mirrorAlive = performance.now();
    if (!was || m.t === 'hello') { syncMirror(); updateAudioHere(); window.onMirror?.(true); }
  } else if (m.t === 'bye') { mirrorAlive = 0; updateAudioHere(); window.onMirror?.(false); }
  else if (m.t === 'current') { const g = GAMES.find((x) => x.id === m.id); if (g && g !== current) selectGame(g, true); }
  else if (m.t === 'bus' && m.bus?.t === 'ai') ai.receive(m.bus.key, m.bus.text);
};
if (isMirror && bc) {
  document.title = 'Tela da Live';
  bc.postMessage({ t: 'hello' });
  setInterval(() => bc.postMessage({ t: 'beat' }), 1000);
  addEventListener('pagehide', () => bc.postMessage({ t: 'bye' }));
}
setInterval(() => { if (!isMirror && mirrorAlive && !mirrorOn()) { mirrorAlive = 0; updateAudioHere(); window.onMirror?.(false); } }, 1000);
function openMirror(light) {
  const u = new URL(location.origin + location.pathname);
  u.searchParams.set('clean', '1'); u.searchParams.set('mirror', '1'); u.searchParams.set('game', current.id);
  if (light) u.searchParams.set('leve', '1');
  const win = window.open(u.toString(), 'telaDaLive', 'popup=yes,width=540,height=960');
  if (!win) setStatus('error', 'O navegador bloqueou a janela. Permita pop-ups para este site.');
  else win.focus();
}
function obsUrl() {
  const u = new URL(location.origin + location.pathname);
  u.searchParams.set('clean', '1');
  u.searchParams.set('game', current.id);
  const user = (wantedUser || $('user').value || '').replace(/^@/, '');
  if (user) u.searchParams.set('user', user);
  return u.toString();
}

ai.leader = true;
widgets.render();
updateAudioHere();
selectGame(current, isClean);
requestAnimationFrame(loop);
if (params.get('user')) { $('user').value = params.get('user'); connect(params.get('user')); }
