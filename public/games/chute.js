'use strict';

// Bola no Ursinho: um personagem (pode ser a sua foto) segura um ursinho de pelúcia. Presentes lançam bolas nele.
// O ursinho tem barra de vida; quando zera, a rodada acaba e recomeça sozinha.

// Seletor do personagem 3D em cada item da tela Configurar (usado aqui e no Combate).
// def(i) dá o padrão do item; a escolha fica em cfg.items[i].kind e é salva junto com o resto.
function charKindSelects(el, cfg, label, def) {
  const add = () => el.querySelectorAll('.cand').forEach((box, i) => {
    if (box.querySelector('[data-kind]') || !cfg.items[i]) return;
    const l = document.createElement('label');
    l.innerHTML = `${label} <select data-kind>${ALL_KINDS.map((k) => `<option value="${k}">${CHARACTERS[k].name}</option>`).join('')}</select>`;
    const sel = l.querySelector('select');
    sel.value = CHARACTERS[cfg.items[i].kind] ? cfg.items[i].kind : def(i);
    sel.addEventListener('change', () => { cfg.items[i].kind = sel.value; });
    box.querySelector('.fields')?.append(l);
  });
  add();
  // A lista é redesenhada ao trocar foto/adicionar: recoloca os seletores
  el._kindObs?.disconnect();
  el._kindObs = new MutationObserver(add); el._kindObs.observe(el, { childList: true });
}

registerGame(withConfig({
  id: 'chute',
  meterY: 900, // posição do medidor de presentes (livre de HUD)
  name: 'Bola no Ursinho',
  icon: '⚽',
  help: '<p>Comente <b>chuta</b> para lançar uma bola (1 a cada 4s); algumas erram.</p><p>1–9 🪙 1 a 3 bolas · 10–99 🪙 3 a 10 bolas · 100–999 🪙 3 a 4 bolas de fogo gigantes (5×) · 1.000+ 🪙 chuva de 30 a 60 bolas de ouro. ❤️ A cada 30 likes da live sai uma bola · ⭐ seguir 1 bola · 🔁 compartilhar 3.</p>' + TIER_HELP + '<p>Quando a vida do ursinho zera, a rodada acaba. Ponha a foto do personagem em <b>Configurar</b>.</p>',
  cd: new Cooldown(4000),
  kickers: new Map(),
  round: 1,
  reset() {
    this.life = this.config.life;
    this.balls = [];
    this.pending = [];
    this.hits = 0;
    this.gray = 0;
    this.shake = 0;
    this.booms = [];
    this.phase = 'play';
    this.endT = 0;
    this.lastGift = null;
  },
  renderSettings(el, save) {
    renderItemsSettings(el, structuredClone(this.config), {
      min: 1, max: 1, itemLabel: 'Nome do personagem',
      extras: [{ key: 'life', label: 'Vida do ursinho', min: 10, max: 100000 }],
    }, (cfg) => { this.applyConfig(cfg); save(this.config); });
  },
  // Foto nova do personagem: remonta a cena 3D.
  applyConfig(cfg) { if (!cfg?.items?.length) return; this.config = cfg; store.set('cfg:chute', cfg); this.r = null; this.reset(); },
  sample: () => pick(['chuta', 'chuta!', 'gol']),
  kick(user, kind, delay = 0) { this.pending.push({ user, kind, at: delay }); },
  onEvent(ev) {
    if (this.phase !== 'play') return;
    if (ev.type === 'chat' && /chut|gol|⚽|bola/i.test(ev.text) && this.cd.ok(uid(ev))) this.kick(ev.user, 'normal');
    else if (ev.type === 'like') {
      // Likes da live inteira enchem a barra: a cada 30, uma bola de quem curtiu por último
      this.likes = (this.likes || 0) + ev.count;
      while (this.likes >= 30) { this.likes -= 30; this.kick(ev.user, 'normal'); }
    } else if (ev.type === 'social') {
      const n = isFollow(ev) ? 1 : 3;
      for (let k = 0; k < n; k++) this.kick(ev.user, 'gift', k * 0.3);
      this.lastGift = { user: ev.user, name: isFollow(ev) ? 'seguiu' : 'compartilhou', n, t: 4 };
    } else if (ev.type === 'gift') {
      // Número de bolas proporcional às moedas (raiz); fogo e ouro para valores altos
      const tier = giftTier(ev), q = giftQty(ev, 60), p = giftPower(ev);
      let n;
      if (tier <= 2) { n = q; for (let k = 0; k < n; k++) this.kick(ev.user, 'gift', k * 0.28); }
      else if (tier === 3) { n = Math.round(p / 2.5); for (let k = 0; k < n; k++) this.kick(ev.user, 'fire', k * 0.8); }
      else { n = q; for (let k = 0; k < n; k++) this.kick(ev.user, k % 10 === 0 ? 'fire' : 'gold', k * 0.15); }
      this.lastGift = { user: ev.user, name: ev.name, n, t: 6 };
      if (tier >= 3) announcer.show(`${tier === 4 ? '🌟' : '🔥'} @${trim(ev.user.nick, 12)}`, tier === 4 ? '#ffd23f' : '#ff8a3d', 2, 58);
    }
  },
  update(dt) {
    this.gray = Math.max(0, this.gray - dt);
    this.shake = Math.max(0, this.shake - dt);
    if (this.lastGift && (this.lastGift.t -= dt) <= 0) this.lastGift = null;
    for (const b of this.booms) b.t -= dt;
    this.booms = this.booms.filter((b) => b.t > 0);
    if (this.phase === 'over') { this.endT -= dt; if (this.endT <= 0) { this.round++; this.reset(); } return; }
    for (const p of this.pending) p.at -= dt;
    for (const p of this.pending.filter((p) => p.at <= 0)) this.launch(p);
    this.pending = this.pending.filter((p) => p.at > 0);
    for (const b of this.balls) {
      b.t += dt;
      if (b.t < b.dur || b.done) continue;
      b.done = true;
      const hp = this.r ? this.project(this.bearWorld()) : { x: W / 2, y: H / 2 };
      if (b.miss) { floatText('errou!', hp.x + (b.tx > 0.55 ? 120 : -120), hp.y - 60, '#fff', 26); continue; }
      const dmg = b.kind === 'fire' ? 5 : b.kind === 'gold' ? 2 : 1;
      this.life = Math.max(0, this.life - dmg);
      this.hits++;
      addScore(this.kickers, b.user.nick, dmg);
      this.gray = 0.16;
      this.shake = 0.35;
      this.booms.push({ t: 0.7, big: b.kind === 'fire', n: dmg });
      burst(hp.x, hp.y, b.kind === 'gold' ? ['#ffd23f', '#fff'] : b.kind === 'fire' ? ['#ff8a3d', '#fe2c55'] : ['#fff', '#c8a27a'], 22, 320);
      sfx.tone(b.kind === 'fire' ? 90 : 220, 0.12, 'square', 0.1);
      if (this.life <= 0) {
        this.phase = 'over'; this.endT = 9;
        this.balls = []; this.pending = [];
        sfx.win();
        for (let i = 0; i < 5; i++) setTimeout(() => burst(rand(100, W - 100), rand(250, 700), COLORS, 70, 550), i * 250);
        return;
      }
    }
    this.balls = this.balls.filter((b) => !b.done || (b.miss && b.t < b.dur + 0.4));
  },
  drawBear(x, y, s, hurt) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const fur = '#a4703f', light = '#d9a066', dark = '#6b4423';
    const ball = (bx, by, r, col) => { const g = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.3, r * 0.1, bx, by, r); g.addColorStop(0, shade(col, 30)); g.addColorStop(1, shade(col, -25)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill(); };
    ball(-36, 70, 24, fur); ball(36, 70, 24, fur);
    ball(0, 30, 52, fur);
    ball(0, 36, 30, light);
    ball(-54, 10, 20, fur); ball(54, 10, 20, fur);
    ball(-34, -66, 20, fur); ball(34, -66, 20, fur); ball(-34, -66, 10, light); ball(34, -66, 10, light);
    ball(0, -36, 46, fur);
    ball(0, -22, 20, light);
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(0, -28, 8, 6, 0, 0, 7); ctx.fill();
    if (hurt) { ctx.strokeStyle = '#111'; ctx.lineWidth = 4; for (const ex of [-16, 16]) { ctx.beginPath(); ctx.moveTo(ex - 6, -50); ctx.lineTo(ex + 6, -40); ctx.moveTo(ex + 6, -50); ctx.lineTo(ex - 6, -40); ctx.stroke(); } }
    else { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-16, -46, 6, 0, 7); ctx.arc(16, -46, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-14, -48, 2, 0, 7); ctx.arc(18, -48, 2, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#e11d48'; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(-20, -12); ctx.lineTo(-20, 8); ctx.closePath(); ctx.moveTo(0, -2); ctx.lineTo(20, -12); ctx.lineTo(20, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  },
  // ---------- Cena 3D: cozinha, personagem e ursinho ----------
  init3d() {
    if (this.r || !THREE) return;
    const T = THREE;
    const scene = new T.Scene();
    scene.background = new T.Color(0x1a120d);
    const camera = new T.PerspectiveCamera(40, W / H, 0.1, 100);
    G3.lights(scene, { sky: 0xfff1e0, ground: 0x3b2a20, hemi: 0.9, sun: 2.2, pos: [6, 10, 8] });
    const lamp = new T.PointLight(0xffd6a0, 25, 14); lamp.position.set(0, 4.2, 1.5); scene.add(lamp);
    const brick = G3.tex(256, 256, (g) => {
      g.fillStyle = '#5c3524'; g.fillRect(0, 0, 256, 256);
      for (let y = 0, row = 0; y < 256; y += 32, row++) for (let x = (row % 2) * -32; x < 256; x += 64) { g.fillStyle = ['#a0603f', '#9a5638', '#b36b47', '#8f5034'][(x + y * 3) & 3]; g.fillRect(x + 3, y + 3, 58, 26); }
    }, [5, 3]);
    const wall = new T.Mesh(new T.PlaneGeometry(14, 8), new T.MeshStandardMaterial({ map: brick, roughness: 0.9 }));
    wall.position.set(0, 4, -2.5); wall.receiveShadow = true; scene.add(wall);
    const tiles = G3.tex(256, 256, (g) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#d6d3cd' : '#c4bfb6'; g.fillRect(x * 64, y * 64, 64, 64); } g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); } }, [6, 6]);
    const floor = new T.Mesh(new T.PlaneGeometry(14, 14), new T.MeshStandardMaterial({ map: tiles, roughness: 0.5 }));
    floor.rotation.x = -Math.PI / 2; floor.position.z = 3; floor.receiveShadow = true; scene.add(floor);
    // Bancada, armários e geladeira
    const wood = new T.MeshStandardMaterial({ color: 0x3b2a20, roughness: 0.7 });
    const counter = new T.Mesh(new T.BoxGeometry(3.4, 1.8, 1.2), wood); counter.position.set(3.6, 0.9, -1.8); counter.castShadow = true; scene.add(counter);
    const top = new T.Mesh(new T.BoxGeometry(3.6, 0.12, 1.3), new T.MeshStandardMaterial({ color: 0xe7e2d8, roughness: 0.3 })); top.position.set(3.6, 1.86, -1.8); scene.add(top);
    const fridge = new T.Mesh(new T.BoxGeometry(1.4, 3.6, 1.2), new T.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.4, roughness: 0.3 })); fridge.position.set(-4, 1.8, -1.8); fridge.castShadow = true; scene.add(fridge);
    const upper = new T.Mesh(new T.BoxGeometry(3.4, 1.2, 0.6), wood); upper.position.set(3.6, 4.4, -2.2); scene.add(upper);
    // Personagem segurando o ursinho
    const it = this.config.items[0];
    const rig = makeHuman({ color: it.color, shorts: '#111827', photo: it.photo, seed: it.name });
    rig.root.position.set(-0.6, 0, 0.2); rig.root.rotation.y = 0.35;
    scene.add(rig.root);
    // Ursinho de pelúcia 3D
    const bear = new T.Group();
    const fur = new T.MeshStandardMaterial({ color: 0xa4703f, roughness: 0.95 }), light = new T.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.95 });
    const ball = (r, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new T.Mesh(new T.SphereGeometry(r, 18, 14), m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; bear.add(o); return o; };
    ball(0.42, fur, 0, 0, 0, 1, 1.1, 0.9); ball(0.26, light, 0, -0.02, 0.3, 1, 1, 0.5);
    const bh = ball(0.36, fur, 0, 0.58, 0); ball(0.15, light, 0, 0.5, 0.32, 1, 0.8, 0.6);
    for (const s of [-1, 1]) { ball(0.13, fur, s * 0.27, 0.86, 0); ball(0.15, fur, s * 0.42, 0.05, 0.05); ball(0.17, fur, s * 0.22, -0.42, 0.08); }
    const eyeM = new T.MeshBasicMaterial({ color: 0x111111 });
    const eyes = [-1, 1].map((s) => ball(0.045, eyeM, s * 0.12, 0.66, 0.32));
    ball(0.05, eyeM, 0, 0.53, 0.42);
    const bow = new T.Mesh(new T.TorusGeometry(0.1, 0.04, 8, 16), new T.MeshStandardMaterial({ color: 0xe11d48 })); bow.position.set(0, 0.3, 0.33); bear.add(bow);
    bear.position.set(0.55, 1.75, 0.65);
    scene.add(bear);
    // Bolas
    const ballTex = G3.tex(128, 64, (g) => { g.fillStyle = '#f8fafc'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#111'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(12 + i * 22, i % 2 ? 18 : 46, 8, 0, 7); g.fill(); } });
    const mats = { normal: new T.MeshStandardMaterial({ map: ballTex, roughness: 0.4 }), gift: new T.MeshStandardMaterial({ map: ballTex, roughness: 0.4 }), fire: new T.MeshStandardMaterial({ color: 0xff6a00, emissive: 0xff3300, emissiveIntensity: 1.2 }), gold: new T.MeshStandardMaterial({ color: 0xffd23f, metalness: 1, roughness: 0.2, emissive: 0x553300 }) };
    this.r = { scene, camera, rig, bear, bh, eyes, mats, ballGeo: new T.SphereGeometry(0.18, 18, 14), balls: new Map() };
  },
  bearWorld() { return this.r ? this.r.bear.position.clone() : null; },
  project(v) { const p = v.clone().project(this.r.camera); return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H }; },
  launch({ user, kind }) {
    if (this.balls.length > 40) return;
    const miss = kind === 'normal' && Math.random() < 0.35;
    // Coordenadas no mundo 3D: sai de perto da câmera e vai até o ursinho
    const tx = 0.55 + rand(-0.25, 0.25) + (miss ? pick([-1.6, 1.6]) : 0), ty = 1.8 + rand(-0.25, 0.3) + (miss ? 0.8 : 0), tz = 0.65;
    this.balls.push({ user, kind, miss, sx: rand(-2.5, 2.5), sy: 0.4, sz: 7, tx, ty, tz, t: 0, dur: kind === 'gold' ? 0.55 : kind === 'fire' ? 1.0 : 0.8, spin: rand(-8, 8) });
    sfx.tone(160, 0.08, 'sine', 0.15);
  },
  draw() {
    if (!this.r) {
      this.init3d();
      background('#1a120d', '#3b2a20');
      title('ACERTE O URSINHO', W / 2, H / 2 - 20, 56, '#fff');
      text('Montando a cozinha…', W / 2, H / 2 + 40, 26, '#fde68a', 'center', 700);
      three3dReady.then(() => this.init3d());
      return;
    }
    const T = THREE, t = performance.now() / 1000, r = this.r;
    // Personagem provocando: mão na cabeça e o outro braço segurando o ursinho
    const wave = Math.sin(t * 3) * 0.15;
    poseHuman(r.rig, { sL: [-1.25, 0, -0.35], eL: [-0.45], sR: [-2.6 + wave, 0, 0.5], eR: [-1.7], torso: [0, -0.15, 0], head: [0.05, 0.25, Math.sin(t * 2) * 0.06], hL: [0.05, 0, 0.06], hR: [-0.05, 0, -0.06], kL: [0.05], kR: [0.05], y: Math.sin(t * 2) * 0.02 });
    const shake = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.6 : 0;
    r.bear.position.set(0.55 + shake, 1.75 + Math.abs(shake) * 0.5, 0.65);
    r.bear.rotation.z = shake * 0.8;
    const hurt = this.life / this.config.life < 0.25 || this.shake > 0.2;
    for (const e of r.eyes) e.scale.set(hurt ? 1.6 : 1, hurt ? 0.3 : 1, 1);
    // Bolas em voo (arco)
    const seen = new Set();
    for (const b of this.balls) {
      let m = r.balls.get(b);
      if (!m) { m = new T.Mesh(r.ballGeo, r.mats[b.kind] || r.mats.normal); m.castShadow = true; m.scale.setScalar(b.kind === 'fire' ? 2.2 : 1); r.scene.add(m); r.balls.set(b, m); }
      seen.add(b);
      const k = clamp(b.t / b.dur, 0, 1.5);
      m.position.set(b.sx + (b.tx - b.sx) * k, b.sy + (b.ty - b.sy) * k + Math.sin(Math.min(1, k) * Math.PI) * 1.2, b.sz + (b.tz - b.sz) * k);
      m.rotation.x += b.spin * 0.016; m.rotation.y += 0.1;
    }
    for (const [b, m] of r.balls) if (!seen.has(b)) { r.scene.remove(m); r.balls.delete(b); }
    r.camera.position.set(0.05 + Math.sin(t * 0.3) * 0.2, 2.2, 8.6);
    r.camera.lookAt(0, 1.55, 0);
    G3.render(r.scene, r.camera);
    // Nomes nas bolas, "BOOM!" e corte em preto e branco
    for (const b of this.balls) if (b.t / b.dur < 0.5) { const m = r.balls.get(b); if (m) { const p = this.project(m.position); pill(`@${trim(b.user.nick, 10)}`, p.x, p.y + 34, { size: 13 }); } }
    for (const b of this.booms) {
      const bp = this.project(this.bearWorld());
      const s = (b.big ? 1.6 : 1) * (1 + (0.7 - b.t) * 0.8);
      ctx.save(); ctx.translate(bp.x + (b.ox ?? (b.ox = rand(-60, 60))), bp.y - 60); ctx.rotate(-0.2); ctx.scale(s, s); ctx.globalAlpha = clamp(b.t * 2, 0, 1);
      ctx.beginPath();
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, rr = k % 2 ? 34 : 58; ctx.lineTo(Math.cos(a) * rr * 1.3, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#b91c1c'; ctx.stroke();
      label('BOOM!', 0, 2, 26, '#b91c1c', 'center', 400, F_TITLE);
      ctx.restore();
    }
    if (this.gray > 0) { ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    this.drawHud();
    if (this.phase === 'over') this.drawOver();
  },
  drawHud() {
    title('ACERTE O URSINHO!', W / 2, 54, 34, '#fff');
    panel(16, 90, W - 32, 120, { r: 14, from: 'rgba(10,12,20,.9)', to: 'rgba(4,5,10,.9)' });
    label('ACERTOS', 40, 116, 13, '#9aa0b4', 'left', 900); num(String(this.hits), 40, 160, 46, '#fff', 'left');
    if (this.lastGift) {
      const g = this.lastGift;
      panel(160, 104, 330, 56, { r: 10, from: 'rgba(40,30,80,.95)', to: 'rgba(20,14,40,.95)', border: '#8b5cf6', shadow: false });
      avatar(g.user, 188, 132, 18, '#8b5cf6');
      label(`@${trim(g.user.nick, 12)}`, 214, 122, 15, '#fff', 'left', 900);
      label(`${trim(g.name, 12)} · ${g.n} bola${g.n > 1 ? 's' : ''}`, 214, 144, 13, '#c4b5fd', 'left', 800);
    } else label('Comente CHUTA ⚽ · 🎁 = mais bolas', 330, 132, 16, '#fff', 'center', 800);
    label('RODADA', W - 40, 116, 13, '#9aa0b4', 'right', 900); num(String(this.round), W - 40, 160, 46, '#fff', 'right');
    const pct = this.life / this.config.life;
    text('🧸', 44, 186, 26);
    glossBar(70, 176, W - 200, 20, pct, pct > 0.5 ? '#22c55e' : pct > 0.2 ? '#f59e0b' : '#ef4444');
    label(`${this.life}/${this.config.life}`, W - 40, 187, 15, '#fff', 'right', 900);
    leaderboardSmall(this.kickers, W - 270, 260, 250);
  },
  drawOver() {
    ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(0, 0, W, H);
    title('URSINHO NOCAUTE!', W / 2, 300, 50, '#ffd23f');
    this.drawBear(W / 2, 520, 1.4, true);
    leaderboard(this.kickers, 'Quem mais acertou', W / 2, 720, 3, 32);
    text(`Rodada ${this.round + 1} em ${Math.ceil(this.endT)}s`, W / 2, 1060, 32, '#ddd', 'center', 700);
  },
}, { life: 100, items: [{ name: 'Personagem', color: '#1d4ed8', photo: '' }] }));
