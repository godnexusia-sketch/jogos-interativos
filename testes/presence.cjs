const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const S = process.argv[2];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:3123/?game=pipa');
  await p.evaluate(() => three3dReady); await p.waitForTimeout(2000);
  await p.evaluate(() => { for (let i = 0; i < 5; i++) sim({ type: 'join', user: fakeUser() }); });
  const r1 = await p.evaluate(() => { const g = GAMES.find(x => x.id === 'pipa'); return { kites: g.kites.length, cfg: g.config }; });
  console.log('after 5 joins', JSON.stringify(r1));
  const box = await (await p.$('canvas')).boundingBox();
  await p.waitForTimeout(1500); await p.screenshot({ path: S + '/pres_1.png', clip: box });
  // viewers drop to 2
  const r2 = await p.evaluate(() => { const g = GAMES.find(x => x.id === 'pipa'); g.onViewers(2); for (let i = 0; i < 100; i++) g.update(0.05); return g.kites.filter(k => !k.falling && !k.dead).length + '/' + g.kites.length; });
  console.log('after viewers=2 alive/total', r2);
  // idle timeout: set idleMin small
  const r3 = await p.evaluate(() => { const g = GAMES.find(x => x.id === 'pipa'); g.onViewers(99); g.config.idleMin = 0.01; for (let i = 0; i < 200; i++) g.update(0.05); return g.kites.filter(k => !k.falling && !k.dead).length + '/' + g.kites.length; });
  console.log('after idle alive/total', r3);
  await p.screenshot({ path: S + '/pres_2.png', clip: box });
  // settings panel (fica na seção Jogo atual)
  await p.click('#rail [data-view="jogo"]'); await p.waitForTimeout(400);
  const html = await p.evaluate(() => { const el = document.querySelector('#settings') || document.body; return el.innerText.slice(0, 2000); });
  console.log(/Derrubar/.test(html) ? 'settings ok' : 'settings MISSING');
  // vote fallback
  const r4 = await p.evaluate(() => { switchGameById('votacao'); const g = GAMES.find(x => x.id === 'votacao'); g.config.autoSwitch = true; for (let i = 0; i < 20*400; i++) { g.update(0.05); if (current.id !== 'votacao') break; } return current.id; });
  console.log('vote fallback ->', r4);
  console.log('errors', errs);
  await b.close();
})();
