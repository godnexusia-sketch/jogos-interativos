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

  // ---- Conteúdos novos (o nível muda o tamanho dos números) ----
  square(r, lv) { const a = r.int(2, 6 + lv * 4), per = r() < 0.4;
    return { topic: 'Geometria plana · quadrado', fig: { type: 'rect', a: `${a} cm`, b: `${a} cm` }, q: per ? 'Qual é o PERÍMETRO do quadrado (cm)?' : 'Qual é a ÁREA do quadrado (cm²)?', ans: per ? 4 * a : a * a, wrong: per ? [a * a, 2 * a, 3 * a] : [4 * a, 2 * a, a * a + a], hint: per ? '4 lados iguais' : 'lado × lado', steps: per ? [`P = 4 × lado`, `P = 4 × ${a} = ${4 * a} cm`] : [`A = lado²`, `A = ${a} × ${a} = ${a * a} cm²`] }; },
  rectSide(r, lv) { const a = r.int(2, 5 + lv * 3), b = r.int(2, 4 + lv * 3);
    return { topic: 'Geometria plana · retângulo', fig: { type: 'rect', a: `${a} cm`, b: '?' }, q: `A área do retângulo é ${a * b} cm². Quanto mede a altura?`, ans: b, wrong: [a * b - a, a + b, a], hint: 'altura = área ÷ base', steps: [`A = base × altura`, `${a * b} = ${a} × h`, `h = ${a * b} ÷ ${a} = ${b} cm`] }; },
  paral(r, lv) { const b = r.int(3, 6 + lv * 4), h = r.int(2, 4 + lv * 3);
    return { topic: 'Geometria plana · paralelogramo', fig: { type: 'paral', b: `${b} cm`, h: `${h} cm` }, q: 'Qual é a ÁREA do paralelogramo (cm²)?', ans: b * h, wrong: [b * h / 2, 2 * (b + h), b + h], hint: 'base × altura (não é o lado inclinado)', steps: [`A = base × altura`, `A = ${b} × ${h} = ${b * h} cm²`] }; },
  rhombus(r, lv) { let D = r.int(2, 4 + lv * 3) * 2, d = r.int(1, 3 + lv * 2) * 2; if (d > D) [D, d] = [d, D]; if (d === D) D += 2;
    return { topic: 'Geometria plana · losango', fig: { type: 'rhombus', D: `${D}`, d: `${d}` }, q: 'Qual é a ÁREA do losango?', ans: D * d / 2, wrong: [D * d, D + d, D * d / 4], hint: 'diagonal maior × diagonal menor ÷ 2', steps: [`A = (D × d) ÷ 2`, `A = (${D} × ${d}) ÷ 2 = ${D * d / 2}`] }; },
  hexa(r, lv) { const a = r.int(2, 6 + lv * 4), per = r() < 0.6;
    return per ? { topic: 'Geometria plana · hexágono regular', fig: { type: 'poly', n: 6 }, q: `Um hexágono regular tem lado ${a} cm. Qual é o PERÍMETRO (cm)?`, ans: 6 * a, wrong: [5 * a, 8 * a, a * a], hint: '6 lados iguais', steps: [`P = 6 × lado`, `P = 6 × ${a} = ${6 * a} cm`] }
      : { topic: 'Geometria plana · hexágono regular', fig: { type: 'poly', n: 6 }, q: `O hexágono regular é formado por 6 triângulos iguais de área ${a * 2} cm². Qual é a ÁREA do hexágono?`, ans: 12 * a, wrong: [6 * a, 3 * a * 2, 18 * a], hint: '6 × área de cada triângulo', steps: [`A = 6 × ${a * 2}`, `A = ${12 * a} cm²`] }; },
  diag(r) { const n = r.int(4, 12), names = { 4: 'quadrilátero', 5: 'pentágono', 6: 'hexágono', 7: 'heptágono', 8: 'octógono', 9: 'eneágono', 10: 'decágono', 11: 'undecágono', 12: 'dodecágono' };
    return { topic: 'Geometria plana · diagonais', fig: { type: 'poly', n }, q: `Quantas DIAGONAIS tem um ${names[n]}?`, ans: n * (n - 3) / 2, wrong: [n * (n - 3), n, n * (n - 1) / 2], hint: 'D = n × (n − 3) ÷ 2', steps: [`D = n × (n − 3) ÷ 2`, `D = ${n} × ${n - 3} ÷ 2 = ${n * (n - 3) / 2}`] }; },
  angInt(r) { const n = r.pick([3, 4, 5, 6, 8, 9, 10, 12]), names = { 3: 'triângulo equilátero', 4: 'quadrado', 5: 'pentágono regular', 6: 'hexágono regular', 8: 'octógono regular', 9: 'eneágono regular', 10: 'decágono regular', 12: 'dodecágono regular' }, ai = (n - 2) * 180 / n;
    return { topic: 'Geometria plana · ângulo interno', fig: { type: 'poly', n }, q: `Quanto mede CADA ângulo interno de um ${names[n]}? (graus)`, ans: ai, wrong: [(n - 2) * 180, 360 / n, 180 - ai === ai ? ai + 10 : 180 - ai], hint: '(n − 2) × 180° ÷ n', steps: [`S = (${n} − 2) × 180° = ${(n - 2) * 180}°`, `Cada um = ${(n - 2) * 180}° ÷ ${n} = ${ai}°`] }; },
  angExt(r) { const n = r.pick([3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20]);
    return { topic: 'Geometria plana · ângulo externo', fig: { type: 'poly', n: Math.min(n, 12) }, q: `Quanto mede cada ângulo EXTERNO de um polígono regular de ${n} lados? (graus)`, ans: 360 / n, wrong: [180 / n, (n - 2) * 180 / n, 360 - 360 / n], hint: 'Os externos somam 360°', steps: [`Externo = 360° ÷ n`, `Externo = 360° ÷ ${n} = ${360 / n}°`] }; },
  compl(r) { const sup = r() < 0.5, a = sup ? r.int(10, 170) : r.int(5, 85);
    return { topic: sup ? 'Ângulos · suplementares' : 'Ângulos · complementares', fig: { type: 'angle', a, total: sup ? 180 : 90 }, q: sup ? `Qual é o SUPLEMENTO de um ângulo de ${a}°?` : `Qual é o COMPLEMENTO de um ângulo de ${a}°?`, ans: (sup ? 180 : 90) - a, wrong: sup ? [90 - a > 0 ? 90 - a : 360 - a, 360 - a, a] : [180 - a, 360 - a, a].filter((x) => x !== 90 - a), hint: sup ? 'Suplementares somam 180°' : 'Complementares somam 90°', steps: [`${sup ? 180 : 90}° − ${a}° = ${(sup ? 180 : 90) - a}°`] }; },
  tri3(r) { const a = r.int(20, 90), b = r.int(20, 160 - a - 10), c = 180 - a - b;
    return { topic: 'Triângulo · soma dos ângulos', fig: { type: 'triang', A: `${a}°`, B: `${b}°`, C: '?' }, q: `Dois ângulos de um triângulo medem ${a}° e ${b}°. Quanto mede o terceiro?`, ans: c, wrong: [360 - a - b, a + b, 90 - Math.min(a, b)].filter((x) => x > 0 && x !== c), hint: 'A soma é 180°', steps: [`${a}° + ${b}° + x = 180°`, `x = 180° − ${a + b}° = ${c}°`] }; },
  triPer(r, lv) { const a = r.int(3, 5 + lv * 4), b = r.int(3, 5 + lv * 4), c = r.int(Math.abs(a - b) + 1, a + b - 1);
    return { topic: 'Geometria plana · perímetro do triângulo', fig: { type: 'tri3s', a: `${a}`, b: `${b}`, c: `${c}` }, q: 'Qual é o PERÍMETRO do triângulo?', ans: a + b + c, wrong: [a * b, a + b, (a + b + c) * 2], hint: 'Some os três lados', steps: [`P = ${a} + ${b} + ${c} = ${a + b + c}`] }; },
  pythLeg(r) { const [p, q2, hyp] = r.pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [7, 24, 25], [12, 16, 20], [9, 40, 41], [20, 21, 29]]);
    return { topic: 'Teorema de Pitágoras · cateto', fig: { type: 'right', a: '?', b: `${q2}`, c: `${hyp}` }, q: `A hipotenusa mede ${hyp} e um cateto mede ${q2}. Quanto mede o outro cateto?`, ans: p, wrong: [hyp - q2, hyp + q2, p + 1], hint: 'cateto² = hipotenusa² − cateto²', steps: [`x² = ${hyp}² − ${q2}²`, `x² = ${hyp * hyp} − ${q2 * q2} = ${p * p}`, `x = √${p * p} = ${p}`] }; },
  dist(r) { const [dx, dy, d] = r.pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 6, 10], [4, 3, 5], [12, 5, 13], [9, 12, 15]]), x1 = r.int(-3, 4), y1 = r.int(-3, 3), x2 = x1 + dx, y2 = y1 + dy;
    return { topic: 'Geometria analítica · distância', fig: { type: 'coord', x1, y1, x2, y2 }, q: `Qual é a distância entre A(${x1}, ${y1}) e B(${x2}, ${y2})?`, ans: d, wrong: [dx + dy, d + 1, Math.abs(dx - dy) || d + 2], hint: 'd² = Δx² + Δy²', steps: [`Δx = ${dx}, Δy = ${dy}`, `d² = ${dx * dx} + ${dy * dy} = ${d * d}`, `d = ${d}`] }; },
  circR(r, lv) { const rad = r.int(1, 4 + lv * 2);
    return { topic: 'Círculo · raio pela área (π = 3)', fig: { type: 'circle', r: '?' }, q: `A área do círculo é ${3 * rad * rad} cm². Quanto mede o raio? (π = 3)`, ans: rad, wrong: [rad * rad, rad * 3, rad + 2], hint: 'A = π × r² → r² = A ÷ 3', steps: [`${3 * rad * rad} = 3 × r²`, `r² = ${rad * rad}`, `r = ${rad} cm`] }; },
  cylLat(r, lv) { const rad = r.int(1, 3 + lv), h = r.int(2, 5 + lv * 2);
    return { topic: 'Cilindro · área lateral (π = 3)', fig: { type: 'cyl', r: `${rad}`, h: `${h}` }, q: 'Qual é a ÁREA LATERAL do cilindro? (π = 3)', ans: 6 * rad * h, wrong: [3 * rad * rad * h, 3 * rad * h, 6 * rad * rad], hint: 'A = 2 × π × r × h', steps: [`A = 2 × π × r × h`, `A = 2 × 3 × ${rad} × ${h} = ${6 * rad * h}`] }; },
  prism3(r, lv) { const b = r.int(1, 3 + lv) * 2, h = r.int(2, 4 + lv), H = r.int(2, 5 + lv * 2);
    return { topic: 'Espacial · prisma triangular', fig: { type: 'prism', n: 3 }, q: `Um prisma tem base triangular de base ${b} e altura ${h}, e altura do prisma ${H}. Qual é o VOLUME?`, ans: b * h / 2 * H, wrong: [b * h * H, b * h / 2 + H, b * h * H / 3], hint: 'V = área da base × altura', steps: [`Base = ${b} × ${h} ÷ 2 = ${b * h / 2}`, `V = ${b * h / 2} × ${H} = ${b * h / 2 * H}`] }; },
  cubeEdge(r, lv) { const a = r.int(2, 4 + lv * 2);
    return { topic: 'Espacial · aresta do cubo', fig: { type: 'box', a: '?', b: '?', c: '?' }, q: `O volume de um cubo é ${a ** 3}. Quanto mede a aresta?`, ans: a, wrong: [a * a, a * 3, a + 1], hint: 'aresta = raiz cúbica do volume', steps: [`a³ = ${a ** 3}`, `a = ∛${a ** 3} = ${a}`] }; },
  litros(r, lv) { const a = r.int(1, 3 + lv), b = r.int(1, 3 + lv), c = r.int(1, 3 + lv);
    return { topic: 'Espacial · volume em litros', fig: { type: 'box', a: `${a} dm`, b: `${b} dm`, c: `${c} dm` }, q: 'Quantos LITROS cabem nessa caixa? (1 dm³ = 1 litro)', ans: a * b * c, wrong: [a * b * c * 10, a + b + c, a * b * c * 1000], hint: '1 dm³ = 1 L', steps: [`V = ${a} × ${b} × ${c} = ${a * b * c} dm³`, `${a * b * c} dm³ = ${a * b * c} litros`] }; },
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
    else { const R = H2, top = cy - H2 * 0.9, bot = cy + H2 * 0.9, a0 = f.n === 3 ? Math.PI / 2 : 0, pts = (y) => Array.from({ length: f.n }, (_, i) => [cx + Math.cos(a0 + i / f.n * Math.PI * 2) * R * 1.3, y + Math.sin(a0 + i / f.n * Math.PI * 2) * R * (f.n === 3 ? 0.5 : 0.35)]);
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
  else if (f.type === 'paral') { const sh = 40 * s; poly([[cx - W2, cy + H2], [cx + W2 - sh, cy + H2], [cx + W2, cy - H2], [cx - W2 + sh, cy - H2]]); ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(cx - W2 + sh, cy - H2); ctx.lineTo(cx - W2 + sh, cy + H2); ctx.stroke(); ctx.setLineDash([]); lab(f.b, cx - sh / 2, cy + H2 + 22 * s); lab(f.h, cx - W2 + sh + 10 * s, cy + 6, 'left'); }
  else if (f.type === 'rhombus') { const rx = W2, ry = H2 * 1.15; poly([[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]]); ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(cx - rx, cy); ctx.lineTo(cx + rx, cy); ctx.moveTo(cx, cy - ry); ctx.lineTo(cx, cy + ry); ctx.stroke(); ctx.setLineDash([]); lab(`D = ${f.D}`, cx + rx / 2, cy + 24 * s); lab(`d = ${f.d}`, cx - 10 * s, cy - ry / 2, 'right'); }
  else if (f.type === 'angle') { const R = H2 * 1.4, a0 = 0, a1 = -(f.total) * Math.PI / 180, am = -(f.a) * Math.PI / 180, ox = cx - R * (f.total === 180 ? 0 : 0.5), oy = cy + H2 * 0.6;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(a0) * R, oy + Math.sin(a0) * R); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(a1) * R, oy + Math.sin(a1) * R); ctx.stroke();
    ctx.strokeStyle = T; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(am) * R, oy + Math.sin(am) * R); ctx.stroke();
    ctx.strokeStyle = C; ctx.beginPath(); ctx.arc(ox, oy, R * 0.35, am, 0); ctx.stroke(); lab(`${f.a}°`, ox + Math.cos(am / 2) * R * 0.55, oy + Math.sin(am / 2) * R * 0.55); lab('?', ox + Math.cos((am + a1) / 2) * R * 0.55, oy + Math.sin((am + a1) / 2) * R * 0.55); }
  else if (f.type === 'triang') { const A = [cx - W2, cy + H2], B = [cx + W2, cy + H2], Cc = [cx - W2 * 0.1, cy - H2]; poly([A, B, Cc]); lab(f.A, A[0] + 34 * s, A[1] - 14 * s); lab(f.B, B[0] - 34 * s, B[1] - 14 * s); lab(f.C, Cc[0], Cc[1] + 36 * s); }
  else if (f.type === 'tri3s') { const A = [cx - W2, cy + H2], B = [cx + W2, cy + H2], Cc = [cx + W2 * 0.15, cy - H2]; poly([A, B, Cc]); lab(f.a, cx, cy + H2 + 22 * s); lab(f.b, (B[0] + Cc[0]) / 2 + 16 * s, (B[1] + Cc[1]) / 2, 'left'); lab(f.c, (A[0] + Cc[0]) / 2 - 16 * s, (A[1] + Cc[1]) / 2, 'right'); }
  else if (f.type === 'coord') { const dx = f.x2 - f.x1, dy = f.y2 - f.y1, u = Math.min(W2 * 1.7 / dx, H2 * 1.7 / dy), P = (x, y) => [cx + (x - (f.x1 + f.x2) / 2) * u, cy - (y - (f.y1 + f.y2) / 2) * u], a = P(f.x1, f.y1), b = P(f.x2, f.y2);
    // quadriculado (1 quadradinho = 1 unidade)
    ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let x = f.x1 - 1; x <= f.x2 + 1; x++) { const [px] = P(x, 0); ctx.moveTo(px, b[1] - u); ctx.lineTo(px, a[1] + u); }
    for (let y = f.y1 - 1; y <= f.y2 + 1; y++) { const [, py] = P(0, y); ctx.moveTo(a[0] - u, py); ctx.lineTo(b[0] + u, py); }
    ctx.stroke();
    ctx.strokeStyle = C; ctx.lineWidth = 4; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.fillStyle = T; for (const [p, n, al, ox] of [[a, `A(${f.x1}, ${f.y1})`, 'right', -12], [b, `B(${f.x2}, ${f.y2})`, 'left', 12]]) { ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, 7); ctx.fill(); lab(n, p[0] + ox * s, p[1] + (n[0] === 'A' ? 4 : 10) * s, al); } }
  ctx.restore();
}

// ---------- Motor dos dois jogos ----------
function defineMathGame(v) {
  const topicSets = v.topics.map(([key, label, def]) => ({ key: 't_' + key, type: 'toggle', label, default: def !== false, group: 'Conteúdos' }));
  return defineGame({
    id: v.id, name: v.name, genre: 'trivia', icon: v.icon, color: v.color, voice: true, legendPos: { side: 'left', y: 930, cycle: true }, legendPos: { side: 'left', y: 930, cycle: true },
    desc: v.desc,
    help: `<p>${v.help}</p><p>Responda com a <b>letra</b> (A, B, C, D) ou com o <b>número</b>. Cada pessoa tem <b>uma tentativa</b> por pergunta; quem acerta primeiro ganha mais pontos. Depois aparece a <b>resolução passo a passo</b>.</p><p>🎁 Presentes dão <b>dica</b> ou <b>pulam</b> a pergunta; ❤️ likes dão <b>+10 segundos</b>.</p>`,
    settings: [
      { key: 'level', type: 'select', label: 'Nível', options: [['mix', 'Aleatório (fácil, médio e difícil misturados)'], ['1', 'Fácil (ensino fundamental)'], ['2', 'Médio (ensino médio)'], ['3', 'Difícil (vestibular)']], default: 'mix' },
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
      // Sem repetir: os conteúdos saem em rodízio (todos antes de repetir) e a mesma pergunta não volta enquanto houver novas
      if (!this.bag?.length || this.bagKeys !== keys.join()) { this.bag = this.rng.shuffle([...keys]); this.bagKeys = keys.join(); }
      this.seen ||= new Set();
      const lvl = this.s.level === 'mix' ? this.rng.int(1, 3) : Number(this.s.level) || 2;
      const topic = this.bag.pop();
      // se um conteúdo já esgotou as perguntas novas, tenta os outros; só repete quando todos esgotarem
      let q, nova = false;
      for (const tp of [topic, ...this.rng.shuffle(keys.filter((k) => k !== topic))]) {
        for (let t = 0; t < 40 && !nova; t++) { q = v.gen[tp](this.rng, lvl); const sig = q.q + JSON.stringify(q.fig || ''); if (!this.seen.has(sig)) { this.seen.add(sig); nova = true; } }
        if (nova) break;
      }
      if (!nova || this.seen.size > 5000) this.seen.clear();
      q.lv = lvl;
      // 4 alternativas: a certa, os erros comuns e vizinhos (sem repetir)
      const opts = new Set([q.ans]);
      for (const w of q.wrong || []) if (opts.size < 4 && Number.isFinite(w) && Math.abs(w - q.ans) > 1e-9) opts.add(+(+w).toFixed(2));
      for (let d = 1; opts.size < 4; d++) for (const x of [q.ans + d, q.ans - d, q.ans + d * 2]) if (opts.size < 4) opts.add(x);
      q.opts = this.rng.shuffle([...opts]); q.letter = 'ABCD'[q.opts.indexOf(q.ans)];
      this.cur = q; this.right = []; this.tried = new Set(); this.hintOn = false; this.round++; this.votes = [0, 0, 0, 0]; this.voters = [[], [], [], []]; this.voteFlash = null;
      this.ph.go('q', this.s.qSeconds);
      narrate(this, `${q.topic}. ${speakMath(q.q.replace('\n', '. '))}`);
    },
    // Lê a resposta do comentário: a letra ("b", "B)", "letra b") ou o número da alternativa ("36", "-10", "36 cm", "2,5")
    pickOption(text) {
      const q = this.cur, raw = String(text || '').trim().toLowerCase().replace(/^(é|e|eh|resposta|letra)\s*[:=]?\s*/, '').replace(/^(letra)\s*/, '');
      const lm = raw.match(/^\(?([abcd])\)?[\s.!)]*$/);
      if (lm && this.s.showOptions) return 'abcd'.indexOf(lm[1]);
      const nm = raw.replace(/\s+/g, ' ').match(/^(-?\s?\d+(?:[.,]\d+)?)\s*(cm²|cm2|cm³|cm3|cm|m²|m|°|graus|grau|unidades)?[\s!.]*$/);
      if (!nm) return -1;
      const n = Number(nm[1].replace(/\s/g, '').replace(',', '.'));
      if (this.s.showOptions) return q.opts.findIndex((o) => Math.abs(o - n) < 1e-6);
      return Math.abs(n - q.ans) < 1e-6 ? q.opts.indexOf(q.ans) : 4; // sem alternativas: qualquer número conta (4 = errado)
    },
    onChat(ev) {
      if (this.ph.name !== 'q') return;
      const q = this.cur, k = uid(ev), i = this.pickOption(ev.text);
      if (i < 0 || this.tried.has(k)) return; // uma resposta por pessoa (a primeira vale)
      this.tried.add(k);
      // Marca na tela: foto da pessoa na alternativa e barra de quantos marcaram cada uma
      if (i < 4) { this.votes[i]++; this.voters[i].unshift(ev.user); if (this.voters[i].length > 6) this.voters[i].pop(); }
      this.voteFlash = { i, user: ev.user, t: 1.6 };
      if (i === q.opts.indexOf(q.ans)) {
        const pos = this.right.length, pts = Math.max(10, 100 - pos * 10) * (q.lv || Number(this.s.level) || 2);
        this.right.push({ user: ev.user, pts }); this.points.add(ev.user, pts);
        if (pos === 0) sfx.confirm();
      } else sfx.pop?.();
    },
    onAction(id, a) {
      if (this.ph.name !== 'q') return;
      if (id === 'hint') { this.hintOn = true; this.feed.push(a.user, `💡 dica: ${this.cur.hint}`); narrate(this, `Dica: ${speakMath(this.cur.hint)}`); }
      else if (id === 'extra_time') { this.ph.t += 10; this.ph.total += 10; this.feed.push(a.user, '⏱️ +10s'); }
      else if (id === 'skip_question') { this.feed.push(a.user, '⏭️ pulou', '#ffc93c'); this.ph.go('reveal', this.s.revealSeconds); }
    },
    update(dt) {
      this.feed.update(dt);
      if (this.voteFlash && (this.voteFlash.t -= dt) <= 0) this.voteFlash = null;
      if (!this.ph.update(dt)) return;
      if (this.ph.name === 'q') {
        this.ph.go('reveal', this.s.revealSeconds);
        const q = this.cur;
        narrate(this, `Resposta: letra ${q.letter}, ${fmtN(q.ans)}. ${q.steps.map(speakMath).join('. ')}. ${congratsLine(this.right)}`);
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
      // Alternativas com a barra de votos (porcentagem e quantos) e as fotos de quem marcou
      if (this.s.showOptions) {
        const tot = this.votes.reduce((a, b) => a + b, 0), bh2 = 92;
        q.opts.forEach((o, i) => {
          const w = (W - 100) / 2, x = 40 + (i % 2) * (w + 20), yy = y + Math.floor(i / 2) * (bh2 + 12), ok = reveal && o === q.ans, pct = tot ? this.votes[i] / tot : 0;
          const flash = this.voteFlash?.i === i ? this.voteFlash.t / 1.6 : 0;
          ctx.fillStyle = ok ? 'rgba(34,197,94,.30)' : reveal ? 'rgba(0,0,0,.35)' : 'rgba(8,10,24,.72)'; ctx.beginPath(); ctx.roundRect(x, yy, w, bh2, 18); ctx.fill();
          // Barra de progresso dos votos
          ctx.save(); ctx.beginPath(); ctx.roundRect(x, yy, w, bh2, 18); ctx.clip();
          ctx.fillStyle = ok ? 'rgba(34,197,94,.45)' : `rgba(${v.accent === '#5eead4' ? '45,212,191' : '167,139,250'},${0.22 + flash * 0.25})`; ctx.fillRect(x, yy + bh2 - 26, w * pct, 26);
          ctx.restore();
          ctx.strokeStyle = ok ? '#22c55e' : flash ? '#fff' : 'rgba(255,255,255,.18)'; ctx.lineWidth = ok ? 4 : flash ? 3 : 2; ctx.beginPath(); ctx.roundRect(x, yy, w, bh2, 18); ctx.stroke();
          label('ABCD'[i], x + 30, yy + 30, 30, ok ? '#86efac' : v.accent, 'center', 900, F_TITLE);
          label(fmtN(o), x + w / 2 + 14, yy + 30, 32, '#fff', 'center', 900);
          label(`${Math.round(pct * 100)}% · ${this.votes[i]}`, x + w - 12, yy + bh2 - 13, 14, '#fff', 'right', 900);
          this.voters[i].slice(0, 5).forEach((u, j) => avatar(u, x + 22 + j * 24, yy + bh2 - 13, 11, ok ? '#86efac' : 'rgba(255,255,255,.8)'));
        });
        y += 2 * (bh2 + 12) + 6;
        if (!reveal) { label(`${tot} ${tot === 1 ? 'pessoa respondeu' : 'pessoas responderam'}`, W / 2, y + 4, 18, 'rgba(255,255,255,.8)', 'center', 800); y += 24; }
        // Aviso de quem acabou de marcar
        if (this.voteFlash && !reveal) { pill(`✔ ${trim(this.voteFlash.user.nick || '', 14)} marcou ${'ABCD'[this.voteFlash.i] || '?'}`, W / 2, y + 12, { size: 16, bg: 'rgba(0,0,0,.6)', color: v.accent }); y += 34; }
      }
      if (reveal) {
        // Resolução passo a passo
        const steps = q.steps, h = 50 + steps.length * 40;
        panel(30, y, W - 60, h, { r: 22, from: '#10301a', to: '#06140b', border: 'rgba(134,239,172,.6)' });
        label(`✔ RESPOSTA: ${q.letter ? q.letter + ') ' : ''}${fmtN(q.ans)}`, W / 2, y + 28, 24, '#86efac', 'center', 900);
        steps.forEach((s, i) => label(trim(s, 44), W / 2, y + 68 + i * 40, 24, '#fff', 'center', 800));
        y += h + 14;
      } else { title('COMENTE A LETRA OU O NÚMERO', W / 2, y + 20, 26, '#fff'); y += 44; }
      // Quem acertou
      if (reveal) this.right.slice(0, 5).forEach((r, i) => avatar(r.user, W / 2 - 2 * 58 + i * 58, y + 28, 24, i === 0 ? '#ffc93c' : '#7cff6b'));
      if (this.s.showLeaderboard) hudBoard(this.points.top(this.s.leaderboardSize), 330, Math.max(y + 60, 930), 210, { title: 'RANKING', n: 3, unit: '', rowH: 32 }); // ranking no meio; lista à esquerda; mascote à direita
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
  desc: 'Geometria plana, espacial e analítica com a figura desenhada na tela: 29 conteúdos, de áreas e perímetros a Pitágoras, ângulos, diagonais, distância entre pontos e volumes. Fácil, médio, difícil ou aleatório.',
  help: 'A figura aparece desenhada com as medidas. Tem <b>geometria plana</b> (retângulo, triângulo, círculo, trapézio, Pitágoras, ângulos) e <b>espacial</b> (cubo, paralelepípedo, cilindro, cone, esfera, pirâmide, poliedros). Nos círculos e cilindros usamos π = 3.',
  topics: [['rect', 'Plana: retângulo'], ['tri', 'Plana: triângulo'], ['pyth', 'Plana: Pitágoras'], ['circle', 'Plana: círculo'], ['trap', 'Plana: trapézio'], ['poly', 'Plana: ângulos dos polígonos'],
    ['square', 'Plana: quadrado'], ['rectSide', 'Plana: lado do retângulo pela área'], ['paral', 'Plana: paralelogramo'], ['rhombus', 'Plana: losango'], ['hexa', 'Plana: hexágono regular'], ['triPer', 'Plana: perímetro do triângulo'], ['circR', 'Plana: raio pela área do círculo'],
    ['diag', 'Ângulos e polígonos: diagonais'], ['angInt', 'Ângulos e polígonos: ângulo interno'], ['angExt', 'Ângulos e polígonos: ângulo externo'], ['compl', 'Ângulos: complementar e suplementar'], ['tri3', 'Ângulos: terceiro ângulo do triângulo'],
    ['pythLeg', 'Pitágoras: cateto'], ['dist', 'Geometria analítica: distância entre pontos'],
    ['cube', 'Espacial: cubo'], ['box', 'Espacial: paralelepípedo'], ['cyl', 'Espacial: cilindro'], ['cylLat', 'Espacial: área lateral do cilindro'], ['cone', 'Espacial: cone'], ['sphere', 'Espacial: esfera'], ['pyr', 'Espacial: pirâmide'], ['prism3', 'Espacial: prisma triangular'], ['cubeEdge', 'Espacial: aresta do cubo pelo volume'], ['litros', 'Espacial: volume em litros'], ['euler', 'Espacial: poliedros (Euler)']],
  gen: GEO_GEN,
});
