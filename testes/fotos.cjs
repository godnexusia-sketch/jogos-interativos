// Fotos de perfil: foto boa aparece, URL quebrada passa para a próxima, sem foto mostra a inicial (nunca imagem quebrada).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const BASE = process.env.BASE || 'http://localhost:3123';
const ROSE = 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.png';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/?game=votacao'); await p.waitForTimeout(2500);
  await p.evaluate((rose) => {
    handleEvent({ type: 'chat', user: { id: '1', nick: 'Com Foto', pic: rose, pics: [rose] }, text: 'oi' });
    handleEvent({ type: 'chat', user: { id: '2', nick: 'Reserva', pic: 'https://p16-sign-va.tiktokcdn.com/expirada.webp', pics: ['https://p16-sign-va.tiktokcdn.com/expirada.webp', rose] }, text: 'foto expirada' });
    handleEvent({ type: 'chat', user: { id: '3', nick: 'Sem Foto', pic: '', pics: [] }, text: 'sem foto' });
  }, ROSE);
  await p.waitForTimeout(3000);
  const r = await p.evaluate(() => [...document.querySelectorAll('#feed li')].slice(0, 3).map((li) => { const im = li.querySelector('.av img'); return { nick: li.querySelector('b')?.textContent, img: im ? { ok: im.classList.contains('ok'), w: im.naturalWidth } : null, ini: li.querySelector('.av i')?.textContent }; }));
  console.log(JSON.stringify(r));
  // No canvas: a primeira URL falha, a segunda carrega e passa a ser usada
  const reserva = (rose) => Boolean(userImg({ pic: 'https://p16-sign-va.tiktokcdn.com/expirada.webp', pics: ['https://p16-sign-va.tiktokcdn.com/expirada.webp', rose] }));
  await p.evaluate(reserva, ROSE); await p.waitForTimeout(2000);
  const canvasOk = await p.evaluate(reserva, ROSE);
  const pass = r.find((x) => x.nick === 'Com Foto')?.img?.ok && r.find((x) => x.nick === 'Reserva')?.img?.ok && r.find((x) => x.nick === 'Sem Foto')?.img === null && canvasOk;
  console.log(pass ? 'FOTOS OK' : 'FOTOS FALHARAM', 'canvas reserva', canvasOk, 'erros', errs);
  if (process.argv[2]) await p.screenshot({ path: process.argv[2] + '/fotos.png' });
  await b.close(); process.exit(pass && !errs.length ? 0 : 1);
})();
