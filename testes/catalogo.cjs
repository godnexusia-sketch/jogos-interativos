// Gera public/data/catalogo.json (a vitrine da página de entrada) a partir dos próprios jogos.
// Uso: PORT=3123 node server.js & node testes/catalogo.cjs   — rode de novo quando mudar jogos.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const base = process.env.BASE || 'http://localhost:3123';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  await p.goto(base + '/?clean=1&game=votacao'); await p.waitForTimeout(2500);
  const data = await p.evaluate(() => {
    const strip = (h) => String(h || '').replace(/<\/p>\s*<p>/g, '\n').replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    const SKIP = new Set(['Geral', 'Fundo']);
    return GAMES.map((g) => {
      const gen = GENRES.find((x) => x.id === g.genre) || {};
      const groups = {};
      for (const st of g.settings || []) { if (!st.label || st.type === 'note') continue; const k = st.group || 'Jogo'; if (SKIP.has(k)) continue; (groups[k] ||= []).push(st.label.replace(/\s*\(.*?\)\s*$/, '')); }
      let rows = [];
      try { rows = legendItems(g).map((it) => ({ e: it.emoji || '', what: it.what, coins: it.coins ?? null, eff: `${it.icon ? it.icon + ' ' : ''}${it.eff}`, tone: it.tone })); } catch {}
      return {
        id: g.id, name: g.name, icon: g.icon, color: g.color || '', genre: g.genre, genreName: gen.name || '', genreIcon: gen.icon || '',
        desc: g.desc || '', help: strip(g.help), three: Boolean(g.three), ai: Boolean(g.ai), voice: Boolean(g.voice), chars: Boolean(g.hasChars || (typeof HAS_CHARS !== 'undefined' && HAS_CHARS.includes(g.id))),
        classic: !g.v2, rows, actions: (g.actions || []).filter((a) => !a.hidden).map((a) => `${a.icon || ''} ${a.label}`.trim()), settings: groups,
      };
    });
  });
  const genres = await p.evaluate(() => GENRES.filter((x) => x.id !== 'all'));
  const out = path.join(__dirname, '..', 'public', 'data', 'catalogo.json');
  fs.writeFileSync(out, JSON.stringify({ geradoEm: new Date().toISOString(), genres, games: data }));
  console.log(`${data.length} jogos em ${out}`);
  await b.close();
})();
