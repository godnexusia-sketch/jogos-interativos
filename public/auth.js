'use strict';

// Quem está usando (antes de carregar o resto): admin vê tudo; usuário só os jogos liberados.
// A tela da live (?clean=1, fonte do LIVE Studio/OBS) não tem login.
const ME = (() => {
  if (new URLSearchParams(location.search).get('clean') === '1') return null;
  try {
    const x = new XMLHttpRequest();
    x.open('GET', '/api/me', false); // de propósito síncrono: o painel inteiro depende disso
    x.send();
    if (x.status === 200) return JSON.parse(x.responseText);
  } catch {}
  location.replace('/'); // sem login: o servidor mostra a tela de entrar
  throw new Error('sem login');
})();
const IS_ADMIN = ME?.role === 'admin';
// Configurações guardadas no navegador ficam separadas por usuário (o admin usa as de sempre)
const STORE_PREFIX = ME && !IS_ADMIN ? `u${ME.id}:` : !ME ? `s:${new URLSearchParams(location.search).get('user') || ''}:` : '';
async function logout() { try { await fetch('/api/logout', { method: 'POST' }); } catch {} location.replace('/'); }
