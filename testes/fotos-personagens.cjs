// Gera a miniatura de cada personagem 3D (assets/chars/fotos/<id>.webp) para o painel 🧍 Personagens.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:3123';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 540, height: 960 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(BASE + '/?clean=1&game=votacao'); await p.waitForTimeout(1500);
  const kinds = await p.evaluate(() => Object.keys(CHARACTERS).filter((k) => !CHARACTERS[k].undead));
  for (const k of kinds) {
    await p.evaluate(async (k) => {
      await three3dReady;
      const T = THREE, scene = new T.Scene(); scene.background = new T.Color('#141a36');
      G3.lights(scene, { hemi: 1.15, sun: 2.4, pos: [3, 6, 8] });
      const rim = new T.DirectionalLight(0x9ef0ff, 1.2); rim.position.set(-4, 3, -4); scene.add(rim);
      const c = new Character3D({ kind: k, height: 2, plate: false, base: 'idle' }); c.root.rotation.y = 0.35; scene.add(c.root);
      const cam = new T.PerspectiveCamera(30, W / H, 0.1, 100); cam.position.set(0, 1.0, 8.6); cam.lookAt(0, 1.0, 0);
      window.__c = c; current.draw = () => { c.update(1 / 60); G3.render(scene, cam); };
    }, k);
    await p.waitForFunction(() => window.__c.ready, null, { timeout: 30000 });
    await p.waitForTimeout(1200);
    const data = await p.evaluate(() => { const src = document.getElementById('canvas'), s = src.width; const c = document.createElement('canvas'); c.width = c.height = 320; c.getContext('2d').drawImage(src, 0, (src.height - s) / 2, s, s, 0, 0, 320, 320); return c.toDataURL('image/webp', 0.85); });
    fs.writeFileSync(`${__dirname}/../public/assets/chars/fotos/${k}.webp`, Buffer.from(data.split(',')[1], 'base64'));
    await p.evaluate(() => window.__c.dispose());
    process.stdout.write(k + ' ');
  }
  console.log();
  await b.close();
})();
