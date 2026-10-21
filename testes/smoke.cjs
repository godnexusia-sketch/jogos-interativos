// Abre todos os jogos (clássicos e novos), simula uma live (comentários, likes, presentes, ações) e procura erros.
// Uso: PORT=3123 node server.js & node testes/smoke.cjs   (BASE= aponta para outro endereço)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const base = process.env.BASE || 'http://localhost:3123';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && !/404|Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await p.goto(base + '/');
  await p.evaluate(() => three3dReady);
  await p.waitForTimeout(1500);
  if (errs.length) console.log('ERROS AO CARREGAR:', errs.join(' | '));
  const ids = await p.evaluate(() => GAMES.map((g) => g.id));
  let bad = 0;
  for (const id of ids) {
    const before = errs.length;
    await p.evaluate((id) => switchGameById(id), id);
    await p.waitForTimeout(700);
    await p.evaluate((id) => {
      const g = GAMES.find((x) => x.id === id);
      for (let i = 0; i < 300; i++) {
        if (i % 4 === 0) simChat(g.sample?.() || 'oi');
        if (i % 13 === 0) handleEvent({ type: 'like', user: fakeUser(), count: 15 });
        if (i % 29 === 0) handleEvent({ type: 'join', user: fakeUser() });
        if (i % 41 === 0) handleEvent({ type: 'social', user: fakeUser(), action: i % 2 ? 'follow' : 'share' });
        if (i % 50 === 25) simGift(1 + ((i / 50) | 0) % 4);
        if (g.v2 && i % 60 === 10) for (const a of g.actions) testAction(g, a.id, [1, 30, 100, 1500][(i / 60 | 0) % 4]);
        g.update(0.05);
      }
    }, id);
    await p.waitForTimeout(900);
    const fail = errs.length > before;
    if (fail) bad++;
    console.log(id.padEnd(22), fail ? 'ERRO: ' + errs.slice(before).join(' | ') : 'ok');
  }
  console.log(`\n${ids.length} jogos, ${bad} com erro`);
  await b.close();
  process.exit(bad ? 1 : 0);
})();
