'use strict';

// Kit visual: painéis, etiquetas, barras, a mão que aperta botões e rostos desenhados para o simulador.

// Painel com gradiente, borda clara em cima e sombra projetada.
function panel(x, y, w, h, { r = 18, from = '#1d2436', to = '#0c0f18', border = 'rgba(255,255,255,.14)', glow = null, shadow = true } = {}) {
  ctx.save();
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8; }
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 28; ctx.shadowOffsetY = 0; }
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, from); g.addColorStop(1, to);
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = g; ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.lineWidth = 1.5; ctx.strokeStyle = border; ctx.stroke();
  // Reflexo na metade de cima
  ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, Math.min(h * 0.45, 60), [r - 2, r - 2, 4, 4]);
  const hl = ctx.createLinearGradient(0, y, 0, y + Math.min(h * 0.45, 60));
  hl.addColorStop(0, 'rgba(255,255,255,.10)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fill();
  ctx.restore();
}

// Etiqueta arredondada. Devolve a largura usada.
function pill(str, x, y, { bg = 'rgba(0,0,0,.7)', color = '#fff', size = 18, h = size * 1.7, padX = size * 0.7, align = 'center', border = null, weight = 800, font = F_TEXT } = {}) {
  ctx.font = `${font === F_TEXT ? weight : 400} ${size}px ${font}`;
  const w = ctx.measureText(str).width + padX * 2;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
  ctx.beginPath(); ctx.roundRect(x0, y - h / 2, w, h, h / 2);
  ctx.fillStyle = bg; ctx.fill();
  ctx.restore();
  if (border) { ctx.beginPath(); ctx.roundRect(x0, y - h / 2, w, h, h / 2); ctx.lineWidth = 2; ctx.strokeStyle = border; ctx.stroke(); }
  label(str, x0 + w / 2, y + 1, size, color, 'center', weight, font);
  return w;
}

// Barra com trilho escuro, preenchimento em gradiente e brilho.
function glossBar(x, y, w, h, pct, color, track = 'rgba(255,255,255,.10)') {
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fillStyle = track; ctx.fill();
  const fw = Math.max(h, w * clamp(pct, 0, 1));
  if (pct > 0) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, shade(color, 40)); g.addColorStop(0.5, color); g.addColorStop(1, shade(color, -30));
    ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.roundRect(x, y, fw, h, h / 2); ctx.fillStyle = g; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.roundRect(x + 3, y + 2, fw - 6, h * 0.35, h / 4); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill();
  }
  ctx.restore();
}

// Clareia (+) ou escurece (−) uma cor hex.
function shade(hex, amt) {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// Quadradinho de posição (1º ouro, 2º prata, 3º bronze).
function posBadge(n, x, y, s = 30) {
  const bg = n === 1 ? '#ffc93c' : n === 2 ? '#d7dde8' : n === 3 ? '#e08a3c' : '#2a3142';
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.roundRect(x - s / 2, y - s / 2, s, s, 6); ctx.fillStyle = bg; ctx.fill();
  ctx.restore();
  label(String(n), x, y + 1, s * 0.62, n <= 3 ? '#1a1a1a' : '#fff', 'center', 900);
}

// Aviso com foto e texto (ex.: "@lucas votou SIM +1").
function toast(user, str, x, y, { w = null, color = '#7cff6b', size = 19, alpha = 1, align = 'left' } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `800 ${size}px ${F_TEXT}`;
  const tw = ctx.measureText(str).width;
  const h = size * 2;
  const width = w || tw + h + 26;
  const x0 = align === 'center' ? x - width / 2 : x;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.roundRect(x0, y - h / 2, width, h, h / 2);
  ctx.fillStyle = 'rgba(8,10,18,.82)'; ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.roundRect(x0, y - h / 2, width, h, h / 2); ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke();
  avatar(user, x0 + h / 2, y, h / 2 - 4, color);
  label(str, x0 + h + 8, y + 1, size, '#fff', 'left', 800);
  ctx.restore();
  return width;
}

// Mão apontando para cima, com a ponta do dedo em (x, y). O braço desce até fora da tela.
function hand(x, y, { scale = 1, angle = 0, skin = '#e0ac69', sleeve = '#8fb8de', press = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y + press * 6);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  const dark = shade(skin, -45), light = shade(skin, 25);
  // Manga
  const sg = ctx.createLinearGradient(-70, 0, 70, 0);
  sg.addColorStop(0, shade(sleeve, -40)); sg.addColorStop(0.45, sleeve); sg.addColorStop(1, shade(sleeve, -55));
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.moveTo(-58, 300); ctx.lineTo(62, 300); ctx.lineTo(92, 900); ctx.lineTo(-92, 900); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(sleeve, -25); ctx.fillRect(-60, 296, 124, 16);
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(30, 330, 5, 0, 7); ctx.fill();
  // Pulso e braço
  const ag = ctx.createLinearGradient(-50, 0, 50, 0);
  ag.addColorStop(0, dark); ag.addColorStop(0.5, light); ag.addColorStop(1, dark);
  ctx.fillStyle = ag;
  ctx.beginPath(); ctx.moveTo(-44, 190); ctx.lineTo(46, 190); ctx.lineTo(54, 304); ctx.lineTo(-52, 304); ctx.closePath(); ctx.fill();
  // Palma e dedos dobrados
  const pg = ctx.createLinearGradient(-60, 0, 60, 0);
  pg.addColorStop(0, dark); pg.addColorStop(0.35, skin); pg.addColorStop(0.7, light); pg.addColorStop(1, dark);
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.roundRect(-58, 92, 112, 120, [26, 30, 34, 40]); ctx.fill();
  for (let k = 0; k < 3; k++) {
    ctx.beginPath(); ctx.ellipse(-36 + k * 26, 104 + k * 6, 16, 22, 0, 0, Math.PI * 2); ctx.fillStyle = k % 2 ? skin : shade(skin, -10); ctx.fill();
    ctx.strokeStyle = 'rgba(80,40,20,.25)'; ctx.lineWidth = 2; ctx.stroke();
  }
  // Polegar
  ctx.save(); ctx.translate(40, 140); ctx.rotate(-0.55);
  ctx.beginPath(); ctx.roundRect(-14, -58, 30, 76, 15); ctx.fillStyle = shade(skin, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(80,40,20,.25)'; ctx.stroke();
  ctx.restore();
  // Indicador
  const fg = ctx.createLinearGradient(-18, 0, 18, 0);
  fg.addColorStop(0, dark); fg.addColorStop(0.45, light); fg.addColorStop(1, shade(skin, -30));
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.roundRect(-17, -4, 34, 124, 17); ctx.fill();
  ctx.strokeStyle = 'rgba(80,40,20,.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-9, 46); ctx.quadraticCurveTo(0, 50, 9, 46); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-9, 82); ctx.quadraticCurveTo(0, 86, 9, 82); ctx.stroke();
  // Unha
  ctx.beginPath(); ctx.roundRect(-11, 0, 22, 26, [11, 11, 6, 6]); ctx.fillStyle = 'rgba(255,225,215,.75)'; ctx.fill();
  ctx.restore();
}

// Rosto desenhado (usado no simulador e quando a conta não tem foto).
const faceCache = new Map();
function fakeFace(seed) {
  if (faceCache.has(seed)) return faceCache.get(seed);
  let h = 0;
  for (const c of seed) h = (h * 131 + c.charCodeAt(0)) >>> 0;
  const r = (n) => { h = (h * 1103515245 + 12345) >>> 0; return h % n; };
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const bgs = ['#ff6b6b', '#4dabf7', '#69db7c', '#ffd43b', '#b197fc', '#ffa94d', '#63e6be', '#f783ac'];
  const skins = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
  const hairs = ['#2b1b0e', '#5a3825', '#000', '#b5651d', '#e6be8a', '#7a2e2e'];
  g.fillStyle = bgs[r(bgs.length)]; g.fillRect(0, 0, 128, 128);
  const skin = skins[r(skins.length)], hair = hairs[r(hairs.length)];
  g.fillStyle = shade(bgs[r(bgs.length)], -40); g.beginPath(); g.ellipse(64, 140, 52, 40, 0, 0, 7); g.fill();
  g.fillStyle = skin; g.beginPath(); g.ellipse(64, 66, 34, 40, 0, 0, 7); g.fill();
  g.fillStyle = hair;
  const style = r(3);
  g.beginPath();
  if (style === 0) { g.ellipse(64, 40, 38, 22, 0, Math.PI, 0); }
  else if (style === 1) { g.ellipse(64, 48, 40, 34, 0, Math.PI, 0); g.rect(24, 48, 12, 50); g.rect(92, 48, 12, 50); }
  else { g.ellipse(64, 36, 30, 14, 0, Math.PI, 0); }
  g.fill();
  g.fillStyle = '#1b1b1b';
  g.beginPath(); g.arc(51, 66, 4, 0, 7); g.arc(77, 66, 4, 0, 7); g.fill();
  g.strokeStyle = '#7a3b2e'; g.lineWidth = 3; g.beginPath(); g.arc(64, 80, 11, 0.2, Math.PI - 0.2); g.stroke();
  g.fillStyle = 'rgba(255,120,120,.35)'; g.beginPath(); g.arc(44, 80, 6, 0, 7); g.arc(84, 80, 6, 0, 7); g.fill();
  const url = c.toDataURL();
  faceCache.set(seed, url);
  return url;
}
