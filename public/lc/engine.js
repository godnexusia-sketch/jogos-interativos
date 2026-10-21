'use strict';

// Motor dos jogos novos (estilo Livecade): cada jogo declara configurações, ações e gatilhos padrão.
// O painel liga eventos da live (presente, comentário, like, seguir, compartilhar, entrar) às ações do jogo.
// Os 14 jogos antigos continuam com o onEvent deles e ficam na categoria "Clássicos".

const GENRES = [
  { id: 'all', name: 'Todos', icon: '🎮' },
  { id: 'party', name: 'Festa', icon: '🎉' },
  { id: 'royale', name: 'Battle Royale', icon: '👑' },
  { id: 'racing', name: 'Corrida', icon: '🏁' },
  { id: 'trivia', name: 'Quiz', icon: '❓' },
  { id: 'word', name: 'Palavras', icon: '🔤' },
  { id: 'battle', name: 'Luta e Batalha', icon: '⚔️' },
  { id: 'arcade', name: 'Arcade', icon: '🕹️' },
  { id: 'talk', name: 'Voz e IA', icon: '🎙️' },
  { id: 'classic', name: 'Clássicos', icon: '⭐' },
];

const TRIGGERS = {
  gift: { icon: '🎁', name: 'Presente' },
  comment: { icon: '💬', name: 'Comentário' },
  like: { icon: '❤️', name: 'Like' },
  follow: { icon: '⭐', name: 'Seguir' },
  share: { icon: '🔁', name: 'Compartilhar' },
  join: { icon: '👋', name: 'Entrar na live' },
};

const WHO_CAN_PLAY = [['all', 'Todo mundo'], ['followers', 'Só seguidores'], ['subs', 'Só assinantes'], ['fans', 'Só fã-clube'], ['mods', 'Só moderadores']];

// ---------- Texto ----------
// Minúsculas, sem acento e sem pontuação: "Brasíl!" -> "brasil".
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function lev(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// Resposta certa? Aceita sinônimos e um erro de digitação em palavras de 6+ letras.
function answerMatch(text, answers) {
  const t = norm(text);
  if (!t) return false;
  for (const a of [].concat(answers)) {
    const n = norm(a);
    if (!n) continue;
    if (t === n || t.replace(/ /g, '') === n.replace(/ /g, '')) return true;
    if (n.length >= 6 && lev(t, n) <= 1) return true;
  }
  return false;
}
// Letra de alternativa no começo do comentário ("b", "B)", "letra c").
function answerLetter(text, letters = 'abcd') {
  const t = norm(text).replace(/^letra /, '');
  const m = t.match(/^([a-z])\b/);
  return m && letters.includes(m[1]) ? m[1] : null;
}
const fmtNum = (n) => Math.round(n).toLocaleString('pt-BR');
const fmtK = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + 'M' : n >= 1e4 ? Math.round(n / 1000) + 'k' : n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',') + 'k' : String(Math.round(n)));

// ---------- Sorteio igual em todas as telas ----------
// O painel e a tela da live rodam cada um a sua cópia do jogo. Com a mesma semente, sorteiam a mesma pergunta.
const RNG = { seed: (Math.random() * 1e9) | 0 };
function hashStr(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function makeRng(tag) {
  let a = hashStr(RNG.seed + ':' + tag) || 1;
  const f = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.shuffle = (arr) => { const a2 = [...arr]; for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; };
  return f;
}

// ---------- Conteúdo (perguntas, palavras…) ----------
const DATA = {};
function loadData(name) {
  if (!DATA[name]) DATA[name] = fetch(`/data/${name}.json`).then((r) => r.json()).catch(() => null);
  return DATA[name];
}
// Lista do admin (textarea) sobrepõe/complementa o banco: uma linha por item.
const lines = (s) => String(s || '').split('\n').map((l) => l.trim()).filter(Boolean);

// ---------- Placar salvo (pontos que os espectadores juntam) ----------
const scores = {
  get(game) { return store.get('score:' + game, {}); },
  add(game, user, pts = 1, wins = 0) {
    if (!user || user.id?.startsWith('sim_') && !scores.countSim) return;
    const all = this.get(game), k = user.id || user.nick;
    const row = all[k] || { nick: user.nick, pic: user.pic, pts: 0, wins: 0 };
    row.nick = user.nick; row.pic = user.pic || row.pic; row.pts += pts; row.wins += wins; row.t = Date.now();
    all[k] = row;
    store.set('score:' + game, all);
  },
  top(game, n = 10, key = 'pts') { return Object.entries(this.get(game)).map(([id, r]) => ({ id, ...r })).sort((a, b) => b[key] - a[key]).slice(0, n); },
  clear(game) { store.set('score:' + game, {}); },
  countSim: true, // o simulador também pontua (útil para testar); o painel pode desligar
};

// ---------- Registro ----------
function defineGame(def) {
  const g = Object.assign({
    genre: 'party', icon: '🎮', desc: '', settings: [], actions: [], bindings: [], three: false,
    meterY: 200, guide: true,
  }, def);
  g.v2 = true;
  // Configurações comuns a todos os jogos
  g.settings = [...g.settings,
    { key: 'whoCanPlay', type: 'select', label: 'Quem pode jogar', options: WHO_CAN_PLAY, default: 'all', group: 'Geral' },
    { key: 'showGuide', type: 'toggle', label: 'Mostrar na tela o que mandar para jogar', default: true, group: 'Geral' },
    { key: 'guidePos', type: 'select', label: 'Posição do guia', options: [['bottom', 'Embaixo'], ['top', 'Em cima']], default: g.guidePos || 'bottom', group: 'Geral', showIf: { key: 'showGuide', value: true } },
    { key: 'bgColor', type: 'color', label: 'Cor de fundo (vazio = do jogo)', default: '', group: 'Fundo' },
    { key: 'bgImage', type: 'media', accept: 'image', label: 'Imagem de fundo', default: '', group: 'Fundo' },
  ];
  g.s = loadSettings(g);
  g.binds = store.get('bind:' + g.id, null) || defaultBinds(g);
  g.help = g.help || `<p>${g.desc}</p>`;
  GAMES.push(g);
  return g;
}
// Os jogos antigos (registerGame) entram como Clássicos.
const _registerGame = registerGame;
// eslint-disable-next-line no-global-assign
registerGame = function (game) { game.genre = game.genre || 'classic'; game.desc = game.desc || game.help?.replace(/<[^>]+>/g, ' ').slice(0, 160); _registerGame(game); };

function defaultBinds(g) { return g.bindings.map((b, i) => ({ id: g.id + '-' + i, on: true, count: 1, ...b })); }
function settingDefaults(g) { return Object.fromEntries(g.settings.map((s) => [s.key, s.default])); }
function loadSettings(g) { return { ...settingDefaults(g), ...store.get('set:' + g.id, {}) }; }
function saveSettings(g, values, share = true) {
  g.s = { ...settingDefaults(g), ...values };
  store.set('set:' + g.id, g.s);
  g.onSettings?.();
  if (share && typeof shareConfig === 'function') shareConfig('set:' + g.id, g.s);
}
function saveBinds(g, binds, share = true) {
  g.binds = binds;
  store.set('bind:' + g.id, binds);
  if (share && typeof shareConfig === 'function') shareConfig('bind:' + g.id, binds);
}
// Configuração que chega do painel para a tela da live
function applyRemoteConfig(key, data) {
  const m = key.match(/^(set|bind):(.+)$/);
  if (m) {
    const g = GAMES.find((x) => x.id === m[2]);
    if (!g) return true;
    if (m[1] === 'set') saveSettings(g, data, false); else saveBinds(g, data, false);
    return true;
  }
  if (key.startsWith('live:')) { liveCfg.apply(key.slice(5), data); return true; }
  return false;
}

// ---------- Gatilhos ----------
const likeAcc = new Map(); // `${jogo}|${bind}|${pessoa}` -> likes acumulados

function canPlay(g, user) {
  const w = g.s.whoCanPlay;
  if (!w || w === 'all' || user?.id?.startsWith('sim_')) return true;
  if (w === 'followers') return user.fol || user.sub || user.mod;
  if (w === 'subs') return user.sub;
  if (w === 'fans') return user.fan || user.sub;
  if (w === 'mods') return user.mod;
  return true;
}
function keywordHit(text, keys) {
  const t = norm(text);
  const list = String(keys || '').split(',').map(norm).filter(Boolean);
  if (!list.length) return true;
  return list.some((k) => t === k || t.startsWith(k + ' '));
}
const learnedGifts = store.get('giftImgs', {}); // id -> imagem, aprendida com os presentes reais
function giftInfo(id) {
  const c = typeof GIFT_CATALOG !== 'undefined' ? GIFT_CATALOG.find((x) => x.id === String(id)) : null;
  return c ? { ...c, img: learnedGifts[c.id] || c.img || '' } : null;
}

// Monta o pacote que a ação recebe: quem, quanto vale, força e quantidade já calculadas.
function actionArgs(ev, extra = {}) {
  const c = ev.type === 'gift' ? coins(ev) : ev.type === 'like' ? Math.max(0.04, (ev.count || 1) / 25) : ev.type === 'social' ? SOCIAL_COINS[ev.action === 'share' ? 'share' : 'follow'] : 1;
  return { user: ev.user, coins: c, count: ev.count || 1, power: 1 + Math.log2(Math.max(1, c)), qty: clamp(Math.round(Math.sqrt(c)), 1, 50), gift: ev.type === 'gift' ? { id: ev.giftId, name: ev.name, img: ev.img, diamonds: ev.diamonds } : null, text: ev.text || '', ev, ...extra };
}

// Passa o evento pelos gatilhos do jogo atual e executa as ações ligadas.
function runTriggers(g, ev) {
  if (!g?.v2) return;
  const trig = ev.type === 'chat' ? 'comment' : ev.type === 'social' ? (ev.action === 'share' ? 'share' : 'follow') : ev.type;
  const fire = (b, args) => {
    const act = g.actions.find((a) => a.id === b.action);
    if (!act) return;
    const times = clamp(Math.round(b.count || 1), 1, 50);
    for (let i = 0; i < times; i++) g.onAction?.(b.action, { ...args, bind: b, params: b.params || {} });
    if (typeof actFeed !== 'undefined') actFeed.push(g, b, args, times); // aviso na tela: ícone ×quantidade → efeito
  };
  const binds = g.binds.filter((b) => b.on !== false && b.trigger === trig);
  if (ev.type !== 'gift' && !canPlay(g, ev.user)) return;
  if (trig === 'gift') {
    const c = coins(ev);
    // Presente específico ganha de "qualquer presente"; entre os genéricos vale o de maior mínimo que o valor alcança.
    const exact = binds.filter((b) => b.giftId && String(b.giftId) === String(ev.giftId));
    const byName = exact.length ? [] : binds.filter((b) => !b.giftId && b.giftName && norm(b.giftName) === norm(ev.name));
    if (exact.length || byName.length) { for (const b of [...exact, ...byName]) if (c >= (b.minCoins || 0)) fire(b, actionArgs(ev)); return; }
    const generic = binds.filter((b) => !b.giftId && !b.giftName && c >= (b.minCoins || 0));
    if (!generic.length) return;
    const best = Math.max(...generic.map((b) => b.minCoins || 0));
    for (const b of generic.filter((x) => (x.minCoins || 0) === best)) fire(b, actionArgs(ev));
  } else if (trig === 'like') {
    for (const b of binds) {
      const need = Math.max(1, b.likes || 1);
      const k = `${g.id}|${b.id}|${uid(ev)}`;
      let acc = (likeAcc.get(k) || 0) + (ev.count || 1);
      let n = Math.floor(acc / need);
      acc -= n * need;
      likeAcc.set(k, acc);
      n = Math.min(n, 15);
      for (let i = 0; i < n; i++) fire(b, actionArgs({ ...ev, count: need }));
    }
  } else if (trig === 'comment') {
    for (const b of binds) if (keywordHit(ev.text, b.text)) fire(b, actionArgs(ev));
  } else {
    for (const b of binds) fire(b, actionArgs(ev));
  }
}

// Ação de teste (botão no painel): pessoa de mentira, valor escolhido.
function testAction(g, actionId, coinsValue = 1, user = null) {
  const u = user || (typeof fakeUser === 'function' ? fakeUser() : { id: 'sim_x', nick: 'teste' });
  const ev = { type: 'gift', user: u, name: 'Teste', diamonds: coinsValue, count: 1 };
  g.onAction?.(actionId, { ...actionArgs(ev), test: true, params: {} });
}

// ---------- Guia na tela: o que mandar para jogar ----------
function guideItems(g) {
  const seen = new Set(), out = [];
  for (const b of g.binds) {
    if (b.on === false) continue;
    const act = g.actions.find((a) => a.id === b.action);
    if (!act || act.hidden) continue;
    let what;
    if (b.trigger === 'gift') {
      const gi = b.giftId ? giftInfo(b.giftId) : null;
      what = gi ? { img: gi.img, txt: gi.name, coins: gi.coins } : b.giftName ? { emoji: '🎁', txt: b.giftName } : { emoji: '🎁', txt: b.minCoins > 1 ? `${fmtK(b.minCoins)}+ 🪙` : 'Presente' };
    } else if (b.trigger === 'comment') what = { emoji: '💬', txt: b.text ? '"' + String(b.text).split(',')[0].trim() + '"' : 'Comente' };
    else if (b.trigger === 'like') what = { emoji: '❤️', txt: (b.likes || 1) > 1 ? `${b.likes} likes` : 'Like' };
    else what = { emoji: TRIGGERS[b.trigger].icon, txt: TRIGGERS[b.trigger].name };
    const key = what.txt + '|' + act.label;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...what, label: act.label, icon: act.icon });
  }
  return out;
}
const guideState = { t: 0 };
function drawGuide(g) {
  if (!g?.v2 || !g.s.showGuide || g.noGuide) return;
  const items = g.guideItems ? g.guideItems() : guideItems(g);
  if (!items.length) return;
  guideState.t += 1 / 60;
  const per = 3, pages = Math.ceil(items.length / per);
  const page = Math.floor(guideState.t / 4) % pages;
  const show = items.slice(page * per, page * per + per);
  const y = g.s.guidePos === 'top' ? 26 + (g.guideTop || 0) : H - 58 - (g.guideBottom || 0);
  const w = Math.min(226, (W - 24) / show.length - 8);
  const x0 = W / 2 - (show.length * (w + 8) - 8) / 2;
  const fade = clamp(Math.min((guideState.t % 4) * 4, (4 - (guideState.t % 4)) * 4), 0, 1);
  ctx.save();
  ctx.globalAlpha = pages > 1 ? fade : 1;
  show.forEach((it, i) => {
    const x = x0 + i * (w + 8);
    ctx.fillStyle = 'rgba(8,10,20,.78)';
    ctx.beginPath(); ctx.roundRect(x, y, w, 46, 23); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5; ctx.stroke();
    const img = it.img ? getImg(proxImgUrl(it.img)) : null;
    if (img) ctx.drawImage(img, x + 6, y + 5, 36, 36);
    else label(it.emoji || '🎁', x + 24, y + 24, 24, '#fff', 'center', 400);
    label(trim(it.txt, 13), x + 48, y + 16, 13, '#ffd23f', 'left', 800);
    label(trim((it.icon ? it.icon + ' ' : '') + it.label, 18), x + 48, y + 33, 14, '#fff', 'left', 700);
  });
  ctx.restore();
}
const proxImgUrl = (url) => (!url || url.startsWith('data:') || url.startsWith('/') ? url : `/api/img?u=${encodeURIComponent(url)}`);

// Fundo personalizado (cor ou imagem do admin), desenhado antes do jogo quando configurado.
function customBackground(g) {
  if (!g?.v2) return false;
  if (g.s.bgImage) {
    const img = getImg(g.s.bgImage);
    if (img) {
      const s = Math.max(W / img.width, H / img.height);
      ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
      return true;
    }
  }
  if (g.s.bgColor) { ctx.fillStyle = g.s.bgColor; ctx.fillRect(0, 0, W, H); return true; }
  return false;
}

// ---------- IA com uma resposta só para todas as telas ----------
// Quem pergunta é o "líder" (o painel, ou a tela da live se não houver painel). As outras cópias esperam a resposta.
const ai = {
  leader: true,
  waiting: new Map(), // chave -> resolve
  got: new Map(),
  async ask(key, system, prompt, fallback = '', max = 160) {
    if (this.got.has(key)) return this.got.get(key);
    if (!this.leader) {
      return new Promise((resolve) => {
        this.waiting.set(key, resolve);
        setTimeout(() => { if (this.waiting.delete(key)) resolve(fallback); }, 25000);
      });
    }
    let text = '';
    try {
      const r = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ system, prompt, max }) });
      if (r.ok) text = (await r.json()).text || '';
    } catch {}
    text = cleanAi(text) || fallback;
    this.got.set(key, text);
    if (this.got.size > 300) this.got.delete(this.got.keys().next().value);
    if (typeof busSend === 'function') busSend({ t: 'ai', key, text });
    return text;
  },
  receive(key, text) {
    this.got.set(key, text);
    const r = this.waiting.get(key);
    if (r) { this.waiting.delete(key); r(text); }
  },
};
// Tira markdown, aspas e emojis demais da resposta da IA (vai ser lida em voz alta).
function cleanAi(t) {
  return String(t || '').replace(/[*_#`>]/g, '').replace(/^["“']|["”']$/g, '').replace(/\s+/g, ' ').trim().slice(0, 400);
}

// ---------- HUD comum dos jogos novos ----------
// Cabeçalho com título e subtítulo (estilo programa de TV).
function hudTitle(str, sub, y = 70, color = '#fff', accent = '#22e3ee') {
  title(str, W / 2, y, 50, color);
  if (sub) pill(sub, W / 2, y + 44, { bg: 'rgba(0,0,0,.55)', color: accent, size: 17 });
}
// Relógio redondo que esvazia.
function hudTimer(x, y, r, left, total, color = '#22e3ee') {
  const pct = total > 0 ? clamp(left / total, 0, 1) : 0;
  const warn = left <= 5 && total > 0;
  ctx.save();
  ctx.fillStyle = 'rgba(6,8,16,.85)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.lineWidth = r * 0.16; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(x, y, r * 0.84, 0, 7); ctx.stroke();
  ctx.strokeStyle = warn ? '#ff3b5c' : color;
  ctx.beginPath(); ctx.arc(x, y, r * 0.84, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2); ctx.stroke();
  ctx.restore();
  num(String(Math.max(0, Math.ceil(left))), x, y + 2, r * 0.95, warn ? '#ff3b5c' : '#fff');
}
// Lista de líderes com foto. rows: [{ user|nick/pic, value, sub }]
function hudBoard(rows, x, y, w, { title: ttl = 'TOP', n = 5, unit = '', rowH = 40, color = '#ffc93c', bg = 'rgba(8,10,20,.8)' } = {}) {
  rows = rows.slice(0, n);
  if (!rows.length) return 0;
  const h = 40 + rows.length * rowH + 8;
  ctx.save();
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
  label(ttl, x + w / 2, y + 21, 16, color, 'center', 900, F_TITLE);
  rows.forEach((r, i) => {
    const ry = y + 40 + i * rowH + rowH / 2;
    posBadge(i + 1, x + 22, ry, 24);
    avatar(r.user || { nick: r.nick, pic: r.pic }, x + 54, ry, rowH * 0.38, i === 0 ? '#ffc93c' : 'rgba(255,255,255,.6)');
    label(trim(r.user?.nick || r.nick || '?', Math.floor((w - 150) / 9)), x + 76, ry + 1, 16, '#fff', 'left', 800);
    label(`${typeof r.value === 'number' ? fmtK(r.value) : r.value}${unit}`, x + w - 14, ry + 1, 16, color, 'right', 900);
  });
  return h;
}
// Faixa de quem acertou (fotos em fila).
function hudWinners(list, y, { title: ttl = 'ACERTARAM', color = '#7cff6b', max = 12 } = {}) {
  if (!list.length) return;
  const shown = list.slice(0, max), r = 22, gap = 50;
  const w = Math.min(W - 40, shown.length * gap + 40);
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,20,.78)'; ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, y - 14, w, 92, 18); ctx.fill();
  ctx.restore();
  label(`${ttl} · ${list.length}`, W / 2, y + 4, 14, color, 'center', 900);
  shown.forEach((u, i) => avatar(u, W / 2 - (shown.length - 1) * gap / 2 + i * gap, y + 44, r, color));
}
// Contagem regressiva grande no meio ("3, 2, 1").
function bigCount(n, color = '#fff') { if (n > 0) num(String(n), W / 2, H / 2, 180, color); }

// Imagem de capa cobrindo um retângulo (mantém proporção, corta o excesso).
function coverImg(img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height), iw = img.width * s, ih = img.height * s;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.restore();
}

// Rodada com fases (pergunta → revelação → intervalo). Cada jogo chama phase.update(dt) e lê phase.name.
class Phases {
  constructor(onEnter) { this.name = 'idle'; this.t = 0; this.total = 0; this.onEnter = onEnter; }
  go(name, secs) { this.name = name; this.t = secs; this.total = secs; this.onEnter?.(name); }
  update(dt) {
    if (this.t > 0) { this.t -= dt; if (this.t <= 0) { this.t = 0; return true; } }
    return false;
  }
  get pct() { return this.total ? 1 - this.t / this.total : 0; }
}

// Gerencia uma partida de vários rounds (fim por rodadas, pontos ou infinito).
const MATCH_SETTINGS = (rounds = 10, points = 50) => [
  { key: 'matchEnd', type: 'select', label: 'Fim da partida', options: [['infinite', 'Infinito'], ['rounds', 'Número de rodadas'], ['points', 'Pontos para vencer']], default: 'infinite', group: 'Partida' },
  { key: 'matchRounds', type: 'number', label: 'Rodadas por partida', min: 1, max: 100, default: rounds, group: 'Partida', showIf: { key: 'matchEnd', value: 'rounds' } },
  { key: 'matchPoints', type: 'number', label: 'Pontos para vencer', min: 5, max: 1000, default: points, group: 'Partida', showIf: { key: 'matchEnd', value: 'points' } },
];
function matchOver(g, round, bestPts) {
  if (g.s.matchEnd === 'rounds') return round >= g.s.matchRounds;
  if (g.s.matchEnd === 'points') return bestPts >= g.s.matchPoints;
  return false;
}
const BOARD_SETTINGS = (n = 5) => [
  { key: 'showLeaderboard', type: 'toggle', label: 'Mostrar ranking', default: true, group: 'Ranking' },
  { key: 'leaderboardSize', type: 'number', label: 'Quantos no ranking', min: 3, max: 10, default: n, group: 'Ranking', showIf: { key: 'showLeaderboard', value: true } },
];
const NARRATE_SETTING = (label = 'Falar o vencedor em voz alta') => ({ key: 'narrate', type: 'toggle', label, default: true, group: 'Voz' });

// Pontos da sessão (zeram ao reiniciar) + placar salvo.
class Points {
  constructor(gameId) { this.game = gameId; this.map = new Map(); }
  add(user, n) {
    const k = user.id || user.nick;
    const r = this.map.get(k) || { user, value: 0 };
    r.user = user; r.value += n;
    this.map.set(k, r);
    scores.add(this.game, user, n);
    return r.value;
  }
  get(user) { return this.map.get(user.id || user.nick)?.value || 0; }
  top(n = 5) { return [...this.map.values()].sort((a, b) => b.value - a.value).slice(0, n); }
  get best() { return this.top(1)[0]?.value || 0; }
  clear() { this.map.clear(); }
}

// Fila de pessoas (jogos de vez em vez: luta, roast, futuro). Não repete quem já está na fila.
class Queue {
  constructor() { this.list = []; }
  push(user, front = false) {
    const k = user.id || user.nick;
    const i = this.list.findIndex((u) => (u.id || u.nick) === k);
    if (i >= 0) { if (!front) return false; this.list.splice(i, 1); }
    front ? this.list.unshift(user) : this.list.push(user);
    return true;
  }
  shift() { return this.list.shift(); }
  get length() { return this.list.length; }
  has(user) { return this.list.some((u) => (u.id || u.nick) === (user.id || user.nick)); }
}
function drawQueue(q, x, y, { n = 5, title: ttl = 'FILA', r = 20 } = {}) {
  if (!q.length) return;
  label(`${ttl} (${q.length})`, x, y, 14, 'rgba(255,255,255,.75)', 'left', 900);
  q.list.slice(0, n).forEach((u, i) => {
    avatar(u, x + r + i * (r * 2 + 8), y + 12 + r, r, 'rgba(255,255,255,.7)');
  });
}

// Bandeiras: imagem do flagcdn (funciona no Windows, onde emoji de bandeira não aparece).
const flagUrl = (code, w = 320) => `/api/img?u=${encodeURIComponent(`https://flagcdn.com/w${w}/${String(code).toLowerCase()}.png`)}`;
