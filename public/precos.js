// Tabela de preços dos planos. O mesmo arquivo é usado pelo site (simulador) e pelo servidor (cobrança),
// então o valor mostrado é sempre o valor cobrado. Valores em centavos.
export const AVULSO = 990; // um jogo avulso por mês
export const PACOTES = [ // n jogos por mês
  { n: 3, v: 1990 },
  { n: 5, v: 2990 },
  { n: 10, v: 4990 },
  { n: 20, v: 6990 },
];
export const TODOS = 9990; // pacote completo, todos os jogos
export const DESCONTO_ANUAL = 0.5; // anual: metade do preço
export const TESTE_DIAS = 30; // teste grátis da assinatura mensal

export const reais = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Melhor preço para n jogos (total = quantos jogos existem).
// Combina pacotes e avulsos pelo menor valor; se um pacote maior sair mais barato,
// cobra ele e avisa que dá para escolher mais jogos sem pagar nada a mais.
export function preco(n, total) {
  n = Math.max(0, Math.min(n | 0, total));
  if (!n) return { n: 0, mensal: 0, anual: 0, anualMes: 0, partes: [], cabe: 0, todos: false, avulso: 0 };
  // custo exato para m jogos (pacotes + avulsos), m = 0..total
  const custo = [0], como = [[]];
  for (let m = 1; m <= total; m++) {
    let best = custo[m - 1] + AVULSO, bc = [...como[m - 1], { tipo: 'avulso', n: 1, v: AVULSO }];
    for (const p of PACOTES) if (p.n <= m && custo[m - p.n] + p.v < best) { best = custo[m - p.n] + p.v; bc = [...como[m - p.n], { tipo: 'pacote', n: p.n, v: p.v }]; }
    custo.push(best); como.push(bc);
  }
  let mensal = Infinity, cabe = n, partes = [];
  for (let m = n; m <= total; m++) if (custo[m] < mensal) { mensal = custo[m]; cabe = m; partes = como[m]; }
  let todos = false;
  if (TODOS <= mensal || n >= total) { mensal = TODOS; cabe = total; partes = [{ tipo: 'todos', n: total, v: TODOS }]; todos = true; }
  // junta os avulsos numa linha só ("2 avulsos")
  const junto = [];
  for (const p of partes) {
    const ult = junto[junto.length - 1];
    if (p.tipo === 'avulso' && ult?.tipo === 'avulso') { ult.n++; ult.v += p.v; } else junto.push({ ...p });
  }
  const anual = Math.round(mensal * 12 * (1 - DESCONTO_ANUAL));
  return { n, mensal, anual, anualMes: Math.round(anual / 12), partes: junto, cabe, todos, avulso: n * AVULSO };
}
