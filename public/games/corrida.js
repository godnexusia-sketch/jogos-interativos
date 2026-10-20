'use strict';

// Corrida na Cidade: racha noturno em 3D, com prédios iluminados, neon e carros com a foto de quem comentou.
const CITY = {
  id: 'corrida',
  name: 'Corrida na Cidade',
  icon: '🏁',
  title: 'CORRIDA NA CIDADE',
  cta: 'COMENTE CARRO',
  accent: '#ff2e63',
  joinWord: 'carro',
  joinRe: /\b(carro|moto|!entrar|entrar|corrida)\b/,
  help: '<p>Comente <b>carro</b> para entrar no racha (até 12). Com 2 pilotos a largada começa. São 2 voltas pela cidade.</p><p>💬 Comentário e ❤️ like dão um empurrão.</p><p>🌹 Nitro · 🍩 Nitro + pedra na pista · 🕶️ Míssil teleguiado em quem está na frente · 🌌 Raio: encolhe todo mundo e mega nitro para você.</p><p>Quem não está correndo e manda presente ataca o líder.</p>',
  laps: 2,
  speed: 34,
  trackW: 18,
  trackScale: 1.8,
  curbW: 5,
  tagY: 2.8,
  asphalt: '#26282e',
  track: [[0, 0], [90, 0], [160, 6], [196, 40], [200, 110], [176, 150], [120, 160], [96, 196], [100, 250], [60, 286], [-20, 290], [-90, 270], [-130, 220], [-140, 140], [-150, 70], [-110, 16], [-60, 0]],
  colors: ['#ef4444', '#111827', '#f8fafc', '#2563eb', '#facc15', '#10b981', '#f97316', '#a3e635', '#06b6d4', '#ec4899', '#64748b', '#7c3aed'],
  env(T, scene, self) {
    scene.background = G3.skyTex('#05070f', '#111a38', '#3a2445');
    scene.fog = new T.Fog(0x161a33, 70, 340);
    scene.add(new T.HemisphereLight(0x8fa0d8, 0x1a1420, 1.1));
    const sun = new T.DirectionalLight(0xc8d4ff, 1.6);
    sun.position.set(-40, 80, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 220 });
    scene.add(sun, sun.target);
    const concrete = self.canvasTex(256, 256, (g) => { g.fillStyle = '#1c1e24'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } });
    concrete.wrapS = concrete.wrapT = T.RepeatWrapping; concrete.repeat.set(160, 160);
    const ground = new T.Mesh(new T.PlaneGeometry(3000, 3000), new T.MeshStandardMaterial({ map: concrete, roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    scene.add(ground);
    return { sun };
  },
  // Calçada com meio-fio amarelo
  curb(T, self) { return self.canvasTex(64, 64, (g) => { g.fillStyle = '#5b5f69'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#4b4f58'; for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 2); g.fillStyle = '#facc15'; g.fillRect(0, 0, 6, 64); g.fillRect(58, 0, 6, 64); }); },
  decor(T, scene, { pts, tan, nor, N }, self) {
    const W2 = CITY.trackW / 2;
    // Janelas acesas (textura que brilha à noite)
    const windowTex = (seed) => self.canvasTex(128, 256, (g) => {
      g.fillStyle = '#0d1018'; g.fillRect(0, 0, 128, 256);
      for (let y = 8; y < 256; y += 16) for (let x = 6; x < 128; x += 14) {
        const r = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453 % 1;
        if (Math.abs(r) < 0.45) { g.fillStyle = Math.abs(r) < 0.1 ? '#9fd8ff' : Math.abs(r) < 0.3 ? '#ffd27a' : '#ffb35c'; g.fillRect(x, y, 8, 10); }
      }
    });
    const winTex = [windowTex(1), windowTex(7), windowTex(13)];
    const near = (x, z, d) => { for (let i = 0; i < N; i += 6) { const dx = pts[i].x - x, dz = pts[i].z - z; if (dx * dx + dz * dz < d * d) return true; } return false; };
    const placed = [];
    for (let i = 0; i < N; i += 14) for (const side of [1, -1]) {
      const w = rand(14, 26), d = rand(14, 24), h = rand(18, 70);
      const off = W2 + CITY.curbW + 3 + d / 2 + rand(0, 6);
      const p = pts[i].clone().addScaledVector(nor[i], side * off);
      if (near(p.x, p.z, W2 + CITY.curbW + Math.max(w, d) / 2 + 1) || placed.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 18)) continue;
      placed.push(p);
      const tex = winTex[placed.length % 3].clone(); tex.needsUpdate = true; tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(Math.round(w / 8), Math.round(h / 16));
      const m = new T.MeshStandardMaterial({ color: 0x2a2f3a, map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.8 });
      const roof = new T.MeshStandardMaterial({ color: 0x15171d });
      const b = new T.Mesh(new T.BoxGeometry(w, h, d), [m, m, roof, roof, m, m]);
      b.position.set(p.x, h / 2, p.z); b.rotation.y = Math.atan2(tan[i].x, tan[i].z);
      b.castShadow = h < 40; b.receiveShadow = true;
      scene.add(b);
      // Letreiro de neon em alguns prédios
      if (placed.length % 4 === 0) {
        const words = ['TURBO', 'AO VIVO', 'NITRO', '24H', 'RACHA', 'NEON'];
        const col = ['#ff2e63', '#00e5ff', '#facc15', '#a3e635'][placed.length % 4];
        const sign = self.canvasTex(256, 96, (g) => { g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, 256, 96); g.shadowColor = col; g.shadowBlur = 18; g.fillStyle = col; g.font = 'italic 900 64px "Barlow Condensed", Impact'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(pick(words), 128, 50); });
        const sm = new T.Mesh(new T.PlaneGeometry(w * 0.8, w * 0.3), new T.MeshBasicMaterial({ map: sign, transparent: true }));
        const facing = -side;
        sm.position.copy(b.position).addScaledVector(nor[i], facing * (d / 2 + 0.2)); sm.position.y = Math.min(h - 4, 12);
        sm.rotation.y = Math.atan2(nor[i].x * facing, nor[i].z * facing);
        scene.add(sm);
      }
    }
    // Postes com poça de luz no chão
    const pool = self.canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,214,140,.55)'); gr.addColorStop(1, 'rgba(255,214,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
    const poleMat = new T.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.6, roughness: 0.4 });
    const bulbMat = new T.MeshBasicMaterial({ color: 0xffe2a8 });
    for (let i = 0; i < N; i += 40) for (const side of [1, -1]) {
      const p = pts[i].clone().addScaledVector(nor[i], side * (W2 + 1.6));
      const pole = new T.Mesh(new T.CylinderGeometry(0.15, 0.2, 9, 8), poleMat); pole.position.set(p.x, 4.5, p.z); scene.add(pole);
      const head = new T.Mesh(new T.BoxGeometry(1.4, 0.3, 0.6), bulbMat); head.position.set(p.x, 9, p.z).addScaledVector(nor[i], -side * 0.7); scene.add(head);
      const light = new T.Mesh(new T.PlaneGeometry(14, 14), new T.MeshBasicMaterial({ map: pool, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      light.rotation.x = -Math.PI / 2; light.position.set(p.x, 0.08, p.z).addScaledVector(nor[i], -side * 4); scene.add(light);
    }
    // Pórtico de largada iluminado
    const arch = new T.Group();
    const pillarMat = new T.MeshStandardMaterial({ color: 0x111318, metalness: 0.5, roughness: 0.4 });
    for (const side of [1, -1]) { const p = new T.Mesh(new T.BoxGeometry(1, 15, 1), pillarMat); p.position.set(side * (W2 + 2), 7.5, 0); arch.add(p); }
    const banner = self.canvasTex(512, 96, (g) => { g.fillStyle = '#0b0d14'; g.fillRect(0, 0, 512, 96); g.shadowColor = '#ff2e63'; g.shadowBlur = 20; g.fillStyle = '#ff2e63'; g.font = 'italic 900 72px "Barlow Condensed", Impact'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LARGADA', 256, 52); });
    const top = new T.Mesh(new T.BoxGeometry(CITY.trackW + 5, 2.4, 0.6), [pillarMat, pillarMat, pillarMat, pillarMat, new T.MeshBasicMaterial({ map: banner }), new T.MeshBasicMaterial({ map: banner })]);
    top.position.y = 15; arch.add(top);
    arch.position.copy(pts[0]); arch.rotation.y = Math.atan2(tan[0].x, tan[0].z);
    scene.add(arch);
    return [];
  },
  vehicle(T, k) {
    const g = new T.Group();
    const type = ['sedan', 'esportivo', 'suv'][Math.abs([...k.id].reduce((a, c) => a + c.charCodeAt(0), 0)) % 3];
    const paint = new T.MeshPhysicalMaterial({ color: k.color, metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
    const glass = new T.MeshStandardMaterial({ color: 0x0b1220, metalness: 0.9, roughness: 0.08 });
    const black = new T.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.85 });
    const chrome = new T.MeshStandardMaterial({ color: 0xc9ced6, metalness: 1, roughness: 0.25 });
    const add = (geo, mat, x, y, z, rx = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; g.add(m); return m; };
    const dims = { sedan: [2.2, 0.62, 4.6, 0.62, 2.3], esportivo: [2.3, 0.5, 4.7, 0.46, 1.8], suv: [2.3, 0.85, 4.5, 0.75, 2.6] }[type];
    const [bw, bh, bl, ch, cl] = dims;
    const y0 = type === 'suv' ? 0.75 : 0.55;
    add(new T.BoxGeometry(bw, bh, bl), paint, 0, y0 + bh / 2, 0);
    add(new T.BoxGeometry(bw * 0.98, bh * 0.4, bl * 0.25), paint, 0, y0 + bh * 0.8, bl * 0.36);
    // Cabine com vidros
    const cab = add(new T.BoxGeometry(bw * 0.86, ch, cl), glass, 0, y0 + bh + ch / 2, type === 'esportivo' ? -0.3 : -0.2);
    const roofM = add(new T.BoxGeometry(bw * 0.82, 0.08, cl * 0.75), paint, 0, y0 + bh + ch + 0.02, -0.25);
    // Para-choques, faróis e lanternas
    add(new T.BoxGeometry(bw + 0.05, 0.25, 0.3), black, 0, y0 + 0.12, bl / 2);
    add(new T.BoxGeometry(bw + 0.05, 0.25, 0.3), black, 0, y0 + 0.12, -bl / 2);
    const headM = new T.MeshBasicMaterial({ color: 0xf5f9ff });
    const tailM = new T.MeshBasicMaterial({ color: 0xff1f3d });
    for (const s of [-1, 1]) {
      add(new T.BoxGeometry(0.5, 0.16, 0.06), headM, s * (bw / 2 - 0.35), y0 + bh * 0.7, bl / 2 + 0.01);
      add(new T.BoxGeometry(0.55, 0.14, 0.06), tailM, s * (bw / 2 - 0.35), y0 + bh * 0.72, -bl / 2 - 0.01);
    }
    if (type === 'esportivo') { add(new T.BoxGeometry(bw, 0.08, 0.5), black, 0, y0 + bh + 0.55, -bl / 2 + 0.3); for (const s of [-0.7, 0.7]) add(new T.BoxGeometry(0.08, 0.5, 0.08), black, s, y0 + bh + 0.3, -bl / 2 + 0.3); }
    // Facho dos faróis
    const beam = new T.Mesh(new T.ConeGeometry(2.2, 12, 20, 1, true), new T.MeshBasicMaterial({ color: 0xfff4d6, transparent: true, opacity: 0.08, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }));
    beam.rotation.x = -Math.PI / 2; beam.position.set(0, y0 + 0.4, bl / 2 + 6); g.add(beam);
    // Neon embaixo do carro
    const glow = new T.Mesh(new T.PlaneGeometry(bw + 1.6, bl + 1.4), new T.MeshBasicMaterial({ color: k.color === '#111827' ? '#00e5ff' : k.color, transparent: true, opacity: 0.35, depthWrite: false, blending: T.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.06; g.add(glow);
    const wheels = [];
    const r = type === 'suv' ? 0.55 : 0.46;
    for (const [x, z] of [[-bw / 2, bl * 0.32], [bw / 2, bl * 0.32], [-bw / 2, -bl * 0.32], [bw / 2, -bl * 0.32]]) {
      const w = new T.Group(); w.position.set(x, r, z);
      const tire = new T.Mesh(new T.CylinderGeometry(r, r, 0.42, 20), black); tire.rotation.z = Math.PI / 2; tire.castShadow = true; w.add(tire);
      const rim = new T.Mesh(new T.CylinderGeometry(r * 0.62, r * 0.62, 0.44, 10), chrome); rim.rotation.z = Math.PI / 2; w.add(rim);
      g.add(w); wheels.push(w);
    }
    // Chama do nitro saindo do escapamento
    const flame = new T.Mesh(new T.ConeGeometry(0.35, 2.4, 12), new T.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.9, blending: T.AdditiveBlending }));
    flame.rotation.x = -Math.PI / 2; flame.position.set(0.5, y0 + 0.15, -bl / 2 - 1.3); flame.visible = false; g.add(flame);
    return { g, wheels, flame, helmet: roofM, cab };
  },
};
registerGame(makeRace3D(CITY));
