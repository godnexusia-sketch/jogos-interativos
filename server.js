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
import * as asaas from './lib/asaas.js';
import { preco, reais, TESTE_DIAS } from './public/precos.js';

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
// Jogos que existem (para conferir a compra e o pacote completo); vem do catálogo da página de entrada
let CAT_IDS = [];
fs.readFile(path.join(PUBLIC_DIR, 'data', 'catalogo.json'), 'utf8').then((t) => { CAT_IDS = JSON.parse(t).games.map((g) => g.id); }).catch((e) => console.warn('catálogo:', e.message));
// Plano pago: venceu (e não é admin) = fica sem jogos até pagar
// Plano pago: os jogos só ficam liberados depois que o Asaas confirma o pagamento (e até a data paga)
const planoVencido = (c) => Boolean(c?.role !== 'admin' && (c?.plano?.ciclo || c?.plano?.pagante) && (!c.plano.ciclo || c.plano.status === 'aguardando' || c.plano.status === 'teste' || Date.now() > Number(c.plano.ate || 0)));
const destinoPagar = (c) => (c?.plano?.ciclo ? '/pagar?aviso=1' : '/planos'); // ainda sem plano: escolher os jogos; com plano: pagar
// Bônus (funções do painel) de cada pacote: o admin escolhe; o pacote completo libera tudo
const PACOTES_N = [1, 3, 5, 10, 20];
const BONUS_PADRAO = { 1: ['musica', 'placar'], 3: ['musica', 'placar', 'voz', 'alertas'], 5: ['musica', 'placar', 'voz', 'alertas', 'efeitos', 'personagens'], 10: ['musica', 'placar', 'voz', 'alertas', 'efeitos', 'personagens', 'widgets', 'historico', 'testar'], 20: ['musica', 'placar', 'voz', 'alertas', 'efeitos', 'personagens', 'widgets', 'historico', 'testar', 'jogo', 'dj'] };
const bonusTabela = () => ({ ...BONUS_PADRAO, ...(contas.lerConfig('bonus') || {}) });
const faixaDe = (pl) => (pl.todos ? 'todos' : PACOTES_N.filter((n) => n <= Number(pl.cabe || (pl.games || []).length || 1)).pop() || 1);
// Configurar o jogo (gatilhos) vem em todo pacote; o resto vem da tabela de bônus do admin
const bonusDe = (pl) => { const f = faixaDe(pl); const base = f === 'todos' ? PERMS.slice() : ['jogo', ...(bonusTabela()[f] || []).filter((x) => PERMS.includes(x))]; return [...new Set([...base, ...(Array.isArray(pl.extras) ? pl.extras.filter((x) => PERMS.includes(x)) : [])])]; }; // bônus do pacote + o que o admin liberou a mais para a conta
const AVISO_PAGAR = 'O pagamento para acesso aos jogos ainda não foi confirmado. Faça o pagamento o quanto antes para liberar o seu acesso.';
const avisoDe = (c) => (!c?.plano?.ciclo ? 'Falta escolher o seu plano: escolha os jogos e faça o pagamento para liberar o acesso.' : c?.plano?.pagos?.length ? `Aguardando renovação do pacote: o seu acesso venceu em ${new Date(Number(c.plano.ate)).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Faça a renovação para voltar a usar os jogos, com todas as suas configurações.` : AVISO_PAGAR);
const jogosDe = (c) => (c?.plano?.ciclo && c.plano.todos && CAT_IDS.length ? CAT_IDS : c?.games || []);
const planoPublico = (p) => p?.ciclo ? { ciclo: p.ciclo, n: p.todos ? CAT_IDS.length : (p.games || []).length, todos: Boolean(p.todos), valor: p.valor, forma: p.forma, parcelas: p.parcelas || 1, status: p.status, teste: Boolean(p.teste), ate: p.ate, fatura: p.fatura || '' } : null;
const contaPublica = (c) => c && { id: c.id, username: c.username, role: c.role, games: jogosDe(c), perms: c.plano?.ciclo ? bonusDe(c.plano) : c.perms || [], nome: c.info?.nome || '', perfil: { nome: c.info?.nome || '', celular: c.info?.celular || '', tiktok: c.info?.tiktok || '', google: Boolean(c.info?.google), senhaPropria: c.info?.google ? Boolean(c.info?.senhaPropria) : true }, pagante: Boolean(c.plano?.pagante || c.plano?.ciclo), plano: planoPublico(c.plano), vencido: Boolean(planoVencido(c)), ai: { provider: c.ai?.provider || 'sistema', model: c.ai?.model || '', ollamaUrl: c.ai?.ollamaUrl || '', temChave: Boolean(c.ai?.key), feito: Boolean(c.ai?.feito) } };
const ASAAS_WEBHOOK_TOKEN = String(process.env.ASAAS_WEBHOOK_TOKEN || '').trim();
const DIA = 86400e3;
// Pagamento caiu: estende o acesso (mensal: até o próximo vencimento + folga; anual: 1 ano)
// Regra do dono: mensal = 30 dias exatos a partir da liberação; anual = 1 ano. Pagou antes de vencer: soma ao que falta.
async function liberar(u, pay) {
  const pl = { ...u.plano };
  const chave = pay.installment || pay.id; // parcelas do mesmo anual contam uma vez só
  pl.pagos = Array.isArray(pl.pagos) ? pl.pagos : [];
  if (chave && pl.pagos.includes(chave)) return; // já contado (aviso do Asaas e conferência da página chegam os dois)
  const agora = Date.now(), aindaVale = pl.status === 'ativo' && Number(pl.ate || 0) > agora;
  pl.ate = (aindaVale ? Number(pl.ate) : agora) + (pl.ciclo === 'anual' ? 365 : 30) * DIA;
  pl.liberadoEm = agora;
  pl.pagos = [...pl.pagos, chave].slice(-36);
  pl.status = 'ativo';
  await contas.alterar(u.id, { plano: pl }); contas.esqueceCache(u.id);
  console.log(`asaas: pago conta ${u.id} → ativo até ${new Date(pl.ate).toISOString().slice(0, 10)}`);
}
const dataAsaas = (ms) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 10); // dia no horário de Brasília
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
      // Cadastro pelo Google: a conta nasce sem acesso (escolhe o plano e paga); depois pede os dados que faltam
      if ((await contas.quantas()) === 0) return sendJson(res, 403, { error: 'o sistema ainda está sendo instalado, tente mais tarde' });
      const nova = await contas.criar({ username: email, senha: crypto.randomBytes(24).toString('hex'), plano: { pagante: true, status: 'escolher' }, info: { nome: String(info.name || '').slice(0, 80), google: true, origem: 'site' } });
      const { token } = await contas.novaSessao(nova.id); setSess(req, res, token, 2592000);
      return sendJson(res, 200, { ok: true, novo: true, completar: true, nome: nova.info?.nome || '', email });
    }
    if (false) {
      if ((await contas.quantas()) === 0) return sendJson(res, 403, { error: 'o sistema ainda está sendo instalado, tente mais tarde' });
      if ((await contas.listar()).filter((u) => u.status === 'pendente').length >= 200) return sendJson(res, 429, { error: 'muitos pedidos na fila, tente mais tarde' });
      const nome = String(b.name || info.name || email.split('@')[0]).trim().slice(0, 60);
      await contas.criar({ username: email, senha: crypto.randomBytes(24).toString('hex'), status: 'pendente', info: { nome, tiktok: String(b.tiktok || '').trim().replace(/^@/, '').slice(0, 40), recado: String(b.message || '').trim().slice(0, 500), google: true } });
      return sendJson(res, 200, { pendente: true, email });
    }
    if (c.disabled) return sendJson(res, 403, { error: 'seu acesso está desativado — fale com o administrador' });
    const { token } = await contas.novaSessao(c.id); setSess(req, res, token, 2592000);
    if (planoVencido(c)) return sendJson(res, 200, { ok: true, pagar: destinoPagar(c), aviso: avisoDe(c) });
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
    if (planoVencido(c)) return sendJson(res, 200, { ok: true, pagar: destinoPagar(c), aviso: avisoDe(c) });
    return sendJson(res, 200, { ok: true, user: contaPublica(c) });
  }
  if (url.pathname === '/api/cadastro' && req.method === 'POST') {
    // Cadastro pelo site: cria a conta (sem acesso até pagar) e leva para escolher o plano
    const b = await lerJson(req); if (!b) return sendJson(res, 400, { error: 'dados inválidos' });
    if (demais(req)) return sendJson(res, 429, { error: 'muitas tentativas, espere um minuto' });
    const email = String(b.email || '').trim().toLowerCase(), nome = String(b.nome || '').trim().slice(0, 80);
    if (nome.length < 3 || !nome.includes(' ')) return sendJson(res, 400, { error: 'coloque o seu nome completo (nome e sobrenome)' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !NOME_RE.test(email)) return sendJson(res, 400, { error: 'coloque um e-mail válido' });
    if (String(b.senha || '').length < 6) return sendJson(res, 400, { error: 'a senha precisa de 6 ou mais caracteres' });
    if ((await contas.quantas()) === 0) return sendJson(res, 403, { error: 'o sistema ainda está sendo instalado, tente mais tarde' });
    if (await contas.porNome(email)) return sendJson(res, 409, { error: 'esse e-mail já tem conta: clique em Entrar' });
    const c = await contas.criar({ username: email, senha: b.senha, plano: { pagante: true, status: 'escolher' }, info: { nome, celular: String(b.celular || '').replace(/\D/g, '').slice(0, 13), tiktok: String(b.tiktok || '').trim().replace(/^@/, '').slice(0, 40), origem: 'site' } });
    const { token } = await contas.novaSessao(c.id); setSess(req, res, token, 2592000);
    return sendJson(res, 200, { ok: true, ir: '/planos' });
  }
  if (url.pathname === '/api/me/dados' && req.method === 'PUT') {
    // Completar o cadastro (depois do Google): nome, celular, @ e, se quiser, uma senha
    const c = await contaDe(req); if (!c) return sendJson(res, 401, { error: 'faça login' });
    const b = await lerJson(req) || {};
    const nome = String(b.nome || '').trim().slice(0, 80);
    if (nome.length < 3 || !nome.includes(' ')) return sendJson(res, 400, { error: 'coloque o seu nome completo (nome e sobrenome)' });
    if (b.senha && String(b.senha).length < 6) return sendJson(res, 400, { error: 'a senha precisa de 6 ou mais caracteres' });
    if (b.senha && (!c.info?.google || c.info?.senhaPropria)) return sendJson(res, 400, { error: 'para trocar a senha use Meu perfil → Senha' });
    const info = { ...(c.info || {}), nome, ...(b.senha ? { senhaPropria: true } : {}), celular: String(b.celular || c.info?.celular || '').replace(/\D/g, '').slice(0, 13), tiktok: String(b.tiktok || c.info?.tiktok || '').trim().replace(/^@/, '').slice(0, 40) };
    await contas.alterar(c.id, { senha: b.senha || undefined, info }); contas.esqueceCache(c.id);
    return sendJson(res, 200, { ok: true, ir: planoVencido(c) ? destinoPagar(c) : '/' });
  }
  if (url.pathname === '/api/me/senha' && req.method === 'PUT') {
    // Trocar a senha: pede a atual (quem entrou pelo Google e nunca criou senha pode criar sem ela)
    const c = await contaDe(req); if (!c) return sendJson(res, 401, { error: 'faça login' });
    if (demais(req)) return sendJson(res, 429, { error: 'muitas tentativas, espere um minuto' });
    const b = await lerJson(req) || {}, nova = String(b.nova || '');
    const semSenha = c.info?.google && !c.info?.senhaPropria;
    if (!semSenha && !contas.confereSenha(String(b.atual || ''), c.pass)) return sendJson(res, 400, { error: 'a senha atual está errada' });
    if (nova.length < 6) return sendJson(res, 400, { error: 'a nova senha precisa de 6 ou mais caracteres' });
    if (nova === String(b.atual || '')) return sendJson(res, 400, { error: 'a nova senha é igual à atual' });
    await contas.alterar(c.id, { senha: nova, info: { ...(c.info || {}), senhaPropria: true } });
    contas.esqueceCache(c.id);
    return sendJson(res, 200, { ok: true });
  }
  if (url.pathname === '/api/me/perfil' && req.method === 'PUT') {
    const c = await contaDe(req); if (!c) return sendJson(res, 401, { error: 'faça login' });
    const b = await lerJson(req) || {}, nome = String(b.nome || '').trim().slice(0, 80);
    if (nome.length < 3) return sendJson(res, 400, { error: 'coloque o seu nome completo' });
    const info = { ...(c.info || {}), nome, celular: String(b.celular || '').replace(/\D/g, '').slice(0, 13), tiktok: String(b.tiktok || '').trim().replace(/^@/, '').slice(0, 40) };
    await contas.alterar(c.id, { info }); contas.esqueceCache(c.id);
    return sendJson(res, 200, { ok: true, perfil: { nome: info.nome, celular: info.celular, tiktok: info.tiktok } });
  }
  if (url.pathname === '/api/config/bonus') {
    const c = await contaDe(req);
    if (req.method === 'PUT') {
      if (c?.role !== 'admin') return sendJson(res, 403, { error: 'só o admin' });
      const b = await lerJson(req) || {}, t = {};
      for (const n of PACOTES_N) t[n] = (Array.isArray(b[n]) ? b[n] : []).filter((x) => PERMS.includes(x));
      await contas.salvarConfig('bonus', t); contas.esqueceCache();
      return sendJson(res, 200, { ok: true, bonus: t });
    }
    return sendJson(res, 200, { bonus: bonusTabela(), todos: PERMS, pacotes: PACOTES_N });
  }
  if (url.pathname === '/api/signup' && req.method === 'POST') return sendJson(res, 410, { error: 'Para criar a sua conta, clique em "Preços", escolha os jogos e faça o pagamento.' });
  if (url.pathname === '/api/signup-antigo' && req.method === 'POST') {
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
  if (url.pathname === '/api/me') { const c = await contaDe(req); if (c && planoVencido(c)) return sendJson(res, 402, { error: avisoDe(c), pagar: destinoPagar(c) }); return c ? sendJson(res, 200, contaPublica(c)) : sendJson(res, 401, { error: 'faça login' }); }
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
    if (req.method === 'GET' && !id) return sendJson(res, 200, { users: (await contas.listar()).map((u) => ({ ...contaPublica(u), disabled: u.disabled, status: u.status, info: u.info, created_at: u.created_at, gamesConta: u.games || [] })), banco: contas.temBanco() });
    if (req.method === 'POST' && !id) {
      const b = await lerJson(req); if (!b || !NOME_RE.test(b.username || '') || String(b.password || '').length < 6) return sendJson(res, 400, { error: 'usuário ou e-mail e senha (6+ caracteres)' });
      if (await contas.porNome(b.username)) return sendJson(res, 409, { error: 'esse usuário já existe' });
      const info = { nome: String(b.nome || '').trim().slice(0, 80), celular: String(b.celular || '').replace(/\D/g, '').slice(0, 13), tiktok: String(b.tiktok || '').trim().replace(/^@/, '').slice(0, 40), recado: String(b.obs || '').trim().slice(0, 300), origem: 'admin' };
      return sendJson(res, 200, contaPublica(await contas.criar({ username: String(b.username).trim().toLowerCase(), senha: b.password, role: b.role === 'admin' ? 'admin' : 'user', games: Array.isArray(b.games) ? b.games.slice(0, 200).map(String) : [], perms: limpaPerms(b.perms) || [], info })));
    }
    if (req.method === 'PUT' && id) {
      const b = await lerJson(req) || {};
      if (b.password && String(b.password).length < 6) return sendJson(res, 400, { error: 'senha com 6+ caracteres' });
      if (id === c.id && (b.role === 'user' || b.disabled)) return sendJson(res, 400, { error: 'você não pode tirar o seu próprio acesso de admin' });
      // Cliente que comprou: as funções marcadas aqui somam aos bônus do pacote (ficam em plano.extras)
      const alvo = await contas.porId(id), pagante = alvo?.plano?.ciclo || alvo?.plano?.pagante;
      let perms = limpaPerms(b.perms), plano;
      if (pagante && perms) { const base = alvo.plano.ciclo ? bonusDe({ ...alvo.plano, extras: [] }) : []; plano = { ...alvo.plano, extras: perms.filter((x) => !base.includes(x)) }; perms = undefined; }
      const u = await contas.alterar(id, { senha: b.password || undefined, role: b.role === 'admin' || b.role === 'user' ? b.role : undefined, games: Array.isArray(b.games) ? b.games.slice(0, 200).map(String) : undefined, perms, plano, disabled: typeof b.disabled === 'boolean' ? b.disabled : undefined, status: b.aprovar ? 'ok' : undefined });
      contas.esqueceCache(id);
      return u ? sendJson(res, 200, contaPublica(u)) : sendJson(res, 404, { error: 'não achei' });
    }
    if (req.method === 'DELETE' && id) { if (id === c.id) return sendJson(res, 400, { error: 'você não pode apagar a si mesmo' }); await contas.apagar(id); contas.esqueceCache(id); return sendJson(res, 200, { ok: true }); }
    return sendJson(res, 405, { error: 'método' });
  }
  // ---------- Assinatura (Asaas) ----------
  if (url.pathname === '/api/checkout' && req.method === 'POST') {
    if (!asaas.ligado()) return sendJson(res, 503, { error: 'Os pagamentos ainda estão sendo ativados. Tente de novo mais tarde ou peça acesso em "Criar cadastro".' });
    const b = await lerJson(req); if (!b) return sendJson(res, 400, { error: 'dados inválidos' });
    if (demais(req)) return sendJson(res, 429, { error: 'muitas tentativas, espere um minuto' });
    if (!CAT_IDS.length) return sendJson(res, 503, { error: 'catálogo indisponível, tente de novo' });
    const ciclo = b.ciclo === 'anual' ? 'anual' : 'mensal';
    let games = b.todos === true ? CAT_IDS.slice() : [...new Set((Array.isArray(b.games) ? b.games : []).map(String))].filter((id) => CAT_IDS.includes(id));
    if (!games.length) return sendJson(res, 400, { error: 'escolha pelo menos um jogo' });
    const pr = preco(games.length, CAT_IDS.length);
    const todos = pr.todos; if (todos) games = CAT_IDS.slice();
    const valor = ciclo === 'anual' ? pr.anual : pr.mensal;
    const forma = ['PIX', 'BOLETO', 'CREDIT_CARD'].includes(b.forma) ? b.forma : 'UNDEFINED';
    const parcelas = ciclo === 'anual' && forma === 'CREDIT_CARD' ? Math.max(1, Math.min(12, Number(b.parcelas) || 1, Math.floor(valor / 500))) : 1;
    let conta = await contaDe(req);
    if (conta?.role === 'admin') return sendJson(res, 400, { error: 'a conta de admin já tem todos os jogos' });
    const cpf = String(b.cpf || '').replace(/\D/g, ''), celular = String(b.celular || '').replace(/\D/g, '').slice(0, 13);
    const nome = String(b.nome || conta?.info?.nome || '').trim().slice(0, 80);
    if (conta?.plano?.pagante && !conta.plano.ciclo) conta.plano = {}; // primeira compra de quem se cadastrou pelo site
    if (nome.length < 3) return sendJson(res, 400, { error: 'coloque o seu nome completo' });
    if (!asaas.docValido(cpf)) return sendJson(res, 400, { error: 'CPF ou CNPJ inválido' });
    const email = conta ? (String(conta.username).includes('@') ? conta.username : String(b.email || '').trim().toLowerCase()) : String(b.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !NOME_RE.test(email)) return sendJson(res, 400, { error: 'coloque um e-mail válido' });
    if (!conta) {
      if (String(b.senha || '').length < 6) return sendJson(res, 400, { error: 'crie uma senha com 6 ou mais caracteres' });
      if (await contas.porNome(email)) return sendJson(res, 409, { error: 'esse e-mail já tem cadastro: clique em Entrar e depois assine o plano' });
    }
    const todasContas = await contas.listar();
    // 30 dias grátis: só na primeira assinatura mensal (por conta e por CPF)
    const teste = TESTE_DIAS > 0 && ciclo === 'mensal' && !conta?.plano?.ciclo && !todasContas.some((u) => u.plano?.cpf === cpf);
    let nova = false;
    if (!conta) { conta = await contas.porId((await contas.criar({ username: email, senha: b.senha, games, perms: PERMS.slice(), info: { nome, tiktok: String(b.tiktok || '').trim().replace(/^@/, '').slice(0, 40), origem: 'compra' } })).id); nova = true; }
    const desc = `${todos ? 'todos os jogos' : `${games.length} jogo${games.length > 1 ? 's' : ''}`} (${ciclo})`;
    const agora = Date.now(), ref = `conta:${conta.id}`;
    let r;
    try {
      const cli = await asaas.cliente({ nome, cpf, email, celular, ref });
      const vence = dataAsaas(teste ? agora + TESTE_DIAS * DIA : agora);
      r = ciclo === 'mensal'
        ? await asaas.assinatura({ cliente: cli.id, valor, vence, forma: 'UNDEFINED', descricao: `Jogos Interativos: ${desc}`, ref })
        : forma === 'CREDIT_CARD' ? { id: '', fatura: '' } // anual no cartão: a cobrança nasce já paga quando a pessoa digita o cartão
        : await asaas.cobranca({ cliente: cli.id, valor, vence, forma: 'UNDEFINED', parcelas: 1, descricao: `Jogos Interativos: ${desc}`, ref });
      r.cliente = cli.id;
    } catch (e) {
      console.warn('asaas:', e.message);
      if (nova) await contas.apagar(conta.id);
      return sendJson(res, 502, { error: `Não deu para criar o pagamento: ${e.message}` });
    }
    // Trocou de plano: cancela a assinatura antiga
    if (conta.plano?.asaasSub && conta.plano.asaasSub !== r.id) asaas.cancelarAssinatura(conta.plano.asaasSub).catch((e) => console.warn('asaas cancelar:', e.message));
    const plano = { ciclo, games, todos, valor, forma, parcelas, cpf, teste, cabe: pr.cabe, inicio: agora, ate: teste ? agora + TESTE_DIAS * DIA : Math.max(agora, Number(conta.plano?.ate || 0)), status: teste ? 'teste' : conta.plano?.status === 'ativo' && Number(conta.plano.ate || 0) > agora ? 'ativo' : 'aguardando', asaasCliente: r.cliente, asaasSub: ciclo === 'mensal' ? r.id : '', asaasPag: ciclo === 'anual' ? r.id : '', parcelamento: r.parcelamento || '', fatura: r.fatura, formaPref: forma, desc };
    await contas.alterar(conta.id, { games, plano, status: 'ok' }); contas.esqueceCache(conta.id);
    if (nova) { const { token } = await contas.novaSessao(conta.id); setSess(req, res, token, 2592000); }
    console.log(`assinatura: conta ${conta.id} ${desc} ${reais(valor)}${teste ? ' (teste grátis)' : ''}`);
    return sendJson(res, 200, { ok: true, teste, pagar: '/pagar', valor, ciclo, ate: plano.ate });
  }
  if (url.pathname === '/api/asaas/webhook' && req.method === 'POST') {
    // Avisos do Asaas: pagamento confirmado libera os jogos; atrasado/cancelado marca o plano
    if (!ASAAS_WEBHOOK_TOKEN || req.headers['asaas-access-token'] !== ASAAS_WEBHOOK_TOKEN) return sendJson(res, 401, { error: 'token' });
    const b = await lerJson(req); const pay = b?.payment, ev = String(b?.event || '');
    const subDel = ev === 'SUBSCRIPTION_DELETED' || ev === 'SUBSCRIPTION_INACTIVATED' ? b?.subscription?.id : '';
    if (!pay && !subDel) return sendJson(res, 200, { ok: true });
    const u = (await contas.listar()).find((x) => x.plano?.ciclo && (subDel ? x.plano.asaasSub === subDel
      : pay.subscription ? x.plano.asaasSub === pay.subscription
      : x.plano.asaasPag === pay.id || (pay.installment && x.plano.parcelamento === pay.installment) || (!x.plano.asaasSub && pay.externalReference === `conta:${x.id}`)));
    if (!u) return sendJson(res, 200, { ok: true, achou: false });
    const pl = { ...u.plano };
    if (ev === 'PAYMENT_CONFIRMED' || ev === 'PAYMENT_RECEIVED') {
      await liberar(u, pay); return sendJson(res, 200, { ok: true });
    } else if (ev === 'PAYMENT_OVERDUE') { pl.status = 'atrasado'; if (pay.invoiceUrl) pl.fatura = pay.invoiceUrl; }
    else if (ev === 'PAYMENT_CREATED' || ev === 'PAYMENT_UPDATED') { if (pay.invoiceUrl && pay.status === 'PENDING') pl.fatura = pay.invoiceUrl; }
    else if (ev === 'PAYMENT_REFUNDED' || ev === 'PAYMENT_CHARGEBACK_REQUESTED') { pl.status = 'cancelado'; pl.ate = Date.now(); }
    else if (subDel || (ev === 'PAYMENT_DELETED' && pl.ciclo === 'anual' && pl.status !== 'ativo')) pl.status = 'cancelado';
    else return sendJson(res, 200, { ok: true });
    await contas.alterar(u.id, { plano: pl }); contas.esqueceCache(u.id);
    console.log(`asaas: ${ev} conta ${u.id} → ${pl.status} até ${new Date(pl.ate).toISOString().slice(0, 10)}`);
    return sendJson(res, 200, { ok: true });
  }
  // ---------- Página de pagamento do próprio site (/pagar) ----------
  if (url.pathname.startsWith('/api/pagamento')) {
    const c = await contaDe(req); if (!c) return sendJson(res, 401, { error: 'faça login' });
    const pl = c.plano || {};
    if (!pl.ciclo) return sendJson(res, 404, { error: 'você ainda não tem plano' });
    if (!asaas.ligado()) return sendJson(res, 503, { error: 'pagamentos desligados' });
    const sub = url.pathname.slice('/api/pagamento'.length);
    try {
      // A cobrança em aberto agora (mensal: a mais antiga da assinatura; anual: a cobrança única)
      const pendente = async () => {
        if (pl.ciclo === 'mensal' && pl.asaasSub) return asaas.pendenteDaAssinatura(pl.asaasSub);
        if (pl.asaasPag) {
          const p = await asaas.cobrancaGet(pl.asaasPag);
          if (p.status === 'PENDING' || p.status === 'OVERDUE') return p;
          // Anual que já venceu: nova cobrança de renovação (1 ano)
          if (pl.ciclo === 'anual' && planoVencido(c) && pl.pagos?.length) {
            const r = await asaas.cobranca({ cliente: pl.asaasCliente, valor: pl.valor, vence: dataAsaas(Date.now()), forma: 'UNDEFINED', parcelas: 1, descricao: `Jogos Interativos: renovação ${pl.desc || 'plano anual'}`, ref: `conta:${c.id}` });
            Object.assign(pl, { asaasPag: r.id, parcelamento: '' }); await contas.alterar(c.id, { plano: pl }); contas.esqueceCache(c.id);
            return asaas.cobrancaGet(r.id);
          }
        }
        return null;
      };
      if (sub === '' && req.method === 'GET') {
        const p = await pendente();
        const nomes = (pl.todos ? CAT_IDS : pl.games || []);
        return sendJson(res, 200, { plano: planoPublico(pl), vencido: Boolean(planoVencido(c)), aviso: planoVencido(c) ? avisoDe(c) : '', jogos: nomes, desc: pl.desc || '', formaPref: pl.formaPref || 'PIX', cpf: pl.cpf || '', email: String(c.username).includes('@') ? c.username : '', precisaCartao: pl.ciclo === 'anual' && !pl.asaasPag && pl.status !== 'ativo',
          pendente: p ? { id: p.id, valor: Math.round(p.value * 100), vence: p.dueDate, status: p.status } : null, maxParcelas: Math.max(1, Math.min(12, Math.floor(pl.valor / 500))) });
      }
      if (sub === '/pix' || sub === '/boleto') {
        const p = await pendente(); if (!p) return sendJson(res, 404, { error: 'nada em aberto' });
        if (sub === '/pix') { const q = await asaas.pix(p.id); return sendJson(res, 200, { img: q.encodedImage, payload: q.payload, expira: q.expirationDate }); }
        const l = await asaas.linhaBoleto(p.id); return sendJson(res, 200, { linha: l.identificationField, pdf: p.bankSlipUrl || '' });
      }
      if (sub === '/status') {
        // Confere direto no Asaas (não espera o aviso): se já caiu, libera na hora
        const id = pl.ciclo === 'anual' ? pl.asaasPag : url.searchParams.get('id');
        if (id && /^pay_\w+$/.test(id)) { const p = await asaas.cobrancaGet(id); if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status) && (p.subscription ? p.subscription === pl.asaasSub : p.id === pl.asaasPag || p.installment === pl.parcelamento)) await liberar(c, p); }
        const atual = await contas.porId(c.id); contas.esqueceCache(c.id);
        return sendJson(res, 200, { plano: planoPublico(atual.plano), vencido: Boolean(planoVencido(atual)) });
      }
      if (sub === '/cartao' && req.method === 'POST') {
        if (demais(req)) return sendJson(res, 429, { error: 'muitas tentativas, espere um minuto' });
        const b = await lerJson(req); if (!b) return sendJson(res, 400, { error: 'dados inválidos' });
        const num = String(b.numero || '').replace(/\D/g, ''), cvv = String(b.cvv || '').replace(/\D/g, ''), mes = String(b.mes || '').padStart(2, '0'), ano = String(b.ano || '').length === 2 ? '20' + b.ano : String(b.ano || '');
        const luhn = (n) => { let s = 0; for (let i = 0; i < n.length; i++) { let d = Number(n[n.length - 1 - i]); if (i % 2) { d *= 2; if (d > 9) d -= 9; } s += d; } return n.length >= 13 && s % 10 === 0; };
        if (!luhn(num)) return sendJson(res, 400, { error: 'número do cartão inválido' });
        if (!/^(0[1-9]|1[0-2])$/.test(mes) || !/^20\d\d$/.test(ano)) return sendJson(res, 400, { error: 'validade inválida (mês/ano)' });
        if (cvv.length < 3) return sendJson(res, 400, { error: 'código de segurança inválido' });
        const cartao = { nome: String(b.nome || '').trim().slice(0, 60), numero: num, mes, ano, cvv };
        if (cartao.nome.length < 3) return sendJson(res, 400, { error: 'coloque o nome como está no cartão' });
        const titular = { nome: String(b.titular || cartao.nome).trim().slice(0, 80), email: String(c.username).includes('@') ? c.username : String(b.email || ''), cpf: String(b.cpf || pl.cpf || '').replace(/\D/g, ''), cep: String(b.cep || '').replace(/\D/g, ''), numeroCasa: String(b.numeroCasa || '').slice(0, 10), telefone: String(b.telefone || '').replace(/\D/g, '') };
        if (!asaas.docValido(titular.cpf)) return sendJson(res, 400, { error: 'CPF ou CNPJ do titular inválido' });
        if (titular.cep.length !== 8) return sendJson(res, 400, { error: 'CEP inválido' });
        if (!titular.numeroCasa) return sendJson(res, 400, { error: 'coloque o número do endereço' });
        if (titular.telefone.length < 10) return sendJson(res, 400, { error: 'coloque o celular com DDD' });
        const ip = ipDe(req);
        let pago = null, msg = '';
        if (pl.ciclo === 'mensal') {
          await asaas.cartaoNaAssinatura(pl.asaasSub, cartao, titular, ip);
          const p = await pendente();
          const hoje = dataAsaas(Date.now());
          if (p && p.dueDate <= hoje) pago = await asaas.pagarComCartao(p.id, cartao, titular, ip);
          msg = pago ? 'Pagamento aprovado!' : `Cartão cadastrado: a cobrança de ${reais(pl.valor)} cai sozinha todo mês${p ? `, a primeira em ${p.dueDate.split('-').reverse().join('/')}` : ''}.`;
          await contas.alterar(c.id, { plano: { ...pl, formaPref: 'CREDIT_CARD', cartao: true } });
        } else {
          const parcelas = Math.max(1, Math.min(12, Number(b.parcelas) || 1, Math.floor(pl.valor / 500)));
          const p = await pendente();
          if (p && parcelas === 1) pago = await asaas.pagarComCartao(p.id, cartao, titular, ip);
          else {
            if (p) await asaas.apagarCobranca(p.id).catch(() => {});
            pago = await asaas.cobrancaCartao({ cliente: pl.asaasCliente, valor: pl.valor, parcelas, descricao: `Jogos Interativos: ${pl.desc || 'plano anual'}`, ref: `conta:${c.id}`, cartao, titular, ip, vence: dataAsaas(Date.now()) });
            await contas.alterar(c.id, { plano: { ...pl, asaasPag: pago.id, parcelamento: pago.installment || '', parcelas, formaPref: 'CREDIT_CARD' } });
          }
          msg = 'Pagamento aprovado!';
        }
        const fresco = await contas.porId(c.id);
        if (pago && ['CONFIRMED', 'RECEIVED'].includes(pago.status)) await liberar(fresco, pago);
        else if (pago) msg = 'Pagamento em análise pelo banco: assim que aprovar, os jogos liberam sozinhos.';
        contas.esqueceCache(c.id);
        const atual = await contas.porId(c.id);
        return sendJson(res, 200, { ok: true, msg, plano: planoPublico(atual.plano), vencido: Boolean(planoVencido(atual)) });
      }
    } catch (e) {
      console.warn('pagamento:', e.message);
      return sendJson(res, 502, { error: e.message.replace(/asaas/ig, 'pagamento') });
    }
    return sendJson(res, 404, { error: 'rota' });
  }
  if (url.pathname === '/planos') { if (!(await contaDe(req))) { res.writeHead(302, { location: '/?login' }); return res.end(); } return sendStatic(req, res, path.join(PUBLIC_DIR, 'inicio.html')); }
  if (url.pathname === '/pagar') { if (!(await contaDe(req))) { res.writeHead(302, { location: '/?login' }); return res.end(); } return sendStatic(req, res, path.join(PUBLIC_DIR, 'pagar.html')); }
  if (url.pathname === '/api/email-livre') { const e = String(url.searchParams.get('e') || '').trim().toLowerCase(); if (demais(req)) return sendJson(res, 429, { error: 'espere um minuto' }); return sendJson(res, 200, { livre: !(await contas.porNome(e)) }); }
  if (url.pathname === '/api/planos') return sendJson(res, 200, { total: CAT_IDS.length, pagamentos: asaas.ligado(), sandbox: asaas.sandbox(), testeDias: TESTE_DIAS });
  // Página do painel: sem login mostra a página de entrada com o catálogo (a tela da live, ?clean=1, abre sem login — é a fonte do LIVE Studio/OBS)
  if ((url.pathname === '/' || url.pathname === '/index.html') && url.searchParams.get('clean') !== '1') {
    const c = await contaDe(req);
    if (!c) return sendStatic(req, res, path.join(PUBLIC_DIR, 'inicio.html'));
    if (planoVencido(c)) { res.writeHead(302, { location: destinoPagar(c), 'cache-control': 'no-store' }); return res.end(); } // sem plano ou sem pagamento confirmado: painel bloqueado
  }
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
      if (msg.role !== 'screen') {
        const c = await contas.contaDaSessao(ws.token);
        if (!c) return ws.send(JSON.stringify({ type: 'status', state: 'error', message: 'Faça login de novo.' }));
        // Plano vencido ou ainda sem pagamento: não conecta na live até pagar
        if (planoVencido(c)) return ws.send(JSON.stringify({ type: 'status', state: 'error', message: c.plano.status === 'aguardando' ? 'Falta pagar o plano: clique em "Falta pagar" no topo. Assim que o pagamento cair, a live conecta.' : 'Seu plano venceu: pague pelo botão no topo para conectar de novo.' }));
      }
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
