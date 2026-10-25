// Grava vídeos curtos (9:16) dos jogos rodando com público simulado, para a página de entrada.
// Relógio falso do Playwright: cada quadro avança 1/24 s, então o vídeo fica liso mesmo em PC lento.
// Uso: PORT=3123 node server.js & node testes/videos.cjs [id...]   (precisa do ffmpeg)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const BASE = process.env.BASE || 'http://localhost:3123';
const OUT = path.join(__dirname, '..', 'public', 'assets', 'videos');
const FPS = 24, SECS = Number(process.env.SECS || 7);
const IDS = process.argv.slice(2).length ? process.argv.slice(2) : ['battle-arena', 'horse-race', 'million-quiz', 'only-climb', 'tower-war', 'messi-vs-ronaldo', 'guess-the-flag', 'mma-clash', 'territory-war', 'dance-floor', 'math-geometry', 'car-race'];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const id of IDS) {
    const p = await b.newPage({ viewport: { width: 540, height: 960 } });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.clock.install();
    await p.goto(`${BASE}/?clean=1&game=${id}`);
    await p.clock.runFor(4000); await p.waitForTimeout(1500); await p.clock.runFor(1500);
    await p.evaluate((id) => {
      for (const k of Object.keys(liveCfg.effects)) if (liveCfg.effects[k] && typeof liveCfg.effects[k] === 'object' && k !== 'likes') liveCfg.effects[k].on = false;
      const g = GAMES.find((x) => x.id === id); if (current !== g) { g.reset(); selectGame(g); }
      document.getElementById('guide')?.remove();
      window.__g = g;
      for (let i = 0; i < 8; i++) handleEvent({ type: 'join', user: fakeUser() });
      for (let i = 0; i < 10; i++) simChat(g.sample?.() || 'oi');
    }, id);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vid-'));
    const n = FPS * SECS, PRE = FPS * 3; // 3 s de aquecimento (o jogo já começa cheio)
    for (let f = -PRE; f < n; f++) {
      await p.evaluate((f) => {
        f += 1000; const g = window.__g;
        if (f % 5 === 0) simChat(g.sample?.() || 'oi');
        if (f % 18 === 3) handleEvent({ type: 'like', user: fakeUser(), count: 20 });
        if (f % 40 === 9) simGift(1 + ((f / 40) | 0) % 4);
        if (f % 55 === 20) handleEvent({ type: 'social', user: fakeUser(), action: 'follow' });
        if (g.v2 && f % 70 === 30 && g.actions?.length) { const a = g.actions[((f / 70) | 0) % g.actions.length]; try { testAction(g, a.id, 30); } catch {} }
        try { lastSimAt = -1e9; } catch {}
      }, f);
      await p.clock.runFor(Math.round(1000 / FPS));
      if (f < 0) continue;
      const data = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 432; c.height = 768; c.getContext('2d').drawImage(document.getElementById('canvas'), 0, 0, 432, 768); return c.toDataURL('image/jpeg', 0.86); });
      fs.writeFileSync(path.join(dir, String(f).padStart(4, '0') + '.jpg'), Buffer.from(data.split(',')[1], 'base64'));
    }
    const src = path.join(dir, '%04d.jpg');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', src, '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-crf', '30', '-preset', 'slow', '-movflags', '+faststart', '-an', path.join(OUT, id + '.mp4')]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(OUT, id + '.mp4'), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '44', '-row-mt', '1', '-an', path.join(OUT, id + '.webm')]); // reserva para navegador sem H.264
    fs.copyFileSync(path.join(dir, '0012.jpg'), path.join(OUT, id + '.jpg'));
    fs.rmSync(dir, { recursive: true, force: true });
    const kb = (f) => Math.round(fs.statSync(path.join(OUT, f)).size / 1024);
    console.log(id.padEnd(18), `mp4 ${kb(id + '.mp4')}KB`, errs.length ? 'ERROS: ' + errs.slice(0, 2).join(' | ') : '');
    await p.close();
  }
  await b.close();
})();
