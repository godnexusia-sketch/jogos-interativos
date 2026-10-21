const { chromium } = require('/opt/node-tools/node_modules/playwright');
// Avança a lógica do jogo N segundos (passos de 50 ms) e tira um print. uso: node ff.cjs jogo prefixo seg1 seg2 ... (+gN = presente)
(async () => {
  const [game, prefix, ...steps] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/404/.test(m.text()) && errs.push(m.text()));
  await p.goto(`http://localhost:3123/?game=${game}`);
  await p.evaluate(() => three3dReady);
  await p.waitForTimeout(2500);
  let n = 0;
  for (const st of steps) {
    if (st.startsWith('g')) { await p.click(`[data-gift="${st.slice(1)}"]`); continue; }
    if (st.startsWith('c:')) { await p.fill('#simText', st.slice(2)); await p.click('#simChat'); await p.fill('#simText', ''); continue; }
    await p.evaluate(([id, secs]) => {
      const g = GAMES.find((x) => x.id === id);
      for (let i = 0; i < secs * 20; i++) {
        if (i % 6 === 0) { const r = Math.random(); if (r < 0.75) simChat(g.sample?.() || 'oi'); else handleEvent({ type: 'like', user: fakeUser(), count: 3 }); }
        g.update(0.05); updateParticles(0.05); announcer.update(0.05);
      }
    }, [game, Number(st)]);
    await p.waitForTimeout(1500);
    const box = await (await p.$('canvas')).boundingBox();
    await p.screenshot({ path: `${prefix}_${++n}.png`, clip: box, timeout: 90000 });
  }
  console.log(game, 'errors', errs);
  await b.close();
})();
