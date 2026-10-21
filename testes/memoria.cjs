// Live longa simulada: muitos lutadores entrando, lutando e saindo. Mede texturas, geometrias e
// memória JS em intervalos para garantir que nada cresce sem parar (vazamento).
// Uso: node testes/memoria.cjs [jogo] [rodadas]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const BASE = process.env.BASE || 'http://localhost:3123';
const game = process.argv[2] || 'stick-fighters', rounds = Number(process.argv[3] || 8);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
  const p = await b.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${BASE}/?clean=1&game=${game}`); await p.waitForTimeout(2500);
  const samples = [];
  for (let r = 0; r < rounds; r++) {
    await p.evaluate((game) => {
      for (let i = 0; i < 12; i++) { const u = { id: 'm' + Math.random(), nick: 'v' + i, pic: '' }; sim({ type: 'join', user: u }); simChat(game === 'battle-arena' ? (i % 2 ? 'a' : 'b') : 'eu', u); }
      simGift(2); simGift(4);
      // Acelera: derruba quem está lutando para girar a fila
      if (current.a) current.a.hp = 0;
    }, game);
    await p.waitForTimeout(4000);
    samples.push(await p.evaluate(() => ({ geo: G3.renderer?.info.memory.geometries, tex: G3.renderer?.info.memory.textures, chars: current.r?.chars?.size, heap: Math.round((performance.memory?.usedJSHeapSize || 0) / 1e6) })));
  }
  console.log(game, JSON.stringify(samples));
  const first = samples[1] || samples[0], last = samples[samples.length - 1];
  const ok = last.tex <= first.tex * 1.6 + 30 && last.geo <= first.geo * 1.6 + 30;
  console.log(ok ? 'MEMÓRIA ESTÁVEL' : 'MEMÓRIA CRESCENDO', 'erros', errs.slice(0, 3));
  await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
