'use strict';

// Sobreviva à Ilha 3D: battle royale com personagens 3D animados (foto e nome do espectador na placa).
// A água sobe, a ilha encolhe e o último de pé leva a coroa.
const ISLE_R = 22;
const ISLE_MAX3D = 40; // acima disso os jogadores extras usam o boneco de blocos (desempenho)

registerGame({
  id: 'ilha',
  name: 'Ilha',
  icon: '🏝️',
  help: '<p>Comente <b>entrar</b> para pular na ilha (até 100). Com 2 jogadores a contagem começa. A ilha encolhe: quem cair na água sai.</p><p>1–9 🪙 Entra na ilha e dá uma corrida (5+ 🪙 ganha escudo) · 10–99 🪙 1 a 3 escudos contra queda · 100–999 🪙 Água congelada por 11 a 15s + 2 escudos · 1.000+ 🪙 TSUNAMI: quanto mais moedas, mais da ilha ele varre, e você ganha uma plataforma. ❤️ Likes puxam você pro centro · ⭐ seguir dá escudo · 🔁 compartilhar dá escudo e corrida.</p>' + TIER_HELP + '',
  wins: new Map(),
  hasChars: true,
  enter() { Assets3D.preload([]); },
  // Quem troca de personagem ganha o boneco novo na hora
  onCharPick(user, k) { const p = this.player(user.id || user.nick); if (p?.c && this.r) { this.dropObj(p); this.buildPlayer(p); } },
  dropObj(p) { p.c?.dispose(); p.c = null; if (p.obj) this.r?.scene.remove(p.obj); p.obj = null; p.tag = null; },
  reset() {
    for (const p of this.players || []) this.dropObj(p);
    this.players = [];
    this.phase = 'lobby';
    this.timer = 0;
    this.R = ISLE_R;
    this.freeze = 0;
    this.eventT = 9;
    this.wave = 0;
    this.winner = null;
    this.log = [];
    this.out = 0;
  },
  sample() { return this.phase === 'battle' ? pick(['vai', 'corre', 'kkk']) : 'entrar'; },
  player(id) { return this.players.find((p) => p.id === id); },
  alive() { return this.players.filter((p) => !p.dead); },
  addLog(user, msg, color = '#fff') { this.log.unshift({ user, msg, color, t: 6 }); this.log.length = Math.min(this.log.length, 3); },
  join(user) {
    const id = user.id || user.nick;
    if (this.player(id) || this.players.length >= 100 || this.phase === 'end' || this.phase === 'battle') return null;
    const a = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * this.R * 0.8;
    const p = { id, user, x: Math.cos(a) * d, z: Math.sin(a) * d, tx: 0, tz: 0, shield: 0, platform: 0, dead: false, t: rand(0, 2), phase: rand(0, 6), sink: 0 };
    this.players.push(p);
    if (this.r) this.buildPlayer(p);
    sfx.pop();
    if (this.players.length >= 2 && this.phase === 'lobby') { this.phase = 'countdown'; this.timer = 25; }
    return p;
  },
  onEvent(ev) {
    const id = uid(ev);
    if (ev.type === 'chat') {
      if (/\b(entrar|entra|eu|!entrar|bora)\b/i.test(ev.text)) this.join(ev.user);
    } else if (ev.type === 'like') {
      const p = this.player(id);
      // Likes puxam o jogador um pouco para o centro
      if (p && !p.dead && this.phase === 'battle' && ev.count >= 5) { p.tx = p.x * 0.5; p.tz = p.z * 0.5; p.dash = Math.max(p.dash || 0, 0.6); }
    } else if (ev.type === 'social') {
      let p = this.player(id) || this.join(ev.user);
      if (!p || p.dead || this.phase !== 'battle') return;
      if (isFollow(ev)) { p.shield++; this.addLog(ev.user, 'seguiu: ganhou ESCUDO', '#00e5ff'); }
      else { p.tx = 0; p.tz = 0; p.dash = 2; p.shield++; this.addLog(ev.user, 'compartilhou: escudo + corrida pro centro', '#00e5ff'); }
    } else if (ev.type === 'gift') {
      // Escudos, gelo e tsunami crescem com as moedas
      const tier = giftTier(ev), pw = giftPower(ev), q = giftQty(ev, 100);
      let p = this.player(id);
      if (!p) { p = this.join(ev.user); if (p) this.addLog(ev.user, 'pulou na ilha', '#ffc93c'); }
      if (!p || p.dead || this.phase !== 'battle') return;
      if (tier === 1) { p.tx = rand(-1, 1); p.tz = rand(-1, 1); p.dash = 1 + pw * 0.3; if (pw >= 3) p.shield++; }
      if (tier === 2) { const n = 1 + Math.floor(q / 5); p.shield += n; this.addLog(ev.user, `ganhou ${n > 1 ? n + ' ESCUDOS' : 'ESCUDO'}`, '#00e5ff'); }
      if (tier === 3) { p.shield += 2; this.freeze = Math.min(40, this.freeze + 4 + pw); this.addLog(ev.user, 'CONGELOU a água', '#bae6fd'); announcer.show('ÁGUA CONGELADA', '#bae6fd', 2, 56); }
      if (tier === 4) {
        p.platform = 15 + pw * 2; p.shield += 3;
        this.wave = 1.4;
        announcer.show(`TSUNAMI de @${trim(ev.user.nick, 10)}`, '#38bdf8', 2.5, 48);
        sfx.boom();
        for (const o of this.alive()) if (o !== p && Math.hypot(o.x, o.z) > this.R * Math.max(0.3, 0.8 - pw * 0.025)) this.drown(o, `foi levado pelo tsunami de @${trim(ev.user.nick, 10)}`);
      }
    }
  },
  drown(p, why = 'caiu na água') {
    if (p.dead || p.platform > 0) return;
    if (p.shield > 0) { p.shield--; p.x *= 0.3; p.z *= 0.3; p.c?.play('block'); return; }
    p.dead = true;
    p.c?.play('death', { hold: true });
    p.sink = 0.001;
    this.out++;
    this.addLog(p.user, why, '#38bdf8');
    sfx.tone(300, 0.15, 'sine', 0.08);
  },
  update(dt) {
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    this.wave = Math.max(0, this.wave - dt);
    if (this.phase === 'countdown') {
      this.timer -= dt;
      if (this.timer <= 0) { this.phase = 'battle'; this.timer = 0; sfx.win(); announcer.show('A ÁGUA ESTÁ SUBINDO!', '#38bdf8', 2, 50); }
    } else if (this.phase === 'end') {
      this.timer -= dt;
      if (this.timer <= 0) this.reset();
      return;
    }
    if (this.phase === 'battle') {
      this.timer += dt;
      this.freeze = Math.max(0, this.freeze - dt);
      // Quatro fases, cada uma encolhendo mais rápido.
      const rate = this.timer < 30 ? 0.18 : this.timer < 60 ? 0.28 : this.timer < 90 ? 0.42 : 0.65;
      if (this.freeze <= 0) this.R = Math.max(2.2, this.R - rate * dt);
      this.eventT -= dt;
      if (this.eventT <= 0) {
        this.eventT = rand(7, 11);
        const list = this.alive();
        if (list.length > 2) {
          announcer.show('ONDA!', '#38bdf8', 1.3, 60);
          for (const p of list) if (Math.random() < 0.3) { const a = Math.atan2(p.z, p.x); p.x += Math.cos(a) * 3; p.z += Math.sin(a) * 3; }
        }
      }
    }
    for (const p of this.players) {
      if (p.dead) { p.sink = Math.min(1, p.sink + dt); continue; }
      p.platform = Math.max(0, p.platform - dt);
      p.dash = Math.max(0, (p.dash || 0) - dt);
      p.t -= dt;
      if (p.t <= 0 && !p.dash) { p.t = rand(1, 3); const a = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * this.R * 0.8; p.tx = Math.cos(a) * d; p.tz = Math.sin(a) * d; }
      if (p.platform <= 0) {
        const sp = p.dash ? 9 : 2.2;
        const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
        if (d > 0.1) { p.x += dx / d * Math.min(d, sp * dt); p.z += dz / d * Math.min(d, sp * dt); p.face = Math.atan2(dx, dz); p.moving = true; } else p.moving = false;
      }
    }
    // Empurrões entre quem está muito perto
    const list = this.alive();
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d > 0 && d < 1.2) { const k = (1.2 - d) / 2 / d; a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k; }
    }
    if (this.phase === 'battle') {
      for (const p of list) if (Math.hypot(p.x, p.z) > this.R) this.drown(p);
      const left = this.alive();
      if (left.length <= 1) {
        this.phase = 'end';
        this.timer = 12;
        this.winner = left[0] || null;
        if (this.winner) addScore(this.wins, this.winner.user.nick);
        sfx.win();
        for (let k = 0; k < 5; k++) setTimeout(() => burst(rand(100, W - 100), rand(250, 700), ['#ffc93c', '#fff', '#a3e635'], 70, 550), k * 250);
      }
    }
  },

  // ---------- Cena 3D ----------
  init3d() {
    if (this.r || !THREE) return;
    const T = THREE;
    const scene = new T.Scene();
    scene.background = G3.skyTex('#0ea5e9', '#7dd3fc', '#fef3c7');
    scene.fog = new T.Fog(0xbfe9ff, 80, 200);
    const camera = new T.PerspectiveCamera(46, W / H, 0.5, 500);
    const sun = G3.lights(scene, { ground: 0x0e7490, hemi: 1.1, sun: 2.6, pos: [30, 60, 20] });
    // Mar com ondas (vértices animados)
    const seaGeo = new T.PlaneGeometry(300, 300, 60, 60);
    const sea = new T.Mesh(seaGeo, new T.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.92 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = 0.1; scene.add(sea);
    // Ilha: areia + grama (escalam com o raio)
    const sand = new T.Mesh(new T.CylinderGeometry(1, 1.12, 1.4, 48), new T.MeshLambertMaterial({ color: 0xf2d38b }));
    sand.position.y = -0.2; sand.receiveShadow = true; scene.add(sand);
    const grass = new T.Mesh(new T.CylinderGeometry(0.72, 0.8, 0.5, 48), new T.MeshLambertMaterial({ color: 0x65a30d }));
    grass.position.y = 0.55; grass.receiveShadow = true; scene.add(grass);
    // Coqueiros
    const palms = [];
    for (let i = 0; i < 6; i++) {
      const g = new T.Group();
      const trunk = new T.Mesh(new T.CylinderGeometry(0.18, 0.28, 4.5, 8), new T.MeshLambertMaterial({ color: 0x8b5a2b })); trunk.position.y = 2.2; trunk.rotation.z = 0.15; trunk.castShadow = true; g.add(trunk);
      for (let k = 0; k < 6; k++) { const leaf = new T.Mesh(new T.ConeGeometry(0.5, 3, 4), new T.MeshLambertMaterial({ color: 0x16a34a })); leaf.position.set(Math.cos(k) * 1.1 + 0.4, 4.4, Math.sin(k) * 1.1); leaf.rotation.set(Math.sin(k) * 1.2, 0, -Math.cos(k) * 1.2); leaf.castShadow = true; g.add(leaf); }
      const a = (i / 6) * Math.PI * 2; g.userData.a = a; g.userData.d = rand(0.35, 0.6);
      scene.add(g); palms.push(g);
    }
    const ice = new T.Mesh(new T.CircleGeometry(150, 48), new T.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.2, transparent: true, opacity: 0 }));
    ice.rotation.x = -Math.PI / 2; ice.position.y = 0.2; scene.add(ice);
    this.r = { scene, camera, sun, sea, sand, grass, palms, ice, cam: new T.Vector3(0, 40, 40) };
    for (const p of this.players) this.buildPlayer(p);
  },
  buildPlayer(p) {
    const T = THREE;
    const g = new T.Group();
    // Personagem 3D (até ISLE_MAX3D); os demais ficam com o boneco de blocos
    if (this.players.filter((o) => o.c).length < ISLE_MAX3D) {
      p.c = new Character3D({ kind: kindFor(p.user), user: p.user, plate: true, height: 2.2, base: 'idle' });
      g.add(p.c.root);
    } else {
      p.rig = makeBlocky3D(p.user.nick, p.user);
      p.rig.root.scale.setScalar(0.85);
      g.add(p.rig.root);
    }
    const shield = new T.Mesh(new T.SphereGeometry(1.1, 16, 12), new T.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.22, depthWrite: false }));
    shield.position.y = 1.3; g.add(shield); p.shieldMesh = shield;
    const plat = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 0.3, 20), new T.MeshStandardMaterial({ color: 0xf97316 }));
    plat.position.y = -0.1; g.add(plat); p.platMesh = plat;
    p.obj = g;
    this.r.scene.add(g);
  },
  draw() {
    if (!this.r) {
      this.init3d();
      background('#0ea5e9', '#fef3c7');
      title('SOBREVIVA À ILHA', W / 2, H / 2 - 20, 56, '#fff');
      text('Montando a ilha…', W / 2, H / 2 + 40, 26, '#fff', 'center', 700);
      three3dReady.then(() => this.init3d());
      return;
    }
    const T = THREE, t = performance.now() / 1000, r = this.r;
    const dt = clamp(t - (r.lastT || t), 0, 0.1); r.lastT = t;
    // Ondas
    const pos = r.sea.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 0.15 + t * 1.4) * 0.25 + Math.cos(pos.getY(i) * 0.12 + t) * 0.25 + (this.wave > 0 ? this.wave * 1.5 : 0));
    pos.needsUpdate = true;
    r.sand.scale.set(this.R, 1, this.R);
    r.grass.scale.set(this.R, 1, this.R);
    r.ice.material.opacity = this.freeze > 0 ? 0.85 : 0;
    r.palms.forEach((g) => { const d = g.userData.d * this.R; g.position.set(Math.cos(g.userData.a) * d, 0.8, Math.sin(g.userData.a) * d); g.visible = this.R > 7; g.rotation.y = Math.sin(t * 0.6 + g.userData.a) * 0.1; });
    const fewLeft = this.alive().length <= 10;
    for (const p of this.players) {
      if (!p.obj) this.buildPlayer(p);
      p.obj.position.set(p.x, p.dead ? 0.8 - p.sink * 2 : 0.8, p.z);
      p.obj.visible = !(p.dead && p.sink >= 1);
      p.obj.rotation.y = p.face || 0;
      if (p.c) {
        // Animação: corre no dash, anda quando se move, comemora se venceu, afunda caindo
        const c = p.c;
        if (p.dead) { if (c.state !== 'death') c.play('death', { hold: true }); }
        else if (this.phase === 'end' && p === this.winner) { if (!c.busy) c.play('victory', { speed: 1 }); }
        else if (!c.busy) { const want = p.moving ? (p.dash ? 'run' : 'walk') : 'idle'; if (c.state !== want) c.play(want); }
        c.update(dt);
      } else if (p.dead) { p.rig.aL.rotation.set(-2.8, 0, 0); p.rig.aR.rotation.set(-2.8, 0, 0); }
      else if (this.phase === 'end' && p === this.winner) danceBlocky(p.rig, t, 1);
      else if (p.moving) walkBlocky(p.rig, t + p.phase, p.dash ? 2 : 1);
      else danceBlocky(p.rig, t + p.phase, 0);
      p.shieldMesh.visible = p.shield > 0;
      p.platMesh.visible = p.platform > 0;
      if (fewLeft && !p.dead && !p.tag && !p.c) { p.tag = G3.label(`@${trim(p.user.nick, 12)}`, { scale: 0.11 }); p.tag.center.set(0.5, 0); p.tag.position.y = 2.7; p.obj.add(p.tag); }
    }
    const dist = 12 + this.R * 1.45;
    const want = new T.Vector3(Math.sin(t * 0.07) * dist * 0.35, dist * 0.78, Math.cos(t * 0.07) * dist * 1.0);
    if (!r.camReady) { r.cam.copy(want); r.camReady = true; } else r.cam.lerp(want, 0.04);
    r.camera.position.copy(r.cam); r.camera.lookAt(0, 0, -this.R * 0.15);
    G3.render(r.scene, r.camera);
    if (this.wave > 0) { ctx.fillStyle = `rgba(56,189,248,${this.wave * 0.35})`; ctx.fillRect(0, 0, W, H); }
    this.drawHud();
  },
  drawHud() {
    slant(16, 18, W - 32, 130, { fill: 'rgba(8,47,73,.85)', skew: 14, border: 'rgba(255,255,255,.25)' });
    title('SOBREVIVA À ILHA', W / 2, 48, 34, '#fff');
    const stats = [['VIVOS', this.alive().length], ['FORA', this.out], ['ILHA', `${Math.round((this.R / ISLE_R) * 100)}%`], [this.phase === 'battle' ? 'TEMPO' : 'STATUS', this.phase === 'battle' ? fmtTime(this.timer) : this.phase === 'countdown' ? `${Math.ceil(this.timer)}s` : 'ABERTA']];
    stats.forEach(([l, v], i) => { const x = 100 + i * 172; label(l, x, 86, 13, 'rgba(255,255,255,.7)', 'center', 800); num(String(v), x, 118, 32, '#fff'); });
    if (this.freeze > 0) label(`água congelada ${Math.ceil(this.freeze)}s`, W / 2, 170, 18, '#bae6fd', 'center', 800);
    if (this.phase === 'lobby' || this.phase === 'countdown') {
      slant(60, 1080, W - 120, 92, { fill: 'rgba(8,47,73,.9)', skew: 14, border: '#ffc93c' });
      title(this.phase === 'lobby' ? 'COMENTE ENTRAR PARA JOGAR' : `COMEÇA EM ${Math.ceil(this.timer)}s`, W / 2, 1112, 30, '#ffc93c');
      label(`${this.players.length}/100 na ilha${this.phase === 'countdown' ? ' · ainda dá tempo de entrar' : ' · mínimo 2'}`, W / 2, 1148, 16, '#fff', 'center', 700);
    }
    this.log.forEach((l, k) => toast(l.user, trim(`@${trim(l.user.nick, 10)} ${l.msg}`, 36), 20, 1196 - k * 44 - (this.phase === 'lobby' || this.phase === 'countdown' ? 130 : 0), { color: l.color, alpha: clamp(l.t, 0, 1), size: 16 }));
    if (this.phase === 'end') {
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 300, W, 560);
      if (this.winner) {
        title('ÚLTIMO SOBREVIVENTE', W / 2, 360, 44, '#ffc93c');
        avatar(this.winner.user, W / 2, 520, 110, '#ffc93c');
        title(`@${trim(this.winner.user.nick, 16).toUpperCase()}`, W / 2, 680, 44, '#fff');
      } else title('NINGUÉM SOBREVIVEU', W / 2, 480, 50, '#38bdf8');
      leaderboardSmall(this.wins, W / 2 - 150, 760);
      label(`Nova ilha em ${Math.ceil(this.timer)}s`, W / 2, 900, 20, '#fff', 'center', 700);
    }
  },
});
