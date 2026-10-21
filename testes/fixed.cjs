const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [w, h] of [[1366, 768], [1920, 1080], [1100, 800]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto('http://localhost:3123/?game=pipa'); await p.waitForTimeout(2500); await p.click('#simAuto');
    const box = async () => JSON.stringify(await p.$eval('canvas', c => { const r = c.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); }));
    const out = [await box()];
    await p.mouse.move(200, 400); for (let i = 0; i < 10; i++) await p.mouse.wheel(0, 400); await p.waitForTimeout(300); out.push(await box());
    await p.mouse.move(w - 150, 400); for (let i = 0; i < 10; i++) await p.mouse.wheel(0, 400); await p.waitForTimeout(300); out.push(await box());
    await p.evaluate(() => setStatus('error', 'Não foi possível conectar: [Empty Payload][fetchWebcastSignatureFromEulerRoute] Failed to sign a request: This endpoint requires a Business plan. Purchase one at https://www.eulerstream.com/pricing.'));
    await p.click('#tabs button:nth-child(3)'); await p.waitForTimeout(500); out.push(await box());
    await p.keyboard.press('PageDown'); await p.keyboard.press('Space'); await p.waitForTimeout(300); out.push(await box());
    const sy = await p.evaluate(() => [window.scrollY, document.querySelector('aside').scrollTop]);
    console.log(w + 'x' + h, out.join(' '), 'pageScrollY/asideScroll', sy);
    await p.screenshot({ path: `${process.argv[2]}/fixed_${w}.png` });
    await p.close();
  }
  await b.close();
})();
