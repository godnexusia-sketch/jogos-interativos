'use strict';

// Kart 3D: circuito no campo, karts com piloto de capacete.
const KART = {
  id: 'kart',
  meterY: 330, // posição do medidor de presentes (livre de HUD)
  name: 'Kart 3D',
  icon: '🏎️',
  title: 'KART 3D',
  cta: 'COMENTE KART',
  accent: '#ff9f1c',
  joinWord: 'kart',
  joinRe: /\b(kart|!entrar|entrar)\b/,
  help: '<p>Comente <b>kart</b> para entrar na corrida (até 12). Com 2 pilotos a largada começa. São 3 voltas.</p><p>💬 Comentário e ❤️ like dão um empurrão.</p><p>1–9 🪙 Nitro (2 a 5s) · 10–99 🪙 Nitro + 1 a 3 pedras na pista · 100–999 🪙 1 a 3 mísseis teleguiados em quem está na frente · 1.000+ 🪙 Raio: encolhe todo mundo e mega nitro (10.000+ 🪙 ainda dispara mísseis). ⭐ Seguir e 🔁 compartilhar dão nitro.</p>' + TIER_HELP + '<p>Quem não está correndo e manda presente ataca o líder.</p>',
  laps: 3,
  speed: 28,
  trackW: 16,
  trackScale: 1.6,
  curbW: 1.6,
  tagY: 3.2,
  asphalt: '#3a3d44',
  track: [[0, 0], [70, -6], [140, 10], [190, 60], [196, 130], [150, 180], [86, 170], [52, 214], [-10, 240], [-90, 220], [-150, 160], [-160, 80], [-110, 30], [-60, 10]],
  colors: ['#e63946', '#1d4ed8', '#f59f00', '#2a9d8f', '#9b5de5', '#ff6b9e', '#06b6d4', '#84cc16', '#f97316', '#e5e7eb', '#111827', '#facc15'],
  env(T, scene, self) {
    scene.background = G3.skyTex('#3b82f6', '#93c5fd', '#e0f2fe');
    scene.fog = new T.Fog(0xcfe8ff, 160, 520);
    const sun = G3.lights(scene, { ground: 0x4d7c3a, hemi: 1.1, sun: 2.2 });
    Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, far: 200 });
    const grass = self.canvasTex(256, 256, (g) => { g.fillStyle = '#4caf50'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 4000; i++) { g.fillStyle = Math.random() < 0.5 ? '#43a047' : '#5cbf60'; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 3); } });
    grass.wrapS = grass.wrapT = T.RepeatWrapping; grass.repeat.set(120, 120);
    const ground = new T.Mesh(new T.PlaneGeometry(3000, 3000), new T.MeshLambertMaterial({ map: grass }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    scene.add(ground);
    return { sun };
  },
  curb(T, self) { return self.canvasTex(64, 64, (g) => { g.fillStyle = '#e11d48'; g.fillRect(0, 0, 64, 32); g.fillStyle = '#fff'; g.fillRect(0, 32, 64, 32); }); },
  decor(T, scene, { pts, tan, nor, N }, self) {
    const arch = new T.Group();
    const pillarMat = new T.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.4, roughness: 0.5 });
    for (const side of [1, -1]) { const p = new T.Mesh(new T.BoxGeometry(1.2, 14, 1.2), pillarMat); p.position.set(side * (KART.trackW / 2 + 2), 7, 0); p.castShadow = true; arch.add(p); }
    const banner = self.canvasTex(512, 96, (g) => { const gr = g.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, '#ff3d5a'); gr.addColorStop(1, '#a3132a'); g.fillStyle = gr; g.fillRect(0, 0, 512, 96); g.fillStyle = '#fff'; g.font = 'italic 900 70px "Barlow Condensed", Impact'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LARGADA', 256, 52); });
    const top = new T.Mesh(new T.BoxGeometry(KART.trackW + 6, 2.6, 0.8), [pillarMat, pillarMat, pillarMat, pillarMat, new T.MeshBasicMaterial({ map: banner }), new T.MeshBasicMaterial({ map: banner })]);
    top.position.y = 14; arch.add(top);
    arch.position.copy(pts[0]); arch.rotation.y = Math.atan2(tan[0].x, tan[0].z);
    scene.add(arch);
    // Arquibancada perto da largada
    const crowd = self.canvasTex(256, 64, (g) => { g.fillStyle = '#334155'; g.fillRect(0, 0, 256, 64); for (let i = 0; i < 220; i++) { g.fillStyle = COLORS[i % COLORS.length]; g.beginPath(); g.arc(Math.random() * 256, 8 + Math.random() * 52, 3, 0, 7); g.fill(); } });
    crowd.wrapS = T.RepeatWrapping; crowd.repeat.set(4, 1);
    const stand = new T.Mesh(new T.BoxGeometry(70, 8, 10), [pillarMat, pillarMat, pillarMat, pillarMat, new T.MeshLambertMaterial({ map: crowd }), new T.MeshLambertMaterial({ map: crowd })]);
    const k0 = 40;
    stand.position.copy(pts[k0]).addScaledVector(nor[k0], -(KART.trackW / 2 + 14)); stand.position.y = 4; stand.rotation.y = Math.atan2(tan[k0].x, tan[k0].z) + Math.PI / 2;
    stand.castShadow = true; scene.add(stand);
    // Árvores (instanciadas) longe da pista
    const near = (x, z) => { for (let i = 0; i < N; i += 8) { const dx = pts[i].x - x, dz = pts[i].z - z; if (dx * dx + dz * dz < (KART.trackW / 2 + 8) ** 2) return true; } return false; };
    const spots = [];
    for (let tries = 0; spots.length < 160 && tries < 4000; tries++) { const x = rand(-420, 480), z = rand(-160, 560); if (!near(x, z)) spots.push([x, z, rand(0.7, 1.4)]); }
    const crown = new T.InstancedMesh(new T.ConeGeometry(4, 10, 8), new T.MeshLambertMaterial({ color: 0x2e7d32 }), spots.length);
    const trunk = new T.InstancedMesh(new T.CylinderGeometry(0.6, 0.8, 4, 6), new T.MeshLambertMaterial({ color: 0x6d4c41 }), spots.length);
    const m = new T.Matrix4();
    spots.forEach(([x, z, s], i) => {
      m.compose(new T.Vector3(x, 7 * s + 2, z), new T.Quaternion(), new T.Vector3(s, s, s)); crown.setMatrixAt(i, m);
      m.compose(new T.Vector3(x, 2 * s, z), new T.Quaternion(), new T.Vector3(s, s, s)); trunk.setMatrixAt(i, m);
    });
    crown.castShadow = true; scene.add(crown, trunk);
    // Caixas de item (enfeite) girando
    const qTex = self.canvasTex(128, 128, (g) => { const gr = g.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, '#fde047'); gr.addColorStop(0.5, '#f472b6'); gr.addColorStop(1, '#60a5fa'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff'; g.font = '900 96px Barlow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 64, 70); });
    const boxes = [];
    for (const u of [0.2, 0.45, 0.7, 0.9]) for (const off of [-4, 0, 4]) {
      const i = Math.floor(u * N);
      const b = new T.Mesh(new T.BoxGeometry(2, 2, 2), new T.MeshLambertMaterial({ map: qTex, transparent: true, opacity: 0.92 }));
      b.position.copy(pts[i]).addScaledVector(nor[i], off); b.position.y = 2.2;
      scene.add(b); boxes.push(b);
    }
    return boxes;
  },
  vehicle(T, k) {
    const g = new T.Group();
    const paint = new T.MeshStandardMaterial({ color: k.color, metalness: 0.35, roughness: 0.35 });
    const black = new T.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const chrome = new T.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 });
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
    add(new T.BoxGeometry(2.4, 0.55, 3.6), paint, 0, 0.75, 0);
    add(new T.BoxGeometry(2.0, 0.45, 1.2), paint, 0, 0.9, 1.9, -0.25);
    add(new T.BoxGeometry(2.8, 0.25, 0.6), black, 0, 0.6, 2.5);
    add(new T.BoxGeometry(2.6, 0.12, 0.7), paint, 0, 1.9, -1.8);
    add(new T.BoxGeometry(0.15, 0.9, 0.15), black, -0.9, 1.45, -1.7); add(new T.BoxGeometry(0.15, 0.9, 0.15), black, 0.9, 1.45, -1.7);
    add(new T.BoxGeometry(1.2, 0.9, 0.3), black, 0, 1.4, -0.9);
    const wheels = [];
    for (const [x, z, r] of [[-1.35, 1.3, 0.48], [1.35, 1.3, 0.48], [-1.4, -1.25, 0.58], [1.4, -1.25, 0.58]]) {
      const wgrp = new T.Group(); wgrp.position.set(x, r, z);
      const tire = new T.Mesh(new T.CylinderGeometry(r, r, 0.55, 18), black); tire.rotation.z = Math.PI / 2; tire.castShadow = true; wgrp.add(tire);
      const hub = new T.Mesh(new T.CylinderGeometry(r * 0.55, r * 0.55, 0.58, 12), chrome); hub.rotation.z = Math.PI / 2; wgrp.add(hub);
      g.add(wgrp); wheels.push(wgrp);
    }
    // Piloto com capacete
    add(new T.CylinderGeometry(0.45, 0.55, 1.0, 12), paint, 0, 1.55, -0.4);
    const helmet = add(new T.SphereGeometry(0.55, 18, 14), new T.MeshStandardMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0.3 }), 0, 2.35, -0.35);
    add(new T.BoxGeometry(0.75, 0.3, 0.2), new T.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.1 }), 0, 2.38, 0.12);
    // Chama do nitro
    const flame = new T.Mesh(new T.ConeGeometry(0.45, 2.4, 12), new T.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.85 }));
    flame.rotation.x = -Math.PI / 2; flame.position.set(0, 0.8, -3.0); flame.visible = false; g.add(flame);
    return { g, wheels, flame, helmet };
  },
};
registerGame(makeRace3D(KART));
