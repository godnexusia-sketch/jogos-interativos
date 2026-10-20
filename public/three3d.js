'use strict';

// Motor 3D compartilhado: um único renderizador WebGL (o navegador limita quantos podem existir),
// texturas desenhadas em canvas, rostos com a foto das pessoas e um boneco 3D articulado.
let THREE = null;
const three3dReady = Promise.all([import('/vendor/three.module.min.js'), document.fonts.ready])
  .then(([m]) => { THREE = m; })
  .catch((err) => console.error('3D indisponível', err));
const proxImg = (url) => (!url || url.startsWith('data:') ? url : `/api/img?u=${encodeURIComponent(url)}`);

const G3 = {
  renderer: null,
  low: false,
  slow: 0,
  last: 0,
  get ready() { return Boolean(THREE); },
  init() {
    if (this.renderer || !THREE) return this.renderer;
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(1);
    r.setSize(W * SCALE, H * SCALE, false);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    this.renderer = r;
    return r;
  },
  // Desenha a cena 3D no canvas principal; o HUD 2D vem por cima.
  render(scene, camera) {
    const r = this.init();
    if (!r) return false;
    // Qualidade automática: se o computador não der conta, baixa a resolução e desliga sombras.
    const now = performance.now();
    this.slow = clamp(this.slow + ((now - (this.last || now)) > 45 ? 1 : -0.5), 0, 200);
    this.last = now;
    if (this.slow > 90 && !this.low) { this.low = true; r.setSize(W * SCALE * 0.6, H * SCALE * 0.6, false); r.shadowMap.enabled = false; }
    r.render(scene, camera);
    ctx.drawImage(r.domElement, 0, 0, W, H);
    return true;
  },
  tex(w, h, fn, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  },
  // Textura com a foto (ou um rosto desenhado), atualizada quando a imagem carrega.
  faceTex(url, seed = '?', round = false) {
    const size = 256;
    const c = document.createElement('canvas'); c.width = c.height = size;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const paint = (img) => {
      const g = c.getContext('2d');
      g.clearRect(0, 0, size, size);
      g.save();
      if (round === true) { g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 4, 0, 7); g.clip(); }
      g.drawImage(img, 0, 0, size, size);
      g.restore();
      if (round === 'soft') {
        // Borda esfumada em oval: a foto se mistura com a pele da cabeça.
        g.globalCompositeOperation = 'destination-in';
        const m = g.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.5);
        m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = m; g.fillRect(0, 0, size, size);
        g.globalCompositeOperation = 'source-over';
      }
      t.needsUpdate = true;
    };
    const fallback = new Image();
    fallback.onload = () => paint(fallback);
    fallback.src = fakeFace(String(seed));
    if (url) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => paint(img);
      img.src = proxImg(url);
    }
    return t;
  },
  // Etiqueta de nome que sempre fica do mesmo tamanho na tela.
  label(text, { color = '#ffffff', bg = 'rgba(8,10,18,.85)', border = null, rank = 0, scale = 0.16 } = {}) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, sizeAttenuation: false }));
    sprite.renderOrder = 20;
    sprite.scale.set(scale, scale * 96 / 512, 1);
    sprite.userData.draw = (str, rk = rank) => {
      const g = c.getContext('2d');
      g.clearRect(0, 0, 512, 96);
      g.font = '800 40px Barlow, sans-serif';
      const tw = Math.min(480 - (rk ? 70 : 0), g.measureText(str).width + 40 + (rk ? 70 : 0));
      const x0 = 256 - tw / 2;
      g.fillStyle = bg; g.beginPath(); g.roundRect(x0, 10, tw, 76, 38); g.fill();
      if (border) { g.lineWidth = 5; g.strokeStyle = border; g.stroke(); }
      let tx = x0 + 20;
      if (rk) {
        g.fillStyle = rk === 1 ? '#ffc93c' : rk === 2 ? '#d7dde8' : rk === 3 ? '#e08a3c' : '#334155';
        g.beginPath(); g.roundRect(x0 + 10, 20, 56, 56, 12); g.fill();
        g.fillStyle = rk <= 3 ? '#111' : '#fff'; g.font = '900 36px Barlow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(rk), x0 + 38, 50);
        tx = x0 + 76;
      }
      g.fillStyle = color; g.font = '800 40px Barlow, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(str, tx, 50, tw - (tx - x0) - 16);
      t.needsUpdate = true;
    };
    sprite.userData.draw(text);
    return sprite;
  },
  skyTex(top, mid, bottom) {
    return this.tex(4, 512, (g) => { const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, top); gr.addColorStop(0.55, mid); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, 4, 512); });
  },
  // Luz padrão de jogo: céu + sol com sombra.
  lights(scene, { sky = 0xffffff, ground = 0x445566, hemi = 1.0, sun = 2.4, pos = [30, 60, 25] } = {}) {
    scene.add(new THREE.HemisphereLight(sky, ground, hemi));
    const s = new THREE.DirectionalLight(0xffffff, sun);
    s.position.set(...pos);
    s.castShadow = true;
    s.shadow.mapSize.set(1024, 1024);
    Object.assign(s.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 220 });
    s.shadow.bias = -0.0005;
    scene.add(s, s.target);
    return s;
  },
};

// ---------- Boneco 3D articulado com a foto no rosto ----------
// Proporção de caricatura (cabeça grande) para o rosto aparecer bem na live.
// Juntas: hips, torso, head, sL/sR (ombro), eL/eR (cotovelo), hL/hR (quadril), kL/kR (joelho).
function makeHuman({ color = '#2563eb', skin = '#c68642', shorts = '#111827', photo = '', seed = '?', gloves = false, shoes = '#f8fafc', hair = '#1f1308' } = {}) {
  const T = THREE;
  const mat = (c, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.05, ...o });
  const skinM = mat(skin), shirtM = mat(color, { roughness: 0.45 }), shortsM = mat(shorts), shoeM = mat(shoes), gloveM = mat(gloves ? '#dc2626' : skin, { roughness: 0.35 });
  const mesh = (geo, m, parent, x = 0, y = 0, z = 0) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const joint = (parent, x, y, z) => { const j = new T.Group(); j.position.set(x, y, z); parent.add(j); return j; };
  const root = new T.Group();
  const hips = joint(root, 0, 1.02, 0);
  mesh(new T.CapsuleGeometry(0.27, 0.12, 6, 12), shortsM, hips, 0, -0.02, 0).scale.set(1.25, 1, 0.9);
  const torso = joint(hips, 0, 0.1, 0);
  const chest = mesh(new T.CapsuleGeometry(0.33, 0.42, 8, 16), shirtM, torso, 0, 0.42, 0);
  chest.scale.set(1.2, 1, 0.82);
  // Faixa na camisa
  mesh(new T.CylinderGeometry(0.4, 0.4, 0.08, 20), mat('#ffffff', { roughness: 0.4 }), torso, 0, 0.5, 0).scale.set(1, 1, 0.68);
  const neck = joint(torso, 0, 0.86, 0);
  mesh(new T.CylinderGeometry(0.12, 0.14, 0.16, 12), skinM, neck, 0, 0.04, 0);
  const head = joint(neck, 0, 0.5, 0);
  mesh(new T.SphereGeometry(0.5, 32, 24), skinM, head);
  // Cabelo no alto e atrás
  mesh(new T.SphereGeometry(0.52, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), mat(hair, { roughness: 0.8 }), head, 0, 0.02, -0.03);
  // Rosto: calota na frente da cabeça com a foto
  const faceTex = G3.faceTex(photo, seed, 'soft');
  const face = new T.Mesh(new T.SphereGeometry(0.507, 40, 28, Math.PI / 2 - 1.05, 2.1, Math.PI / 2 - 0.98, 1.9), new T.MeshStandardMaterial({ map: faceTex, roughness: 0.6, transparent: true }));
  head.add(face);
  for (const s of [-1, 1]) mesh(new T.SphereGeometry(0.1, 12, 10), skinM, head, s * 0.5, -0.02, 0);
  const arm = (side) => {
    const sh = joint(torso, side * 0.46, 0.7, 0);
    mesh(new T.SphereGeometry(0.16, 14, 12), shirtM, sh);
    mesh(new T.CapsuleGeometry(0.11, 0.3, 6, 10), skinM, sh, 0, -0.22, 0);
    const el = joint(sh, 0, -0.44, 0);
    mesh(new T.CapsuleGeometry(0.1, 0.28, 6, 10), skinM, el, 0, -0.2, 0);
    const hand = mesh(gloves ? new T.SphereGeometry(0.2, 16, 14) : new T.SphereGeometry(0.12, 12, 10), gloveM, el, 0, -0.44, gloves ? 0.04 : 0);
    if (gloves) hand.scale.set(1, 1.1, 1.25);
    return { sh, el, hand };
  };
  const leg = (side) => {
    const hp = joint(hips, side * 0.18, -0.08, 0);
    mesh(new T.CapsuleGeometry(0.14, 0.32, 6, 10), skinM, hp, 0, -0.24, 0);
    const kn = joint(hp, 0, -0.48, 0);
    mesh(new T.CapsuleGeometry(0.12, 0.3, 6, 10), skinM, kn, 0, -0.22, 0);
    const foot = mesh(new T.BoxGeometry(0.22, 0.14, 0.38), shoeM, kn, 0, -0.44, 0.07);
    return { hp, kn, foot };
  };
  const L = arm(1), R = arm(-1), LL = leg(1), RL = leg(-1);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const rig = { root, hips, torso, neck, head, face, faceTex, sL: L.sh, eL: L.el, sR: R.sh, eR: R.el, hL: LL.hp, kL: LL.kn, hR: RL.hp, kR: RL.kn, gloveL: L.hand, gloveR: R.hand };
  rig.setPhoto = (url, sd) => { const t = G3.faceTex(url, sd, 'soft'); face.material.map = t; face.material.needsUpdate = true; };
  return rig;
}

// Poses: ângulos (radianos) de cada junta. "x" negativo leva o membro para a frente.
function poseHuman(rig, p) {
  const set = (j, v) => { if (!v) return; j.rotation.set(v[0] || 0, v[1] || 0, v[2] || 0); };
  set(rig.torso, p.torso); set(rig.head, p.head); set(rig.hips, p.hips);
  set(rig.sL, p.sL); set(rig.eL, p.eL); set(rig.sR, p.sR); set(rig.eR, p.eR);
  set(rig.hL, p.hL); set(rig.kL, p.kL); set(rig.hR, p.hR); set(rig.kR, p.kR);
  if (p.y !== undefined) rig.hips.position.y = 1.02 + p.y;
}

// Ciclo de corrida (t em segundos, speed ~1).
function runPose(t, speed = 1) {
  const ph = t * 10 * speed;
  const s = Math.sin(ph), c = Math.cos(ph);
  return {
    hL: [-s * 0.9], kL: [Math.max(0, c) * 1.3 + 0.2], hR: [s * 0.9], kR: [Math.max(0, -c) * 1.3 + 0.2],
    sL: [s * 0.9, 0, 0.12], eL: [-1.3], sR: [-s * 0.9, 0, -0.12], eR: [-1.3],
    torso: [0.18, 0, 0], head: [-0.12, 0, 0], y: Math.abs(c) * 0.08,
  };
}

// ---------- Avatares estilo Roblox ----------
// Imagem do avatar de corpo inteiro (fundo transparente) como textura; mantém a proporção quadrada.
G3.imageTex = function (url, fallbackUrl) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const paint = (img) => { const g = c.getContext('2d'); g.clearRect(0, 0, 512, 512); g.drawImage(img, 0, 0, 512, 512); t.needsUpdate = true; };
  if (fallbackUrl) { const f = new Image(); f.onload = () => paint(f); f.src = fallbackUrl; }
  if (url) { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => paint(img); img.src = proxImg(url); }
  return t;
};

// Boneco de blocos no estilo Roblox (para quem não comentou o nick), com o rosto da pessoa na cabeça.
const blockyCache = new Map();
function blockyAvatar(seed, faceUrl) {
  const key = seed + '|' + (faceUrl || '');
  if (blockyCache.has(key)) return blockyCache.get(key);
  let h = 0; for (const ch of seed) h = (h * 131 + ch.charCodeAt(0)) >>> 0;
  const r = (n) => { h = (h * 1103515245 + 12345) >>> 0; return h % n; };
  const shirts = ['#1d4ed8', '#dc2626', '#16a34a', '#9333ea', '#f97316', '#0891b2', '#111827', '#db2777', '#ca8a04'];
  const pants = ['#1e3a8a', '#14532d', '#111827', '#78350f', '#334155', '#4c1d95'];
  const skins = ['#f5c542', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  const box = (x, y, w, hh, col) => { const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, shade(col, 25)); gr.addColorStop(1, shade(col, -25)); g.fillStyle = gr; g.fillRect(x, y, w, hh); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 3; g.strokeRect(x, y, w, hh); };
  const shirt = shirts[r(shirts.length)], pant = pants[r(pants.length)], skin = skins[r(skins.length)];
  box(186, 300, 66, 170, pant); box(260, 300, 66, 170, pant);
  box(176, 170, 160, 140, shirt);
  box(116, 172, 58, 136, r(2) ? shirt : skin); box(338, 172, 58, 136, r(2) ? shirt : skin);
  box(206, 60, 100, 104, skin);
  // Rosto: foto da pessoa ou a carinha clássica
  const face = () => { g.fillStyle = '#111'; g.fillRect(232, 98, 12, 16); g.fillRect(268, 98, 12, 16); g.beginPath(); g.lineWidth = 6; g.strokeStyle = '#111'; g.arc(256, 120, 22, 0.2, Math.PI - 0.2); g.stroke(); };
  face();
  const url = { canvas: c, url: c.toDataURL() };
  if (faceUrl) {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { g.save(); g.beginPath(); g.rect(210, 64, 92, 96); g.clip(); g.drawImage(img, 206, 60, 100, 104); g.restore(); url.url = c.toDataURL(); url.onUpdate?.(); };
    img.src = proxImg(faceUrl);
  }
  blockyCache.set(key, url);
  return url;
}

// Boneco 3D de blocos no estilo R6 do Roblox, com a foto da pessoa no rosto e cores variadas por nick.
// Juntas: aL/aR (ombros) e lL/lR (quadris), para dançar e andar.
function makeBlocky3D(seed, faceUrl) {
  const T = THREE;
  let h = 0; for (const ch of String(seed)) h = (h * 131 + ch.charCodeAt(0)) >>> 0;
  const rnd = (n) => { h = (h * 1103515245 + 12345) >>> 0; return h % n; };
  const shirts = [0x1d4ed8, 0xdc2626, 0x16a34a, 0x9333ea, 0xf97316, 0x0891b2, 0x111827, 0xdb2777, 0xca8a04, 0xf8fafc];
  const pants = [0x1e3a8a, 0x14532d, 0x111827, 0x78350f, 0x334155, 0x4c1d95, 0x9ca3af];
  const skins = [0xf5c542, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
  const shirt = shirts[rnd(shirts.length)], pant = pants[rnd(pants.length)], skin = skins[rnd(skins.length)];
  const mat = (c) => new T.MeshStandardMaterial({ color: c, roughness: 0.6 });
  const root = new T.Group();
  const add = (parent, w, hh, d, m, x, y, z) => { const o = new T.Mesh(new T.BoxGeometry(w, hh, d), m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const torso = add(root, 1.0, 1.0, 0.5, mat(shirt), 0, 1.5, 0);
  const faceTex = G3.faceTex(faceUrl, seed);
  const headMats = [mat(skin), mat(skin), mat(skin), mat(skin), new T.MeshStandardMaterial({ map: faceTex, roughness: 0.6 }), mat(skin)];
  const head = new T.Mesh(new T.BoxGeometry(0.62, 0.62, 0.62), headMats); head.position.set(0, 2.33, 0); head.castShadow = true; root.add(head);
  const limb = (x, y, c) => { const pivot = new T.Group(); pivot.position.set(x, y, 0); root.add(pivot); add(pivot, 0.48, 1.0, 0.48, mat(c), 0, -0.5, 0); return pivot; };
  const armCol = rnd(2) ? shirt : skin;
  const aL = limb(0.74, 2.0, armCol), aR = limb(-0.74, 2.0, armCol), lL = limb(0.26, 1.0, pant), lR = limb(-0.26, 1.0, pant);
  return { root, torso, head, aL, aR, lL, lR };
}
// Passos de dança para o boneco de blocos (t em segundos).
function danceBlocky(b, t, style = 0) {
  const s = Math.sin(t * 6), c = Math.cos(t * 6);
  if (style === 0) { b.aL.rotation.set(s * 0.8, 0, 0.3); b.aR.rotation.set(-s * 0.8, 0, -0.3); b.lL.rotation.x = -s * 0.3; b.lR.rotation.x = s * 0.3; b.root.position.y = Math.abs(c) * 0.15; b.torso.rotation.y = s * 0.15; }
  else if (style === 1) { b.aL.rotation.set(-2.6 + s * 0.4, 0, 0.2); b.aR.rotation.set(-2.6 - s * 0.4, 0, -0.2); b.lL.rotation.x = s * 0.4; b.lR.rotation.x = -s * 0.4; b.root.position.y = Math.abs(s) * 0.4; }
  else { b.aL.rotation.set(0, 0, 1.4 + s * 0.3); b.aR.rotation.set(0, 0, -1.4 - s * 0.3); b.lL.rotation.z = Math.max(0, s) * 0.5; b.lR.rotation.z = -Math.max(0, -s) * 0.5; b.root.position.y = Math.abs(c) * 0.25; }
}
// Ciclo de caminhada do boneco de blocos.
function walkBlocky(b, t, speed = 1) {
  const s = Math.sin(t * 7 * speed);
  b.aL.rotation.set(s * 0.7, 0, 0.05); b.aR.rotation.set(-s * 0.7, 0, -0.05);
  b.lL.rotation.set(-s * 0.7, 0, 0); b.lR.rotation.set(s * 0.7, 0, 0);
  b.root.position.y = Math.abs(Math.cos(t * 7 * speed)) * 0.08;
}
