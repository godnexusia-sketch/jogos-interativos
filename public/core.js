'use strict';

// Base compartilhada por todos os jogos: canvas, desenho, avatares, partículas e registro.
const canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
function ctxSwap(c) { ctx = c; }
// Os jogos desenham em 720×1280; o canvas real é 1080×1920 (Full HD vertical), escalado.
const W = 720, H = 1280, SCALE = canvas.width / W;
const F_TEXT = 'Barlow, system-ui, sans-serif', F_NUM = '"Barlow Condensed", Impact, sans-serif', F_TITLE = 'F_TITLE';
// Números e títulos em Barlow Condensed itálico (estilo placar de transmissão esportiva).
function fontCss(weight, size, font) {
  if (font === F_NUM) return `italic 800 ${size}px "Barlow Condensed", Impact, sans-serif`;
  if (font === F_TITLE) return `italic 900 ${size}px "Barlow Condensed", Impact, sans-serif`;
  return `${weight} ${size}px ${font}`;
}
const COLORS = ['#fe2c55', '#25f4ee', '#ffd23f', '#7cff6b', '#b36bff', '#ff8a3d', '#4d9bff', '#ff6bd6'];
const GAMES = [];

function registerGame(game) { GAMES.push(game); }

// ---------- Números ----------
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const uid = (ev) => ev.user?.id || ev.user?.nick || 'anônimo';

// ---------- Valor das interações ----------
// O TikTok manda diamondCount = preço do presente em moedas. O que conta é o total: preço × combo.
// Exemplos da loja: Rosa, TikTok, GG = 1 · Bola de futebol, Fogos, Mãos fazendo coração = 5 · Dedos divinos = 6 ·
// Coração, Fantasminha, Mini dino = 10 · Rosquinha, Buquê, Capybara = 30 · Chapéu e Bigode = 99 ·
// Mãos em coração = 100 · Bons Pressá(gios) = 1.500 · Tom pé = 2.499 · Festa dos Doces = 3.999 ·
// Promessa = 4.999 · Casa = 15.000 · Ária da Sereia = 22.500 · Estrelas do TikTok = 39.999.
const coins = (ev) => (ev.diamonds || 1) * (ev.count || 1);
// Faixa (tipo de ação): 1 = 1–9 moedas · 2 = 10–99 · 3 = 100–999 · 4 = 1.000+.
function giftTier(ev) {
  const c = coins(ev);
  return c >= 1000 ? 4 : c >= 100 ? 3 : c >= 10 ? 2 : 1;
}
// Força (intensidade dentro da faixa), escala log: 1 moeda = 1 · 5 = 3,3 · 10 = 4,3 · 30 = 5,9 · 100 = 7,6 · 1.000 = 11 · 40.000 = 16,3.
const giftPower = (ev) => 1 + Math.log2(coins(ev));
// Quantidade proporcional (raiz): 1 → 1 · 5 → 2 · 10 → 3 · 30 → 5 · 100 → 10 · 1.000 → 32.
const giftQty = (ev, max = 50) => clamp(Math.round(Math.sqrt(coins(ev))), 1, max);
// Interações grátis em "moedas equivalentes", para usar a mesma escala: 25 likes ≈ 1 moeda, seguir ≈ 5, compartilhar ≈ 10.
const SOCIAL_COINS = { follow: 5, share: 10 };
const isFollow = (ev) => ev.type === 'social' && ev.action !== 'share';
const TIER_TXT = ['', '1–9 🪙', '10–99 🪙', '100–999 🪙', '1.000+ 🪙'];
const TIER_HELP = '<p class="tiers"><b>Quanto mais moedas, mais ação.</b> O efeito depende do total (preço × combo) e cresce dentro de cada faixa: 1–9 🪙 (Rosa, Bola, Fogos) · 10–99 🪙 (Coração, Mini dino, Rosquinha, Capybara, Chapéu) · 100–999 🪙 (Mãos em coração) · 1.000+ 🪙 (Bons Presságios, Estrelas do TikTok…). ⭐ Seguir e 🔁 compartilhar também valem.</p>';

// Medidor de presentes, igual em todos os jogos: mostra quem mandou, o valor e a força.
const giftMeter = {
  items: [],
  push(ev) {
    const c = ev.type === 'gift' ? coins(ev) : SOCIAL_COINS[ev.action === 'share' ? 'share' : 'follow'];
    const label = ev.type === 'gift' ? `${trim(ev.name || 'Presente', 14)}${(ev.count || 1) > 1 ? ' ×' + ev.count : ''}` : ev.action === 'share' ? '🔁 compartilhou' : '⭐ seguiu';
    this.items.unshift({ user: ev.user, label, c, tier: giftTier({ diamonds: c }), t: 4 });
    this.items.length = Math.min(this.items.length, 3);
  },
  update(dt) { this.items = this.items.filter((g) => (g.t -= dt) > 0); },
  draw(top = 200) {
    const cols = ['', '#f472b6', '#38bdf8', '#facc15', '#a3e635'];
    this.items.forEach((g, i) => {
      const a = clamp(Math.min((4 - g.t) * 6, g.t * 2), 0, 1), x = W - 18 - 262 + (1 - a) * 60, y = top + i * 66;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(10,8,24,.82)'; ctx.beginPath(); ctx.roundRect(x, y, 262, 56, 14); ctx.fill();
      ctx.strokeStyle = cols[g.tier]; ctx.lineWidth = 2; ctx.stroke();
      avatar(g.user, x + 30, y + 28, 20, cols[g.tier]);
      label(`@${trim(g.user?.nick || '', 11)}`, x + 58, y + 20, 15, '#fff', 'left', 800);
      label(g.label, x + 58, y + 40, 13, 'rgba(255,255,255,.75)', 'left', 600);
      label(`${g.c >= 1000 ? (g.c / 1000).toFixed(g.c >= 10000 ? 0 : 1).replace('.', ',') + 'k' : g.c} 🪙`, x + 250, y + 20, 15, cols[g.tier], 'right', 900);
      // barra de força (log): 1 moeda ≈ 6%, 40.000 = cheia
      const f = clamp((1 + Math.log2(g.c)) / 16.3, 0.06, 1);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x + 176, y + 36, 74, 7);
      ctx.fillStyle = cols[g.tier]; ctx.fillRect(x + 176, y + 36, 74 * f, 7);
      ctx.globalAlpha = 1;
    });
  },
};

class Cooldown {
  constructor(ms) { this.ms = ms; this.last = new Map(); }
  ok(key) {
    const now = performance.now();
    if (now - (this.last.get(key) || -Infinity) < this.ms) return false;
    this.last.set(key, now);
    return true;
  }
}

// ---------- Desenho ----------
// Texto com sombra suave (sem contorno). font: F_TEXT, F_NUM (números grandes) ou F_TITLE (títulos).
function text(str, x, y, size = 40, color = '#fff', align = 'center', weight = 800, font = F_TEXT) {
  ctx.save();
  ctx.font = fontCss(weight, size, font);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.65)';
  ctx.shadowBlur = clamp(size / 5, 3, 8);
  ctx.shadowOffsetY = Math.max(1, size / 18);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}
const num = (str, x, y, size, color = '#fff', align = 'center') => text(str, x, y, size, color, align, 400, F_NUM);
const title = (str, x, y, size, color = '#fff', align = 'center') => text(str, x, y, size, color, align, 400, F_TITLE);

function roundRect(x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function trim(str, n) { str = String(str); return str.length > n ? str.slice(0, n - 1) + '…' : str; }

function wrapText(str, x, y, maxW, size, maxLines = 2, color = '#fff') {
  ctx.font = `800 ${size}px ${F_TEXT}`;
  const lines = [];
  let line = '';
  for (const word of String(str).split(' ')) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; } else line = test;
  }
  lines.push(line);
  lines.slice(0, maxLines).forEach((l, i) => text(l, x, y + i * size * 1.15, size, color));
}

function background(c1, c2) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function colorFor(str) {
  let h = 0;
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

// ---------- Avatares ----------
// Fotos do TikTok passam pelo /api/img do servidor: mesma origem (a foto pode virar textura 3D),
// cache no servidor e sem bloqueio de referer. Cada pessoa pode ter mais de uma URL (pics); se a
// primeira falhar ou expirar, tenta a próxima. Sem nenhuma, fica a inicial numa cor fixa da pessoa.
const imgCache = new Map();
const PIC_RETRY_MS = 45000;
function picSrc(url) {
  if (!url) return '';
  return /^(data:|blob:|\/)/.test(url) ? url : `/api/img?u=${encodeURIComponent(url)}`;
}
function picList(user) {
  return [...new Set([user?.pic, ...(Array.isArray(user?.pics) ? user.pics : [])].filter((x) => typeof x === 'string' && x))].map(picSrc);
}
function getImg(url) {
  if (!url) return null;
  let img = imgCache.get(url);
  if (img?.failedAt && Date.now() - img.failedAt > PIC_RETRY_MS && !img.retried) { imgCache.delete(url); img = null; }
  if (!img) {
    const retried = imgCache.has(url);
    img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';
    // Imagem de outro site passa pelo servidor: assim ela não "contamina" o canvas (pode virar textura 3D e ser exportada).
    img.crossOrigin = 'anonymous';
    img.onerror = () => { img.failedAt = Date.now(); };
    img.retried = retried;
    img.src = /^https?:\/\//.test(url) && !url.startsWith(location.origin) ? picSrc(url) : url;
    imgCache.set(url, img);
    if (imgCache.size > 900) imgCache.delete(imgCache.keys().next().value);
  }
  return img.complete && img.naturalWidth ? img : null;
}
// Primeira foto da pessoa que já carregou (ou null enquanto carrega / se não tiver).
function userImg(user) {
  for (const src of picList(user)) { const img = getImg(src); if (img) return img; }
  return null;
}
// Carrega a primeira foto que funcionar (com CORS liberado, para virar textura) e chama cb(img).
function loadUserImg(user, cb) {
  const list = picList(user);
  const go = (i) => { if (i >= list.length) return; const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => cb(img); img.onerror = () => go(i + 1); img.src = list[i]; };
  go(0);
}
function initialOf(user) { return [...String(user?.nick || user?.handle || '?').replace(/^[^\p{L}\p{N}]+/u, '') || '?'][0].toUpperCase(); }

// Foto do perfil do TikTok num círculo; sem foto, a inicial do nome numa cor fixa por pessoa.
function avatar(user, x, y, r, border = '#fff') {
  const img = userImg(user);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
  if (img) {
    ctx.clip();
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, x - r, y - r, r * 2, r * 2);
  } else {
    const c = colorFor(user?.id || user?.nick || '?');
    const g = ctx.createLinearGradient(x, y - r, x, y + r);
    g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = c; ctx.fill();
    ctx.fillStyle = g; ctx.fill();
    ctx.clip();
    text(initialOf(user), x, y + r * 0.05, r * 1.05, '#fff');
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(2, r / 8);
  ctx.strokeStyle = border;
  ctx.stroke();
}

// Mesma ideia em HTML (painel, alertas, widgets): a inicial fica por baixo e a foto por cima;
// se a foto falhar, passa para a próxima URL e, sem nenhuma, some (fica a inicial, nunca imagem quebrada).
function avatarHtml(user, cls = '') {
  const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const list = picList(user);
  const img = list.length ? `<img src="${e(list[0])}" data-alt="${e(list.slice(1).join('|'))}" alt="" loading="lazy" referrerpolicy="no-referrer" onload="this.classList.add('ok')" onerror="avatarImgError(this)">` : '';
  return `<span class="av ${cls}" style="--av:${colorFor(user?.id || user?.nick || '?')}" title="${e(user?.nick || '')}"><i>${e(initialOf(user))}</i>${img}</span>`;
}
function avatarImgError(img) {
  const rest = (img.dataset.alt || '').split('|').filter(Boolean);
  if (rest.length) { img.dataset.alt = rest.slice(1).join('|'); img.src = rest[0]; } else img.remove();
}

function leaderboard(map, title, x, y, n = 3, size = 28) {
  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  if (!rows.length) return;
  text(title, x, y, size + 2, '#ffd23f');
  rows.forEach(([name, v], i) => text(`${['🥇', '🥈', '🥉', '4º', '5º'][i]} ${trim(name, 16)} — ${v}`, x, y + (i + 1) * (size + 14), size, '#fff', 'center', 600));
}

function addScore(map, key, n = 1) { map.set(key, (map.get(key) || 0) + n); }

// Faixa de aviso temporária no meio da tela ("GOL!", "VENCEDOR" etc.).
const announcer = {
  items: [],
  show(msg, color = '#ffd23f', secs = 2.5, size = 56) { this.items.push({ msg, color, t: secs, total: secs, size }); },
  update(dt) { this.items = this.items.filter((a) => (a.t -= dt) > 0); },
  draw() {
    this.items.slice(-3).forEach((a, i) => {
      const k = Math.min(1, (a.total - a.t) * 6, a.t * 3);
      ctx.globalAlpha = clamp(k, 0, 1);
      text(a.msg, W / 2, H * 0.42 + i * (a.size + 16), a.size * (0.8 + 0.2 * clamp(k, 0, 1)), a.color);
      ctx.globalAlpha = 1;
    });
  },
};

// ---------- Partículas ----------
const particles = [];
function burst(x, y, color = '#ffd23f', n = 24, speed = 380, size = 8) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(speed * 0.3, speed);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.6, 1.2), max: 1.2, color: Array.isArray(color) ? pick(color) : color, size: rand(size * 0.5, size) });
  }
}
function floatText(str, x, y, color = '#fff', size = 34) {
  particles.push({ x, y, vx: rand(-20, 20), vy: -120, life: 1.4, max: 1.4, text: str, color, size, noGravity: true });
}
function updateParticles(dt) {
  for (const p of particles) {
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (!p.noGravity) p.vy += 600 * dt;
  }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
  if (particles.length > 1500) particles.splice(0, particles.length - 1500);
}
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max * 1.5, 0, 1);
    if (p.text) text(p.text, p.x, p.y, p.size, p.color);
    else { ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
  }
  ctx.globalAlpha = 1;
}

// Pergunta cada campo por prompt(); devolve false se a pessoa cancelar.
function editFields(fields) {
  const out = [];
  for (const f of fields) {
    const v = prompt(f.label, f.value);
    if (v === null) return false;
    out.push(v.trim() || f.value);
  }
  return out;
}

// ---------- Som (gerado na hora, sem arquivos) ----------
// O navegador só libera áudio depois do primeiro clique na página; no OBS ele já vem liberado.
const sfx = {
  ctx: null,
  muted: false,
  get ac() {
    if (!this.ctx) { try { this.ctx = new AudioContext(); } catch { return null; } }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  },
  tone(freq, dur = 0.08, type = 'square', vol = 0.08, when = 0) {
    const ac = this.ac;
    if (!ac || this.muted) return;
    const t = ac.currentTime + when;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect((typeof mixer !== 'undefined' && mixer.init() && this.out) || ac.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  key() { this.tone(1800, 0.05, 'square', 0.05); },
  // Sequência de bipes no estilo de confirmação de urna.
  confirm() { [0, 0.09, 0.18, 0.27, 0.36].forEach((w, i) => this.tone(i < 4 ? 1400 : 1000, i < 4 ? 0.07 : 0.35, 'square', 0.06, w)); },
  pop() { this.tone(600, 0.08, 'sine', 0.12); this.tone(900, 0.1, 'sine', 0.1, 0.05); },
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, i * 0.14)); },
  boom() { this.tone(90, 0.5, 'sawtooth', 0.15); this.tone(60, 0.6, 'sine', 0.2, 0.02); },
};
window.addEventListener('pointerdown', () => sfx.ac, { once: true });

// Reduz uma foto escolhida pelo usuário para um quadrado JPEG pequeno (cabe no localStorage e no WebSocket).
function fileToSquareDataUrl(file, size = 320) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Desenha uma imagem recortada em retângulo arredondado (ex.: foto do candidato).
function photo(url, x, y, w, h, r = 16, fallbackText = '?', fallbackColor = '#444') {
  const img = getImg(url);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  if (img) ctx.drawImage(img, x, y, w, h);
  else { ctx.fillStyle = fallbackColor; ctx.fillRect(x, y, w, h); text(fallbackText, x + w / 2, y + h / 2, h * 0.45); }
  ctx.restore();
}

function fmtTime(secs) {
  secs = Math.max(0, Math.ceil(secs));
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
}

// Guarda a configuração de um jogo neste navegador (sem quebrar se o armazenamento estiver bloqueado).
const store = {
  // STORE_PREFIX (auth.js): cada usuário tem as próprias configurações neste navegador
  get(key, fallback) { try { const v = localStorage.getItem((typeof STORE_PREFIX === 'string' ? STORE_PREFIX : '') + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem((typeof STORE_PREFIX === 'string' ? STORE_PREFIX : '') + key, JSON.stringify(value)); } catch {} },
};

// Texto sem contorno, para fundos claros e letras pequenas.
function label(str, x, y, size = 20, color = '#111', align = 'center', weight = 700, font = F_TEXT) {
  ctx.font = fontCss(weight, size, font);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// Avatar Roblox pelo nick (o servidor consulta a API pública da Roblox). Devolve { name, img } ou null.
const robloxLookups = new Map();
function robloxLookup(nick) {
  const key = nick.toLowerCase();
  if (!robloxLookups.has(key)) {
    robloxLookups.set(key, fetch(`/api/roblox?u=${encodeURIComponent(nick)}`)
      .then((r) => {
        if (r.status === 429) { robloxLookups.delete(key); return null; }
        return r.ok ? r.json() : null;
      })
      .catch(() => { robloxLookups.delete(key); return null; }));
  }
  return robloxLookups.get(key);
}
const looksLikeNick = (t) => /^@?[A-Za-z0-9_]{3,20}$/.test(t.trim()) && !/^\d+$/.test(t.trim());

// Painel genérico: uma lista de itens com nome, cor e foto, e campos numéricos extras.
// items: [{ name, color, photo }], extras: [{ key, label, min, max }]
function renderItemsSettings(el, cfg, { min = 2, max = 2, extras = [], itemLabel = 'Nome', newItem }, onSave) {
  const draw = () => {
    el.innerHTML = '';
    cfg.items.forEach((it, i) => {
      const box = document.createElement('div');
      box.className = 'cand';
      box.innerHTML = `
        <img alt="" src="${it.photo || ''}" ${it.photo ? '' : 'hidden'}>
        <div class="fields">
          <label>${itemLabel} <input data-k="name" maxlength="24" value="${String(it.name).replace(/"/g, '&quot;')}"></label>
          <label class="row2">Cor <input data-k="color" type="color" value="${it.color}">
            <span class="file">📷 Foto<input data-k="photo" type="file" accept="image/*"></span>
            ${it.photo ? '<button data-nophoto>Sem foto</button>' : ''}
            ${cfg.items.length > min ? '<button data-del>✕</button>' : ''}</label>
        </div>`;
      box.querySelectorAll('input').forEach((inp) => inp.addEventListener('change', async () => {
        if (inp.dataset.k === 'photo') { if (inp.files[0]) { it.photo = await fileToSquareDataUrl(inp.files[0]); draw(); } }
        else it[inp.dataset.k] = inp.value.trim() || it[inp.dataset.k];
      }));
      box.querySelector('[data-nophoto]')?.addEventListener('click', () => { it.photo = ''; draw(); });
      box.querySelector('[data-del]')?.addEventListener('click', () => { cfg.items.splice(i, 1); draw(); });
      el.append(box);
    });
    const extra = document.createElement('div');
    extra.className = 'cfg-extra';
    extra.innerHTML = `${cfg.items.length < max ? '<button data-add>+ Adicionar</button>' : ''}
      ${extras.map((x) => `<label>${x.label} <input data-k="${x.key}" type="number" min="${x.min}" max="${x.max}" value="${cfg[x.key]}"></label>`).join('')}
      <button data-save class="primary">Salvar e reiniciar</button>`;
    extra.querySelector('[data-add]')?.addEventListener('click', () => { cfg.items.push(newItem(cfg.items.length)); draw(); });
    extra.querySelectorAll('input').forEach((inp) => inp.addEventListener('change', () => { cfg[inp.dataset.k] = clamp(Number(inp.value) || 0, Number(inp.min), Number(inp.max)); }));
    extra.querySelector('[data-save]').addEventListener('click', () => onSave(structuredClone(cfg)));
    el.append(extra);
  };
  draw();
}

// Registra um jogo com configuração salva neste navegador e repassada às outras telas.
function withConfig(game, defaults) {
  game.configKey = game.id;
  game.config = store.get('cfg:' + game.id, defaults);
  game.getConfig = game.getConfig || function () { return this.config; };
  game.applyConfig = game.applyConfig || function (cfg) {
    if (!cfg?.items?.length) return;
    this.config = cfg;
    store.set('cfg:' + this.id, cfg);
    this.reset();
  };
  return game;
}
