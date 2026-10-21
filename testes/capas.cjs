// Gera a capa de cada jogo a partir do próprio jogo rodando (com espectadores do simulador),
// para a biblioteca mostrar a experiência real. Uso: node testes/capas.cjs [id...]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:3123';
const OUT = __dirname + '/../public/assets/capas/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/?clean=1&game=votacao'); await p.waitForTimeout(2500);
  // Capa limpa: sem os efeitos da live (chafariz de likes, balões) e sem o selo de teste
  await p.evaluate(() => { for (const k of Object.keys(liveCfg.effects)) if (liveCfg.effects[k] && typeof liveCfg.effects[k] === 'object') liveCfg.effects[k].on = false; window.sim = (ev) => handleEvent(ev); });
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : await p.evaluate(() => GAMES.map((g) => g.id));
  for (const id of ids) {
    await p.evaluate((id) => {
      const g = GAMES.find((x) => x.id === id); g.reset(); selectGame(g);
      document.getElementById('guide')?.remove();
      for (let i = 0; i < 6; i++) sim({ type: 'join', user: fakeUser() });
      for (let i = 0; i < 8; i++) simChat(g.sample?.() || 'oi');
      sim({ type: 'like', user: fakeUser(), count: 30 });
      simGift(2); simGift(3);
      for (const a of (g.actions || []).slice(0, 4)) try { busDo({ t: 'action', game: g.id, id: a.id, coins: 30, user: fakeUser() }); } catch {}
    }, id);
    await p.waitForTimeout(id === 'votacao' ? 1500 : 5000);
    const data = await p.evaluate(() => {
      // Sem os alertas e o guia: só a tela do jogo
      const src = document.getElementById('canvas');
      const c = document.createElement('canvas'); c.width = 360; c.height = 640;
      c.getContext('2d').drawImage(src, 0, 0, 360, 640);
      try { return c.toDataURL('image/webp', 0.78); } catch (err) { return 'TAINT'; }
    });
    if (data === 'TAINT') { console.log('\n' + id + ': canvas com imagem de outro domínio (não deu para exportar)'); continue; }
    fs.writeFileSync(OUT + id + '.webp', Buffer.from(data.split(',')[1], 'base64'));
    process.stdout.write(id + ' ');
  }
  console.log('\nerros', errs.slice(0, 5));
  await b.close();
})();
