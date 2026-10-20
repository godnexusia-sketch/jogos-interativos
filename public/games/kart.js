'use strict';

// Kart 3D: circuito fechado em 3D. Quem comenta "kart" entra com a foto e o @ em cima do kart.
// Presentes viram poderes: nitro, pedra na pista, míssil teleguiado e raio.
let THREE = null;
const threeReady = Promise.all([import('/vendor/three.module.min.js'), document.fonts.ready]).then(([m]) => { THREE = m; }).catch(() => {});
const KART_MAX = 12, LAPS = 3, TRACK_W = 16;
const TRACK_PTS = [[0, 0], [70, -6], [140, 10], [190, 60], [196, 130], [150, 180], [86, 170], [52, 214], [-10, 240], [-90, 220], [-150, 160], [-160, 80], [-110, 30], [-60, 10]];
const KART_COLORS = ['#e63946', '#1d4ed8', '#f59f00', '#2a9d8f', '#9b5de5', '#ff6b9e', '#06b6d4', '#84cc16', '#f97316', '#e5e7eb', '#111827', '#facc15'];
const proxImg = (url) => (!url || url.startsWith('data:') ? url : `/api/img?u=${encodeURIComponent(url)}`);

registerGame({
  id: 'kart',
  name: 'Kart 3D',
  icon: '🏎️',
  help: '<p>Comente <b>kart</b> para entrar na corrida (até 12). Com 2 pilotos a largada começa. São 3 voltas.</p><p>💬 Comentário e ❤️ like dão um empurrão.</p><p>🌹 Nitro · 🍩 Nitro + pedra na pista · 🕶️ Míssil teleguiado em quem está na frente · 🌌 Raio: encolhe todo mundo e mega nitro para você.</p><p>Quem não está correndo e manda presente ataca o líder.</p>',
  cd: new Cooldown(1000),
  wins: new Map(),
  raceNo: 1,
  reset() {
    if (this.karts) for (const k of this.karts) this.r?.scene.remove(k.mesh);
    for (const it of this.items || []) this.r?.scene.remove(it.mesh);
    this.karts = [];
    this.next = [];
    this.items = [];
    this.phase = 'lobby';
    this.timer = 0;
    this.podium = [];
    this.log = [];
    this.flash = 0;
    this.focus = null;
    this.focusT = 0;
    this.leaderId = null;
  },
  sample() { return this.phase === 'race' ? pick(['vai!', 'acelera', 'bora']) : 'kart'; },
  kart(id) { return this.karts.find((k) => k.id === id); },
  ranked() { return [...this.karts].sort((a, b) => b.s - a.s); },
  addLog(user, msg, color = '#fff') { this.log.unshift({ user, msg, color, t: 6 }); this.log.length = Math.min(this.log.length, 4); },

  // ---------- Cena 3D ----------
  init3d() {
    if (this.r || !THREE) return;
    const T = THREE;
    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(1);
    renderer.setSize(W * SCALE, H * SCALE, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene();
    scene.background = this.canvasTex(2, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#3b82f6'); gr.addColorStop(0.6, '#93c5fd'); gr.addColorStop(1, '#e0f2fe'); g.fillStyle = gr; g.fillRect(0, 0, 2, 256); });
    scene.fog = new T.Fog(0xcfe8ff, 160, 520);
    const camera = new T.PerspectiveCamera(58, W / H, 0.5, 1500);
    scene.add(new T.HemisphereLight(0xffffff, 0x4d7c3a, 1.1));
    const sun = new T.DirectionalLight(0xffffff, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 200 });
    scene.add(sun, sun.target);

    // Grama
    const grass = this.canvasTex(256, 256, (g) => { g.fillStyle = '#4caf50'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 4000; i++) { g.fillStyle = Math.random() < 0.5 ? '#43a047' : '#5cbf60'; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 3); } });
    grass.wrapS = grass.wrapT = T.RepeatWrapping; grass.repeat.set(120, 120);
    const ground = new T.Mesh(new T.PlaneGeometry(3000, 3000), new T.MeshLambertMaterial({ map: grass }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    scene.add(ground);

    // Pista
    const curve = new T.CatmullRomCurve3(TRACK_PTS.map(([x, z]) => new T.Vector3(x * 1.6, 0, z * 1.6)), true, 'catmullrom', 0.5);
    const L = curve.getLength();
    const N = 1600;
    const pts = [], tan = [], nor = [];
    for (let i = 0; i < N; i++) {
      const u = i / N;
      const p = curve.getPointAt(u), t = curve.getTangentAt(u);
      pts.push(p); tan.push(t); nor.push(new T.Vector3(t.z, 0, -t.x).normalize());
    }
    const ribbon = (inner, outer, y, vScale) => {
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const k = i % N;
        const a = pts[k].clone().addScaledVector(nor[k], inner), b = pts[k].clone().addScaledVector(nor[k], outer);
        pos.push(a.x, y, a.z, b.x, y, b.z);
        uv.push(0, (i / N) * L / vScale, 1, (i / N) * L / vScale);
        if (i < N) { const j = i * 2; idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      return geo;
    };
    const asphalt = this.canvasTex(256, 256, (g) => {
      g.fillStyle = '#3a3d44'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},.08)`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
      g.fillStyle = '#f5f5f5'; g.fillRect(124, 0, 8, 128);
    });
    asphalt.wrapS = asphalt.wrapT = T.RepeatWrapping;
    const road = new T.Mesh(ribbon(TRACK_W / 2, -TRACK_W / 2, 0.05, 16), new T.MeshLambertMaterial({ map: asphalt, side: T.DoubleSide }));
    road.receiveShadow = true; scene.add(road);
    const curbTex = this.canvasTex(64, 64, (g) => { g.fillStyle = '#e11d48'; g.fillRect(0, 0, 64, 32); g.fillStyle = '#fff'; g.fillRect(0, 32, 64, 32); });
    curbTex.wrapS = curbTex.wrapT = T.RepeatWrapping;
    for (const side of [1, -1]) {
      const curb = new T.Mesh(ribbon(side * TRACK_W / 2, side * (TRACK_W / 2 + 1.6), 0.12, 3), new T.MeshLambertMaterial({ map: curbTex, side: T.DoubleSide }));
      curb.receiveShadow = true; scene.add(curb);
    }
    // Linha de largada e pórtico
    const checker = this.canvasTex(128, 32, (g) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 8, y * 8, 8, 8); } });
    const line = new T.Mesh(new T.PlaneGeometry(TRACK_W, 3), new T.MeshLambertMaterial({ map: checker }));
    line.rotation.x = -Math.PI / 2; line.position.set(pts[0].x, 0.15, pts[0].z); line.rotation.z = Math.atan2(tan[0].x, tan[0].z) + Math.PI / 2;
    scene.add(line);
    const arch = new T.Group();
    const pillarMat = new T.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.4, roughness: 0.5 });
    for (const side of [1, -1]) { const p = new T.Mesh(new T.BoxGeometry(1.2, 10, 1.2), pillarMat); p.position.set(side * (TRACK_W / 2 + 2), 5, 0); p.castShadow = true; arch.add(p); }
    const banner = this.canvasTex(512, 96, (g) => { const gr = g.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, '#ff3d5a'); gr.addColorStop(1, '#a3132a'); g.fillStyle = gr; g.fillRect(0, 0, 512, 96); g.fillStyle = '#fff'; g.font = '64px Bungee, Impact'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LARGADA', 256, 52); });
    const top = new T.Mesh(new T.BoxGeometry(TRACK_W + 6, 2.6, 0.8), [pillarMat, pillarMat, pillarMat, pillarMat, new T.MeshBasicMaterial({ map: banner }), new T.MeshBasicMaterial({ map: banner })]);
    top.position.y = 10; arch.add(top);
    arch.position.copy(pts[0]); arch.rotation.y = Math.atan2(tan[0].x, tan[0].z);
    scene.add(arch);
    // Arquibancada perto da largada
    const crowd = this.canvasTex(256, 64, (g) => { g.fillStyle = '#334155'; g.fillRect(0, 0, 256, 64); for (let i = 0; i < 220; i++) { g.fillStyle = COLORS[i % COLORS.length]; g.beginPath(); g.arc(Math.random() * 256, 8 + Math.random() * 52, 3, 0, 7); g.fill(); } });
    crowd.wrapS = T.RepeatWrapping; crowd.repeat.set(4, 1);
    const stand = new T.Mesh(new T.BoxGeometry(70, 8, 10), [pillarMat, pillarMat, pillarMat, pillarMat, new T.MeshLambertMaterial({ map: crowd }), new T.MeshLambertMaterial({ map: crowd })]);
    const k0 = 40;
    stand.position.copy(pts[k0]).addScaledVector(nor[k0], -(TRACK_W / 2 + 14)); stand.position.y = 4; stand.rotation.y = Math.atan2(tan[k0].x, tan[k0].z) + Math.PI / 2;
    stand.castShadow = true; scene.add(stand);
    // Árvores (instanciadas) longe da pista
    const near = (x, z) => { for (let i = 0; i < N; i += 8) { const dx = pts[i].x - x, dz = pts[i].z - z; if (dx * dx + dz * dz < (TRACK_W / 2 + 8) ** 2) return true; } return false; };
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
    const qTex = this.canvasTex(128, 128, (g) => { const gr = g.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, '#fde047'); gr.addColorStop(0.5, '#f472b6'); gr.addColorStop(1, '#60a5fa'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff'; g.font = '900 96px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 64, 70); });
    const boxes = [];
    for (const u of [0.2, 0.45, 0.7, 0.9]) for (const off of [-4, 0, 4]) {
      const i = Math.floor(u * N);
      const b = new T.Mesh(new T.BoxGeometry(2, 2, 2), new T.MeshLambertMaterial({ map: qTex, transparent: true, opacity: 0.92 }));
      b.position.copy(pts[i]).addScaledVector(nor[i], off); b.position.y = 2.2;
      scene.add(b); boxes.push(b);
    }
    this.r = { renderer, scene, camera, sun, curve, L, N, pts, tan, nor, boxes, camPos: new T.Vector3(0, 30, -40), camLook: new T.Vector3() };
    // Mapa do percurso: pontos normalizados para o minimapa
    const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const sc = 170 / Math.max(maxX - minX, maxZ - minZ);
    this.r.map = (p) => ({ x: (p.x - minX) * sc, y: (p.z - minZ) * sc, w: (maxX - minX) * sc, h: (maxZ - minZ) * sc });
    for (const k of this.karts) if (!k.mesh) this.buildKart(k);
  },
  canvasTex(w, h, fn) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    fn(c.getContext('2d'));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  },
  buildKart(k) {
    const T = THREE;
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
    // Foto e @ em cima do kart
    const face = document.createElement('canvas'); face.width = face.height = 256;
    const faceTex = new T.CanvasTexture(face); faceTex.colorSpace = T.SRGBColorSpace;
    // Tamanho fixo na tela (não cresce quando o kart chega perto da câmera)
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: faceTex, depthTest: false, sizeAttenuation: false }));
    sprite.center.set(0.5, 0); sprite.position.set(0, 3.2, 0); sprite.renderOrder = 10; g.add(sprite);
    const tag = document.createElement('canvas'); tag.width = 512; tag.height = 96;
    const tagTex = new T.CanvasTexture(tag); tagTex.colorSpace = T.SRGBColorSpace;
    const tagSprite = new T.Sprite(new T.SpriteMaterial({ map: tagTex, depthTest: false, sizeAttenuation: false }));
    tagSprite.center.set(0.5, -3.1); tagSprite.position.set(0, 3.2, 0); tagSprite.renderOrder = 11; g.add(tagSprite);
    const drawFace = (img) => {
      const c = face.getContext('2d');
      c.clearRect(0, 0, 256, 256);
      c.save(); c.beginPath(); c.arc(128, 128, 112, 0, 7); c.closePath();
      if (img) { c.clip(); c.drawImage(img, 16, 16, 224, 224); } else { c.fillStyle = k.color; c.fill(); c.fillStyle = '#fff'; c.font = '900 120px Inter'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText((k.user.nick || '?')[0].toUpperCase(), 128, 136); }
      c.restore();
      c.lineWidth = 16; c.strokeStyle = k.color; c.beginPath(); c.arc(128, 128, 116, 0, 7); c.stroke();
      faceTex.needsUpdate = true;
    };
    drawFace(null);
    if (k.user.pic) { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => drawFace(img); img.src = proxImg(k.user.pic); }
    k.drawTag = (rank) => {
      const c = tag.getContext('2d');
      c.clearRect(0, 0, 512, 96);
      c.fillStyle = 'rgba(8,10,18,.85)'; c.beginPath(); c.roundRect(4, 8, 504, 80, 40); c.fill();
      c.fillStyle = rank === 1 ? '#ffc93c' : rank === 2 ? '#d7dde8' : rank === 3 ? '#e08a3c' : '#334155';
      c.beginPath(); c.roundRect(14, 18, 60, 60, 14); c.fill();
      c.fillStyle = rank <= 3 ? '#111' : '#fff'; c.font = '900 40px Inter'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(rank), 44, 50);
      c.fillStyle = '#fff'; c.font = '800 40px Inter'; c.textAlign = 'left'; c.fillText(`@${trim(k.user.nick, 14)}`, 90, 50);
      tagTex.needsUpdate = true;
      k.tagRank = rank;
    };
    k.drawTag(this.karts.indexOf(k) + 1);
    k.mesh = g; k.wheels = wheels; k.flame = flame; k.helmet = helmet; k.face = sprite; k.tag = tagSprite;
    this.r.scene.add(g);
  },
  frameAt(s, off) {
    const r = this.r;
    const i = Math.floor((((s % r.L) + r.L) % r.L) / r.L * r.N) % r.N;
    const p = r.pts[i].clone().addScaledVector(r.nor[i], off);
    return { p, t: r.tan[i], n: r.nor[i] };
  },

  // ---------- Regras ----------
  join(ev) {
    const id = uid(ev);
    if (this.kart(id) || this.next.some((n) => n.id === id)) return;
    const entry = { id, user: ev.user, color: KART_COLORS[(this.karts.length + this.next.length) % KART_COLORS.length] };
    if (this.phase === 'race' || this.phase === 'finish') { if (this.next.length < KART_MAX) this.next.push(entry); return; }
    if (this.karts.length >= KART_MAX) return;
    this.addKart(entry);
    sfx.pop();
    this.addLog(ev.user, 'entrou na corrida', '#25f4ee');
    if (this.karts.length >= 2 && this.phase === 'lobby') { this.phase = 'countdown'; this.timer = 25; }
  },
  addKart(entry) {
    const n = this.karts.length;
    // Grid de largada: duas filas, atrás da linha
    const k = { ...entry, s: -6 - Math.floor(n / 2) * 7, off: n % 2 ? -3.5 : 3.5, targetOff: 0, speed: rand(27, 29), boost: 0, stun: 0, spin: 0, shrink: 0, wheelRot: 0, offT: rand(2, 5), lap: 0 };
    k.targetOff = k.off;
    this.karts.push(k);
    if (this.r) this.buildKart(k);
  },
  onEvent(ev) {
    const id = uid(ev);
    if (ev.type === 'chat') {
      const t = ev.text.trim().toLowerCase();
      if (/\b(kart|carro|moto|!entrar|entrar|corrida)\b/.test(t)) return this.join(ev);
      const k = this.kart(id);
      if (k && this.phase === 'race' && this.cd.ok(id)) k.s += 1.5;
    } else if (ev.type === 'like') {
      const k = this.kart(id);
      if (k && this.phase === 'race') k.s += Math.min(4, 0.3 * ev.count);
    } else if (ev.type === 'gift') {
      if (this.phase !== 'race') { if (this.phase !== 'finish') this.join(ev); const k = this.kart(id); if (k) this.addLog(ev.user, 'largou com NITRO guardado', '#60a5fa'); if (k) k.boost = 3; return; }
      this.power(ev);
    }
  },
  power(ev) {
    const me = this.kart(uid(ev));
    const tier = giftTier(ev), n = Math.min(5, ev.count || 1);
    const order = this.ranked();
    const leader = order[0];
    if (!me) {
      // Fora da corrida: ataca o líder
      if (tier >= 3) this.fire(null, leader, ev.user); else this.dropRock(leader.s + 18, leader.off, ev.user);
      this.addLog(ev.user, `atacou o líder @${trim(leader.user.nick, 10)}`, '#ff8a3d');
      return;
    }
    if (tier >= 2) this.setFocus(me, 3);
    if (tier === 1) { me.boost = Math.min(12, me.boost + 2.5 * n); this.addLog(ev.user, `usou NITRO ${(2.5 * n).toFixed(0)}s`, '#60a5fa'); }
    else if (tier === 2) { me.boost = Math.min(12, me.boost + 4); this.dropRock(me.s - 5, me.off, ev.user); this.addLog(ev.user, 'jogou uma PEDRA na pista', '#a8a29e'); }
    else if (tier === 3) {
      const target = order[order.indexOf(me) - 1] || order[order.indexOf(me) + 1];
      if (target) this.fire(me, target, ev.user);
      me.boost = Math.max(me.boost, 3);
      this.addLog(ev.user, `lançou um MÍSSIL${target ? ' em @' + trim(target.user.nick, 10) : ''}`, '#f43f5e');
    } else {
      for (const k of this.karts) if (k !== me) { k.shrink = 6; k.stun = Math.max(k.stun, 1.2); k.spin = 1; }
      me.boost = Math.max(me.boost, 7);
      this.flash = 0.6;
      sfx.boom();
      announcer.show(`⚡ RAIO de @${trim(ev.user.nick, 12)}`, '#facc15', 2.5, 54);
      this.addLog(ev.user, 'chamou o RAIO: todo mundo encolheu!', '#facc15');
      this.setFocus(me, 5);
    }
  },
  setFocus(k, secs) { this.focus = k; this.focusT = secs; },
  dropRock(s, off, user) {
    const it = { kind: 'rock', s, off, user, t: 25 };
    if (this.r) {
      const T = THREE;
      it.mesh = new T.Mesh(new T.DodecahedronGeometry(1.4, 0), new T.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9, flatShading: true }));
      it.mesh.castShadow = true;
      const f = this.frameAt(s, off); it.mesh.position.set(f.p.x, 1.2, f.p.z);
      this.r.scene.add(it.mesh);
    }
    this.items.push(it);
  },
  fire(from, target, user) {
    if (!target) return;
    const it = { kind: 'missile', s: from ? from.s + 3 : target.s - 40, off: from ? from.off : target.off, target, user, t: 6 };
    if (this.r) {
      const T = THREE;
      const g = new T.Group();
      const body = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, 2.2, 10), new T.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.5, roughness: 0.3 }));
      body.rotation.x = Math.PI / 2; g.add(body);
      const tip = new T.Mesh(new T.ConeGeometry(0.35, 0.8, 10), new T.MeshStandardMaterial({ color: 0xf8fafc }));
      tip.rotation.x = Math.PI / 2; tip.position.z = 1.5; g.add(tip);
      const fire = new T.Mesh(new T.ConeGeometry(0.3, 1.2, 8), new T.MeshBasicMaterial({ color: 0xfbbf24 }));
      fire.rotation.x = -Math.PI / 2; fire.position.z = -1.6; g.add(fire);
      it.mesh = g; this.r.scene.add(g);
    }
    this.items.push(it);
    sfx.tone(300, 0.3, 'sawtooth', 0.06);
  },
  hit(k, label, user) {
    if (!k) return;
    k.stun = Math.max(k.stun, 1.8); k.spin = 1; k.s -= 6;
    this.addLog(k.user, `${label}${user ? ' (por @' + trim(user.nick, 10) + ')' : ''}`, '#f43f5e');
    sfx.boom();
  },
  update(dt) {
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    this.flash = Math.max(0, this.flash - dt);
    this.focusT = Math.max(0, this.focusT - dt);
    if (this.focusT <= 0) this.focus = null;
    if (this.phase === 'countdown') {
      this.timer -= dt;
      if (this.timer <= 3 && Math.ceil(this.timer) !== this.lastBeep && this.timer > 0) { this.lastBeep = Math.ceil(this.timer); sfx.tone(520, 0.2, 'square', 0.08); }
      if (this.timer <= 0) { this.phase = 'race'; this.timer = 0; sfx.tone(1040, 0.4, 'square', 0.1); announcer.show('GO!', '#7cff6b', 1.2, 140); }
    } else if (this.phase === 'race') {
      this.timer += dt;
      const L = this.r?.L || 1000;
      for (const k of this.karts) {
        k.boost = Math.max(0, k.boost - dt); k.stun = Math.max(0, k.stun - dt); k.spin = Math.max(0, k.spin - dt); k.shrink = Math.max(0, k.shrink - dt);
        const wave = Math.sin(this.timer * 0.6 + k.speed) * 1.2;
        let v = k.stun > 0 ? 6 : (k.speed + wave) * (k.boost > 0 ? 1.65 : 1) * (k.shrink > 0 ? 0.75 : 1);
        k.s += v * dt;
        k.wheelRot += v * dt / 0.5;
        // Troca de faixa de vez em quando, para ultrapassar
        k.offT -= dt;
        if (k.offT <= 0) { k.offT = rand(2, 5); k.targetOff = rand(-TRACK_W / 2 + 2.2, TRACK_W / 2 - 2.2); }
        k.off += (k.targetOff - k.off) * Math.min(1, dt * 1.2);
        k.lap = Math.floor(k.s / L);
      }
      for (const it of this.items) {
        it.t -= dt;
        if (it.kind === 'rock') {
          for (const k of this.karts) if (Math.abs(((k.s - it.s) % L + L) % L) < 2.5 && Math.abs(k.off - it.off) < 2.6 && !it.used) { it.used = true; this.hit(k, 'bateu na PEDRA', it.user); }
        } else if (it.kind === 'missile') {
          it.s += 70 * dt;
          it.off += (it.target.off - it.off) * Math.min(1, dt * 4);
          if (it.s >= it.target.s - 1 && !it.used) { it.used = true; this.hit(it.target, 'levou um MÍSSIL', it.user); }
        }
      }
      for (const it of this.items.filter((i) => i.used || i.t <= 0)) if (it.mesh) this.r?.scene.remove(it.mesh);
      this.items = this.items.filter((i) => !i.used && i.t > 0);
      const order = this.ranked();
      const lead = order[0];
      if (lead && lead.id !== this.leaderId) { if (this.leaderId) this.addLog(lead.user, 'assumiu a liderança!', '#ffc93c'); this.leaderId = lead.id; }
      if (lead && lead.s >= LAPS * L) {
        this.phase = 'finish'; this.timer = 12;
        this.podium = order.slice(0, 3);
        addScore(this.wins, lead.user.nick);
        announcer.items.length = 0;
        sfx.win();
        burst(W / 2, 500, COLORS, 120, 600);
      }
    } else if (this.phase === 'finish') {
      this.timer -= dt;
      if (this.timer <= 0) {
        const next = this.next;
        this.reset();
        this.raceNo++;
        for (const n of next) this.addKart(n);
        if (this.karts.length >= 2) { this.phase = 'countdown'; this.timer = 25; }
      }
    }
  },

  // ---------- Desenho ----------
  draw() {
    if (!this.r) {
      this.init3d();
      background('#0b1020', '#1e293b');
      title('KART 3D', W / 2, H / 2 - 30, 60, '#ff9f1c');
      text(THREE ? 'Montando a pista…' : 'Carregando o 3D…', W / 2, H / 2 + 40, 28, '#ddd', 'center', 700);
      threeReady.then(() => this.init3d());
      return;
    }
    const r = this.r, T = THREE;
    const order = this.ranked();
    const now = performance.now() / 1000;
    for (const b of r.boxes) { b.rotation.y = now; b.rotation.x = now * 0.5; b.position.y = 2.2 + Math.sin(now * 2 + b.position.x) * 0.3; }
    order.forEach((k, i) => {
      const f = this.frameAt(k.s, k.off);
      const yaw = Math.atan2(f.t.x, f.t.z);
      k.mesh.position.set(f.p.x, 0, f.p.z);
      k.mesh.rotation.y = yaw + (k.spin > 0 ? k.spin * Math.PI * 4 : 0);
      const sc = k.shrink > 0 ? 0.55 : k.boost > 0 && k === this.focus ? 1.15 : 1;
      k.mesh.scale.setScalar(sc);
      for (const w of k.wheels) w.rotation.x = k.wheelRot;
      k.flame.visible = k.boost > 0;
      if (k.flame.visible) { k.flame.scale.set(1, 0.8 + Math.random() * 0.6, 1); k.flame.material.color.set(Math.random() < 0.5 ? 0x60a5fa : 0x93c5fd); }
      if (k.tagRank !== i + 1) k.drawTag(i + 1);
      const d = r.camera.position.distanceTo(k.mesh.position);
      const z = clamp(40 / Math.max(d, 1), 0.55, 1) / sc;
      k.face.scale.set(0.075 * z, 0.075 * z, 1);
      k.tag.scale.set(0.15 * z, 0.028 * z, 1);
    });
    for (const it of this.items) {
      if (!it.mesh) continue;
      const f = this.frameAt(it.s, it.off);
      if (it.kind === 'missile') { it.mesh.position.set(f.p.x, 1.4, f.p.z); it.mesh.rotation.y = Math.atan2(f.t.x, f.t.z); }
      else it.mesh.rotation.y += 0.02;
    }
    // Câmera atrás do líder (ou de quem mandou presente grande)
    const target = this.focus || order[0];
    let tp, tt;
    if (target) { const f = this.frameAt(target.s, target.off * 0.6); tp = f.p; tt = f.t; }
    else { const f = this.frameAt(-10, 0); tp = f.p; tt = f.t; }
    const close = this.phase === 'race' ? 1 : 1.4;
    const want = tp.clone().addScaledVector(tt, -20 * close).add(new T.Vector3(0, 10 * close, 0));
    r.camPos.lerp(want, 0.08);
    r.camLook.lerp(tp.clone().addScaledVector(tt, 16).add(new T.Vector3(0, 1, 0)), 0.12);
    r.camera.position.copy(r.camPos);
    r.camera.lookAt(r.camLook);
    r.sun.position.copy(tp).add(new T.Vector3(40, 80, 30));
    r.sun.target.position.copy(tp);
    // Qualidade automática: se o computador não der conta, baixa a resolução do 3D e tira as sombras.
    const nowMs = performance.now();
    r.slow = (r.slow || 0) + ((nowMs - (r.lastFrame || nowMs)) > 45 ? 1 : -0.5);
    r.lastFrame = nowMs;
    if (r.slow > 90 && !r.low) { r.low = true; r.renderer.setSize(W * SCALE * 0.6, H * SCALE * 0.6, false); r.sun.castShadow = false; }
    r.slow = clamp(r.slow, 0, 200);
    r.renderer.render(r.scene, r.camera);
    ctx.drawImage(r.renderer.domElement, 0, 0, W, H);
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,220,${this.flash})`; ctx.fillRect(0, 0, W, H); }
    this.drawHud(order);
    if (this.phase === 'finish') this.drawPodium();
  },
  drawHud(order) {
    const L = this.r.L;
    panel(16, 16, W - 32, 76, { r: 16, from: 'rgba(15,18,30,.88)', to: 'rgba(5,6,12,.88)' });
    title('KART 3D', 34, 54, 28, '#ff9f1c', 'left');
    const lead = order[0];
    const lap = lead ? clamp(lead.lap + 1, 1, LAPS) : 1;
    label('VOLTA', 300, 40, 13, '#9aa0b4', 'center', 900);
    num(`${lap}/${LAPS}`, 300, 66, 34, '#fff');
    label(`CORRIDA #${this.raceNo}`, 430, 54, 14, '#9aa0b4', 'center', 900);
    num(fmtTime(this.timer), W - 34, 54, 34, '#fff', 'right');
    // Minimapa
    const mx = W - 212, my = 104;
    panel(mx, my, 196, 196, { r: 16, from: 'rgba(15,18,30,.82)', to: 'rgba(5,6,12,.82)' });
    const box = this.r.map(this.r.pts[0]);
    const ox = mx + (196 - box.w) / 2, oy = my + (196 - box.h) / 2;
    ctx.beginPath();
    this.r.pts.forEach((p, i) => { if (i % 10) return; const q = this.r.map(p); i ? ctx.lineTo(ox + q.x, oy + q.y) : ctx.moveTo(ox + q.x, oy + q.y); });
    ctx.closePath();
    ctx.lineWidth = 9; ctx.strokeStyle = '#0b0d14'; ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = '#e5e7eb'; ctx.stroke();
    const s0 = this.r.map(this.r.pts[0]);
    ctx.fillStyle = '#111'; ctx.fillRect(ox + s0.x - 6, oy + s0.y - 3, 12, 6);
    for (const k of [...order].reverse()) {
      const f = this.frameAt(k.s, 0); const q = this.r.map(f.p);
      ctx.beginPath(); ctx.arc(ox + q.x, oy + q.y, k === lead ? 8 : 6, 0, 7); ctx.fillStyle = k.color; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
    // Posições
    const rows = order.slice(0, 8);
    if (rows.length) panel(16, 104, 250, 20 + rows.length * 42, { r: 14, from: 'rgba(15,18,30,.82)', to: 'rgba(5,6,12,.82)' });
    rows.forEach((k, i) => {
      const y = 134 + i * 42;
      posBadge(i + 1, 40, y, 26);
      avatar(k.user, 76, y, 15, k.color);
      label(`@${trim(k.user.nick, 10)}`, 98, y + 1, 16, '#fff', 'left', 800);
      if (k.boost > 0) label('🔥', 246, y + 1, 16, '#fff', 'right');
      else if (k.stun > 0) label('💫', 246, y + 1, 16, '#fff', 'right');
    });
    // Semáforo e chamadas
    if (this.phase === 'countdown' && this.timer <= 3.2) {
      panel(W / 2 - 150, 380, 300, 110, { r: 30, from: '#1f2937', to: '#0b0f17' });
      for (let k = 0; k < 3; k++) {
        const on = 3 - Math.ceil(this.timer) >= k;
        ctx.save(); if (on) { ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 24; }
        ctx.beginPath(); ctx.arc(W / 2 - 90 + k * 90, 435, 34, 0, 7); ctx.fillStyle = on ? '#ef4444' : '#3f1d1d'; ctx.fill(); ctx.restore();
      }
    }
    if (this.phase === 'lobby' || this.phase === 'countdown') {
      panel(50, 1060, W - 100, 110, { r: 24, from: 'rgba(20,24,40,.92)', to: 'rgba(8,9,15,.92)', border: '#ff9f1c' });
      title(this.phase === 'lobby' ? 'COMENTE KART' : `LARGADA EM ${Math.ceil(this.timer)}s`, W / 2, 1100, 30, '#ff9f1c');
      label(`${this.karts.length}/${KART_MAX} pilotos${this.phase === 'lobby' ? ' · mínimo 2' : ' · ainda dá tempo de entrar'}`, W / 2, 1142, 18, '#ddd', 'center', 800);
    } else {
      // Legenda dos poderes
      panel(16, 1196, W - 32, 64, { r: 16, from: 'rgba(15,18,30,.88)', to: 'rgba(5,6,12,.88)' });
      const pw = [['🌹', 'NITRO'], ['🍩', 'PEDRA'], ['🕶️', 'MÍSSIL'], ['🌌', 'RAIO']];
      pw.forEach(([e, n], i) => { const x = 30 + i * 172; text(e, x + 20, 1228, 26); label(n, x + 44, 1229, 17, '#fff', 'left', 900); });
    }
    const baseY = this.phase === 'lobby' || this.phase === 'countdown' ? 1020 : 1160;
    this.log.forEach((l, k) => toast(l.user, trim(`@${trim(l.user.nick, 10)} ${l.msg}`, 34), 20, baseY - k * 44, { color: l.color, size: 17, alpha: clamp(l.t, 0, 1) }));
  },
  drawPodium() {
    ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(0, 0, W, H);
    title('PÓDIO', W / 2, 220, 70, '#ffd23f');
    const spots = [{ i: 1, x: 170, h: 200 }, { i: 0, x: 360, h: 280 }, { i: 2, x: 550, h: 150 }];
    for (const s of spots) {
      const k = this.podium[s.i];
      const col = ['#ffc93c', '#d7dde8', '#e08a3c'][s.i];
      panel(s.x - 90, 860 - s.h, 180, s.h, { r: 14, from: shade(col, 20), to: shade(col, -50) });
      num(`${s.i + 1}º`, s.x, 860 - s.h + 60, 64, '#1a1a1a');
      if (!k) continue;
      avatar(k.user, s.x, 860 - s.h - 70, s.i === 0 ? 60 : 48, col);
      label(`@${trim(k.user.nick, 10)}`, s.x, 860 - s.h - 150, 22, '#fff', 'center', 800);
    }
    leaderboard(this.wins, 'Vitórias na live', W / 2, 940, 3, 28);
    text(`Próxima corrida em ${Math.ceil(this.timer)}s`, W / 2, 1180, 30, '#ddd', 'center', 700);
  },
});
