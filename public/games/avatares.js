'use strict';

// Palco Roblox 3D: quem comenta o nick do Roblox entra dançando com o avatar real num palco de show.
// Quem manda presente ganha a foto do TikTok flutuando em cima da cabeça do avatar e um efeito maior.
const STAGE_MAX = 25;
const GIFT_RING = ['#ffffff', '#ffc93c', '#ff2e63', '#00e5ff', '#a3e635'];

registerGame({
  id: 'avatares',
  name: 'Palco Roblox',
  icon: '🕺',
  help: '<p>Comente o seu <b>nick do Roblox</b> (só o nick, ou <b>!nick seunick</b>) e o seu avatar entra dançando no palco.</p><p>Quem manda presente ganha a sua foto em cima da cabeça do avatar.</p><p>1–9 🪙 fica mais tempo no palco · 10–99 🪙 cresce (2× a 2,8×) e a câmera vai nele · 100–999 🪙 Furacão que gira todo mundo (12 a 18s) · 1.000+ 🪙 Chuva de 32 a 48 avatares seus. Quanto mais moedas, maior e por mais tempo. ❤️ Likes e comentários fazem o seu avatar dançar mais animado · ⭐ seguir e 🔁 compartilhar põem o ícone na cabeça.</p>' + TIER_HELP + '',
  reset() {
    if (this.r) for (const d of this.dancers || []) this.r.scene.remove(d.obj);
    for (const r of this.rain || []) this.r?.scene.remove(r.obj);
    this.dancers = [];
    this.rain = [];
    this.focus = null; this.focusT = 0;
    this.storm = 0;
    this.log = [];
    this.known = this.known || new Map();
  },
  sample: () => pick(['builderman', 'Roblox', 'oi', 'kkk']),
  addLog(user, msg, color = '#fff') { this.log.unshift({ user, msg, color, t: 5 }); this.log.length = Math.min(this.log.length, 3); },
  dancer(id) { return this.dancers.find((d) => d.id === id); },
  // pw = força do presente (giftPower): tempo no palco e tamanho crescem com as moedas
  place(id, user, rbx, tier = 0, pw = 0) {
    let d = this.dancer(id);
    const ttl = tier ? Math.round(60 + pw * 25) : 45;
    if (!d) {
      if (this.dancers.length >= STAGE_MAX) { const old = this.dancers.shift(); this.r?.scene.remove(old.obj); }
      d = { id, user, rbx, size: 1, ttl, tier: 0, phase: rand(0, 6), born: 0, gifted: false };
      this.dancers.push(d);
      if (this.r) this.buildDancer(d);
      sfx.pop();
    }
    if (rbx && !d.rbx) { d.rbx = rbx; if (this.r) { this.r.scene.remove(d.obj); this.buildDancer(d); } }
    d.ttl = Math.max(d.ttl, ttl);
    d.tier = Math.max(d.tier, tier);
    if (tier >= 2) d.size = Math.max(d.size, Math.min(4.2, 1 + pw * 0.27)); else if (tier) d.size = Math.max(d.size, 1.2);
    if (tier > 0 && !d.gifted && this.r) { d.gifted = true; this.addGiftIcon(d); }
    return d;
  },
  async onEvent(ev) {
    const id = uid(ev);
    if (ev.type === 'chat') {
      const m = ev.text.trim().match(/^!nick\s+@?([A-Za-z0-9_]{3,20})$/i);
      const nick = m ? m[1] : looksLikeNick(ev.text) ? ev.text.trim().replace(/^@/, '') : null;
      if (!nick) { const d = this.dancer(id); if (d) { d.ttl = Math.max(d.ttl, 20); d.hype = Math.min(3, (d.hype || 0) + 0.6); } return; }
      const rbx = await robloxLookup(nick);
      if (!rbx) { if (m) this.addLog(ev.user, `nick "${trim(nick, 12)}" não existe no Roblox`, '#ff8a3d'); return; }
      this.known.set(id, rbx);
      this.place(id, ev.user, rbx);
      this.addLog(ev.user, `entrou como ${trim(rbx.name, 14)}`, '#00e5ff');
    } else if (ev.type === 'like') {
      const d = this.dancer(id);
      if (d) { d.ttl += Math.min(30, ev.count); d.hype = Math.min(3, (d.hype || 0) + ev.count * 0.1); }
    } else if (ev.type === 'social') {
      const d = this.place(id, ev.user, this.known.get(id) || null, 1, giftPower({ diamonds: SOCIAL_COINS[isFollow(ev) ? 'follow' : 'share'] }));
      d.hype = 3;
      this.addLog(ev.user, isFollow(ev) ? 'seguiu e subiu no palco' : 'compartilhou e subiu no palco', '#ffd23f');
    } else if (ev.type === 'gift') {
      const tier = giftTier(ev), pw = giftPower(ev);
      const d = this.place(id, ev.user, this.known.get(id) || null, tier, pw);
      d.hype = 3;
      this.addLog(ev.user, ['', 'brilhou no palco', 'virou destaque', 'chamou o FURACÃO', 'fez CHOVER avatares'][tier], GIFT_RING[tier]);
      if (tier >= 2) { this.focus = d; this.focusT = 3 + pw * 0.5; }
      if (tier === 3) { this.storm = 4 + pw; sfx.boom(); announcer.show('FURACÃO', '#00e5ff', 2, 80); }
      if (tier === 4) {
        for (let k = 0, n = giftQty(ev, 48); k < n; k++) this.rain.push({ d, x: rand(-7, 7), z: rand(-4, 3), y: 14 + k * 1.2, vy: rand(3, 5), rot: rand(-1, 1) });
        if (this.r) for (const r of this.rain) if (!r.obj) { r.obj = new THREE.Sprite(new THREE.SpriteMaterial({ map: d.tex, transparent: true })); r.obj.center.set(0.5, 0); r.obj.scale.set(2.4, 2.4, 1); this.r.scene.add(r.obj); }
        announcer.show(`@${trim(ev.user.nick, 12)}`, '#a3e635', 2.5, 60);
        sfx.win();
      }
    }
  },

  // ---------- Cena 3D: palco de show ----------
  init3d() {
    if (this.r || !THREE) return;
    const T = THREE;
    const scene = new T.Scene();
    scene.background = new T.Color(0x05040b);
    scene.fog = new T.Fog(0x05040b, 18, 60);
    const camera = new T.PerspectiveCamera(46, W / H, 0.1, 200);
    scene.add(new T.HemisphereLight(0x8899ff, 0x220022, 0.55));
    const key = new T.DirectionalLight(0xffffff, 1.2); key.position.set(0, 10, 12); scene.add(key);
    // Piso do palco com grade de LED
    const floorTex = G3.tex(512, 512, (g) => {
      g.fillStyle = '#0b0b14'; g.fillRect(0, 0, 512, 512);
      for (let x = 0; x < 512; x += 64) for (let y = 0; y < 512; y += 64) { g.fillStyle = (x + y) % 128 ? '#141428' : '#1b1b38'; g.fillRect(x + 2, y + 2, 60, 60); }
    }, [6, 4]);
    const floor = new T.Mesh(new T.BoxGeometry(24, 1, 14), new T.MeshStandardMaterial({ map: floorTex, roughness: 0.25, metalness: 0.6 }));
    floor.position.set(0, -0.5, -1); floor.receiveShadow = true; scene.add(floor);
    const edge = new T.Mesh(new T.BoxGeometry(24.2, 0.12, 0.12), new T.MeshBasicMaterial({ color: 0xff2e63 }));
    edge.position.set(0, 0.02, 6); scene.add(edge);
    // Telão de LED animado
    const ledC = document.createElement('canvas'); ledC.width = 512; ledC.height = 256;
    const ledTex = new T.CanvasTexture(ledC); ledTex.colorSpace = T.SRGBColorSpace;
    const led = new T.Mesh(new T.PlaneGeometry(22, 11), new T.MeshBasicMaterial({ map: ledTex }));
    led.position.set(0, 6, -8); scene.add(led);
    // Treliça com moving heads
    const truss = new T.Mesh(new T.BoxGeometry(24, 0.5, 0.5), new T.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.8, roughness: 0.3 }));
    truss.position.set(0, 12, 0); scene.add(truss);
    const heads = [];
    const cols = [0xff2e63, 0x00e5ff, 0xa3e635, 0xffc93c, 0xff2e63, 0x00e5ff];
    cols.forEach((c, i) => {
      const x = -10 + i * 4;
      const g = new T.Group(); g.position.set(x, 11.6, 0); scene.add(g);
      const beam = new T.Mesh(new T.ConeGeometry(2.4, 16, 20, 1, true), new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.12, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
      beam.position.y = -8; g.add(beam);
      const sp = new T.SpotLight(c, 160, 30, 0.35, 0.6, 1.5); sp.position.set(0, 0, 0); g.add(sp); sp.target.position.set(0, -12, 0); g.add(sp.target);
      heads.push(g);
    });
    // Lasers
    const lasers = [];
    for (let i = 0; i < 8; i++) {
      const l = new T.Mesh(new T.BoxGeometry(0.05, 0.05, 40), new T.MeshBasicMaterial({ color: i % 2 ? 0x00e5ff : 0xa3e635, transparent: true, opacity: 0.55, blending: T.AdditiveBlending }));
      l.position.set(i < 4 ? -11 : 11, 0.3, -6); scene.add(l); lasers.push(l);
    }
    // Público em silhueta com celulares acesos
    const crowd = G3.tex(1024, 256, (g) => {
      g.clearRect(0, 0, 1024, 256);
      for (let i = 0; i < 70; i++) { const x = i * 15 + Math.random() * 8, y = 120 + Math.random() * 40; g.fillStyle = '#000'; g.beginPath(); g.arc(x, y, 18, 0, 7); g.fill(); g.fillRect(x - 22, y + 14, 44, 140); }
    });
    const crowdM = new T.Mesh(new T.PlaneGeometry(26, 6.5), new T.MeshBasicMaterial({ map: crowd, transparent: true }));
    crowdM.position.set(0, 1.4, 10.5); scene.add(crowdM);
    // Fumaça
    const smokeTex = G3.tex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64); gr.addColorStop(0, 'rgba(180,170,255,.35)'); gr.addColorStop(1, 'rgba(180,170,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
    const smoke = [];
    for (let i = 0; i < 14; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0.6 })); s.position.set(rand(-12, 12), rand(0.5, 2.5), rand(-5, 5)); s.scale.set(8, 5, 1); scene.add(s); smoke.push(s); }
    this.r = { scene, camera, led: { c: ledC, tex: ledTex, t: 0 }, heads, lasers, smoke, cam: new T.Vector3(0, 6, 22), look: new T.Vector3(0, 2.5, 0) };
    for (const d of this.dancers) this.buildDancer(d);
  },
  buildDancer(d) {
    const T = THREE;
    const g = new T.Group();
    if (d.rbx?.img) {
      // Avatar real do Roblox (imagem oficial de corpo inteiro)
      d.tex = G3.imageTex(d.rbx.img);
      const body = new T.Sprite(new T.SpriteMaterial({ map: d.tex, transparent: true }));
      body.center.set(0.5, 0.02); body.scale.set(3.4, 3.4, 1);
      g.add(body); d.body = body;
    } else {
      // Sem nick: boneco 3D de blocos no estilo Roblox, com a foto da pessoa no rosto
      d.blocky = makeBlocky3D(d.user.nick, d.user.pic);
      d.blocky.root.scale.setScalar(1.05);
      g.add(d.blocky.root);
      d.tex = G3.imageTex(null, blockyAvatar(d.user.nick).url);
    }
    const shadow = new T.Mesh(new T.CircleGeometry(0.9, 24), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; g.add(shadow);
    const tag = G3.label(trim(d.rbx?.name || d.user.nick, 14), { scale: 0.13, border: d.rbx ? '#00e5ff' : 'rgba(255,255,255,.3)' });
    tag.center.set(0.5, 0); tag.position.set(0, 3.3, 0); g.add(tag);
    d.obj = g; d.tag = tag;
    this.r.scene.add(g);
    if (d.gifted) this.addGiftIcon(d);
  },
  // Foto do TikTok de quem mandou presente, em cima da cabeça do avatar
  addGiftIcon(d) {
    const T = THREE;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
    const paint = (img) => {
      const g = c.getContext('2d'); g.clearRect(0, 0, 256, 256);
      g.save(); g.beginPath(); g.arc(128, 116, 96, 0, 7); g.clip(); g.drawImage(img, 32, 20, 192, 192); g.restore();
      g.lineWidth = 14; g.strokeStyle = GIFT_RING[d.tier]; g.beginPath(); g.arc(128, 116, 100, 0, 7); g.stroke();
      g.fillStyle = GIFT_RING[d.tier]; g.beginPath(); g.moveTo(108, 214); g.lineTo(148, 214); g.lineTo(128, 246); g.fill();
      t.needsUpdate = true;
    };
    const f = new Image(); f.onload = () => paint(f); f.src = fakeFace(d.user.nick);
    if (d.user.pic) { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => paint(img); img.src = proxImg(d.user.pic); }
    const icon = new T.Sprite(new T.SpriteMaterial({ map: t, depthTest: false, sizeAttenuation: false }));
    icon.center.set(0.5, -0.55); icon.scale.set(0.075, 0.075, 1); icon.position.set(0, 3.3, 0); icon.renderOrder = 21;
    d.obj.add(icon); d.icon = icon;
  },
  slot(i, n) {
    // Tela vertical é estreita: fileiras de 3, indo para o fundo do palco.
    const perRow = 3, row = Math.floor(i / perRow), col = i % perRow;
    const inRow = Math.min(perRow, n - row * perRow);
    return { x: (col - (inRow - 1) / 2) * 2.5 + (row % 2) * 0.6, z: 3.5 - row * 2.4 };
  },
  update(dt) {
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    for (const d of this.dancers) { d.ttl -= dt; d.born += dt; d.hype = Math.max(0, (d.hype || 0) - dt * 0.5); }
    for (const d of this.dancers.filter((d) => d.ttl <= 0)) this.r?.scene.remove(d.obj);
    this.dancers = this.dancers.filter((d) => d.ttl > 0);
    this.storm = Math.max(0, this.storm - dt);
    this.focusT = Math.max(0, this.focusT - dt);
    if (this.focusT <= 0 || !this.dancers.includes(this.focus)) this.focus = null;
    for (const r of this.rain) { r.y -= r.vy * dt; r.rot += dt; }
    for (const r of this.rain.filter((r) => r.y < -3)) this.r?.scene.remove(r.obj);
    this.rain = this.rain.filter((r) => r.y >= -3);
  },
  drawLed(t) {
    const L = this.r.led;
    if (t - L.t < 0.08) return;
    L.t = t;
    const g = L.c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 512, 256);
    gr.addColorStop(0, `hsl(${(t * 40) % 360},90%,25%)`); gr.addColorStop(1, `hsl(${(t * 40 + 120) % 360},90%,18%)`);
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 32; i++) { const h = (Math.sin(t * 6 + i * 0.7) * 0.5 + 0.5) * (0.4 + 0.6 * Math.abs(Math.sin(t * 2.3 + i))) * 180; g.fillStyle = `hsl(${(i * 11 + t * 60) % 360},95%,60%)`; g.fillRect(i * 16 + 2, 256 - h, 12, h); }
    g.fillStyle = 'rgba(255,255,255,.9)'; g.font = 'italic 900 34px "Barlow Condensed", Impact'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('AO VIVO · PALCO ROBLOX', 256, 34);
    L.tex.needsUpdate = true;
  },
  draw() {
    if (!this.r) {
      this.init3d();
      background('#05040b', '#1a0b2e');
      title('PALCO ROBLOX', W / 2, H / 2 - 20, 64, '#fff');
      text('Montando o palco…', W / 2, H / 2 + 40, 26, '#c4b5fd', 'center', 700);
      three3dReady.then(() => this.init3d());
      return;
    }
    const T = THREE, t = performance.now() / 1000, r = this.r;
    this.drawLed(t);
    r.heads.forEach((h, i) => { h.rotation.z = Math.sin(t * 0.9 + i) * 0.55; h.rotation.x = Math.cos(t * 0.7 + i * 1.3) * 0.35; });
    r.lasers.forEach((l, i) => { l.rotation.y = Math.sin(t * 0.8 + i) * 0.6 + (i < 4 ? 0.4 : -0.4); l.rotation.x = Math.sin(t * 1.3 + i) * 0.15 - 0.05; });
    r.smoke.forEach((s, i) => { s.position.x += Math.sin(t * 0.2 + i) * 0.01; s.material.opacity = 0.35 + Math.sin(t + i) * 0.15; });
    const n = this.dancers.length;
    this.dancers.forEach((d, i) => {
      const p = this.slot(i, n);
      let x = p.x, z = p.z, spin = 0;
      if (this.storm > 0 && d.tier < 3) { const a = t * 2.4 + i; x = Math.cos(a) * (3 + (i % 5)); z = Math.sin(a) * 2.5; spin = a; }
      const grow = Math.min(1, d.born * 3);
      const s = d.size * (0.4 + 0.6 * grow);
      // Dança: pulinho, balanço e passo de lado; quem mandou presente grande dança mais forte
      const bpm = d.tier >= 2 ? 8 : 5.5;
      const hype = 1 + (d.hype || 0) * 0.45;
      const hop = Math.abs(Math.sin(t * bpm * (1 + (d.hype || 0) * 0.15) + d.phase)) * (d.tier >= 2 ? 0.6 : 0.3) * hype;
      d.obj.position.set(x + Math.sin(t * 2 + d.phase) * (d.tier >= 2 ? 0.6 : 0.25), hop, z);
      d.obj.scale.setScalar(s);
      if (d.body) {
        d.body.material.rotation = Math.sin(t * bpm * 0.5 + d.phase) * (d.tier >= 2 ? 0.22 : 0.12) + spin * 0.2;
        const flip = Math.sin(t * 1.6 + d.phase) > 0.85 ? -1 : 1;
        d.body.scale.set(3.4 * flip * (1 + Math.sin(t * bpm * 2) * 0.03), 3.4 * (1 - Math.sin(t * bpm * 2) * 0.03), 1);
      } else {
        danceBlocky(d.blocky, t + d.phase, d.tier >= 2 ? 1 + (Math.floor(t / 4 + d.phase) % 2) : Math.floor(t / 5 + d.phase) % 3 === 2 ? 2 : 0);
        d.blocky.root.rotation.y = spin + Math.sin(t * 0.8 + d.phase) * 0.4;
      }
    });
    for (const rr of this.rain) if (rr.obj) { rr.obj.position.set(rr.x, rr.y, rr.z); rr.obj.material.rotation = rr.rot; }
    // Câmera: frente do palco; com destaque, aproxima de quem mandou presente
    const f = this.focus;
    const want = f ? new T.Vector3(f.obj.position.x * 0.8, 3.5 + f.size * 0.6, f.obj.position.z + 9 + f.size) : new T.Vector3(Math.sin(t * 0.15) * 2, 5, 16.5);
    const look = f ? new T.Vector3(f.obj.position.x, 1.2 + f.size * 1.2, f.obj.position.z) : new T.Vector3(0, 2.6, 0);
    r.cam.lerp(want, 0.05); r.look.lerp(look, 0.08);
    r.camera.position.copy(r.cam); r.camera.lookAt(r.look);
    G3.render(r.scene, r.camera);
    this.drawHud(n);
  },
  drawHud(n) {
    slant(16, 22, W - 32, 112, { fill: 'rgba(8,6,20,.85)', skew: 14, border: 'rgba(255,255,255,.18)' });
    title('COMENTE SEU NICK DO ROBLOX', W / 2, 62, 40, '#fff');
    label(`${n}/${STAGE_MAX} no palco  ·  quem manda presente aparece com a foto em cima`, W / 2, 104, 16, 'rgba(255,255,255,.75)', 'center', 700);
    if (this.focus) { slant(W / 2 - 170, 150, 340, 48, { fill: 'rgba(255,46,99,.9)', skew: 10 }); title(`DESTAQUE: ${trim(this.focus.rbx?.name || this.focus.user.nick, 14).toUpperCase()}`, W / 2, 175, 26, '#fff'); }
    if (!n) { slant(80, 560, W - 160, 120, { fill: 'rgba(8,6,20,.85)', skew: 14, border: '#00e5ff' }); title('O PALCO ESTÁ ESPERANDO', W / 2, 600, 38, '#fff'); label('Comente o seu nick do Roblox para dançar aqui', W / 2, 644, 18, '#c4f1ff', 'center', 700); }
    this.log.forEach((l, k) => toast(l.user, trim(`@${trim(l.user.nick, 12)} ${l.msg}`, 36), 20, 1130 + k * 44, { color: l.color, alpha: clamp(l.t, 0, 1), size: 17 }));
  },
});
