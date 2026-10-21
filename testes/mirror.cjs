const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const S = process.argv[2];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push('admin: ' + e.message));
  await p.goto('http://localhost:3123/?game=cobra'); await p.waitForTimeout(2000);
  await p.click('#rail [data-view="tela"]'); await p.waitForTimeout(300); await p.click('label:has(#mirrorLight)');
  const [pop] = await Promise.all([ctx.waitForEvent('page'), p.click('#mirrorBtn')]);
  pop.on('pageerror', e => errs.push('popup: ' + e.message));
  await pop.waitForLoadState(); await pop.evaluate(() => three3dReady); await pop.waitForTimeout(2500);
  console.log('btn', await p.textContent('#mirrorBtn'), '| popup title', await pop.title(), '| canvas', await pop.$eval('canvas', c => c.width + 'x' + c.height));
  // eventos do simulador do painel vão para a janela
  await p.evaluate(() => { for (let i = 0; i < 4; i++) sim({ type: 'join', user: fakeUser() }); });
  await p.evaluate(() => { for (let i = 0; i < 3; i++) simChat('cobra'); });
  await p.evaluate(() => simGift(['Mãos em coração', 100]));
  await p.waitForTimeout(800);
  console.log('popup cobras', await pop.evaluate(() => current.id + ' ' + current.snakes.filter(s => !s.bot).length), '| admin cobras', await p.evaluate(() => current.snakes.filter(s => !s.bot).length));
  // troca de jogo pelo painel
  await p.evaluate(() => selectGame(GAMES.find((g) => g.id === 'pipa'))); await p.waitForTimeout(500);
  await p.evaluate(() => { for (let i = 0; i < 3; i++) sim({ type: 'join', user: fakeUser() }); }); await p.waitForTimeout(500);
  console.log('popup game', await pop.evaluate(() => current.id + ' kites ' + current.kites.length));
  // votação termina na janela -> painel acompanha
  await p.evaluate(() => selectGame(GAMES.find((g) => g.id === 'votacao'))); await p.waitForTimeout(500);
  await pop.evaluate(() => { const g = current; for (let i = 0; i < 20 * 400 && current === g; i++) g.update(0.05); });
  await p.waitForTimeout(800);
  console.log('after vote popup', await pop.evaluate(() => current.id), 'admin', await p.evaluate(() => current.id));
  await p.screenshot({ path: S + '/mir_admin.png' });
  await pop.screenshot({ path: S + '/mir_pop.png' });
  await pop.close(); await p.waitForTimeout(1500);
  console.log('after close btn', await p.textContent('#mirrorBtn'), 'mirrorOn', await p.evaluate(() => mirrorOn()));
  console.log('errors', errs);
  await b.close();
})();
