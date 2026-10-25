// Contas de acesso: admin (tudo) e usuários (só os jogos liberados). Guarda no Postgres (DATABASE_URL:
// Supabase ou Render); sem banco, usa um arquivo temporário (some quando o servidor reinicia).
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATABASE_URL pode ter mais de um endereço separado por espaço (tenta um por um até conectar)
const DB_URLS = String(process.env.DATABASE_URL || '').split(/\s+/).filter(Boolean);
const S = /^[a-z_]+$/.test(process.env.DB_SCHEMA || '') ? process.env.DB_SCHEMA : 'public'; // esquema das tabelas
let pool = null;
const FILE = path.join(os.tmpdir(), 'jogos-contas.json');
let mem = { seq: 0, users: [], sessions: {}, config: {} };
const cfg = {}; // cópia em memória dos ajustes

export const temBanco = () => Boolean(pool);

export async function iniciar() {
  for (const url of DB_URLS) {
    const { default: pg } = await import('pg');
    let host = ''; try { host = new URL(url).hostname; } catch {}
    const ssl = !host.includes('.') || host === '127.0.0.1' ? false : { rejectUnauthorized: false }; // "dpg-…-a" (interno do Render) e localhost sem SSL
    const p = new pg.Pool({ connectionString: url, ssl, max: 4, idleTimeoutMillis: 30000, connectionTimeoutMillis: 8000 });
    p.on('error', (e) => console.error('banco:', e.message));
    try { await p.query('select 1'); } catch (e) { console.warn(`contas: não conectou em ${host} —`, e.message); await p.end().catch(() => {}); continue; }
    pool = p;
    if (S !== 'public') await pool.query(`create schema if not exists ${S}`).catch(() => {});
    await pool.query(`create table if not exists ${S}.contas (
      id serial primary key, username text unique not null, pass text not null, role text not null default 'user',
      games jsonb not null default '[]', ai jsonb not null default '{}', disabled boolean not null default false, created_at timestamptz not null default now())`);
    await pool.query(`create table if not exists ${S}.sessoes (token text primary key, conta_id int not null references ${S}.contas(id) on delete cascade, expira timestamptz not null)`);
    await pool.query(`alter table ${S}.contas add column if not exists perms jsonb not null default '[]'`);
    await pool.query(`alter table ${S}.contas add column if not exists status text not null default 'ok'`); // 'pendente' = pedido de cadastro
    await pool.query(`alter table ${S}.contas add column if not exists info jsonb not null default '{}'`); // nome, @tiktok e recado do pedido
    await pool.query(`alter table ${S}.contas add column if not exists plano jsonb not null default '{}'`); // assinatura paga (Asaas)
    await pool.query(`create table if not exists ${S}.config (chave text primary key, valor jsonb not null)`); // ajustes do admin (ex.: bônus de cada pacote)
    for (const r of (await pool.query(`select chave, valor from ${S}.config`)).rows) cfg[r.chave] = r.valor;
    await pool.query(`delete from ${S}.sessoes where expira < now()`);
    console.log(`contas: banco Postgres ligado (${host})`);
    break;
  }
  if (pool) return;
  {
    try { mem = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
    Object.assign(cfg, mem.config || {});
    console.warn('contas: sem DATABASE_URL — usando arquivo temporário (as contas somem quando o servidor reinicia)');
  }
}
const salvarArquivo = () => { try { fs.writeFileSync(FILE, JSON.stringify(mem)); } catch {} };

// ---------- Senhas ----------
export function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(String(senha), salt, 32).toString('hex')}`;
}
export function confereSenha(senha, guardada) {
  const [, salt, hash] = String(guardada || '').split('$');
  if (!salt || !hash) return false;
  const a = crypto.scryptSync(String(senha), salt, 32), b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- Contas ----------
const limpa = (u) => u && { id: u.id, username: u.username, role: u.role, games: u.games || [], perms: u.perms || [], ai: u.ai || {}, disabled: Boolean(u.disabled), status: u.status || 'ok', info: u.info || {}, plano: u.plano || {}, created_at: u.created_at };
export async function quantas() { if (pool) return Number((await pool.query(`select count(*) from ${S}.contas`)).rows[0].count); return mem.users.length; }
export async function porNome(username) {
  if (pool) return (await pool.query(`select * from ${S}.contas where lower(username) = lower($1)`, [username])).rows[0] || null;
  return mem.users.find((u) => u.username.toLowerCase() === String(username).toLowerCase()) || null;
}
export async function porId(id) {
  if (pool) return (await pool.query(`select * from ${S}.contas where id = $1`, [id])).rows[0] || null;
  return mem.users.find((u) => u.id === Number(id)) || null;
}
export async function listar() {
  if (pool) return (await pool.query(`select * from ${S}.contas order by id`)).rows.map(limpa);
  return mem.users.map(limpa);
}
export async function criar({ username, senha, role = 'user', games = [], perms = [], status = 'ok', info = {}, plano = {} }) {
  const pass = hashSenha(senha);
  if (pool) return limpa((await pool.query(`insert into ${S}.contas (username, pass, role, games, perms, status, info, plano) values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`, [username, pass, role, JSON.stringify(games), JSON.stringify(perms), status, JSON.stringify(info), JSON.stringify(plano)])).rows[0]);
  const u = { id: ++mem.seq, username, pass, role, games, perms, status, info, plano, ai: {}, disabled: false, created_at: new Date().toISOString() };
  mem.users.push(u); salvarArquivo(); return limpa(u);
}
export async function alterar(id, { senha, role, games, perms, ai, disabled, status, plano }) {
  const u = await porId(id); if (!u) return null;
  const novo = { pass: senha ? hashSenha(senha) : u.pass, role: role || u.role, games: games ?? u.games, perms: perms ?? u.perms ?? [], ai: ai ?? u.ai, disabled: disabled ?? u.disabled, status: status || u.status || 'ok', plano: plano ?? u.plano ?? {} };
  if (pool) return limpa((await pool.query(`update ${S}.contas set pass = $2, role = $3, games = $4, ai = $5, disabled = $6, perms = $7, status = $8, plano = $9 where id = $1 returning *`, [id, novo.pass, novo.role, JSON.stringify(novo.games), JSON.stringify(novo.ai), novo.disabled, JSON.stringify(novo.perms), novo.status, JSON.stringify(novo.plano)])).rows[0]);
  Object.assign(u, novo); salvarArquivo(); return limpa(u);
}
export async function apagar(id) {
  if (pool) { await pool.query(`delete from ${S}.contas where id = $1`, [id]); return; }
  mem.users = mem.users.filter((u) => u.id !== Number(id));
  for (const [t, s] of Object.entries(mem.sessions)) if (s.id === Number(id)) delete mem.sessions[t];
  salvarArquivo();
}

// ---------- Sessões (cookie "sess", 30 dias) ----------
const cache = new Map(); // token -> { conta, ate }
export async function novaSessao(id) {
  const token = crypto.randomBytes(32).toString('base64url'), expira = new Date(Date.now() + 30 * 86400e3);
  if (pool) await pool.query(`insert into ${S}.sessoes (token, conta_id, expira) values ($1, $2, $3)`, [token, id, expira]);
  else { mem.sessions[token] = { id, expira: expira.getTime() }; salvarArquivo(); }
  return { token, expira };
}
export async function contaDaSessao(token) {
  if (!token || token.length > 100) return null;
  const c = cache.get(token);
  if (c && c.ate > Date.now()) return c.conta;
  let conta = null;
  if (pool) conta = (await pool.query(`select c.* from ${S}.sessoes s join ${S}.contas c on c.id = s.conta_id where s.token = $1 and s.expira > now()`, [token])).rows[0] || null;
  else { const s = mem.sessions[token]; if (s && s.expira > Date.now()) conta = mem.users.find((u) => u.id === s.id) || null; }
  if (conta?.disabled || conta?.status === 'pendente') conta = null;
  cache.set(token, { conta, ate: Date.now() + 30000 });
  if (cache.size > 2000) cache.delete(cache.keys().next().value);
  return conta;
}
export async function fimSessao(token) {
  cache.delete(token);
  if (pool) await pool.query(`delete from ${S}.sessoes where token = $1`, [token]);
  else { delete mem.sessions[token]; salvarArquivo(); }
}
export function esqueceCache(id) { for (const [t, c] of cache) if (!id || c.conta?.id === id) cache.delete(t); }

// ---------- Ajustes do admin ----------
export const lerConfig = (chave) => cfg[chave];
export async function salvarConfig(chave, valor) {
  cfg[chave] = valor;
  if (pool) await pool.query(`insert into ${S}.config (chave, valor) values ($1, $2) on conflict (chave) do update set valor = excluded.valor`, [chave, JSON.stringify(valor)]);
  else { mem.config = { ...(mem.config || {}), [chave]: valor }; salvarArquivo(); }
}
