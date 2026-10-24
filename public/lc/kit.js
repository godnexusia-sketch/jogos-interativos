'use strict';

// Kit visual dos jogos novos: palco de programa de TV, cartões de pergunta, alternativas, confete e texto que se ajusta.

// Quebra o texto em linhas que cabem na largura; diminui a fonte até caber em maxLines.
function fitLines(str, maxW, size, minSize = 18, maxLines = 3, weight = 800, font = F_TEXT) {
  for (let s = size; s >= minSize; s -= 2) {
    ctx.font = fontCss(weight, s, font);
    const out = [];
    let line = '';
    for (const word of String(str).split(/\s+/)) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
    if (out.length <= maxLines || s - 2 < minSize) return { lines: out.slice(0, maxLines), size: s };
  }
  return { lines: [String(str)], size: minSize };
}
// Texto centrado em várias linhas, já ajustado.
function textBlock(str, x, y, maxW, size, { minSize = 18, maxLines = 3, color = '#fff', weight = 800, font = F_TEXT, lh = 1.18, shadow = true } = {}) {
  const { lines: ls, size: s } = fitLines(str, maxW, size, minSize, maxLines, weight, font);
  const top = y - ((ls.length - 1) * s * lh) / 2;
  ls.forEach((l, i) => (shadow ? text(l, x, top + i * s * lh, s, color, 'center', weight, font) : label(l, x, top + i * s * lh, s, color, 'center', weight, font)));
  return { size: s, lines: ls.length, h: ls.length * s * lh };
}

// Palco: degradê, feixes de luz que balançam, chão brilhante e partículas de fundo.
const STAGES = {
  blue: ['#050a1f', '#0b1d4d', '#22e3ee'], purple: ['#0c0520', '#2a0f55', '#c084fc'], red: ['#1a0408', '#4a0d1b', '#ff2d55'],
  green: ['#03140c', '#0a3d24', '#34d399'], gold: ['#140d02', '#3d2a07', '#ffc93c'], pink: ['#1a0514', '#4a0f3a', '#ff6bd6'],
  teal: ['#02141a', '#073b45', '#2dd4bf'], night: ['#03040a', '#101634', '#7c9bff'],
};
function stageBg(theme = 'blue', t = performance.now() / 1000, { rays = true, floor = true, dots = true } = {}) {
  const [c1, c2, acc] = STAGES[theme] || STAGES.blue;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, c1); g.addColorStop(0.55, c2); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (rays) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 5; k++) {
      ctx.save(); ctx.translate(80 + k * 140, -30); ctx.rotate(Math.sin(t * 0.4 + k * 1.3) * 0.32);
      const rg = ctx.createLinearGradient(0, 0, 0, 1000);
      rg.addColorStop(0, hexA(acc, 0.16)); rg.addColorStop(1, hexA(acc, 0));
      ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(150, 1000); ctx.lineTo(-150, 1000); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  if (dots) {
    ctx.save(); ctx.globalAlpha = 0.5;
    for (let i = 0; i < 40; i++) {
      const x = (i * 97 + t * (6 + (i % 5) * 3)) % W, y = (i * 173 + Math.sin(t * 0.5 + i) * 20) % H;
      ctx.fillStyle = hexA(acc, 0.35 + (i % 3) * 0.15); ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3), 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  if (floor) {
    const fg = ctx.createRadialGradient(W / 2, H + 60, 40, W / 2, H + 60, 620);
    fg.addColorStop(0, hexA(acc, 0.35)); fg.addColorStop(1, hexA(acc, 0));
    ctx.fillStyle = fg; ctx.fillRect(0, H - 520, W, 520);
  }
}
// Cor hex com transparência.
function hexA(hex, a) {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// Cartão grande da pergunta.
function questionCard(str, y, h, { color = '#22e3ee', size = 40, tag = '', w = W - 60 } = {}) {
  const x = (W - w) / 2;
  panel(x, y, w, h, { r: 26, from: '#1a2346', to: '#0a0f22', border: hexA(color, 0.6), glow: hexA(color, 0.35) });
  if (tag) pill(tag, W / 2, y, { bg: color, color: '#06121a', size: 16, h: 30 });
  textBlock(str, W / 2, y + h / 2 + (tag ? 6 : 0), w - 60, size, { minSize: 20, maxLines: 4 });
}

// Alternativa (A, B, C, D) com estado: normal, certa, errada, apagada.
const LETTER_COLORS = { a: '#ff4d6d', b: '#3b82f6', c: '#f59e0b', d: '#22c55e' };
function answerTile(x, y, w, h, letter, str, { state = 'normal', pct = null, votes = null, color = null } = {}) {
  const c = color || LETTER_COLORS[letter] || '#22e3ee';
  const dim = state === 'dim' || state === 'wrong';
  ctx.save();
  if (dim) ctx.globalAlpha = state === 'wrong' ? 0.45 : 0.3;
  const from = state === 'correct' ? '#16a34a' : '#18203a', to = state === 'correct' ? '#065f2b' : '#0b1020';
  panel(x, y, w, h, { r: h / 2, from, to, border: state === 'correct' ? '#86efac' : hexA(c, 0.8), glow: state === 'correct' ? 'rgba(34,197,94,.7)' : null });
  if (pct !== null && pct > 0) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.clip();
    ctx.fillStyle = hexA(state === 'correct' ? '#86efac' : c, 0.22); ctx.fillRect(x, y, w * clamp(pct, 0, 1), h);
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(x + h / 2, y + h / 2, h / 2 - 6, 0, 7); ctx.fillStyle = state === 'correct' ? '#22c55e' : c; ctx.fill();
  label(letter.toUpperCase(), x + h / 2, y + h / 2 + 1, h * 0.45, '#fff', 'center', 900, F_TITLE);
  const tw = w - h - (pct !== null ? 90 : 24);
  const fl = fitLines(str, tw, h * 0.36, 14, 2, 800);
  fl.lines.forEach((l, i) => label(l, x + h + 4, y + h / 2 + (i - (fl.lines.length - 1) / 2) * fl.size * 1.1 + 1, fl.size, '#fff', 'left', 800));
  if (pct !== null) label(`${Math.round(pct * 100)}%`, x + w - 18, y + h / 2 + 1, h * 0.34, '#fff', 'right', 900, F_NUM);
  if (votes !== null) label(fmtK(votes), x + w - 18, y + h / 2 + 18, 13, 'rgba(255,255,255,.6)', 'right', 700);
  ctx.restore();
}

// Chuva de confete (partículas do core).
function confetti(n = 120, y = -20) {
  for (let i = 0; i < n; i++) particles.push({ x: rand(0, W), y: y - rand(0, 300), vx: rand(-60, 60), vy: rand(120, 360), life: rand(2.5, 4.5), max: 4.5, color: pick(['#ff2d55', '#ffc93c', '#22e3ee', '#7cff6b', '#b36bff', '#fff']), size: rand(6, 12), noGravity: true });
}
// Destaque de vencedor: foto grande com coroa e nome.
function winnerSpot(user, y, { title: ttl = 'VENCEDOR', color = '#ffc93c', r = 90, sub = '' } = {}) {
  const t = performance.now() / 1000;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12; i++) {
    const a = t * 0.6 + (i / 12) * Math.PI * 2;
    ctx.fillStyle = hexA(color, 0.08);
    ctx.beginPath(); ctx.moveTo(W / 2, y); ctx.arc(W / 2, y, 420, a, a + 0.16); ctx.fill();
  }
  ctx.restore();
  avatar(user, W / 2, y, r, color);
  label('👑', W / 2, y - r - 22, 54, '#fff', 'center', 400);
  title(ttl, W / 2, y + r + 46, 46, color);
  text('@' + trim(user?.nick || '', 20), W / 2, y + r + 92, 32, '#fff');
  if (sub) label(sub, W / 2, y + r + 130, 22, 'rgba(255,255,255,.8)', 'center', 700);
}
// Toast pequeno de quem acertou/errou, empilhado (como um feed na tela).
class Feed {
  constructor(max = 4) { this.items = []; this.max = max; }
  push(user, msg, color = '#7cff6b') { this.items.unshift({ user, msg, color, t: 4 }); this.items.length = Math.min(this.items.length, this.max); }
  update(dt) { for (const i of this.items) i.t -= dt; this.items = this.items.filter((i) => i.t > 0); }
  draw(x, y, { gap = 46, align = 'left' } = {}) {
    this.items.forEach((it, i) => toast(it.user, it.msg, x, y + i * gap, { color: it.color, alpha: clamp(it.t, 0, 1), size: 17, align }));
  }
}
// Fala o texto pela voz da live, se o jogo deixar.
function narrate(g, str, opts = {}) { if (g.s.narrate !== false && g === current) voice.say(str, { cat: g.voiceCat || 'game', ...opts }); }
