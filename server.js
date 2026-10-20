import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

const PORT = Number(process.env.PORT) || 3000;
const SIGN_API_KEY = process.env.SIGN_API_KEY || undefined;
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const USERNAME_RE = /^[a-zA-Z0-9_.]{2,24}$/;
const THREE_PATH = fileURLToPath(new URL('./node_modules/three/build/three.module.min.js', import.meta.url));
const IMG_HOSTS = ['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com', 'ibyteimg.com', 'muscdn.com', 'byteimg.com', 'rbxcdn.com'];
const imgCache = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Busca o avatar Roblox de um nick pela API pública da Roblox, com cache e limite de pedidos.
const robloxCache = new Map(); // nick minúsculo -> { name, img } ou null
let robloxBudget = 10;
setInterval(() => (robloxBudget = 10), 2000);

async function robloxAvatar(nick) {
  const key = nick.toLowerCase();
  if (robloxCache.has(key)) return robloxCache.get(key);
  if (robloxBudget <= 0) throw new Error('busy');
  robloxBudget--;
  const users = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ usernames: [nick], excludeBannedUsers: true }),
    signal: AbortSignal.timeout(8000),
  }).then((r) => r.json());
  const user = users?.data?.[0];
  let result = null;
  if (user) {
    for (let attempt = 0; attempt < 3 && !result; attempt++) {
      const thumb = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${user.id}&size=720x720&format=Png&isCircular=false`, { signal: AbortSignal.timeout(8000) }).then((r) => r.json());
      const t = thumb?.data?.[0];
      if (t?.state === 'Completed' && t.imageUrl) result = { name: user.name, display: user.displayName, img: t.imageUrl };
      else await new Promise((r) => setTimeout(r, 1200));
    }
  }
  if (robloxCache.size > 5000) robloxCache.clear();
  robloxCache.set(key, result);
  return result;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('ok');
  }
  if (url.pathname === '/api/diag') {
    // Diagnóstico: tenta achar a sala de um @ e mostra o resultado de cada fonte.
    const user = (url.searchParams.get('u') || '').replace(/^@/, '').toLowerCase();
    res.writeHead(200, { 'content-type': 'application/json' });
    if (!USERNAME_RE.test(user)) return res.end(JSON.stringify({ error: 'usuário inválido' }));
    const conn = new TikTokLiveConnection(user, { signApiKey: SIGN_API_KEY });
    conn.on('error', () => {});
    try {
      const roomId = await conn.fetchRoomId();
      let live = null;
      try { live = await conn.fetchIsLive(); } catch (e) { live = `erro: ${e.message}`; }
      return res.end(JSON.stringify({ user, roomId, live, signKey: Boolean(SIGN_API_KEY) }));
    } catch (err) {
      return res.end(JSON.stringify({ user, error: err?.message, details: detailErrors(err), signKey: Boolean(SIGN_API_KEY) }));
    }
  }
  if (url.pathname === '/vendor/three.module.min.js') {
    const body = await fs.readFile(THREE_PATH);
    res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'public, max-age=86400' });
    return res.end(body);
  }
  if (url.pathname === '/api/img') {
    // Repassa fotos de perfil (TikTok/Roblox) com CORS liberado, para poderem virar textura no 3D.
    let target;
    try { target = new URL(url.searchParams.get('u') || ''); } catch { res.writeHead(400); return res.end(); }
    if (target.protocol !== 'https:' || !IMG_HOSTS.some((h) => target.hostname === h || target.hostname.endsWith('.' + h))) { res.writeHead(403); return res.end(); }
    const cached = imgCache.get(target.href);
    const send = (img) => { res.writeHead(200, { 'content-type': img.type, 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=3600' }); res.end(img.body); };
    if (cached) return send(cached);
    try {
      const r = await fetch(target, { signal: AbortSignal.timeout(8000) });
      const type = r.headers.get('content-type') || '';
      if (!r.ok || !type.startsWith('image/')) { res.writeHead(502); return res.end(); }
      const body = Buffer.from(await r.arrayBuffer());
      if (body.length > 2_000_000) { res.writeHead(413); return res.end(); }
      if (imgCache.size > 500) imgCache.delete(imgCache.keys().next().value);
      const img = { type, body };
      imgCache.set(target.href, img);
      return send(img);
    } catch { res.writeHead(502); return res.end(); }
  }
  if (url.pathname === '/api/roblox') {
    const nick = url.searchParams.get('u') || '';
    const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (!/^[A-Za-z0-9_]{3,20}$/.test(nick)) return send(400, { error: 'nick inválido' });
    try {
      const r = await robloxAvatar(nick);
      return r ? send(200, r) : send(404, { error: 'não encontrado' });
    } catch (err) {
      return send(err.message === 'busy' ? 429 : 502, { error: err.message });
    }
  }
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end();
  }
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Não encontrado');
  }
});

// Junta as mensagens das tentativas internas (HTML, API e Euler) para o log e o diagnóstico.
function detailErrors(err, depth = 0) {
  if (!err || depth > 3) return [];
  const inner = err.config?.requestErrs || err.requestErrs || err.errors || (err.exception ? [err.exception] : []);
  const out = [];
  for (const e of inner) out.push(`${e?.name || 'Error'}: ${e?.message || e}`, ...detailErrors(e, depth + 1));
  return out;
}

// Uma conexão com o TikTok por @, compartilhada por todos os navegadores que pedirem o mesmo @.
const rooms = new Map(); // username -> { conn, clients: Set<ws>, ready: Promise }

function userInfo(u) {
  return {
    id: u?.uniqueId || '',
    nick: u?.nickname || u?.uniqueId || 'anônimo',
    pic: u?.profilePicture?.url?.[0] || '',
  };
}

function broadcast(room, msg) {
  const data = JSON.stringify(msg);
  for (const ws of room.clients) if (ws.readyState === ws.OPEN) ws.send(data);
}

function closeRoom(username) {
  const room = rooms.get(username);
  if (!room) return;
  rooms.delete(username);
  room.conn.disconnect().catch(() => {});
}

function openRoom(username) {
  const conn = new TikTokLiveConnection(username, {
    processInitialData: false,
    enableExtendedGiftInfo: true,
    signApiKey: SIGN_API_KEY,
  });
  const room = { conn, clients: new Set(), state: null, configs: {} };
  rooms.set(username, room);

  conn.on(WebcastEvent.CHAT, (d) => broadcast(room, { type: 'chat', user: userInfo(d.user), text: d.comment || '' }));
  conn.on(WebcastEvent.LIKE, (d) => broadcast(room, { type: 'like', user: userInfo(d.user), count: d.likeCount || 1 }));
  conn.on(WebcastEvent.GIFT, (d) => {
    // Presentes em sequência (giftType 1) só contam quando a sequência termina.
    if (d.giftDetails?.giftType === 1 && !d.repeatEnd) return;
    broadcast(room, {
      type: 'gift',
      user: userInfo(d.user),
      name: d.giftDetails?.giftName || d.extendedGiftInfo?.name || 'Presente',
      count: d.repeatCount || 1,
      diamonds: d.giftDetails?.diamondCount || d.extendedGiftInfo?.diamond_count || 1,
    });
  });
  // Seguir e compartilhar chegam separados (o conector já filtra o SOCIAL por tipo).
  conn.on(WebcastEvent.FOLLOW, (d) => broadcast(room, { type: 'social', user: userInfo(d.user), action: 'follow' }));
  conn.on(WebcastEvent.SHARE, (d) => broadcast(room, { type: 'social', user: userInfo(d.user), action: 'share' }));
  conn.on(WebcastEvent.MEMBER, (d) => broadcast(room, { type: 'join', user: userInfo(d.user) }));
  conn.on(WebcastEvent.ROOM_USER, (d) => broadcast(room, { type: 'viewers', count: d.viewerCount || 0 }));
  conn.on(WebcastEvent.STREAM_END, () => {
    broadcast(room, { type: 'status', state: 'ended', message: 'A live terminou.' });
    closeRoom(username);
  });
  conn.on(ControlEvent.DISCONNECTED, () => {
    if (rooms.get(username) !== room) return;
    broadcast(room, { type: 'status', state: 'disconnected', message: 'Conexão com o TikTok caiu.' });
    rooms.delete(username);
  });
  conn.on(ControlEvent.ERROR, ({ info }) => console.error(`[${username}] erro:`, info));

  room.ready = conn.connect().then(
    (state) => {
      room.state = { state: 'connected', message: `Conectado à live de @${username}`, roomId: state.roomId };
      broadcast(room, { type: 'status', ...room.state });
      console.log(`[${username}] conectado, sala ${state.roomId}`);
    },
    (err) => {
      const details = detailErrors(err).join(' | ');
      const offline = err?.name === 'UserOfflineError' || /offline|not live|isn't online|user_not_found|SIGI_STATE/i.test(`${err?.message} ${details}`);
      const message = offline
        ? `Nenhuma live aberta em @${username} agora. Entre ao vivo no TikTok primeiro — vou tentando de novo sozinho.`
        : `Não foi possível conectar: ${err?.message || err}`;
      console.error(`[${username}] falha ao conectar:`, err?.message || err, details);
      broadcast(room, { type: 'status', state: offline ? 'offline' : 'error', message });
      rooms.delete(username);
    }
  );
  return room;
}

function leave(ws) {
  if (!ws.username) return;
  const room = rooms.get(ws.username);
  if (room) {
    room.clients.delete(ws);
    if (room.clients.size === 0) closeRoom(ws.username);
  }
  ws.username = null;
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4 * 1024 * 1024 });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'connect') {
      const username = String(msg.user || '').trim().replace(/^@/, '').toLowerCase();
      if (!USERNAME_RE.test(username)) {
        return ws.send(JSON.stringify({ type: 'status', state: 'error', message: 'Usuário inválido.' }));
      }
      leave(ws);
      ws.username = username;
      const room = rooms.get(username) || openRoom(username);
      room.clients.add(ws);
      for (const [key, data] of Object.entries(room.configs)) ws.send(JSON.stringify({ type: 'config', key, data }));
      ws.send(JSON.stringify(room.state ? { type: 'status', ...room.state } : { type: 'status', state: 'connecting', message: `Conectando a @${username}…` }));
    } else if (msg.type === 'config') {
      // Configuração de um jogo (fotos, nomes) repassada às outras telas do mesmo @, como a fonte do OBS.
      const room = ws.username && rooms.get(ws.username);
      if (!room || typeof msg.key !== 'string' || !/^[a-z]{1,20}$/.test(msg.key)) return;
      room.configs[msg.key] = msg.data;
      const data = JSON.stringify({ type: 'config', key: msg.key, data: msg.data });
      for (const other of room.clients) if (other !== ws && other.readyState === other.OPEN) other.send(data);
    } else if (msg.type === 'disconnect') {
      leave(ws);
      ws.send(JSON.stringify({ type: 'status', state: 'idle', message: 'Desconectado.' }));
    }
  });
  ws.on('close', () => leave(ws));
});

// Ping a cada 30s mantém o WebSocket vivo atrás do proxy do Render e limpa clientes mortos.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

server.listen(PORT, () => console.log(`Jogos interativos em http://localhost:${PORT}`));
