// Pagamentos pelo Asaas (assinatura mensal e plano anual). A chave fica só no servidor (ASAAS_API_KEY no Render).
// Chave de teste ($aact_hmlg_…) usa o sandbox; chave de produção ($aact_prod_…) cobra de verdade.
const KEY = String(process.env.ASAAS_API_KEY || '').trim();
const BASE = process.env.ASAAS_URL || (KEY.startsWith('$aact_hmlg_') ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3');

export const ligado = () => Boolean(KEY);
export const sandbox = () => BASE.includes('sandbox');

async function api(method, caminho, body) {
  const r = await fetch(BASE + caminho, {
    method,
    headers: { 'content-type': 'application/json', access_token: KEY, 'user-agent': 'jogos-interativos' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.errors?.[0]?.description || `Asaas respondeu ${r.status}`);
  return j;
}

// Cliente: reaproveita pelo CPF/CNPJ (o Asaas não deixa dois iguais sem necessidade)
export async function cliente({ nome, cpf, email, celular, ref }) {
  const achou = await api('GET', `/customers?cpfCnpj=${encodeURIComponent(cpf)}&limit=1`);
  if (achou?.data?.[0]) return achou.data[0];
  return api('POST', '/customers', { name: nome, cpfCnpj: cpf, email, mobilePhone: celular || undefined, externalReference: ref, notificationDisabled: false });
}

// Assinatura mensal: a primeira cobrança vence em `vence` (depois do teste grátis, quando tem)
export async function assinatura({ cliente, valor, vence, forma, descricao, ref }) {
  const s = await api('POST', '/subscriptions', { customer: cliente, billingType: forma, value: valor / 100, nextDueDate: vence, cycle: 'MONTHLY', description: descricao, externalReference: ref });
  const pags = await api('GET', `/subscriptions/${s.id}/payments?limit=1`).catch(() => ({ data: [] }));
  return { id: s.id, fatura: pags?.data?.[0]?.invoiceUrl || '' };
}

// Plano anual: uma cobrança (no cartão dá para parcelar)
export async function cobranca({ cliente, valor, vence, forma, parcelas, descricao, ref }) {
  const corpo = { customer: cliente, billingType: forma, dueDate: vence, description: descricao, externalReference: ref };
  if (forma === 'CREDIT_CARD' && parcelas > 1) Object.assign(corpo, { installmentCount: parcelas, totalValue: valor / 100 });
  else corpo.value = valor / 100;
  const p = await api('POST', '/payments', corpo);
  return { id: p.id, fatura: p.invoiceUrl || '', parcelamento: p.installment || '' };
}

export const cancelarAssinatura = (id) => api('DELETE', `/subscriptions/${id}`);

// CPF ou CNPJ com dígitos verificadores certos
export function docValido(d) {
  d = String(d || '').replace(/\D/g, '');
  const rep = /^(\d)\1+$/.test(d);
  if (d.length === 11 && !rep) {
    const dv = (k) => { let s = 0; for (let i = 0; i < k; i++) s += Number(d[i]) * (k + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
  }
  if (d.length === 14 && !rep) {
    const dv = (k) => { const w = k === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < k; i++) s += Number(d[i]) * w[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
    return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
  }
  return false;
}
