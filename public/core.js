'use strict';

// Base compartilhada por todos os jogos: canvas, desenho, avatares, partículas e registro.
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
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

// Faixa do presente pelo valor em moedas: 1 (Rosa), 2 (5–99, ex.: Rosquinha), 3 (100–499, ex.: Óculos), 4 (500+, ex.: Galáxia).
function giftTier(ev) {
  const d = ev.diamonds || 1;
  return d >= 500 ? 4 : d >= 100 ? 3 : d >= 5 ? 2 : 1;
}
const coins = (ev) => (ev.diamonds || 1) * (ev.count || 1);

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
function text(str, x, y, size = 40, color = '#fff', align = 'center', weight = 700) {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(4, size / 8);
  ctx.lineJoin = 'round';
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

function trim(str, n) { str = String(str); return str.length > n ? str.slice(0, n - 1) + '…' : str; }

function wrapText(str, x, y, maxW, size, maxLines = 2, color = '#fff') {
  ctx.font = `700 ${size}px system-ui, sans-serif`;
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
const imgCache = new Map();
function getImg(url) {
  if (!url) return null;
  let img = imgCache.get(url);
  if (!img) {
    img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.src = url;
    imgCache.set(url, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

// Foto do perfil do TikTok num círculo; sem foto, a inicial do nome numa cor fixa por pessoa.
function avatar(user, x, y, r, border = '#fff') {
  const img = getImg(user?.pic);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
  if (img) {
    ctx.clip();
    ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = colorFor(user?.nick || '?');
    ctx.fill();
    ctx.clip();
    text((user?.nick || '?')[0].toUpperCase(), x, y + r * 0.05, r * 1.1, '#fff');
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(2, r / 8);
  ctx.strokeStyle = border;
  ctx.stroke();
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
    o.connect(g).connect(ac.destination);
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
  get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
};

// Texto sem contorno, para fundos claros e letras pequenas.
function label(str, x, y, size = 20, color = '#111', align = 'center', weight = 700) {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}
