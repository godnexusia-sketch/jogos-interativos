import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import os from 'node:os';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import Anthropic from '@anthropic-ai/sdk';
import { userInfo, giftInfo } from './lib/eventos.js';
import * as contas from './lib/contas.js';

const PORT = Number(process.env.PORT) || 3000;
const SIGN_API_KEY = process.env.SIGN_API_KEY || undefined;
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const USERNAME_RE = /^[a-zA-Z0-9_.]{2,24}$/;
const THREE_PATH = fileURLToPath(new URL('./node_modules/three/build/three.module.min.js', import.meta.url));
const THREE_JSM = fileURLToPath(new URL('./node_modules/three/examples/jsm', import.meta.url));
const IMG_HOSTS = ['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com', 'ibyteimg.com', 'muscdn.com', 'byteimg.com', 'rbxcdn.com',
  'ibytedtos.com', 'ttwstatic.com', 'tiktokv.com', 'tiktokv.us', 'tiktok.com', 'byteoversea.com', 'bytecdn.cn', 'tiktokcdn-eu.com', 'tiktokw.us',
  'flagcdn.com', 'ytimg.com', 'wikimedia.org', 'www.google.com', 'gstatic.com', 'mc-heads.net', 'crafatar.com'];
// Diagnóstico das fotos (/api/img-stats): quantas deram certo, as últimas falhas e sites recusados.
const imgStats = { ok: 0, fail: 0, last: [], denied: {}, semFoto: 0 };
// Pessoa do evento; conta (e mostra no log as primeiras) as que chegam sem foto nenhuma
function userOf(u, d) {
  const x = userInfo(u, d);
  if (!x.pic) { imgStats.semFoto++; if (imgStats.semFoto <= 3) console.warn('evento sem foto, campos do usuário:', Object.keys(u || {}).join(',').slice(0, 300)); }
  return x;
}
function imgLog(target, why) {
  imgStats.fail++;
  imgStats.last.unshift({ host: target.hostname, why: String(why), t: new Date().toISOString() });
  imgStats.last.length = Math.min(imgStats.last.length, 20);
  if (imgStats.fail <= 5 || imgStats.fail % 50 === 0) console.warn(`foto falhou (${why}) em ${target.hostname} — total ${imgStats.fail}`);
}
const MEDIA_DIR = path.join(os.tmpdir(), 'jogos-media');
const MEDIA_MAX = 60 * 1024 * 1024;
const imgCache = new Map();
const imgFail = new Map();
function sniffImage(b) {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  if (b.slice(0, 3).toString() === 'GIF') return 'image/gif';
  if (b.slice(4, 12).toString().startsWith('ftypavif')) return 'image/avif';
  return '';
}
const wikiCache = new Map();
const UA = 'JogosInterativos/1.0 (jogos para lives; contato pelo GitHub godnexusia-sketch)';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.txt': 'text/plain; charset=utf-8',
};
// Arquivos de texto e modelos 3D vão comprimidos (gzip), guardados prontos na memória.
const GZIP_EXT = new Set(['.html', '.js', '.css', '.json', '.svg', '.glb', '.txt']);
const gzCache = new Map();
async function sendStatic(req, res, file, cache = 'no-cache') {
  const ext = path.extname(file);
  const st = await fs.stat(file);
  const head = { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': cache, vary: 'accept-encoding' };
  if (GZIP_EXT.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    let c = gzCache.get(file);
    if (!c || c.mtime !== st.mtimeMs) { c = { mtime: st.mtimeMs, body: zlib.gzipSync(await fs.readFile(file), { level: 6 }) }; gzCache.set(file, c); }
    res.writeHead(200, { ...head, 'content-encoding': 'gzip', 'content-length': c.body.length });
    return res.end(c.body);
  }
  res.writeHead(200, { ...head, 'content-length': st.size });
  res.end(await fs.readFile(file));
}
const MEDIA_EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'audio/mpeg': '.mp3', 'audio/mp3': '.mp3',
  'audio/ogg': '.ogg', 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'video/mp4': '.mp4', 'video/webm': '.webm' };
const MEDIA_TYPE = Object.fromEntries(Object.entries(MEDIA_EXT).map(([t, e]) => [e, t]));

// ---------- Voz (TTS neural da Microsoft Edge, grátis) ----------
// Gera MP3 no servidor: o áudio sai pela própria página, então o OBS e o LIVE Studio capturam junto com o jogo.
const ttsCache = new Map(); // chave -> Buffer
let ttsVoices = null;
// A voz da Microsoft limita pedidos: no máximo 2 ao mesmo tempo, e depois de um 429 fica 45s só no plano B.
let ttsBusy = 0, ttsPauseUntil = 0;
const ttsWait = [];
async function tts(text, voice, rate = 0, pitch = 0) {
  const key = `${voice}|${rate}|${pitch}|${text}`;
  if (ttsCache.has(key)) return ttsCache.get(key);
  if (Date.now() < ttsPauseUntil) throw new Error('pausa 429');
  if (ttsBusy >= 2) await new Promise((r) => ttsWait.push(r));
  ttsBusy++;
  try { return await ttsEdge(text, voice, rate, pitch, key); }
  catch (err) { if (/429/.test(err?.message)) ttsPauseUntil = Date.now() + 45000; throw err; }
  finally { ttsBusy--; ttsWait.shift()?.(); }
}
async function ttsEdge(text, voice, rate, pitch, key) {
  const engine = new MsEdgeTTS();
  await engine.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const opts = {};
  if (rate) opts.rate = `${rate > 0 ? '+' : ''}${rate}%`;
  if (pitch) opts.pitch = `${pitch > 0 ? '+' : ''}${pitch}Hz`;
  const buf = await new Promise((resolve, reject) => {
    const { audioStream } = engine.toStream(text, opts);
    const chunks = [];
    const timer = setTimeout(() => reject(new Error('timeout')), 15000);
    audioStream.on('data', (c) => chunks.push(c));
    audioStream.on('error', (e) => { clearTimeout(timer); reject(e); });
    audioStream.on('close', () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
  });
  try { engine.close(); } catch {}
  if (!buf.length) throw new Error('vazio');
  if (ttsCache.size > 300) ttsCache.delete(ttsCache.keys().next().value);
  ttsCache.set(key, buf);
  return buf;
}
// Plano B: voz do Google Tradutor (até 200 letras por pedaço).
async function ttsGoogle(text, lang = 'pt-BR') {
  const parts = [];
  let rest = text;
  while (rest.length) {
    let cut = rest.length <= 190 ? rest.length : Math.max(rest.lastIndexOf(' ', 190), 60);
    parts.push(rest.slice(0, cut)); rest = rest.slice(cut).trim();
  }
  const bufs = [];
  for (const p of parts) {
    const r = await fetch(`https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(p)}`, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('google ' + r.status);
    bufs.push(Buffer.from(await r.arrayBuffer()));
  }
  return Buffer.concat(bufs);
}

// ---------- IA (respostas do apresentador, roast, futuro, pistas) ----------
// Com ANTHROPIC_API_KEY usa o Claude; sem chave, usa o serviço grátis da Pollinations; se falhar, o jogo usa frases prontas.
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const AI_MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
let aiBudget = 30;
setInterval(() => (aiBudget = 30), 60000);
async function aiReply(system, prompt, maxTokens = 300) {
  if (anthropic) {
    const r = await anthropic.beta.messages.create({
      model: AI_MODEL,
      max_tokens: Math.max(maxTokens, 1024),
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    if (r.stop_reason === 'refusal') return '';
    return r.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  }
  const r = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'openai', messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], max_tokens: maxTokens }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error('ia ' + r.status);
  const j = await r.json();
  return String(j?.choices?.[0]?.message?.content || '').trim();
}

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size > max) { reject(new Error('grande')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
const sendJson = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

// ---------- Login ----------
const cookieDe = (req, nome) => (String(req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(nome + '='))?.slice(nome.length + 1)) || '';
const contaDe = (req) => contas.contaDaSessao(decodeURIComponent(cookieDe(req, 'sess')));
const setSess = (req, res, token, maxAge) => res.setHeader('set-cookie', `sess=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`);
const NOME_RE = /^[a-zA-Z0-9_.@+-]{3,60}$/; // usuário ou e-mail
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || '').trim();
const ESPERA = 'seu cadastro ainda está aguardando a aprovação do administrador';
const AI_PROVS = ['sistema', 'puter', 'ollama', 'anthropic', 'openai', 'gemini', 'openrouter'];
// O que o navegador pode ver da conta (sem senha nem a chave da IA)
const PERMS = ['jogo', 'personagens', 'testar', 'efeitos', 'alertas', 'widgets', 'dj', 'musica', 'voz', 'placar', 'historico'];
const limpaPerms = (p) => (Array.isArray(p) ? p.filter((x) => PERMS.includes(x)) : undefined);
const contaPublica = (c) => c && { id: c.id, username: c.username, role: c.role, games: c.games || [], perms: c.perms || [], ai: { provider: c.ai?.provider || 'sistema', model: c.ai?.model || '', ollamaUrl: c.ai?.ollamaUrl || '', temChave: Boolean(c.ai?.key), feito: Boolean(c.ai?.feito) } };
const tentativas = new Map(); // ip -> { n, ate }: no máximo 10 tentativas de login por minuto
const ipDe = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
function demais(req) { const k = ipDe(req), t = tentativas.get(k) || { n: 0, ate: Date.now() + 60000 }; if (Date.now() > t.ate) { t.n = 0; t.ate = Date.now() + 60000; } t.n++; tentativas.set(k, t); return t.n > 10; }
async function lerJson(req) { try { return JSON.parse(await readBody(req, 64 * 1024)); } catch { return null; } }

// IA com a chave do próprio usuário (Claude, ChatGPT, Gemini ou OpenRouter)
const clientesClaude = new Map();
async function aiReplyConta(ai, system, prompt, maxTokens) {
  const key = ai.key, model = ai.model;
  if (ai.provider === 'anthropic') {
    let cl = clientesClaude.get(key); if (!cl) { cl = new Anthropic({ apiKey: key }); clientesClaude.set(key, cl); }
    const r = await cl.messages.create({ model: model || 'claude-opus-5-5', max_tokens: Math.max(maxTokens, 512), system, messages: [{ role: 'user', content: prompt }] });
    return r.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  }
  if (ai.provider === 'gemini') {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || 'gemini-2.0-flash')}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens } }), signal: AbortSignal.timeout(25000) });
    if (!r.ok) throw new Error('gemini ' + r.status);
    const j = await r.json(); return String(j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '').trim();
  }
  const url = ai.provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ model: model || (ai.provider === 'openai' ? 'gpt-4o-mini' : 'openrouter/auto'), messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], max_tokens: maxTokens }), signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(ai.provider + ' ' + r.status);
  const j = await r.json(); return String(j?.choices?.[0]?.message?.content || '').trim();
}

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
  // ---------- Contas ----------
  if (url.pathname === '/api/auth') { const c = await contaDe(req); return sendJson(res, 200, { setup: (await contas.quantas()) === 0, banco: contas.temBanco(), user: contaPublica(c), adminEmail: ADMIN_EMAIL, google: GOOGLE_CLIENT_ID }); }
  if (url.pathname === '/api/google' && req.method === 'POST') {
    // Entrar com o Google: confere o token no Google e entra na conta com o mesmo e-mail (o admin cadastra o e-mail como usuário)
    const b = await lerJson(req);
    if (!GOOGLE_CLIENT_ID || !b?.credential) return sendJson(res, 400, { error: 'login com Google não configurado' });
    if (demais(req)) return sendJson(res, 429, { error: 'muitas tentativas, espere um minuto' });
    let info;
    try { const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(b.credential)}`, { signal: AbortSignal.timeout(8000) }); info = await r.json(); if (!r.ok) throw new Error(); } catch { return sendJson(res, 401, { error: 'o Google não confirmou o login' }); }
    if (info.aud !== GOOGLE_CLIENT_ID || String(info.email_verified) !== 'true' || !info.email) return sendJson(res, 401, { error: 'o Google não confirmou o login' });
    const email = String(info.email).toLowerCase();
    let c = await contas.porNome(email);
    // Primeiro acesso do dono: o e-mail do admin (ADMIN_EMAIL) vira o admin direto pelo Google
    if (!c && email === ADMIN_EMAIL && (await contas.quantas()) === 0) c = await contas.porId((await contas.criar({ username: email, senha: crypto.randomBytes(24).toString('hex'), role: 'admin' })).id);
    if (c?.status === 'pendente') return sendJson(res, 403, { error: ESPERA });
    if (!c) {
      // Sem conta: o Google vira um pedido de cadastro (o admin aprova na aba Usuários)
      if ((await contas.quantas()) === 0) return sendJson(res, 403, { error: 'o sistema ainda está sendo instalado, tente mais tarde' });
      if ((await contas.listar()).filter((u) => u.status === 'pendente').length >= 200) return sendJson(res, 429, { error: 'muitos pedidos na fila, tente mais tarde' });
      const nome = String(b.name || info.name || email.split('@')[0]).trim().slice(0, 60);
      await contas.criar({ username: email, senha: crypto.randomBytes(24).toString('hex'), status: 'pendente', info: { nome, tiktok: String(b.tiktok || '').trim().replace(/^@/, '').slice(0, 40), recado: String(b.message || '').trim().slice(0, 500), google: true } });
      return sendJson(res, 200, { pendente: true, email });
    }
    if (c.disabled) return sendJson(res, 403, { error: 'seu acesso está desativado — fale com o administrador' });
    const { token } = await contas.novaSessao(c.id); setSess(req, res, token, 2592000);
    return sendJson(res, 200, { ok: true });
  }
  if (url.pathname === '/api/setup' && req.method === 'POST') {
    // Primeiro acesso: cria a conta de admin com o código secreto (ADMIN_SETUP_CODE no Render)
    const b = await lerJson(req); if (!b) return sendJson(res, 400, { error: 'dados inválidos' });
    if (demais(req)) return sendJson(res, 429, { error: 'muitas tentativas, espere um minuto' });
    if ((await contas.quantas()) > 0) return sendJson(res, 403, { error: 'o admin já foi criado' });
    if (!process.env.ADMIN_SETUP_CODE || String(b.code || '').trim().toUpperCase() !== process.env.ADMIN_SETUP_CODE.toUpperCase()) return sendJson(res, 403, { error: 'código de instalação errado' });
    if (!NOME_RE.test(b.username || '') || String(b.password || '').length < 6) return sendJson(res, 400, { error: 'usuário ou e-mail e senha (6+ caracteres)' });
    if (ADMIN_EMAIL && String(b.username).trim().toLowerCase() !== ADMIN_EMAIL) return sendJson(res, 403, { error: `o admin é ${ADMIN_EMAIL}` });
    const c = await contas.criar({ username: String(b.username).trim().toLowerCase(), senha: b.password, role: 'admin' });
    const { token } = await contas.novaSessao(c.id); setSess(req, res, token, 2592000);
    return sendJson(res, 200, { ok: true });
  }
  if (url.pathname === '/api/login' && req.method === 'POST') {
    const b = await lerJson(req); if (!b) return sendJson(res, 400, { error: 'dados inválidos' });
    if (demais(req)) return sendJson(res, 429, { error: 'muitas tentativas, espere um minuto' });
    const c = await contas.porNome(String(b.username || '').trim());
    if (!c || !contas.confereSenha(b.password, c.pass)) return sendJson(res, 401, { error: 'usuário ou senha errados' });
    if (c.status === 'pendente') return sendJson(res, 403, { error: ESPERA });
    if (c.disabled) return sendJson(res, 403, { error: 'seu acesso está desativado — fale com o administrador' });
    const { token } = await contas.novaSessao(c.id); setSess(req, res, token, 2592000);
    return sendJson(res, 200, { ok: true, user: contaPublica(c) });
  }
  if (url.pathname === '/api/signup' && req.method === 'POST') {
    // Pedido de cadastro: a conta nasce "pendente" e só entra depois que o admin aprovar (aba Usuários)
    const b = await lerJson(req); if (!b) return sendJson(res, 400, { error: 'dados inválidos' });
    if (demais(req)) return sendJson(res, 429, { error: 'muitas tentativas, espere um minuto' });
    const email = String(b.username || '').trim().toLowerCase(), nome = String(b.name || '').trim().slice(0, 60);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !NOME_RE.test(email)) return sendJson(res, 400, { error: 'coloque um e-mail válido' });
    if (nome.length < 2) return sendJson(res, 400, { error: 'coloque o seu nome' });
    if (String(b.password || '').length < 6) return sendJson(res, 400, { error: 'a senha precisa de 6 ou mais caracteres' });
    if ((await contas.quantas()) === 0) return sendJson(res, 403, { error: 'o sistema ainda está sendo instalado, tente mais tarde' });
    const ja = await contas.porNome(email);
    if (ja) return sendJson(res, 409, { error: ja.status === 'pendente' ? ESPERA : 'esse e-mail já tem cadastro — use o botão Entrar' });
    if ((await contas.listar()).filter((u) => u.status === 'pendente').length >= 200) return sendJson(res, 429, { error: 'muitos pedidos na fila, tente mais tarde' });
    const info = { nome, tiktok: String(b.tiktok || '').trim().replace(/^@/, '').slice(0, 40), recado: String(b.message || '').trim().slice(0, 500) };
    await contas.criar({ username: email, senha: b.password, status: 'pendente', info });
    return sendJson(res, 200, { ok: true });
  }
  if (url.pathname === '/api/logout' && req.method === 'POST') { const t = decodeURIComponent(cookieDe(req, 'sess')); if (t) await contas.fimSessao(t); setSess(req, res, '', 0); return sendJson(res, 200, { ok: true }); }
  if (url.pathname === '/api/me') { const c = await contaDe(req); return c ? sendJson(res, 200, contaPublica(c)) : sendJson(res, 401, { error: 'faça login' }); }
  if (url.pathname === '/api/me/ai' && req.method === 'PUT') {
    const c = await contaDe(req); if (!c) return sendJson(res, 401, { error: 'faça login' });
    const b = await lerJson(req); if (!b || !AI_PROVS.includes(b.provider)) return sendJson(res, 400, { error: 'escolha uma opção' });
    const ai = { provider: b.provider, model: String(b.model || '').slice(0, 80), ollamaUrl: String(b.ollamaUrl || '').slice(0, 200), feito: true, key: c.ai?.key || '' };
    if (typeof b.key === 'string' && b.key.trim() && !b.key.includes('•')) ai.key = b.key.trim().slice(0, 300);
    if (['anthropic', 'openai', 'gemini', 'openrouter'].includes(ai.provider) && !ai.key) return sendJson(res, 400, { error: 'cole a sua chave' });
    const nova = await contas.alterar(c.id, { ai }); contas.esqueceCache(c.id);
    return sendJson(res, 200, contaPublica({ ...nova, ai }));
  }
  if (url.pathname === '/api/users' || url.pathname.startsWith('/api/users/')) {
    const c = await contaDe(req); if (!c || c.role !== 'admin') return sendJson(res, 403, { error: 'só o admin' });
    const id = Number(url.pathname.split('/')[3]) || 0;
    if (req.method === 'GET' && !id) return sendJson(res, 200, { users: (await contas.listar()).map((u) => ({ ...contaPublica(u), disabled: u.disabled, status: u.status, info: u.info, created_at: u.created_at })), banco: contas.temBanco() });
    if (req.method === 'POST' && !id) {
      const b = await lerJson(req); if (!b || !NOME_RE.test(b.username || '') || String(b.password || '').length < 6) return sendJson(res, 400, { error: 'usuário ou e-mail e senha (6+ caracteres)' });
      if (await contas.porNome(b.username)) return sendJson(res, 409, { error: 'esse usuário já existe' });
      return sendJson(res, 200, contaPublica(await contas.criar({ username: String(b.username).trim().toLowerCase(), senha: b.password, role: b.role === 'admin' ? 'admin' : 'user', games: Array.isArray(b.games) ? b.games.slice(0, 200).map(String) : [], perms: limpaPerms(b.perms) || [] })));
    }
    if (req.method === 'PUT' && id) {
      const b = await lerJson(req) || {};
      if (b.password && String(b.password).length < 6) return sendJson(res, 400, { error: 'senha com 6+ caracteres' });
      if (id === c.id && (b.role === 'user' || b.disabled)) return sendJson(res, 400, { error: 'você não pode tirar o seu próprio acesso de admin' });
      const u = await contas.alterar(id, { senha: b.password || undefined, role: b.role === 'admin' || b.role === 'user' ? b.role : undefined, games: Array.isArray(b.games) ? b.games.slice(0, 200).map(String) : undefined, perms: limpaPerms(b.perms), disabled: typeof b.disabled === 'boolean' ? b.disabled : undefined, status: b.aprovar ? 'ok' : undefined });
      contas.esqueceCache(id);
      return u ? sendJson(res, 200, contaPublica(u)) : sendJson(res, 404, { error: 'não achei' });
    }
    if (req.method === 'DELETE' && id) { if (id === c.id) return sendJson(res, 400, { error: 'você não pode apagar a si mesmo' }); await contas.apagar(id); contas.esqueceCache(id); return sendJson(res, 200, { ok: true }); }
    return sendJson(res, 405, { error: 'método' });
  }
  // Página do painel: sem login mostra a página de entrada com o catálogo (a tela da live, ?clean=1, abre sem login — é a fonte do LIVE Studio/OBS)
  if ((url.pathname === '/' || url.pathname === '/index.html') && url.searchParams.get('clean') !== '1' && !(await contaDe(req))) return sendStatic(req, res, path.join(PUBLIC_DIR, 'inicio.html'));
  if (url.pathname === '/inicio') return sendStatic(req, res, path.join(PUBLIC_DIR, 'inicio.html')); // a logo do painel volta para cá (logado ou não)
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
  if (url.pathname === '/vendor/three.module.min.js') return sendStatic(req, res, THREE_PATH, 'public, max-age=86400');
  if (url.pathname.startsWith('/vendor/jsm/')) {
    // Módulos extras do three.js (carregador de GLB, utilidades de esqueleto), só quando um jogo pede.
    const file = path.normalize(path.join(THREE_JSM, url.pathname.slice('/vendor/jsm/'.length)));
    if (!file.startsWith(THREE_JSM + path.sep) || !file.endsWith('.js')) { res.writeHead(403); return res.end(); }
    try { return await sendStatic(req, res, file, 'public, max-age=86400'); } catch { res.writeHead(404); return res.end(); }
  }
  if (url.pathname === '/api/img') {
    // Repassa fotos de perfil (TikTok/Roblox) com CORS liberado, para poderem virar textura no 3D.
    let target;
    try { target = new URL(url.searchParams.get('u') || ''); } catch { res.writeHead(400); return res.end(); }
    if (target.protocol !== 'https:' || !IMG_HOSTS.some((h) => target.hostname === h || target.hostname.endsWith('.' + h))) { imgStats.denied[target.hostname] = (imgStats.denied[target.hostname] || 0) + 1; if (imgStats.denied[target.hostname] <= 3) console.warn('foto de site não liberado:', target.hostname); res.writeHead(403); return res.end(); }
    const cached = imgCache.get(target.href);
    const send = (img) => { res.writeHead(200, { 'content-type': img.type, 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=3600' }); res.end(img.body); };
    const fail = (code) => { imgFail.set(target.href, Date.now()); if (imgFail.size > 2000) imgFail.delete(imgFail.keys().next().value); res.writeHead(code, { 'access-control-allow-origin': '*', 'cache-control': 'no-store' }); res.end(); };
    if (cached) return send(cached);
    // URL que falhou há pouco (foto expirada, removida): responde logo, sem bater no TikTok de novo.
    if (Date.now() - (imgFail.get(target.href) || 0) < 120000) { res.writeHead(404, { 'access-control-allow-origin': '*' }); return res.end(); }
    try {
      const get = (extra = {}) => fetch(target, { headers: { 'user-agent': UA, accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8', ...extra }, signal: AbortSignal.timeout(8000) });
      let r = await get();
      // Alguns CDNs do TikTok só entregam a foto com o site do TikTok como origem
      if (r.status === 403 || r.status === 401) r = await get({ referer: 'https://www.tiktok.com/', origin: 'https://www.tiktok.com' });
      let type = (r.headers.get('content-type') || '').split(';')[0];
      if (!r.ok) { imgLog(target, r.status); return fail(r.status === 403 || r.status === 404 ? 404 : 502); }
      const body = Buffer.from(await r.arrayBuffer());
      // Alguns CDNs mandam image sem content-type certo: reconhece pelos primeiros bytes.
      if (!type.startsWith('image/')) type = sniffImage(body);
      if (!type) return fail(502);
      if (body.length > 6_000_000) { res.writeHead(413); return res.end(); }
      if (imgCache.size > 500) imgCache.delete(imgCache.keys().next().value);
      const img = { type, body };
      imgStats.ok++;
      imgCache.set(target.href, img);
      return send(img);
    } catch (err) { imgLog(target, err?.name || 'erro'); return fail(502); }
  }
  if (url.pathname === '/api/yt-info') {
    // Nome e capa de um vídeo ou playlist do YouTube (oEmbed público), para o painel mostrar a música certa
    const id = url.searchParams.get('id') || '', list = url.searchParams.get('list') || '';
    if (!/^[\w-]{6,20}$/.test(id) && !/^[\w-]{10,64}$/.test(list)) return sendJson(res, 400, { error: 'link inválido' });
    const page = id ? `https://www.youtube.com/watch?v=${id}` : `https://www.youtube.com/playlist?list=${list}`;
    try {
      const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(page)}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) return sendJson(res, r.status === 401 || r.status === 403 ? 403 : 404, { error: r.status === 401 || r.status === 403 ? 'o dono não deixa tocar fora do YouTube' : 'não encontrado' });
      const j = await r.json();
      return sendJson(res, 200, { title: j.title || '', author: j.author_name || '', thumb: j.thumbnail_url || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '') });
    } catch { return sendJson(res, 502, { error: 'sem resposta do YouTube' }); }
  }
  if (url.pathname === '/api/img-stats') return sendJson(res, 200, { ok: imgStats.ok, falhas: imgStats.fail, ultimas: imgStats.last, recusadas: imgStats.denied, eventosSemFoto: imgStats.semFoto });
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
  if (url.pathname === '/api/tts') {
    const text = String(url.searchParams.get('t') || '').slice(0, 600).trim();
    const voice = /^[a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural$/.test(url.searchParams.get('v') || '') ? url.searchParams.get('v') : 'pt-BR-FranciscaNeural';
    const rate = clamp(Math.round(Number(url.searchParams.get('r')) || 0), -60, 100);
    const pitch = clamp(Math.round(Number(url.searchParams.get('p')) || 0), -80, 80);
    if (!text) { res.writeHead(400); return res.end(); }
    let buf;
    try { buf = await tts(text, voice, rate, pitch); }
    catch (err) {
      if (err?.message !== 'pausa 429') console.error('tts edge falhou:', err?.message);
      try { buf = await ttsGoogle(text, voice.slice(0, 5)); } catch { res.writeHead(502); return res.end(); }
    }
    res.writeHead(200, { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=86400', 'access-control-allow-origin': '*' });
    return res.end(buf);
  }
  if (url.pathname === '/api/voices') {
    try {
      if (!ttsVoices) ttsVoices = (await new MsEdgeTTS().getVoices()).filter((v) => /^(pt|es|en)-/.test(v.Locale)).map((v) => ({ id: v.ShortName, name: v.FriendlyName, gender: v.Gender, locale: v.Locale }));
      return sendJson(res, 200, ttsVoices);
    } catch { return sendJson(res, 200, []); }
  }
  if (url.pathname === '/api/ai' && req.method === 'POST') {
    let body;
    try { body = JSON.parse(await readBody(req, 64 * 1024)); } catch { return sendJson(res, 400, { error: 'json' }); }
    const conta = await contaDe(req);
    if (!conta) return sendJson(res, 401, { error: 'faça login' });
    const own = ['anthropic', 'openai', 'gemini', 'openrouter'].includes(conta.ai?.provider) && conta.ai?.key;
    if (!own) { if (aiBudget <= 0) return sendJson(res, 429, { error: 'limite' }); aiBudget--; }
    try {
      const sys = String(body.system || '').slice(0, 6000), pr = String(body.prompt || '').slice(0, 4000), mx = clamp(Number(body.max) || 200, 20, 800);
      // Com a chave do próprio usuário usa a IA dele; senão a do servidor (chave do admin no Render ou a grátis)
      const text = own ? await aiReplyConta(conta.ai, sys, pr, mx) : await aiReply(sys, pr, mx);
      return sendJson(res, 200, { text, provider: own ? conta.ai.provider : anthropic ? 'claude' : 'gratis' });
    } catch (err) {
      console.error('ia falhou:', err?.message);
      return sendJson(res, 502, { error: err?.message || 'falha' });
    }
  }
  if (url.pathname === '/api/wiki') {
    // Foto e resumo de um lugar na Wikipédia (português primeiro, depois inglês), para o jogo Onde Fica.
    const titles = [url.searchParams.get('pt'), url.searchParams.get('en')].filter(Boolean).map((t) => String(t).slice(0, 80));
    const key = titles.join('|');
    if (wikiCache.has(key)) return sendJson(res, 200, wikiCache.get(key));
    for (const [i, t] of titles.entries()) {
      try {
        const r = await fetch(`https://${i === 0 && url.searchParams.get('pt') ? 'pt' : 'en'}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, '_'))}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) });
        if (!r.ok) continue;
        const j = await r.json();
        let img = String(j.originalimage?.source || j.thumbnail?.source || '').split('?')[0];
        // Pede uma versão de até 960px (tamanho padrão aceito pela Wikimedia) em vez do arquivo original (que pode ser enorme)
        if (/\/\d+px-[^/]+$/.test(img)) img = img.replace(/\/(\d+)px-([^/]+)$/, (m0, n, f) => `/${Math.min(Number(n), 960)}px-${f}`);
        else {
          const m = img.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/(\w)\/(\w\w)\/([^/]+)$/);
          if (m && (j.originalimage?.width || 0) > 960 && !/\.svg$/i.test(m[4])) img = `${m[1]}/thumb/${m[2]}/${m[3]}/${m[4]}/960px-${m[4]}`;
        }
        if (!img || /\.svg/i.test(img)) continue;
        const out = { img, title: j.title, w: j.originalimage?.width, h: j.originalimage?.height };
        if (wikiCache.size > 500) wikiCache.delete(wikiCache.keys().next().value);
        wikiCache.set(key, out);
        return sendJson(res, 200, out);
      } catch {}
    }
    return sendJson(res, 404, { error: 'sem foto' });
  }
  if (url.pathname === '/api/ai-status') return sendJson(res, 200, { provider: anthropic ? 'claude' : 'gratis', model: anthropic ? AI_MODEL : 'pollinations' });
  if (url.pathname === '/api/media' && req.method === 'POST') {
    // Arquivos do painel (sons, músicas, vídeos, imagens). O disco do Render é temporário:
    // o painel guarda o original e reenvia quando o servidor perde o arquivo.
    const type = String(req.headers['content-type'] || '').split(';')[0];
    const ext = MEDIA_EXT[type];
    if (!ext) return sendJson(res, 415, { error: 'tipo não aceito' });
    let body;
    try { body = await readBody(req, MEDIA_MAX); } catch { return sendJson(res, 413, { error: 'arquivo grande demais' }); }
    const id = crypto.createHash('sha256').update(body).digest('hex').slice(0, 32) + ext;
    await fs.mkdir(MEDIA_DIR, { recursive: true });
    await fs.writeFile(path.join(MEDIA_DIR, id), body);
    return sendJson(res, 200, { id, url: '/api/media/' + id });
  }
  if (url.pathname.startsWith('/api/media/')) {
    const id = url.pathname.slice(11);
    if (!/^[0-9a-f]{32}\.[a-z0-9]{3,4}$/.test(id)) { res.writeHead(400); return res.end(); }
    const file = path.join(MEDIA_DIR, id);
    let stat;
    try { stat = await fs.stat(file); } catch { res.writeHead(404); return res.end(); }
    const type = MEDIA_TYPE[path.extname(id)] || 'application/octet-stream';
    const headers = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'public, max-age=31536000, immutable', 'access-control-allow-origin': '*' };
    if (req.method === 'HEAD') { res.writeHead(200, { ...headers, 'content-length': stat.size }); return res.end(); }
    // Vídeo e áudio pedem pedaços (Range) para poder pular e tocar em loop.
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    const fh = await fs.open(file);
    if (m) {
      const start = m[1] ? Number(m[1]) : 0, end = m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
      res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${stat.size}`, 'content-length': end - start + 1 });
      fh.createReadStream({ start, end }).pipe(res).on('close', () => fh.close());
    } else {
      res.writeHead(200, { ...headers, 'content-length': stat.size });
      fh.createReadStream().pipe(res).on('close', () => fh.close());
    }
    return;
  }
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end();
  }
  try {
    await sendStatic(req, res, file, rel.startsWith('assets/') ? 'public, max-age=604800' : 'no-cache');
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Não encontrado');
  }
});

// Junta as mensagens das tentativas internas (HTML, API e Euler) para o log e o diagnóstico.
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function detailErrors(err, depth = 0) {
  if (!err || depth > 3) return [];
  const inner = err.config?.requestErrs || err.requestErrs || err.errors || (err.exception ? [err.exception] : []);
  const out = [];
  for (const e of inner) out.push(`${e?.name || 'Error'}: ${e?.message || e}`, ...detailErrors(e, depth + 1));
  return out;
}

// Uma conexão com o TikTok por @, compartilhada por todos os navegadores que pedirem o mesmo @.
const rooms = new Map(); // username -> { conn, clients: Set<ws>, ready: Promise }

// Dados do espectador. fol/mod/sub/fan dizem se segue, é moderador, assinante ou do fã-clube (para "quem pode jogar").
function broadcast(room, msg) {
  const data = JSON.stringify(msg);
  for (const ws of room.clients) if (ws.readyState === ws.OPEN) ws.send(data);
}

function closeRoom(username) {
  const room = rooms.get(username);
  if (!room) return;
  rooms.delete(username);
  clearTimeout(room.retry);
  room.closed = true;
  room.conn?.disconnect().catch(() => {});
}

// A sala do @ existe enquanto houver alguém conectado, com ou sem live no ar: painel e tela já conversam
// (configurações, troca de jogo, simulador) antes de você entrar ao vivo. A conexão com o TikTok tenta de novo sozinha.
function openRoom(username) {
  const room = { conn: null, clients: new Set(), state: null, configs: {}, retry: null, closed: false };
  rooms.set(username, room);
  connectTikTok(username, room);
  return room;
}

function connectTikTok(username, room) {
  if (room.closed) return;
  const conn = new TikTokLiveConnection(username, {
    processInitialData: false,
    // A lista completa de presentes (gift/list) exige plano pago no Euler Stream; o evento de presente já traz nome e valor.
    enableExtendedGiftInfo: false,
    signApiKey: SIGN_API_KEY,
  });
  room.conn = conn;
  const again = (ms) => { clearTimeout(room.retry); room.retry = setTimeout(() => { if (!room.closed && room.conn === conn) connectTikTok(username, room); }, ms); };

  conn.on(WebcastEvent.CHAT, (d) => broadcast(room, { type: 'chat', user: userOf(d.user, d), text: d.content ?? d.comment ?? '' }));
  conn.on(WebcastEvent.LIKE, (d) => broadcast(room, { type: 'like', user: userOf(d.user, d), count: Number(d.count ?? d.likeCount) || 1, total: Number(d.total ?? d.totalLikeCount) || 0 }));
  conn.on(WebcastEvent.GIFT, (d) => {
    const gift = giftInfo(d);
    if (gift) broadcast(room, { type: 'gift', user: userOf(d.user, d), ...gift });
  });
  // Seguir e compartilhar chegam separados (o conector já filtra o SOCIAL por tipo).
  conn.on(WebcastEvent.FOLLOW, (d) => broadcast(room, { type: 'social', user: userOf(d.user, d), action: 'follow' }));
  conn.on(WebcastEvent.SHARE, (d) => broadcast(room, { type: 'social', user: userOf(d.user, d), action: 'share' }));
  conn.on(WebcastEvent.MEMBER, (d) => broadcast(room, { type: 'join', user: userOf(d.user, d) }));
  conn.on(WebcastEvent.ROOM_USER, (d) => broadcast(room, { type: 'viewers', count: Number(d.total ?? d.viewerCount) || 0 }));
  conn.on(WebcastEvent.STREAM_END, () => {
    if (room.conn !== conn) return;
    room.state = { state: 'offline', message: `A live de @${username} terminou. Quando você voltar ao vivo, eu reconecto sozinho.` };
    broadcast(room, { type: 'status', ...room.state });
    conn.disconnect().catch(() => {});
    again(30000);
  });
  conn.on(ControlEvent.DISCONNECTED, () => {
    if (room.conn !== conn || room.closed || room.state?.state !== 'connected') return;
    room.state = { state: 'connecting', message: 'Conexão com o TikTok caiu. Reconectando…' };
    broadcast(room, { type: 'status', ...room.state });
    again(5000);
  });
  conn.on(ControlEvent.ERROR, ({ info }) => console.error(`[${username}] erro:`, info));

  room.state = { state: 'connecting', message: `Conectando a @${username}…` };
  conn.connect().then(
    (state) => {
      if (room.conn !== conn) return;
      room.state = { state: 'connected', message: `Conectado à live de @${username}`, roomId: state.roomId };
      broadcast(room, { type: 'status', ...room.state });
      console.log(`[${username}] conectado, sala ${state.roomId}`);
    },
    (err) => {
      if (room.conn !== conn) return;
      const details = detailErrors(err).join(' | ');
      const offline = err?.name === 'UserOfflineError' || /offline|not live|isn't online|user_not_found|SIGI_STATE/i.test(`${err?.message} ${details}`);
      const message = offline
        ? `Nenhuma live aberta em @${username} agora. Painel e tela já estão ligados; quando você entrar ao vivo, eu conecto sozinho.`
        : `Não foi possível conectar: ${err?.message || err}. Tentando de novo…`;
      console.error(`[${username}] falha ao conectar:`, err?.message || err, details);
      room.state = { state: 'offline', message };
      broadcast(room, { type: 'status', ...room.state });
      again(offline ? 30000 : 20000);
    }
  );
}

// Quem está conectado no mesmo @: painéis e telas da live. O "líder" (primeiro painel, ou a primeira tela)
// é quem chama a IA e decide sorteios; os outros recebem o resultado. O painel se cala quando há tela.
function sendPeers(room) {
  const list = [...room.clients];
  const panels = list.filter((c) => c.role !== 'screen'), screens = list.filter((c) => c.role === 'screen');
  const leader = panels[0] || screens[0];
  for (const c of list) if (c.readyState === c.OPEN) c.send(JSON.stringify({ type: 'peers', panels: panels.length, screens: screens.length, leader: c === leader }));
}

function leave(ws) {
  if (!ws.username) return;
  const room = rooms.get(ws.username);
  if (room) {
    room.clients.delete(ws);
    if (room.clients.size === 0) closeRoom(ws.username);
    else sendPeers(room);
  }
  ws.username = null;
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4 * 1024 * 1024 });

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.token = decodeURIComponent(cookieDe(req, 'sess'));
  ws.on('pong', () => (ws.isAlive = true));
  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'connect') {
      // Painel precisa de login; a tela da live (fonte do LIVE Studio/OBS) só assiste e não precisa
      if (msg.role !== 'screen' && !(await contas.contaDaSessao(ws.token))) return ws.send(JSON.stringify({ type: 'status', state: 'error', message: 'Faça login de novo.' }));
      const username = String(msg.user || '').trim().replace(/^@/, '').toLowerCase();
      if (!USERNAME_RE.test(username)) {
        return ws.send(JSON.stringify({ type: 'status', state: 'error', message: 'Usuário inválido.' }));
      }
      leave(ws);
      ws.username = username;
      ws.role = msg.role === 'screen' ? 'screen' : 'panel';
      const room = rooms.get(username) || openRoom(username);
      room.clients.add(ws);
      sendPeers(room);
      for (const [key, data] of Object.entries(room.configs)) ws.send(JSON.stringify({ type: 'config', key, data }));
      if (room.game) ws.send(JSON.stringify({ type: 'control', action: 'game', id: room.game, seed: room.seed, join: true }));
      ws.send(JSON.stringify({ type: 'status', ...room.state }));
    } else if (msg.type === 'config') {
      // Configuração de um jogo (fotos, nomes) repassada às outras telas do mesmo @, como a fonte do OBS.
      const room = ws.username && rooms.get(ws.username);
      if (!room || ws.role === 'screen' || typeof msg.key !== 'string' || !/^[a-z0-9:_-]{1,48}$/.test(msg.key)) return; // só o painel (com login) muda configurações
      room.configs[msg.key] = msg.data;
      const data = JSON.stringify({ type: 'config', key: msg.key, data: msg.data });
      for (const other of room.clients) if (other !== ws && other.readyState === other.OPEN) other.send(data);
    } else if (msg.type === 'control') {
      // Comandos do painel (trocar jogo, reiniciar, simulador) para as telas do mesmo @, como a fonte "Link" do LIVE Studio.
      // A tela da live só manda 'current' (trocou de jogo sozinha, ex.: fim da votação) para o painel acompanhar.
      const room = ws.username && rooms.get(ws.username);
      // 'bus' leva comandos do painel novo (pausar, ação de teste, DJ, alerta, shoutout, música…) num pacote livre.
      if (!room || !['game', 'reset', 'sim', 'press', 'current', 'bus'].includes(msg.action)) return;
      // A tela da live (sem login) só avisa que trocou de jogo e devolve respostas da IA/estado do YouTube
      if (ws.role === 'screen' && !(msg.action === 'current' || (msg.action === 'bus' && ['ai', 'ytState'].includes(msg.bus?.t)))) return;
      if (msg.action === 'game' || msg.action === 'current') { if (typeof msg.id !== 'string' || !/^[a-z0-9-]{1,30}$/.test(msg.id)) return; room.game = msg.id; }
      if (Number.isInteger(msg.seed)) room.seed = msg.seed;
      const data = JSON.stringify({ type: 'control', action: msg.action, id: msg.id, seed: Number.isInteger(msg.seed) ? msg.seed : undefined, ev: msg.action === 'sim' ? msg.ev : undefined, bus: msg.action === 'bus' ? msg.bus : undefined });
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

contas.iniciar().catch((e) => console.error('contas: banco não respondeu —', e.message)).finally(() => server.listen(PORT, () => console.log(`Jogos interativos em http://localhost:${PORT}`)));
