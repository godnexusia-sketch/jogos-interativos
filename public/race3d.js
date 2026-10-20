'use strict';

// Motor de corrida 3D: pista fechada, voltas, poderes por presente, câmera atrás do líder e minimapa.
// Cada tema (Kart, Cidade) define o cenário e o veículo; a lógica é a mesma.
// Presentes: 🌹 nitro · 🍩 nitro + pedra · 🕶️ míssil teleguiado · 🌌 raio.
const RACE_MAX = 12;

function makeRace3D(opt) {
  return {
  id: opt.id,
  meterY: opt.meterY,
  name: opt.name,
  icon: opt.icon,
  help: opt.help,
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
  sample() { return this.phase === 'race' ? pick(['vai!', 'acelera', 'bora']) : opt.joinWord; },
  kart(id) { return this.karts.find((k) => k.id === id); },
  ranked() { return [...this.karts].sort((a, b) => b.s - a.s); },
  addLog(user, msg, color = '#fff') { this.log.unshift({ user, msg, color, t: 6 }); this.log.length = Math.min(this.log.length, 4); },

  // ---------- Cena 3D ----------
  init3d() {
    if (this.r || !THREE) return;
    const T = THREE;
    const renderer = G3.init();
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(58, W / H, 0.5, 1500);
    const { sun } = opt.env(T, scene, this);

    // Pista
    const curve = new T.CatmullRomCurve3(opt.track.map(([x, z]) => new T.Vector3(x * opt.trackScale, 0, z * opt.trackScale)), true, 'catmullrom', 0.5);
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
      g.fillStyle = opt.asphalt; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},.08)`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
      g.fillStyle = '#f5f5f5'; g.fillRect(124, 0, 8, 128);
    });
    asphalt.wrapS = asphalt.wrapT = T.RepeatWrapping;
    const road = new T.Mesh(ribbon(opt.trackW / 2, -opt.trackW / 2, 0.05, 16), new T.MeshLambertMaterial({ map: asphalt, side: T.DoubleSide }));
    road.receiveShadow = true; scene.add(road);
    const curbTex = opt.curb(T, this);
    curbTex.wrapS = curbTex.wrapT = T.RepeatWrapping;
    for (const side of [1, -1]) {
      const curb = new T.Mesh(ribbon(side * opt.trackW / 2, side * (opt.trackW / 2 + opt.curbW), 0.12, 3), new T.MeshLambertMaterial({ map: curbTex, side: T.DoubleSide }));
      curb.receiveShadow = true; scene.add(curb);
    }
    // Linha de largada e pórtico
    const checker = this.canvasTex(128, 32, (g) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 8, y * 8, 8, 8); } });
    const line = new T.Mesh(new T.PlaneGeometry(opt.trackW, 3), new T.MeshLambertMaterial({ map: checker }));
    line.rotation.x = -Math.PI / 2; line.position.set(pts[0].x, 0.15, pts[0].z); line.rotation.z = Math.atan2(tan[0].x, tan[0].z) + Math.PI / 2;
    scene.add(line);
    const boxes = opt.decor(T, scene, { pts, tan, nor, N, L, ribbon }, this);
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
    const { g, wheels, flame, helmet } = opt.vehicle(T, k);
    // Foto e @ em cima do kart
    const face = document.createElement('canvas'); face.width = face.height = 256;
    const faceTex = new T.CanvasTexture(face); faceTex.colorSpace = T.SRGBColorSpace;
    // Tamanho fixo na tela (não cresce quando o kart chega perto da câmera)
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: faceTex, depthTest: false, sizeAttenuation: false }));
    sprite.center.set(0.5, 0); sprite.position.set(0, opt.tagY, 0); sprite.renderOrder = 10; g.add(sprite);
    const tag = document.createElement('canvas'); tag.width = 512; tag.height = 96;
    const tagTex = new T.CanvasTexture(tag); tagTex.colorSpace = T.SRGBColorSpace;
    const tagSprite = new T.Sprite(new T.SpriteMaterial({ map: tagTex, depthTest: false, sizeAttenuation: false }));
    tagSprite.center.set(0.5, -3.1); tagSprite.position.set(0, opt.tagY, 0); tagSprite.renderOrder = 11; g.add(tagSprite);
    const drawFace = (img) => {
      const c = face.getContext('2d');
      c.clearRect(0, 0, 256, 256);
      c.save(); c.beginPath(); c.arc(128, 128, 112, 0, 7); c.closePath();
      if (img) { c.clip(); c.drawImage(img, 16, 16, 224, 224); } else { c.fillStyle = k.color; c.fill(); c.fillStyle = '#fff'; c.font = '900 120px Barlow'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText((k.user.nick || '?')[0].toUpperCase(), 128, 136); }
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
      c.fillStyle = rank <= 3 ? '#111' : '#fff'; c.font = '900 40px Barlow'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(rank), 44, 50);
      c.fillStyle = '#fff'; c.font = '800 40px Barlow'; c.textAlign = 'left'; c.fillText(`@${trim(k.user.nick, 14)}`, 90, 50);
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
    const entry = { id, user: ev.user, color: opt.colors[(this.karts.length + this.next.length) % opt.colors.length] };
    if (this.phase === 'race' || this.phase === 'finish') { if (this.next.length < RACE_MAX) this.next.push(entry); return; }
    if (this.karts.length >= RACE_MAX) return;
    this.addKart(entry);
    sfx.pop();
    this.addLog(ev.user, 'entrou na corrida', '#25f4ee');
    if (this.karts.length >= 2 && this.phase === 'lobby') { this.phase = 'countdown'; this.timer = 25; }
  },
  addKart(entry) {
    const n = this.karts.length;
    // Grid de largada: duas filas, atrás da linha
    const k = { ...entry, s: -6 - Math.floor(n / 2) * 7, off: n % 2 ? -3.5 : 3.5, targetOff: 0, speed: rand(opt.speed - 1, opt.speed + 1), boost: 0, stun: 0, spin: 0, shrink: 0, wheelRot: 0, offT: rand(2, 5), lap: 0 };
    k.targetOff = k.off;
    this.karts.push(k);
    if (this.r) this.buildKart(k);
  },
  onEvent(ev) {
    const id = uid(ev);
    if (ev.type === 'chat') {
      const t = ev.text.trim().toLowerCase();
      if (opt.joinRe.test(t)) return this.join(ev);
      const k = this.kart(id);
      if (k && this.phase === 'race' && this.cd.ok(id)) k.s += 1.5;
    } else if (ev.type === 'like') {
      const k = this.kart(id);
      if (k && this.phase === 'race') k.s += Math.min(4, 0.3 * ev.count);
    } else if (ev.type === 'social') {
      let k = this.kart(id);
      if (!k && this.phase !== 'race' && this.phase !== 'finish') { this.join(ev); k = this.kart(id); }
      if (!k) return;
      k.boost = Math.min(14, k.boost + (isFollow(ev) ? 2 : 3));
      if (!isFollow(ev) && this.phase === 'race') this.dropRock(k.s - 5, k.off, ev.user);
      this.addLog(ev.user, isFollow(ev) ? 'seguiu: NITRO 2s' : 'compartilhou: NITRO + pedra', '#60a5fa');
    } else if (ev.type === 'gift') {
      if (this.phase !== 'race') { if (this.phase !== 'finish') this.join(ev); const k = this.kart(id); if (k) { k.boost = Math.min(10, 1 + giftPower(ev) * 0.6); this.addLog(ev.user, `largou com NITRO de ${k.boost.toFixed(0)}s guardado`, '#60a5fa'); } return; }
      this.power(ev);
    }
  },
  // Tudo proporcional às moedas: p = força (log), q = quantidade (raiz)
  power(ev) {
    const me = this.kart(uid(ev));
    const tier = giftTier(ev), p = giftPower(ev), q = giftQty(ev, 40);
    const order = this.ranked();
    const leader = order[0];
    if (!me) {
      // Fora da corrida: ataca o líder (mais moedas, mais ataques)
      const n = clamp(Math.round(p / 3), 1, 6);
      for (let k = 0; k < n; k++) { if (tier >= 3) this.fire(null, order[k % Math.min(3, order.length)], ev.user); else this.dropRock(leader.s + 18 + k * 6, leader.off + rand(-2, 2), ev.user); }
      this.addLog(ev.user, `atacou o líder @${trim(leader.user.nick, 10)}${n > 1 ? ' ×' + n : ''}`, '#ff8a3d');
      return;
    }
    if (tier >= 2) this.setFocus(me, 2 + p * 0.25);
    if (tier === 1) { const secs = 1 + p * 0.8; me.boost = Math.min(14, me.boost + secs); this.addLog(ev.user, `usou NITRO ${secs.toFixed(0)}s`, '#60a5fa'); }
    else if (tier === 2) {
      const rocks = 1 + Math.floor(q / 4);
      me.boost = Math.min(14, me.boost + 2 + p * 0.5);
      for (let k = 0; k < rocks; k++) this.dropRock(me.s - 5 - k * 5, me.off + (k ? rand(-3, 3) : 0), ev.user);
      this.addLog(ev.user, `NITRO + ${rocks} PEDRA${rocks > 1 ? 'S' : ''} na pista`, '#a8a29e');
    } else if (tier === 3) {
      const i = order.indexOf(me), n = clamp(Math.round(p / 3.5), 1, 4);
      const targets = order.slice(Math.max(0, i - n), i).reverse();
      if (!targets.length) targets.push(order[i + 1]);
      targets.forEach((t) => this.fire(me, t, ev.user));
      me.boost = Math.max(me.boost, 2 + p * 0.3);
      this.addLog(ev.user, `lançou ${targets.length > 1 ? targets.length + ' MÍSSEIS' : 'um MÍSSIL'}${targets[0] ? ' em @' + trim(targets[0].user.nick, 10) : ''}`, '#f43f5e');
    } else {
      const secs = 3 + p * 0.4;
      for (const k of this.karts) if (k !== me) { k.shrink = secs; k.stun = Math.max(k.stun, 0.6 + p * 0.06); k.spin = 1; }
      me.boost = Math.max(me.boost, 3 + p * 0.45);
      if (p >= 13) for (const t of order.filter((k) => k !== me).slice(0, 3)) this.fire(me, t, ev.user); // 10.000+ 🪙: raio + mísseis
      this.flash = 0.6;
      sfx.boom();
      announcer.show(`⚡ RAIO de @${trim(ev.user.nick, 12)}`, '#facc15', 2.5, 54);
      this.addLog(ev.user, `chamou o RAIO: todo mundo encolheu ${secs.toFixed(0)}s!`, '#facc15');
      this.setFocus(me, 5);
    }
  },
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
        if (k.offT <= 0) { k.offT = rand(2, 5); k.targetOff = rand(-opt.trackW / 2 + 2.2, opt.trackW / 2 - 2.2); }
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
      if (lead && lead.s >= opt.laps * L) {
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
      title(opt.title, W / 2, H / 2 - 30, 60, opt.accent);
      text(THREE ? 'Montando a pista…' : 'Carregando o 3D…', W / 2, H / 2 + 40, 28, '#ddd', 'center', 700);
      three3dReady.then(() => this.init3d());
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
    const want = tp.clone().addScaledVector(tt, -18 * close).add(new T.Vector3(0, 7.5 * close, 0));
    r.camPos.lerp(want, 0.08);
    r.camLook.lerp(tp.clone().addScaledVector(tt, 16).add(new T.Vector3(0, 1, 0)), 0.12);
    r.camera.position.copy(r.camPos);
    r.camera.lookAt(r.camLook);
    r.sun.position.copy(tp).add(new T.Vector3(40, 80, 30));
    r.sun.target.position.copy(tp);
    G3.render(r.scene, r.camera);
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,220,${this.flash})`; ctx.fillRect(0, 0, W, H); }
    this.drawHud(order);
    if (this.phase === 'finish') this.drawPodium();
  },
  drawHud(order) {
    const L = this.r.L;
    panel(16, 16, W - 32, 76, { r: 16, from: 'rgba(15,18,30,.88)', to: 'rgba(5,6,12,.88)' });
    title(opt.title, 34, 54, 28, opt.accent, 'left');
    const lead = order[0];
    const lap = lead ? clamp(lead.lap + 1, 1, opt.laps) : 1;
    label('VOLTA', 300, 40, 13, '#9aa0b4', 'center', 900);
    num(`${lap}/${opt.laps}`, 300, 66, 34, '#fff');
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
      title(this.phase === 'lobby' ? opt.cta : `LARGADA EM ${Math.ceil(this.timer)}s`, W / 2, 1100, 30, opt.accent);
      label(`${this.karts.length}/${RACE_MAX} pilotos${this.phase === 'lobby' ? ' · mínimo 2' : ' · ainda dá tempo de entrar'}`, W / 2, 1142, 18, '#ddd', 'center', 800);
    } else {
      // Legenda dos poderes
      panel(16, 1196, W - 32, 64, { r: 16, from: 'rgba(15,18,30,.88)', to: 'rgba(5,6,12,.88)' });
      const pw = [['1+', 'NITRO'], ['10+', 'PEDRA'], ['100+', 'MÍSSIL'], ['1000+', 'RAIO']];
      pw.forEach(([e, n], i) => { const x = 30 + i * 172; label(e + ' 🪙', x + 4, 1219, 13, 'rgba(255,255,255,.6)', 'left', 800); label(n, x + 4, 1241, 18, '#fff', 'left', 900); });
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
  };
}
