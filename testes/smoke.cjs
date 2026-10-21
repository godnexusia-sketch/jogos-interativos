const { chromium } = require('/opt/node-tools/node_modules/playwright');
const base = process.env.BASE || 'http://localhost:3123';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/404|Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await p.goto(base + '/');
  await p.evaluate(() => three3dReady);
  const ids = await p.evaluate(() => GAMES.map((g) => g.id));
  for (const id of ids) {
    const before = errs.length;
    await p.evaluate((id) => switchGameById(id), id);
    await p.waitForTimeout(1200);
    // Simula uma live: comentários, likes e presentes das 4 faixas, avançando a lógica
    await p.evaluate((id) => {
      const g = GAMES.find((x) => x.id === id);
      for (let i = 0; i < 400; i++) {
        if (i % 5 === 0) simChat(g.sample?.() || 'oi');
        if (i % 17 === 0) handleEvent({ type: 'like', user: fakeUser(), count: 5 });
        if (i % 60 === 30) simGift(1 + ((i / 60) | 0) % 4);
        g.update(0.05);
      }
    }, id);
    await p.waitForTimeout(1500);
    console.log(id.padEnd(9), errs.length > before ? 'ERRO: ' + errs.slice(before).join(' | ') : 'ok');
  }
  await b.close();
})();
