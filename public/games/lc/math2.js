'use strict';

// Matemática de verdade na live: Desafio da Álgebra (equações, logaritmos, sistemas) e Geometria Show
// (geometria plana e espacial, com a figura desenhada). Cada pergunta tem 4 alternativas: o chat responde
// com a letra (A, B, C, D) ou com o número. Na revelação aparece a resolução passo a passo, lida em voz alta.

// Quebra um texto em linhas que cabem na largura (mesma fonte do label)
function mathLines(str, maxW, size, weight = 800) {
  ctx.font = `${weight} ${size}px ${F_TEXT}`;
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const w of para.split(' ')) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
    out.push(line);
  }
  return out;
}
const SUB = (n) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]);
const fmtN = (n) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)).replace('.', ','));
// Lê o número em voz alta sem símbolos estranhos
const speakMath = (s) => String(s).replace(/×/g, ' vezes ').replace(/÷/g, ' dividido por ').replace(/−/g, ' menos ').replace(/²/g, ' ao quadrado').replace(/³/g, ' ao cubo').replace(/√/g, 'raiz de ').replace(/π/g, 'pi').replace(/log([₀-₉]+)/g, (_, b) => `log na base ${b.replace(/[₀-₉]/g, (c) => '₀₁₂₃₄₅₆₇₈₉'.indexOf(c))} de `).replace(/=/g, ' igual a ').replace(/\s+/g, ' ');

// ---------- Perguntas: Álgebra ----------
// Cada gerador devolve { topic, q (enunciado), ans (número), wrong (erros comuns), steps (resolução), hint }
const ALG_GEN = {
  eq1(r, lv) {
    const a = r.int(2, lv > 1 ? 12 : 6), x = r.int(lv > 1 ? -12 : 1, lv > 1 ? 20 : 12), b = r.int(-20, 30), c = a * x + b;
    const bs = b >= 0 ? `+ ${b}` : `− ${-b}`;
    return { topic: 'Equação do 1º grau', q: `${a}x ${bs} = ${c}\nQuanto vale x?`, ans: x, wrong: [(c + b) / a, c - b, x + 1, -x],
      hint: `Passe o ${Math.abs(b)} para o outro lado`, steps: [`${a}x = ${c} ${b >= 0 ? '−' : '+'} ${Math.abs(b)}`, `${a}x = ${c - b}`, `x = ${c - b} ÷ ${a} = ${x}`] };
  },
  eq2(r, lv) {
    let x1 = r.int(-6, 9), x2 = r.int(-6, 9); if (x1 === x2) x2 += 2;
    const S = x1 + x2, P = x1 * x2, big = Math.max(x1, x2), small = Math.min(x1, x2);
    const sS = S === 0 ? '' : S > 0 ? ` − ${S === 1 ? '' : S}x` : ` + ${-S === 1 ? '' : -S}x`, sP = P === 0 ? '' : P > 0 ? ` + ${P}` : ` − ${-P}`;
    const askSum = lv === 1 && r() < 0.4;
    return { topic: 'Equação do 2º grau', q: `x²${sS}${sP} = 0\n${askSum ? 'Quanto dá a SOMA das raízes?' : 'Qual é a MAIOR raiz?'}`, ans: askSum ? S : big, wrong: askSum ? [-S, P, S + 1] : [small, -big, P, S],
      hint: 'Soma das raízes = −b/a e produto = c/a', steps: [`Soma das raízes = ${S}`, `Produto das raízes = ${P}`, `Dois números com soma ${S} e produto ${P}: ${small} e ${big}`, askSum ? `Soma = ${S}` : `Maior raiz = ${big}`] };
  },
  log(r, lv) {
    const kind = lv === 1 ? 0 : r.int(0, 2);
    if (kind === 0) { const b = r.pick([2, 3, 5, 10]), k = r.int(1, b === 2 ? 8 : b === 10 ? 5 : 4), n = b ** k;
      return { topic: 'Logaritmo', q: `log${SUB(b)} ${n} = ?`, ans: k, wrong: [n / b, k + 1, b * k, k - 1], hint: `${b} elevado a quanto dá ${n}?`, steps: [`log${SUB(b)} ${n} = x  ⟺  ${b}ˣ = ${n}`, `${b}${'⁰¹²³⁴⁵⁶⁷⁸⁹'[k]} = ${n}`, `x = ${k}`] }; }
    if (kind === 1) { const b = r.pick([2, 3, 10]), m = r.int(1, 3), n = r.int(1, 3), A = b ** m, B = b ** n;
      return { topic: 'Logaritmo (propriedade)', q: `log${SUB(b)} ${A} + log${SUB(b)} ${B} = ?`, ans: m + n, wrong: [m * n, A + B, m + n + 1, Math.abs(m - n)], hint: 'Soma de logs = log do produto', steps: [`log${SUB(b)} ${A} + log${SUB(b)} ${B} = log${SUB(b)} (${A}×${B})`, `= log${SUB(b)} ${A * B}`, `= ${m + n}`] }; }
    const b = r.pick([2, 3]), k = r.int(2, 4), p = r.int(2, 4);
    return { topic: 'Logaritmo (potência)', q: `log${SUB(b)} (${b ** k})${'⁰¹²³⁴⁵⁶⁷⁸⁹'[p]} = ?`, ans: k * p, wrong: [k + p, k ** p, k * p + 1, p], hint: 'O expoente sai multiplicando', steps: [`log${SUB(b)} (${b ** k})${'⁰¹²³⁴⁵⁶⁷⁸⁹'[p]} = ${p} × log${SUB(b)} ${b ** k}`, `= ${p} × ${k}`, `= ${k * p}`] };
  },
  sys(r, lv) {
    const x = r.int(-5, 12), y = r.int(-5, 12), askX = r() < 0.5;
    if (lv === 1) { const s = x + y, d = x - y;
      return { topic: 'Sistema de equações', q: `x + y = ${s}\nx − y = ${d}\nQuanto vale ${askX ? 'x' : 'y'}?`, ans: askX ? x : y, wrong: askX ? [y, s, d, x + 1] : [x, s, -y, y + 1], hint: 'Some as duas equações', steps: [`Somando: 2x = ${s + d}`, `x = ${x}`, `y = ${s} − ${x} = ${y}`] }; }
    const a = r.int(1, 4), b = r.int(1, 4), c = r.int(1, 3), d = r.int(1, 5) * (r() < 0.5 ? -1 : 1);
    const e = a * x + b * y, f = c * x + d * y, D = a * d - b * c;
    if (D === 0) return ALG_GEN.sys(r, 1);
    const sg = (n) => (n >= 0 ? `+ ${n === 1 ? '' : n}y` : `− ${n === -1 ? '' : -n}y`), co = (n) => (n === 1 ? '' : n);
    return { topic: 'Sistema de equações', q: `${co(a)}x ${sg(b)} = ${e}\n${co(c)}x ${sg(d)} = ${f}\nQuanto vale ${askX ? 'x' : 'y'}?`, ans: askX ? x : y, wrong: askX ? [y, x + 1, -x, e - f] : [x, y - 1, -y, f], hint: 'Isole uma letra e substitua na outra', steps: [`Determinante = ${a}×${d} − ${b}×${c} = ${D}`, `x = (${e}×${d} − ${b}×${f}) ÷ ${D} = ${x}`, `y = (${a}×${f} − ${e}×${c}) ÷ ${D} = ${y}`] };
  },
};
// ---------- Perguntas: Geometria (com figura) ----------
// fig: { type, ...medidas } desenhado por drawFig()
const GEO_GEN = {
  rect(r) { const a = r.int(3, 15), b = r.int(2, 12), per = r() < 0.4;
    return { topic: 'Geometria plana · retângulo', fig: { type: 'rect', a: `${a} cm`, b: `${b} cm` }, q: per ? 'Qual é o PERÍMETRO do retângulo (cm)?' : 'Qual é a ÁREA do retângulo (cm²)?', ans: per ? 2 * (a + b) : a * b, wrong: per ? [a * b, a + b, 2 * a + b] : [2 * (a + b), a + b, a * b / 2], hint: per ? 'Some os 4 lados' : 'Base × altura', steps: per ? [`P = 2 × (${a} + ${b})`, `P = ${2 * (a + b)} cm`] : [`A = base × altura`, `A = ${a} × ${b} = ${a * b} cm²`] }; },
  tri(r) { const b = r.int(2, 10) * 2, h = r.int(3, 14);
    return { topic: 'Geometria plana · triângulo', fig: { type: 'tri', b: `${b} cm`, h: `${h} cm` }, q: 'Qual é a ÁREA do triângulo (cm²)?', ans: b * h / 2, wrong: [b * h, b + h, b * h / 4], hint: 'Base × altura ÷ 2', steps: [`A = (base × altura) ÷ 2`, `A = (${b} × ${h}) ÷ 2 = ${b * h / 2} cm²`] }; },
  pyth(r) { const [p, q2, hyp] = r.pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [7, 24, 25], [12, 16, 20]]);
    return { topic: 'Teorema de Pitágoras', fig: { type: 'right', a: `${p}`, b: `${q2}`, c: '?' }, q: 'Quanto mede a hipotenusa?', ans: hyp, wrong: [p + q2, hyp + 1, Math.abs(q2 - p), hyp - 2], hint: 'a² = b² + c²', steps: [`h² = ${p}² + ${q2}²`, `h² = ${p * p} + ${q2 * q2} = ${hyp * hyp}`, `h = √${hyp * hyp} = ${hyp}`] }; },
  circle(r) { const rad = r.int(2, 10), per = r() < 0.4;
    return { topic: 'Geometria plana · círculo (π = 3)', fig: { type: 'circle', r: `${rad} cm` }, q: per ? 'Qual é o COMPRIMENTO da circunferência? (π = 3)' : 'Qual é a ÁREA do círculo? (π = 3)', ans: per ? 6 * rad : 3 * rad * rad, wrong: per ? [3 * rad, 3 * rad * rad, 2 * rad] : [6 * rad, 9 * rad, rad * rad], hint: per ? 'C = 2πr' : 'A = πr²', steps: per ? [`C = 2 × π × r`, `C = 2 × 3 × ${rad} = ${6 * rad} cm`] : [`A = π × r²`, `A = 3 × ${rad}² = 3 × ${rad * rad} = ${3 * rad * rad} cm²`] }; },
  trap(r) { const B = r.int(6, 16), b = r.int(2, B - 2), h = r.int(1, 6) * 2;
    return { topic: 'Geometria plana · trapézio', fig: { type: 'trap', B: `${B}`, b: `${b}`, h: `${h}` }, q: 'Qual é a ÁREA do trapézio?', ans: (B + b) * h / 2, wrong: [(B + b) * h, B * h, B * b * h / 2], hint: '(base maior + base menor) × altura ÷ 2', steps: [`A = (B + b) × h ÷ 2`, `A = (${B} + ${b}) × ${h} ÷ 2`, `A = ${(B + b) * h / 2}`] }; },
  poly(r) { const n = r.int(5, 10), names = { 5: 'pentágono', 6: 'hexágono', 7: 'heptágono', 8: 'octógono', 9: 'eneágono', 10: 'decágono' };
    return { topic: 'Geometria plana · ângulos', fig: { type: 'poly', n }, q: `Quanto dá a SOMA dos ângulos internos de um ${names[n]}? (graus)`, ans: (n - 2) * 180, wrong: [n * 180, (n - 1) * 180, 360], hint: 'S = (n − 2) × 180°', steps: [`S = (n − 2) × 180°`, `S = (${n} − 2) × 180° = ${(n - 2) * 180}°`] }; },
  cube(r) { const a = r.int(2, 9), area = r() < 0.35;
    return { topic: 'Geometria espacial · cubo', fig: { type: 'box', a: `${a}`, b: `${a}`, c: `${a}` }, q: area ? 'Qual é a ÁREA TOTAL do cubo?' : 'Qual é o VOLUME do cubo?', ans: area ? 6 * a * a : a ** 3, wrong: area ? [a * a, 4 * a * a, a ** 3] : [3 * a, a * a, 6 * a * a], hint: area ? '6 faces quadradas' : 'aresta × aresta × aresta', steps: area ? [`A = 6 × a²`, `A = 6 × ${a * a} = ${6 * a * a}`] : [`V = a³`, `V = ${a} × ${a} × ${a} = ${a ** 3}`] }; },
  box(r) { const a = r.int(2, 10), b = r.int(2, 8), c = r.int(2, 9);
    return { topic: 'Geometria espacial · paralelepípedo', fig: { type: 'box', a: `${a}`, b: `${b}`, c: `${c}` }, q: 'Qual é o VOLUME do paralelepípedo?', ans: a * b * c, wrong: [a + b + c, a * b, 2 * (a * b + a * c + b * c)], hint: 'comprimento × largura × altura', steps: [`V = a × b × c`, `V = ${a} × ${b} × ${c} = ${a * b * c}`] }; },
  cyl(r) { const rad = r.int(1, 6), h = r.int(2, 10);
    return { topic: 'Geometria espacial · cilindro (π = 3)', fig: { type: 'cyl', r: `${rad}`, h: `${h}` }, q: 'Qual é o VOLUME do cilindro? (π = 3)', ans: 3 * rad * rad * h, wrong: [6 * rad * h, 3 * rad * h, rad * rad * h], hint: 'V = área da base × altura', steps: [`V = π × r² × h`, `V = 3 × ${rad * rad} × ${h} = ${3 * rad * rad * h}`] }; },
  cone(r) { const rad = r.int(1, 6), h = r.int(2, 12);
    return { topic: 'Geometria espacial · cone (π = 3)', fig: { type: 'cone', r: `${rad}`, h: `${h}` }, q: 'Qual é o VOLUME do cone? (π = 3)', ans: rad * rad * h, wrong: [3 * rad * rad * h, rad * h, 2 * rad * rad * h], hint: 'V = π × r² × h ÷ 3', steps: [`V = (π × r² × h) ÷ 3`, `V = (3 × ${rad * rad} × ${h}) ÷ 3 = ${rad * rad * h}`] }; },
  sphere(r) { const rad = r.int(1, 6);
    return { topic: 'Geometria espacial · esfera (π = 3)', fig: { type: 'sphere', r: `${rad}` }, q: 'Qual é o VOLUME da esfera? (π = 3)', ans: 4 * rad ** 3, wrong: [3 * rad ** 3, 4 * rad * rad, 12 * rad * rad], hint: 'V = 4/3 × π × r³', steps: [`V = (4 ÷ 3) × π × r³`, `V = (4 ÷ 3) × 3 × ${rad ** 3}`, `V = 4 × ${rad ** 3} = ${4 * rad ** 3}`] }; },
  pyr(r) { const a = r.int(2, 8), h = r.int(1, 5) * 3;
    return { topic: 'Geometria espacial · pirâmide', fig: { type: 'pyr', a: `${a}`, h: `${h}` }, q: 'Qual é o VOLUME da pirâmide de base quadrada?', ans: a * a * h / 3, wrong: [a * a * h, a * h, a * a * h / 2], hint: 'V = área da base × altura ÷ 3', steps: [`V = (a² × h) ÷ 3`, `V = (${a * a} × ${h}) ÷ 3 = ${a * a * h / 3}`] }; },
  euler(r) { const [name, n] = r.pick([['prisma triangular', 3], ['prisma quadrangular', 4], ['prisma pentagonal', 5], ['prisma hexagonal', 6]]), ask = r.pick(['arestas', 'vértices', 'faces']);
    const v = { arestas: 3 * n, vértices: 2 * n, faces: n + 2 }[ask];
    return { topic: 'Geometria espacial · poliedros', fig: { type: 'prism', n }, q: `Quantas ${ask} tem um ${name}?`, ans: v, wrong: [3 * n, 2 * n, n + 2, v + 2].filter((x) => x !== v), hint: 'V − A + F = 2 (Euler)', steps: [`Faces = ${n} laterais + 2 bases = ${n + 2}`, `Vértices = 2 × ${n} = ${2 * n}`, `Arestas = 3 × ${n} = ${3 * n}`, `Euler: ${2 * n} − ${3 * n} + ${n + 2} = 2 ✔`] }; },
};

// ---------- Desenho das figuras ----------
function drawFig(f, cx, cy, s = 1) {
  const C = '#5eead4', F = 'rgba(45,212,191,.16)', T = '#fde68a';
  ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = C; ctx.fillStyle = F; ctx.lineJoin = 'round';
  const lab = (t, x, y, al = 'center') => label(t, x, y, 22 * s, T, al, 900);
  const poly = (pts, fill = true) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); if (fill) ctx.fill(); ctx.stroke(); };
  const W2 = 120 * s, H2 = 75 * s;
  if (f.type === 'rect') { poly([[cx - W2, cy - H2], [cx + W2, cy - H2], [cx + W2, cy + H2], [cx - W2, cy + H2]]); lab(f.a, cx, cy + H2 + 22 * s); lab(f.b, cx + W2 + 14 * s, cy, 'left'); }
  else if (f.type === 'tri') { poly([[cx - W2, cy + H2], [cx + W2, cy + H2], [cx - W2 * 0.2, cy - H2]]); ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(cx - W2 * 0.2, cy - H2); ctx.lineTo(cx - W2 * 0.2, cy + H2); ctx.stroke(); ctx.setLineDash([]); lab(f.b, cx, cy + H2 + 22 * s); lab(f.h, cx - W2 * 0.2 + 12 * s, cy + 8, 'left'); }
  else if (f.type === 'right') { poly([[cx - W2 * 0.8, cy + H2], [cx + W2 * 0.8, cy + H2], [cx - W2 * 0.8, cy - H2]]); ctx.strokeRect(cx - W2 * 0.8, cy + H2 - 18 * s, 18 * s, 18 * s); lab(f.b, cx, cy + H2 + 22 * s); lab(f.a, cx - W2 * 0.8 - 14 * s, cy, 'right'); lab(f.c, cx + 14 * s, cy - 14 * s, 'left'); }
  else if (f.type === 'circle') { ctx.beginPath(); ctx.arc(cx, cy, H2 * 1.2, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + H2 * 1.2, cy); ctx.stroke(); ctx.fillStyle = C; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 7); ctx.fill(); lab(`r = ${f.r}`, cx + H2 * 0.6, cy - 18 * s); }
  else if (f.type === 'trap') { poly([[cx - W2, cy + H2], [cx + W2, cy + H2], [cx + W2 * 0.45, cy - H2], [cx - W2 * 0.45, cy - H2]]); ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(cx, cy - H2); ctx.lineTo(cx, cy + H2); ctx.stroke(); ctx.setLineDash([]); lab(`B = ${f.B}`, cx, cy + H2 + 22 * s); lab(`b = ${f.b}`, cx, cy - H2 - 18 * s); lab(`h = ${f.h}`, cx + 10, cy, 'left'); }
  else if (f.type === 'poly') { const R = H2 * 1.2; poly(Array.from({ length: f.n }, (_, i) => [cx + Math.cos(i / f.n * Math.PI * 2 - Math.PI / 2) * R, cy + Math.sin(i / f.n * Math.PI * 2 - Math.PI / 2) * R])); lab(`${f.n} lados`, cx, cy); }
  else if (f.type === 'box' || f.type === 'prism') {
    // Caixa em perspectiva (o prisma usa a mesma ideia com a base poligonal)
    if (f.type === 'box') { const w = W2 * 0.9, h = H2 * 1.1, d = 45 * s, x0 = cx - w / 2 - d / 2, y0 = cy + h / 2 + d / 4;
      ctx.fillStyle = 'rgba(45,212,191,.10)'; poly([[x0 + d, y0 - d], [x0 + d + w, y0 - d], [x0 + d + w, y0 - d - h], [x0 + d, y0 - d - h]]);
      ctx.fillStyle = F; poly([[x0, y0], [x0 + w, y0], [x0 + w, y0 - h], [x0, y0 - h]]); poly([[x0, y0 - h], [x0 + d, y0 - d - h], [x0 + d + w, y0 - d - h], [x0 + w, y0 - h]]); poly([[x0 + w, y0], [x0 + w + d, y0 - d], [x0 + w + d, y0 - d - h], [x0 + w, y0 - h]]);
      lab(f.a, x0 + w / 2, y0 + 22 * s); lab(f.c, x0 - 12 * s, y0 - h / 2, 'right'); lab(f.b, x0 + w + d / 2 + 14 * s, y0 - d / 2 + 6, 'left'); }
    else { const R = H2, top = cy - H2 * 0.9, bot = cy + H2 * 0.9, pts = (y) => Array.from({ length: f.n }, (_, i) => [cx + Math.cos(i / f.n * Math.PI * 2) * R * 1.3, y + Math.sin(i / f.n * Math.PI * 2) * R * 0.35]);
      const a = pts(top), b = pts(bot); poly(b); for (let i = 0; i < f.n; i++) { ctx.beginPath(); ctx.moveTo(a[i][0], a[i][1]); ctx.lineTo(b[i][0], b[i][1]); ctx.stroke(); } poly(a); }
  }
  else if (f.type === 'cyl' || f.type === 'cone') {
    const rx = H2 * 1.1, ry = rx * 0.32, top = cy - H2, bot = cy + H2;
    ctx.beginPath(); ctx.ellipse(cx, bot, rx, ry, 0, 0, 7); ctx.fill(); ctx.stroke();
    if (f.type === 'cyl') { ctx.beginPath(); ctx.moveTo(cx - rx, bot); ctx.lineTo(cx - rx, top); ctx.moveTo(cx + rx, bot); ctx.lineTo(cx + rx, top); ctx.stroke(); ctx.beginPath(); ctx.ellipse(cx, top, rx, ry, 0, 0, 7); ctx.fill(); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(cx - rx, bot); ctx.lineTo(cx, top - 10); ctx.lineTo(cx + rx, bot); ctx.stroke(); }
    ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(cx, bot); ctx.lineTo(cx + rx, bot); ctx.moveTo(cx, bot); ctx.lineTo(cx, f.type === 'cyl' ? top : top - 10); ctx.stroke(); ctx.setLineDash([]);
    lab(`r = ${f.r}`, cx + rx / 2, bot + ry + 20 * s); lab(`h = ${f.h}`, cx + 10, cy, 'left');
  }
  else if (f.type === 'sphere') { const R = H2 * 1.2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill(); ctx.stroke(); ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.3, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R, cy); ctx.stroke(); ctx.setLineDash([]); lab(`r = ${f.r}`, cx + R / 2, cy - 18 * s); }
  else if (f.type === 'pyr') { const w = W2 * 0.85, d = 40 * s, b0 = cy + H2 * 0.9, apex = [cx + d / 2, cy - H2 * 1.1];
    const A = [cx - w / 2, b0], B = [cx + w / 2, b0], Cc = [cx + w / 2 + d, b0 - d], D = [cx - w / 2 + d, b0 - d];
    poly([A, B, Cc, D]); ctx.fillStyle = 'rgba(45,212,191,.22)'; poly([A, B, apex]); poly([B, Cc, apex]);
    ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(apex[0], apex[1]); ctx.lineTo(apex[0], b0 - d / 2); ctx.stroke(); ctx.setLineDash([]);
    lab(`a = ${f.a}`, cx, b0 + 22 * s); lab(`h = ${f.h}`, apex[0] + 10, cy, 'left'); }
  ctx.restore();
}

// ---------- Motor dos dois jogos ----------
function defineMathGame(v) {
  const topicSets = v.topics.map(([key, label, def]) => ({ key: 't_' + key, type: 'toggle', label, default: def !== false, group: 'Conteúdos' }));
  return defineGame({
    id: v.id, name: v.name, genre: 'trivia', icon: v.icon, color: v.color, voice: true,
    desc: v.desc,
    help: `<p>${v.help}</p><p>Responda com a <b>letra</b> (A, B, C, D) ou com o <b>número</b>. Cada pessoa tem <b>uma tentativa</b> por pergunta; quem acerta primeiro ganha mais pontos. Depois aparece a <b>resolução passo a passo</b>.</p><p>🎁 Presentes dão <b>dica</b> ou <b>pulam</b> a pergunta; ❤️ likes dão <b>+10 segundos</b>.</p>`,
    settings: [
      { key: 'level', type: 'select', label: 'Nível', options: [['1', 'Fácil (ensino fundamental)'], ['2', 'Médio (ensino médio)'], ['3', 'Difícil (vestibular)']], default: '2' },
      { key: 'qSeconds', type: 'number', label: 'Segundos para responder', min: 10, max: 180, default: 40 },
      { key: 'revealSeconds', type: 'number', label: 'Segundos mostrando a resolução', min: 4, max: 40, default: 12 },
      { key: 'breakSeconds', type: 'number', label: 'Intervalo', min: 1, max: 15, default: 3 },
      { key: 'showOptions', type: 'toggle', label: 'Mostrar 4 alternativas (A, B, C, D)', default: true },
      NARRATE_SETTING('Ler a pergunta e a resolução em voz alta'),
      ...topicSets,
      ...MATCH_SETTINGS(10, 1000), ...BOARD_SETTINGS(5),
    ],
    actions: [{ id: 'hint', label: 'Dica', icon: '💡' }, { id: 'extra_time', label: '+10 segundos', icon: '⏱️' }, { id: 'skip_question', label: 'Pular pergunta', icon: '⏭️' }],
    bindings: [{ action: 'hint', trigger: 'gift', minCoins: 1 }, { action: 'skip_question', trigger: 'gift', minCoins: 30 }, { action: 'extra_time', trigger: 'like', likes: 50 }],
    reset() { this.rng = makeRng(v.id); this.points = new Points(this.id); this.round = 0; this.ph = new Phases(); this.feed = new Feed(3); this.next(); },
    onSettings() { this.reset(); },
    sample() { return this.cur ? (Math.random() < 0.5 ? pick(['a', 'b', 'c', 'd']) : String(Math.random() < 0.5 ? this.cur.ans : this.cur.ans + randInt(-2, 2))) : 'a'; },
    next() {
      const on = v.topics.filter(([k]) => this.s['t_' + k] !== false).map(([k]) => k);
      const keys = on.length ? on : v.topics.map(([k]) => k);
      const q = v.gen[this.rng.pick(keys)](this.rng, Number(this.s.level) || 2);
      // 4 alternativas: a certa, os erros comuns e vizinhos (sem repetir)
      const opts = new Set([q.ans]);
      for (const w of q.wrong || []) if (opts.size < 4 && Number.isFinite(w) && Math.abs(w - q.ans) > 1e-9) opts.add(+(+w).toFixed(2));
      for (let d = 1; opts.size < 4; d++) for (const x of [q.ans + d, q.ans - d, q.ans + d * 2]) if (opts.size < 4) opts.add(x);
      q.opts = this.rng.shuffle([...opts]); q.letter = 'ABCD'[q.opts.indexOf(q.ans)];
      this.cur = q; this.right = []; this.tried = new Set(); this.hintOn = false; this.round++;
      this.ph.go('q', this.s.qSeconds);
      narrate(this, `${q.topic}. ${speakMath(q.q.replace('\n', '. '))}`);
    },
    onChat(ev) {
      if (this.ph.name !== 'q') return;
      const q = this.cur, k = uid(ev), t = norm(ev.text).replace(',', '.');
      const lt = t.replace(/^letra /, '').replace(/ /g, ''), letter = this.s.showOptions && /^[abcd]$/.test(lt) ? lt : null; // só a letra sozinha ("a resposta é…" não conta)
      const n = /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
      if (!letter && n === null) return;
      if (this.tried.has(k)) return;
      this.tried.add(k);
      if ((letter && letter.toUpperCase() === q.letter) || (n !== null && Math.abs(n - q.ans) < 1e-6)) {
        const pos = this.right.length, pts = Math.max(10, 100 - pos * 10) * (Number(this.s.level) || 2);
        this.right.push({ user: ev.user, pts }); this.points.add(ev.user, pts);
        if (pos === 0) { sfx.confirm(); burst(W / 2, 520, ['#2dd4bf', '#fff'], 30, 360); }
      }
    },
    onAction(id, a) {
      if (this.ph.name !== 'q') return;
      if (id === 'hint') { this.hintOn = true; this.feed.push(a.user, `💡 dica: ${this.cur.hint}`); narrate(this, `Dica: ${speakMath(this.cur.hint)}`); }
      else if (id === 'extra_time') { this.ph.t += 10; this.ph.total += 10; this.feed.push(a.user, '⏱️ +10s'); }
      else if (id === 'skip_question') { this.feed.push(a.user, '⏭️ pulou', '#ffc93c'); this.ph.go('reveal', this.s.revealSeconds); }
    },
    update(dt) {
      this.feed.update(dt);
      if (!this.ph.update(dt)) return;
      if (this.ph.name === 'q') {
        this.ph.go('reveal', this.s.revealSeconds);
        const q = this.cur;
        narrate(this, `Resposta: letra ${q.letter}, ${fmtN(q.ans)}. ${q.steps.map(speakMath).join('. ')}. ${this.right[0] ? `${this.right[0].user.nick} acertou primeiro!` : ''}`);
      } else if (this.ph.name === 'reveal') {
        if (matchOver(this, this.round, this.points.best)) { this.champ = this.points.top(1)[0]; if (this.champ) { scores.add(this.id, this.champ.user, 0, 1); confetti(140); sfx.win(); } this.ph.go('final', 9); }
        else this.ph.go('break', this.s.breakSeconds);
      } else if (this.ph.name === 'break') this.next();
      else if (this.ph.name === 'final') { this.points.clear(); this.round = 0; this.next(); }
    },
    draw() {
      if (!customBackground(this)) stageBg(v.stage);
      if (this.ph.name === 'final') { title('FIM DA PARTIDA', W / 2, 120, 54, v.accent); if (this.champ) winnerSpot(this.champ.user, 420, { sub: `${fmtNum(this.champ.value)} pontos` }); hudBoard(this.points.top(5), 90, 720, W - 180, { title: 'PÓDIO', unit: ' pts' }); return; }
      const q = this.cur, reveal = this.ph.name !== 'q';
      title(v.title, W / 2, 58, 42, '#fff');
      pill(`${q.topic.toUpperCase()} · PERGUNTA ${this.round}`, W / 2, 100, { size: 14, bg: 'rgba(0,0,0,.55)', color: v.accent });
      hudTimer(W - 70, 70, 40, this.ph.name === 'q' ? this.ph.t : 0, this.ph.name === 'q' ? this.ph.total : 1, v.accent);
      // Quadro: figura (geometria) e enunciado
      const top = 130, figH = q.fig ? 290 : 0;
      panel(30, top, W - 60, figH + 40 + 46 * mathLines(q.q, W - 120, 36).length, { r: 26, from: '#0b2d2a', to: '#04110f', border: 'rgba(94,234,212,.6)', glow: 'rgba(45,212,191,.25)' });
      if (q.fig) drawFig(q.fig, W / 2, top + 30 + figH / 2, 1);
      mathLines(q.q, W - 120, 36).forEach((l, i) => label(l, W / 2, top + figH + 44 + i * 46, 36, '#fff', 'center', 900));
      let y = top + figH + 60 + 46 * mathLines(q.q, W - 120, 36).length;
      if (this.hintOn && !reveal) { pill(`💡 ${q.hint}`, W / 2, y, { size: 18, bg: 'rgba(250,204,21,.18)', color: '#fde68a', border: '#facc15' }); y += 42; }
      // Alternativas
      if (this.s.showOptions) {
        q.opts.forEach((o, i) => {
          const x = 40 + (i % 2) * ((W - 80) / 2 + 0), yy = y + Math.floor(i / 2) * 76, w = (W - 100) / 2, ok = reveal && o === q.ans;
          ctx.fillStyle = ok ? 'rgba(34,197,94,.35)' : reveal ? 'rgba(0,0,0,.35)' : 'rgba(8,10,24,.7)'; ctx.beginPath(); ctx.roundRect(x + (i % 2) * 20, yy, w, 64, 18); ctx.fill();
          ctx.strokeStyle = ok ? '#22c55e' : 'rgba(255,255,255,.18)'; ctx.lineWidth = ok ? 4 : 2; ctx.stroke();
          label('ABCD'[i], x + (i % 2) * 20 + 34, yy + 33, 30, ok ? '#86efac' : v.accent, 'center', 900, F_TITLE);
          label(fmtN(o), x + (i % 2) * 20 + w / 2 + 20, yy + 33, 32, '#fff', 'center', 900);
        });
        y += 160;
      }
      if (reveal) {
        // Resolução passo a passo
        const steps = q.steps, h = 50 + steps.length * 40;
        panel(30, y, W - 60, h, { r: 22, from: '#10301a', to: '#06140b', border: 'rgba(134,239,172,.6)' });
        label(`✔ RESPOSTA: ${q.letter ? q.letter + ') ' : ''}${fmtN(q.ans)}`, W / 2, y + 28, 24, '#86efac', 'center', 900);
        steps.forEach((s, i) => label(trim(s, 44), W / 2, y + 68 + i * 40, 24, '#fff', 'center', 800));
        y += h + 14;
      } else { title(this.right.length ? `${this.right.length} ACERTARAM` : 'COMENTE A LETRA OU O NÚMERO', W / 2, y + 20, 26, this.right.length ? '#7cff6b' : '#fff'); y += 44; }
      // Quem acertou
      this.right.slice(0, 5).forEach((r, i) => avatar(r.user, W / 2 - 2 * 58 + i * 58, y + 28, 24, i === 0 ? '#ffc93c' : '#7cff6b'));
      if (this.s.showLeaderboard && y < 960) hudBoard(this.points.top(this.s.leaderboardSize), 120, Math.max(y + 70, 900), W - 240, { title: 'RANKING', n: 3, unit: ' pts', rowH: 34 });
      this.feed.draw(20, 160);
    },
  });
}

defineMathGame({
  id: 'math-algebra', name: 'Desafio da Álgebra', title: 'DESAFIO DA ÁLGEBRA', icon: '🧮', color: '#14b8a6', stage: 'teal', accent: '#5eead4',
  desc: 'Equações do 1º e 2º grau, logaritmos e sistemas. O chat responde com a letra ou o número e depois vê a resolução passo a passo.',
  help: 'Aparece uma questão de <b>equação do 1º grau</b>, <b>equação do 2º grau</b>, <b>logaritmo</b> ou <b>sistema</b>. Escolha os conteúdos e o nível nas configurações.',
  topics: [['eq1', 'Equação do 1º grau'], ['eq2', 'Equação do 2º grau'], ['log', 'Logaritmos'], ['sys', 'Sistemas de equações']],
  gen: ALG_GEN,
});
defineMathGame({
  id: 'math-geometry', name: 'Geometria Show', title: 'GEOMETRIA SHOW', icon: '📐', color: '#8b5cf6', stage: 'purple', accent: '#c4b5fd',
  desc: 'Geometria plana e espacial com a figura desenhada na tela: áreas, perímetros, Pitágoras, ângulos, volumes de cubo, cilindro, cone, esfera e pirâmide.',
  help: 'A figura aparece desenhada com as medidas. Tem <b>geometria plana</b> (retângulo, triângulo, círculo, trapézio, Pitágoras, ângulos) e <b>espacial</b> (cubo, paralelepípedo, cilindro, cone, esfera, pirâmide, poliedros). Nos círculos e cilindros usamos π = 3.',
  topics: [['rect', 'Plana: retângulo'], ['tri', 'Plana: triângulo'], ['pyth', 'Plana: Pitágoras'], ['circle', 'Plana: círculo'], ['trap', 'Plana: trapézio'], ['poly', 'Plana: ângulos dos polígonos'],
    ['cube', 'Espacial: cubo'], ['box', 'Espacial: paralelepípedo'], ['cyl', 'Espacial: cilindro'], ['cone', 'Espacial: cone'], ['sphere', 'Espacial: esfera'], ['pyr', 'Espacial: pirâmide'], ['euler', 'Espacial: poliedros (Euler)']],
  gen: GEO_GEN,
});
