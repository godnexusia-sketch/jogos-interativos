const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const S = process.argv[2];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack||'').split('\n')[1]));
  await p.goto('http://localhost:3123/?game=cobra');
  await p.evaluate(() => three3dReady); await p.waitForTimeout(1500);
  const ids = await p.evaluate(() => GAMES.map(g => g.id));
  for (const id of ids) {
    const r = await p.evaluate((id) => {
      switchGameById(id);
      const g = current, out = [];
      const users = ['ana','bruno','carla','davi'].map(n => ({ id: 'sim_' + n, nick: n, pic: fakeFace(n) }));
      // entrar / escolher lado
      for (const u of users) { simChat(g.sample?.() || 'oi', u); simChat('1', u); simChat('sim', u); simChat('kart', u); simChat('carro', u); simChat('entrar', u); simChat('cobra', u); }
      for (let i = 0; i < 40; i++) g.update(0.05);
      GIFT_SHOP.forEach(([, n, c], i) => { simGift([n, c], users[i % 4], i === 0 ? 10 : 1); for (let k = 0; k < 10; k++) g.update(0.05); });
      for (const u of users) { handleEvent({ type: 'social', user: u, action: 'follow' }); handleEvent({ type: 'social', user: u, action: 'share' }); handleEvent({ type: 'like', user: u, count: 40 }); }
      for (let i = 0; i < 100; i++) { g.update(0.05); giftMeter.update(0.05); }
      return 'ok';
    }, id);
    await p.waitForTimeout(400);
    console.log(id.padEnd(10), r);
  }
  console.log('errors', errs);
  await b.close();
})();
