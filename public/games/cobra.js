'use strict';

// Arena de Cobras 3D (estilo Snake Rivals): cada espectador vira uma cobra que anda sozinha comendo energia.
// Encostar a cabeça no corpo de outra cobra mata; a cobra morta vira comida e quem matou ganha ponto.
const ARENA = { w: 56, h: 96 };
const SEG_GAP = 0.55, SEG_R = 0.62, MAX_SNAKES = 24, FOOD_N = 260, MAX_SEGS = 4000;
const SNAKE_COLORS = ['#22d3ee', '#f43f5e', '#a3e635', '#facc15', '#c084fc', '#fb923c', '#34d399', '#60a5fa', '#f472b6', '#e2e8f0'];

registerGame({
  id: 'cobra',
  meterY: 360, // posição do medidor de presentes (livre de HUD)
  name: 'Arena de Cobras',
  icon: '🐍',
  help: '<p>Comente <b>cobra</b> para entrar na arena com a sua foto. A sua cobra anda sozinha comendo energia.</p><p>Se a cabeça encostar no corpo de outra cobra, ela morre e vira comida. Comentários dão um empurrão.</p><p>1–9 🪙 Turbo · 10–99 🪙 Cresce · 100–999 🪙 Escudo · 1.000+ 🪙 MEGA: cresce, escudo e ímã. ❤️ Likes fazem crescer, ⭐ seguir +8, 🔁 compartilhar dá turbo.</p>' + TIER_HELP + '',
  cd: new Cooldown(1500),
  kills: new Map(),
  best: new Map(),
  reset() {
    this.snakes = [];
    this.food = [];
    this.log = [];
    this.respawn = new Map();
    for (let i = 0; i < FOOD_N; i++) this.food.push(this.newFood());
    for (let i = 0; i < 3; i++) this.spawn({ id: 'bot' + i, nick: ['Robô Verde', 'Robô Azul', 'Robô Rosa'][i], pic: '' }, true);
  },
  sample: () => pick(['cobra', 'cobra', 'vai', 'come']),
  newFood(x, z, big) { return { x: x ?? rand(-ARENA.w / 2 + 2, ARENA.w / 2 - 2), z: z ?? rand(-ARENA.h / 2 + 2, ARENA.h / 2 - 2), v: big ? 3 : 1, c: pick(SNAKE_COLORS), p: rand(0, 6) }; },
  snake(id) { return this.snakes.find((s) => s.id === id && !s.dead); },
  addLog(user, msg, color = '#fff') { this.log.unshift({ user, msg, color, t: 6 }); this.log.length = Math.min(this.log.length, 3); },
  spawn(user, bot = false) {
    const id = user.id || user.nick;
    if (this.snake(id) || this.snakes.filter((s) => !s.dead).length >= MAX_SNAKES) return this.snake(id);
    const x = rand(-ARENA.w / 2 + 6, ARENA.w / 2 - 6), z = rand(-ARENA.h / 2 + 6, ARENA.h / 2 - 6), a = rand(0, Math.PI * 2);
    const segs = [];
    for (let i = 0; i < 12; i++) segs.push({ x: x - Math.cos(a) * i * SEG_GAP, z: z - Math.sin(a) * i * SEG_GAP });
    const s = { id, user, bot, color: bot ? ['#22c55e', '#3b82f6', '#ec4899'][this.snakes.length % 3] : colorFor(user.nick + 'cobra'), segs, a, turn: 0, boost: 0, shield: 2, magnet: 0, dead: false, kills: 0, grow: 0, think: 0 };
    this.snakes.push(s);
    if (this.r) this.buildHead(s);
    if (!bot) { sfx.pop(); this.addLog(user, 'entrou na arena', s.color); }
    return s;
  },
  onEvent(ev) {
    const id = uid(ev);
    if (ev.type === 'chat') {
      if (/\b(cobra|entrar|!entrar|snake)\b/i.test(ev.text) && !this.snake(id)) {
        if ((this.respawn.get(id) || 0) > performance.now()) return;
        // Quando entra gente de verdade, os robôs saem para abrir espaço
        const bot = this.snakes.find((s) => s.bot && !s.dead);
        if (bot && this.snakes.filter((s) => !s.bot && !s.dead).length >= 2) this.kill(bot, null, true);
        this.spawn(ev.user);
        return;
      }
      const s = this.snake(id);
      if (s && this.cd.ok(id)) s.boost = Math.max(s.boost, 0.6);
    } else if (ev.type === 'like') {
      const s = this.snake(id);
      if (s) { s.grow += Math.max(1, Math.floor(ev.count / 5)); if (ev.count >= 10) s.boost = Math.max(s.boost, 0.4 + ev.count * 0.03); }
    } else if (ev.type === 'social') {
      const s = this.snake(id) || this.spawn(ev.user);
      if (!s) return;
      if (isFollow(ev)) { s.grow += 8; this.addLog(ev.user, 'seguiu: cresceu +8', '#a3e635'); }
      else { s.boost = Math.max(s.boost, 3); s.grow += 12; this.addLog(ev.user, 'compartilhou: turbo + cresceu', '#22d3ee'); }
    } else if (ev.type === 'gift') {
      const s = this.snake(id) || this.spawn(ev.user);
      if (!s) return;
      // Tudo cresce com as moedas: p = força (log), q = quantidade (raiz)
      const tier = giftTier(ev), p = giftPower(ev), q = giftQty(ev, 60);
      if (tier === 1) { s.boost = Math.max(s.boost, 1 + p * 0.8); s.grow += q * 2; this.addLog(ev.user, `ligou o TURBO ${(1 + p * 0.8).toFixed(0)}s`, '#22d3ee'); }
      else if (tier === 2) { s.grow += q * 4; s.boost = Math.max(s.boost, p * 0.4); this.addLog(ev.user, `cresceu +${q * 4}`, '#a3e635'); }
      else if (tier === 3) { s.shield = Math.max(s.shield, p + 2); s.boost = Math.max(s.boost, 3); s.grow += q * 2; this.addLog(ev.user, `ESCUDO ${(p + 2).toFixed(0)}s e +${q * 2}`, '#facc15'); }
      else { s.grow += q * 2; s.shield = Math.max(s.shield, p + 2); s.magnet = Math.max(s.magnet, p * 1.4); s.boost = Math.max(s.boost, p * 0.4); this.addLog(ev.user, `virou MEGA COBRA +${q * 2}`, '#f472b6'); announcer.show(`MEGA COBRA @${trim(ev.user.nick, 10)}`, '#f472b6', 2.4, 50); sfx.boom(); }
    }
  },
  kill(s, by, silent) {
    s.dead = true;
    for (let i = 0; i < s.segs.length; i += 2) if (this.food.length < FOOD_N * 2) this.food.push(this.newFood(s.segs[i].x + rand(-0.5, 0.5), s.segs[i].z + rand(-0.5, 0.5), true));
    if (this.r && s.head) this.r.scene.remove(s.head);
    if (!s.bot) this.respawn.set(s.id, performance.now() + 5000);
    if (silent) return;
    if (by) {
      by.kills++;
      if (!by.bot) addScore(this.kills, by.user.nick);
      this.addLog(by.user, `eliminou @${trim(s.user.nick, 10)} (${s.segs.length})`, '#f43f5e');
      if (s.segs.length > 40) announcer.show(`@${trim(by.user.nick, 10)} ELIMINOU @${trim(s.user.nick, 10)}`, '#f43f5e', 2, 40);
    } else this.addLog(s.user, 'bateu na parede', '#94a3b8');
    sfx.tone(160, 0.3, 'sawtooth', 0.08);
    // Robôs voltam sozinhos se a arena ficar vazia
    if (s.bot) setTimeout(() => { if (this.snakes.filter((x) => !x.dead).length < 4) this.spawn(s.user, true); }, 4000);
  },
  update(dt) {
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    const alive = this.snakes.filter((s) => !s.dead);
    for (const s of alive) {
      s.boost = Math.max(0, s.boost - dt); s.shield = Math.max(0, s.shield - dt); s.magnet = Math.max(0, s.magnet - dt);
      const h = s.segs[0];
      // IA: vai atrás da comida mais perto e desvia de corpos e paredes
      s.think -= dt;
      if (s.think <= 0) {
        s.think = 0.15;
        let best = null, bd = 1e9;
        for (const f of this.food) { const d = (f.x - h.x) ** 2 + (f.z - h.z) ** 2 - f.v * 6; if (d < bd) { bd = d; best = f; } }
        let want = best ? Math.atan2(best.z - h.z, best.x - h.x) : s.a;
        // Perigo à frente: corpo de outra cobra ou parede
        const look = 3.2;
        const danger = (ang) => {
          const px = h.x + Math.cos(ang) * look, pz = h.z + Math.sin(ang) * look;
          if (Math.abs(px) > ARENA.w / 2 - 1.5 || Math.abs(pz) > ARENA.h / 2 - 1.5) return true;
          for (const o of alive) { if (o === s) continue; for (let i = 0; i < o.segs.length; i += 2) { const q = o.segs[i]; if ((q.x - px) ** 2 + (q.z - pz) ** 2 < 2.2) return true; } }
          return false;
        };
        if (danger(want)) { for (const off of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.6]) if (!danger(want + off)) { want += off; break; } }
        s.target = want;
      }
      let da = ((s.target ?? s.a) - s.a + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      s.a += clamp(da, -3.2 * dt, 3.2 * dt);
      const speed = (s.boost > 0 ? 12 : 7) * (1 - Math.min(0.3, s.segs.length / 800));
      h.x += Math.cos(s.a) * speed * dt; h.z += Math.sin(s.a) * speed * dt;
      // Corpo segue a cabeça mantendo a distância entre os gomos
      for (let i = 1; i < s.segs.length; i++) {
        const a = s.segs[i - 1], b = s.segs[i];
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1;
        if (d > SEG_GAP) { b.x = a.x + (dx / d) * SEG_GAP; b.z = a.z + (dz / d) * SEG_GAP; }
      }
      if (s.grow > 0 && s.segs.length < 400) { const t = s.segs[s.segs.length - 1]; s.segs.push({ x: t.x, z: t.z }); s.grow--; }
      // Comer
      const reach = s.magnet > 0 ? 6 : 1.4;
      for (const f of this.food) {
        const d2 = (f.x - h.x) ** 2 + (f.z - h.z) ** 2;
        if (s.magnet > 0 && d2 < 36) { f.x += (h.x - f.x) * dt * 6; f.z += (h.z - f.z) * dt * 6; }
        if (d2 < reach * reach * 0.5 || d2 < 1.6) { f.eaten = true; s.grow += f.v; }
      }
      if (!s.bot) { const cur = this.best.get(s.user.nick) || 0; if (s.segs.length > cur) this.best.set(s.user.nick, s.segs.length); }
    }
    this.food = this.food.filter((f) => !f.eaten);
    while (this.food.length < FOOD_N) this.food.push(this.newFood());
    // Colisões
    for (const s of alive) {
      if (s.dead) continue;
      const h = s.segs[0];
      if (Math.abs(h.x) > ARENA.w / 2 || Math.abs(h.z) > ARENA.h / 2) { if (s.shield > 0) { s.a += Math.PI; h.x = clamp(h.x, -ARENA.w / 2 + 1, ARENA.w / 2 - 1); h.z = clamp(h.z, -ARENA.h / 2 + 1, ARENA.h / 2 - 1); } else this.kill(s, null); continue; }
      if (s.shield > 0) continue;
      for (const o of alive) {
        if (o === s || o.dead) continue;
        let hit = false;
        for (let i = 1; i < o.segs.length; i++) { const q = o.segs[i]; if ((q.x - h.x) ** 2 + (q.z - h.z) ** 2 < (SEG_R * 1.6) ** 2) { hit = true; break; } }
        if (hit) { this.kill(s, o); break; }
      }
    }
    this.snakes = this.snakes.filter((s) => !s.dead);
  },

  // ---------- Cena 3D ----------
  init3d() {
    if (this.r || !THREE) return;
    const T = THREE;
    const scene = new T.Scene();
    scene.background = new T.Color(0x070b14);
    const camera = new T.PerspectiveCamera(48, W / H, 0.5, 400);
    scene.add(new T.HemisphereLight(0xb8c8ff, 0x101020, 1.1));
    const sun = new T.DirectionalLight(0xffffff, 1.4); sun.position.set(20, 60, 30); scene.add(sun);
    // Piso da arena com grade e borda neon
    const grid = G3.tex(256, 256, (g) => { g.fillStyle = '#0d1424'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(34,211,238,.18)'; g.lineWidth = 3; g.strokeRect(0, 0, 256, 256); g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(8, 8, 240, 240); }, [ARENA.w / 4, ARENA.h / 4]);
    const floor = new T.Mesh(new T.PlaneGeometry(ARENA.w, ARENA.h), new T.MeshStandardMaterial({ map: grid, roughness: 0.6, metalness: 0.2 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const wallMat = new T.MeshBasicMaterial({ color: 0x22d3ee });
    for (const [w, d, x, z] of [[ARENA.w + 1, 0.5, 0, ARENA.h / 2], [ARENA.w + 1, 0.5, 0, -ARENA.h / 2], [0.5, ARENA.h, ARENA.w / 2, 0], [0.5, ARENA.h, -ARENA.w / 2, 0]]) { const m = new T.Mesh(new T.BoxGeometry(w, 0.8, d), wallMat); m.position.set(x, 0.4, z); scene.add(m); }
    // Gomos de todas as cobras num único desenho instanciado (rápido mesmo com muitas cobras)
    const segMesh = new T.InstancedMesh(new T.SphereGeometry(SEG_R, 14, 10), new T.MeshStandardMaterial({ roughness: 0.35, metalness: 0.15 }), MAX_SEGS);
    segMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    segMesh.count = 0; scene.add(segMesh);
    const foodMesh = new T.InstancedMesh(new T.IcosahedronGeometry(0.32, 0), new T.MeshBasicMaterial(), FOOD_N * 2);
    foodMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    foodMesh.count = 0; scene.add(foodMesh);
    const glow = new T.InstancedMesh(new T.PlaneGeometry(1.6, 1.6), new T.MeshBasicMaterial({ map: G3.glowTex(), transparent: true, depthWrite: false, blending: T.AdditiveBlending }), FOOD_N * 2);
    glow.count = 0; scene.add(glow);
    this.r = { scene, camera, segMesh, foodMesh, glow, m: new T.Matrix4(), q: new T.Quaternion(), c: new T.Color(), cam: new T.Vector3(0, 70, 48), look: new T.Vector3(0, 0, 4) };
    for (const s of this.snakes) this.buildHead(s);
  },
  buildHead(s) {
    const T = THREE;
    const g = new T.Group();
    const head = new T.Mesh(new T.SphereGeometry(SEG_R * 1.35, 20, 16), new T.MeshStandardMaterial({ color: s.color, roughness: 0.3 }));
    head.position.y = SEG_R; g.add(head);
    for (const side of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(0.22, 10, 8), new T.MeshBasicMaterial({ color: 0xffffff })); e.position.set(0.45, SEG_R + 0.45, side * 0.4); g.add(e); const p = new T.Mesh(new T.SphereGeometry(0.11, 8, 6), new T.MeshBasicMaterial({ color: 0x000000 })); p.position.set(0.6, SEG_R + 0.5, side * 0.42); g.add(p); }
    const face = new T.Sprite(new T.SpriteMaterial({ map: G3.faceTex(s.user.pic, s.user.nick, true), depthTest: false, sizeAttenuation: false }));
    face.center.set(0.5, 0); face.scale.set(0.05, 0.05, 1); face.position.y = 1.6; face.renderOrder = 20; g.add(face);
    const tag = G3.label(`@${trim(s.user.nick, 12)}`, { scale: 0.11, border: s.color });
    tag.center.set(0.5, -3.6); tag.position.y = 1.6; g.add(tag);
    const shield = new T.Mesh(new T.SphereGeometry(1.6, 16, 12), new T.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.25, depthWrite: false }));
    shield.position.y = SEG_R; g.add(shield);
    s.head = g; s.shieldMesh = shield;
    this.r.scene.add(g);
  },
  draw() {
    if (!this.r) {
      this.init3d();
      background('#070b14', '#0d1424');
      title('ARENA DE COBRAS', W / 2, H / 2 - 20, 60, '#22d3ee');
      text('Montando a arena…', W / 2, H / 2 + 40, 26, '#cbd5e1', 'center', 700);
      three3dReady.then(() => this.init3d());
      return;
    }
    const r = this.r, t = performance.now() / 1000;
    const alive = this.snakes.filter((s) => !s.dead);
    let n = 0;
    for (const s of alive) {
      if (!s.head) this.buildHead(s);
      r.c.set(s.color);
      const dark = r.c.clone().multiplyScalar(0.7);
      for (let i = 1; i < s.segs.length && n < MAX_SEGS; i++) {
        const q = s.segs[i], sc = 1 - Math.min(0.35, i / s.segs.length * 0.35);
        r.m.compose(new THREE.Vector3(q.x, SEG_R * sc, q.z), r.q, new THREE.Vector3(sc, sc, sc));
        r.segMesh.setMatrixAt(n, r.m); r.segMesh.setColorAt(n, i % 4 < 2 ? r.c : dark); n++;
      }
      const h = s.segs[0];
      s.head.position.set(h.x, 0, h.z); s.head.rotation.y = -s.a;
      s.shieldMesh.visible = s.shield > 0;
    }
    r.segMesh.count = n; r.segMesh.instanceMatrix.needsUpdate = true; if (r.segMesh.instanceColor) r.segMesh.instanceColor.needsUpdate = true;
    let fn = 0;
    const qUp = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    for (const f of this.food) {
      const s = f.v > 1 ? 1.5 : 1, y = 0.5 + Math.sin(t * 3 + f.p) * 0.15;
      r.m.compose(new THREE.Vector3(f.x, y, f.z), r.q, new THREE.Vector3(s, s, s)); r.foodMesh.setMatrixAt(fn, r.m); r.c.set(f.c); r.foodMesh.setColorAt(fn, r.c);
      r.m.compose(new THREE.Vector3(f.x, 0.05, f.z), qUp, new THREE.Vector3(s, s, s)); r.glow.setMatrixAt(fn, r.m); r.glow.setColorAt(fn, r.c);
      fn++;
    }
    r.foodMesh.count = fn; r.glow.count = fn;
    r.foodMesh.instanceMatrix.needsUpdate = true; r.glow.instanceMatrix.needsUpdate = true;
    if (r.foodMesh.instanceColor) r.foodMesh.instanceColor.needsUpdate = true;
    if (r.glow.instanceColor) r.glow.instanceColor.needsUpdate = true;
    // Câmera mostra a arena inteira, levemente inclinada, e segue um pouco a maior cobra
    const top = [...alive].sort((a, b) => b.segs.length - a.segs.length)[0];
    const fx = top ? top.segs[0].x * 0.25 : 0, fz = top ? top.segs[0].z * 0.2 : 0;
    r.cam.lerp(new THREE.Vector3(fx, 92, 44 + fz), 0.03); r.look.lerp(new THREE.Vector3(fx, 0, 2 + fz), 0.05);
    r.camera.position.copy(r.cam); r.camera.lookAt(r.look);
    G3.render(r.scene, r.camera);
    this.drawHud(alive);
  },
  drawHud(alive) {
    slant(16, 18, W - 32, 70, { fill: 'rgba(7,11,20,.85)', skew: 14, border: 'rgba(34,211,238,.4)' });
    title('ARENA DE COBRAS', 40, 46, 32, '#22d3ee', 'left');
    label(`${alive.filter((s) => !s.bot).length} jogadores · comente COBRA para entrar`, 40, 74, 15, 'rgba(255,255,255,.75)', 'left', 700);
    // Ranking ao vivo pelo tamanho
    const rank = [...alive].sort((a, b) => b.segs.length - a.segs.length).slice(0, 5);
    slant(W - 252, 100, 236, 30 + rank.length * 38, { fill: 'rgba(7,11,20,.82)', skew: 8 });
    label('MAIORES AGORA', W - 230, 118, 13, 'rgba(255,255,255,.7)', 'left', 800);
    rank.forEach((s, i) => {
      const y = 146 + i * 38;
      posBadge(i + 1, W - 226, y, 22);
      avatar(s.user, W - 196, y, 13, s.color);
      label(`@${trim(s.user.nick, 9)}`, W - 178, y + 1, 15, '#fff', 'left', 800);
      num(String(s.segs.length), W - 30, y, 20, s.color, 'right');
    });
    this.log.forEach((l, k) => toast(l.user, trim(`@${trim(l.user.nick, 10)} ${l.msg}`, 36), 20, 1120 + k * 44, { color: l.color, alpha: clamp(l.t, 0, 1), size: 17 }));
    slant(16, 1226, W - 32, 40, { fill: 'rgba(7,11,20,.85)', skew: 10 });
    label('1+🪙 turbo  ·  10+🪙 cresce  ·  100+🪙 escudo  ·  1000+🪙 mega  ·  ⭐🔁 bônus', W / 2, 1247, 14, '#fff', 'center', 800);
  },
});
