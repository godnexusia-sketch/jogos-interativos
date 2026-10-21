// Clica em todas as seções do painel, mexe numa configuração e num gatilho, e confere que a tela da live
// (outra página em ?clean=1 com o mesmo @) recebe a troca de jogo, a configuração, o gatilho e o pacote de DJ/alerta.
// Não precisa de live: a sala do @ funciona mesmo com a conta fora do ar.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const base = process.env.BASE || 'http://localhost:3123';
const shots = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const errs = [];
  const watch = (p, tag) => { p.on('pageerror', (e) => errs.push(tag + ': ' + e.message)); p.on('console', (m) => m.type() === 'error' && !/404|Failed to load resource/.test(m.text()) && errs.push(tag + ': ' + m.text())); };
  const panel = await b.newPage({ viewport: { width: 1600, height: 950 } }); watch(panel, 'painel');
  const user = 'teste_' + Date.now().toString(36);
  await panel.goto(base + '/?user=' + user);
  await panel.waitForTimeout(2500);
  const screen = await b.newPage({ viewport: { width: 432, height: 768 } }); watch(screen, 'tela');
  await screen.goto(base + `/?clean=1&user=${user}`);
  await screen.waitForTimeout(2500);
  const views = await panel.evaluate(() => [...document.querySelectorAll('#rail [data-view]')].map((x) => x.dataset.view));
  for (const v of views) {
    await panel.click(`#rail [data-view="${v}"]`);
    await panel.waitForTimeout(400);
    if (shots) await panel.screenshot({ path: `${shots}/view-${v}.png` });
  }
  // Troca de jogo pelo painel
  await panel.click('#rail [data-view="jogos"]');
  await panel.click('.gcard[data-id="trivia-time"]');
  await panel.waitForTimeout(1200);
  // Iniciar deixa o jogo no ar; o destaque abre as configurações
  await panel.click('#heroOpen');
  await panel.waitForTimeout(400);
  const g1 = await screen.evaluate(() => current.id);
  // Configuração ao vivo
  await panel.evaluate(() => document.querySelectorAll('#sets details').forEach((d) => (d.open = true)));
  await panel.selectOption('[data-k="accentColor"]', 'red');
  await panel.waitForTimeout(800);
  const s1 = await screen.evaluate(() => current.s.accentColor);
  // Gatilho novo
  await panel.click('#binds [data-add]');
  await panel.waitForTimeout(800);
  const b1 = await screen.evaluate(() => current.binds.length);
  const b0 = await panel.evaluate(() => current.binds.length);
  // Pacotes: pausa, alerta e DJ
  await panel.evaluate(() => busDo({ t: 'pause', on: true }));
  await panel.waitForTimeout(500);
  const paused1 = await screen.evaluate(() => paused);
  await panel.evaluate(() => busDo({ t: 'pause', on: false }));
  await panel.evaluate(() => busDo({ t: 'alertTest', ev: { type: 'social', action: 'follow', user: fakeUser() } }));
  await panel.waitForTimeout(600);
  const alert1 = await screen.evaluate(() => document.querySelectorAll('#ovl .alert').length);
  // Simulador chega na tela
  await panel.evaluate(() => simChat('b'));
  await panel.waitForTimeout(400);
  const peers = await panel.evaluate(() => peers);
  const here = await panel.evaluate(() => mixer.here);
  console.log(JSON.stringify({ jogoNaTela: g1, configNaTela: s1, gatilhosPainel: b0, gatilhosTela: b1, pausouNaTela: paused1, alertaNaTela: alert1, peers, painelMudo: !here }));
  if (shots) await screen.screenshot({ path: `${shots}/tela-sync.png` });
  const ok = g1 === 'trivia-time' && s1 === 'red' && b1 === b0 && paused1 === true && alert1 > 0 && peers.screens === 1 && !here;
  console.log(errs.length ? 'ERROS: ' + errs.join(' | ') : 'sem erros', ok ? '· SINCRONIZAÇÃO OK' : '· SINCRONIZAÇÃO FALHOU');
  await b.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
