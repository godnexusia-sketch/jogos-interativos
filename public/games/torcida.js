'use strict';

// Corrida de Torcidas no estilo atletismo olímpico: estádio 3D, pista azul de 8 raias e corredores 3D
// com o rosto configurado. O público torce comentando o nome ou o número; presentes viram efeitos.
const TORCIDA_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#f59e0b'];
const LANE_W = 1.22;
const RUN_H = 2.5; // altura dos corredores 3D na cena
const RUN_KINDS = ['cavaleiro', 'barbaro', 'maga', 'ladino', 'encapuzado', 'aventureiro', 'swat', 'sapo', 'cactoro', 'mech', 'panda', 'astronauta'];

registerGame(withConfig({
  id: 'torcida',
  meterY: 440, // posição do medidor de presentes (livre de HUD)
  name: 'Corrida de Torcidas',
  icon: '🏃',
  help: '<p>Comente o <b>nome</b> ou o <b>número</b> (1, 2…) do corredor para torcer por ele. Cada comentário depois disso dá um empurrão.</p><p>1–9 🪙 Impulso (3 a 6s) · 10–99 🪙 Casca de banana no rival da frente + impulso · 100–999 🪙 Superarrancada (5 a 7s) · 1.000+ 🪙 Derruba todos os rivais + escudo. Quanto mais moedas, mais tempo dura. ⭐ Seguir +4 m · 🔁 compartilhar +7 m.</p>' + TIER_HELP + '<p>❤️ Likes enchem a <b>meta coletiva</b>: quando completa, quem está em último ganha uma arrancada.</p><p>Fotos e nomes em <b>Configurar</b>.</p>',
  hasChars: true,
  cd: new Cooldown(1500),
  wins: new Map(),
  heat: 1,
  reset() {
    this.runners = this.config.items.map((it, i) => ({ ...it, i, pos: 0, boost: 0, mult: 1, slip: 0, shield: 0, fans: 0, lane: this.laneFor(i), fall: 0 }));
    this.fan = this.fan || new Map();
    for (const [, i] of this.fan) if (this.runners[i]) this.runners[i].fans++;
    this.top = new Map();
    this.phase = 'marks';
    this.timer = 4.2;
    this.raceT = 0;
    this.log = [];
    this.goal = { n: 0, need: 100, t: 30 };
    this.winner = null;
    if (this.r) this.rebuildRunners();
  },
  laneFor(i) { return [4, 5, 3, 6][i] ?? i + 2; },
  applyConfig(cfg) {
    if (!cfg?.items?.length) return;
    this.config = cfg; store.set('cfg:torcida', cfg);
    this.fan = new Map(); this.kindOvr = {};
    this.reset();
  },
  renderSettings(el, save) {
    renderItemsSettings(el, structuredClone(this.config), {
      min: 2, max: 4, itemLabel: 'Corredor',
      extras: [{ key: 'length', label: 'Distância da prova (metros)', min: 60, max: 1500 }],
      newItem: (n) => ({ name: `Corredor ${n + 1}`, color: TORCIDA_COLORS[n], photo: '' }),
    }, (cfg) => { this.applyConfig(cfg); save(this.config); });
  },
  sample() { return Math.random() < 0.4 ? String(randInt(1, this.runners.length)) : pick(['vai!', 'corre', 'bora']); },
  pickRunner(t) {
    t = t.trim().toLowerCase();
    const m = t.match(/^([1-4])\b/);
    if (m && Number(m[1]) <= this.runners.length) return this.runners[Number(m[1]) - 1];
    return this.runners.find((r) => t.includes(r.name.toLowerCase()));
  },
  addLog(user, msg, color) { this.log.unshift({ user, msg, color, t: 7 }); this.log.length = Math.min(this.log.length, 3); },
  leaderOf(except) { return [...this.runners].filter((r) => r !== except).sort((a, b) => b.pos - a.pos)[0]; },
  apply(r, kind, secs, user) {
    if (!r) return;
    if (kind === 'boost') { r.boost = Math.max(r.boost, secs); r.mult = Math.max(r.mult, 1.7); }
    if (kind === 'super') { r.boost = Math.max(r.boost, secs); r.mult = 2.6; }
    if (kind === 'slip') {
      if (r.shield > 0) { r.shield = 0; this.addLog(user, `bateu no escudo de ${r.name}`, '#00e5ff'); return; }
      r.slip = Math.max(r.slip, secs); r.boost = 0;
    }
  },
  onEvent(ev) {
    if (this.phase === 'finish') return;
    const id = uid(ev);
    if (ev.type === 'chat') {
      const r = this.pickRunner(ev.text);
      if (r && this.fan.get(id) !== r.i) {
        if (this.fan.has(id)) this.runners[this.fan.get(id)].fans--;
        this.fan.set(id, r.i); r.fans++;
        this.addLog(ev.user, `torce por ${r.name}`, r.color);
        return;
      }
      const mine = this.fan.has(id) ? this.runners[this.fan.get(id)] : null;
      if (mine && this.phase === 'race' && this.cd.ok(id)) { mine.pos += 0.8; addScore(this.top, ev.user.nick, 1); }
    } else if (ev.type === 'like') {
      this.goal.n += ev.count;
      const mine = this.fan.has(id) ? this.runners[this.fan.get(id)] : null;
      if (mine && this.phase === 'race') mine.pos += Math.min(2, 0.1 * ev.count);
    } else if (ev.type === 'social') {
      const mine = this.fan.has(id) ? this.runners[this.fan.get(id)] : null;
      const m = isFollow(ev) ? 4 : 7;
      if (mine) { mine.pos += m; this.addLog(ev.user, `${isFollow(ev) ? 'seguiu' : 'compartilhou'}: +${m} m para ${mine.name}`, mine.color); }
    } else if (ev.type === 'gift') {
      if (!this.fan.has(id)) { this.addLog(ev.user, 'comente o nome do corredor antes!', '#ffd23f'); return; }
      const r = this.runners[this.fan.get(id)];
      // Duração dos efeitos cresce com as moedas
      const tier = giftTier(ev), pw = giftPower(ev);
      addScore(this.top, ev.user.nick, coins(ev) * 5);
      if (tier === 1) { this.apply(r, 'boost', 2 + pw, ev.user); this.addLog(ev.user, `deu IMPULSO em ${r.name}`, r.color); }
      else if (tier === 2) { const rival = this.leaderOf(r); this.apply(rival, 'slip', 1 + pw * 0.3, ev.user); this.apply(r, 'boost', pw * 0.5, ev.user); this.addLog(ev.user, `jogou casca de banana em ${rival.name}`, '#ffd23f'); }
      else if (tier === 3) { this.apply(r, 'super', 1.5 + pw * 0.5, ev.user); this.addLog(ev.user, `SUPERARRANCADA em ${r.name}`, r.color); announcer.show('SUPERARRANCADA', r.color, 1.6, 54); }
      else {
        for (const o of this.runners) if (o !== r) this.apply(o, 'slip', 1 + pw * 0.15, ev.user);
        r.shield = 5 + pw; this.apply(r, 'super', 1 + pw * 0.35, ev.user);
        this.addLog(ev.user, `derrubou todos! escudo em ${r.name}`, r.color);
        announcer.show(`@${trim(ev.user.nick, 12)}`, r.color, 2.2, 60);
        sfx.boom();
      }
    }
  },
  update(dt) {
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    if (this.phase === 'marks') {
      const before = this.timer;
      this.timer -= dt;
      if (before > 2.6 && this.timer <= 2.6) sfx.tone(440, 0.15, 'sine', 0.08);
      if (before > 1.2 && this.timer <= 1.2) sfx.tone(520, 0.15, 'sine', 0.08);
      if (this.timer <= 0) { this.phase = 'race'; sfx.boom(); announcer.show('VAI!', '#ffffff', 1, 130); }
      return;
    }
    if (this.phase === 'finish') {
      this.timer -= dt;
      if (this.timer <= 0) { this.heat++; this.reset(); }
      return;
    }
    this.raceT += dt;
    this.goal.t -= dt;
    if (this.goal.n >= this.goal.need) {
      const last = [...this.runners].sort((a, b) => a.pos - b.pos)[0];
      this.apply(last, 'super', 5);
      announcer.show(`META BATIDA · ${last.name}`, '#22c55e', 2.2, 46);
      sfx.win();
      this.goal = { n: 0, need: Math.round(this.goal.need * 1.3), t: 30 };
    } else if (this.goal.t <= 0) this.goal = { n: 0, need: this.goal.need, t: 30 };
    const L = this.config.length;
    for (const r of this.runners) {
      r.boost = Math.max(0, r.boost - dt);
      if (r.boost <= 0) r.mult = 1;
      r.slip = Math.max(0, r.slip - dt);
      r.shield = Math.max(0, r.shield - dt);
      r.fall = r.slip > 0 ? Math.min(1, r.fall + dt * 4) : Math.max(0, r.fall - dt * 3);
      // Velocidade base ~3,4 m/s: uma prova de 200 m dura cerca de 1 minuto sem ajuda
      const v = r.slip > 0 ? 0.3 : (3.2 + Math.sin(this.raceT * 0.8 + r.i * 2) * 0.35) * r.mult;
      r.v = v;
      r.pos = Math.min(L, r.pos + v * dt);
    }
    const w = this.runners.find((r) => r.pos >= L);
    if (w) {
      this.winner = w; this.finalT = this.raceT;
      this.phase = 'finish'; this.timer = 14;
      addScore(this.wins, w.name);
      sfx.win();
      announcer.items.length = 0;
      for (let k = 0; k < 5; k++) setTimeout(() => burst(rand(100, W - 100), rand(250, 700), [w.color, '#ffd23f', '#fff'], 70, 550), k * 250);
    }
  },

  // ---------- Estádio 3D ----------
  init3d() {
    if (this.r || !THREE) return;
    const T = THREE;
    const scene = new T.Scene();
    scene.background = G3.skyTex('#1e3a8a', '#60a5fa', '#fde68a');
    scene.fog = new T.Fog(0xa7c4f2, 90, 260);
    const camera = new T.PerspectiveCamera(40, W / H, 0.1, 600);
    const sun = G3.lights(scene, { ground: 0x335533, hemi: 1.0, sun: 2.6, pos: [-30, 50, 40] });
    const len = 260;
    // Pista azul de 8 raias, com linhas brancas e números
    const track = G3.tex(1024, 256, (g) => {
      g.fillStyle = '#1e5aa8'; g.fillRect(0, 0, 1024, 256);
      for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; g.fillRect(Math.random() * 1024, Math.random() * 256, 2, 2); }
      g.fillStyle = '#f8fafc'; for (let l = 0; l <= 8; l++) g.fillRect(0, l * 32 - (l === 8 ? 3 : 0), 1024, 3);
    }, [len / 40, 1]);
    const trackMesh = new T.Mesh(new T.PlaneGeometry(len, 8 * LANE_W), new T.MeshStandardMaterial({ map: track, roughness: 0.85 }));
    trackMesh.rotation.x = -Math.PI / 2; trackMesh.position.set(len / 2 - 20, 0.01, 0); trackMesh.receiveShadow = true;
    scene.add(trackMesh);
    const infield = G3.tex(256, 256, (g) => { for (let y = 0; y < 256; y += 32) { g.fillStyle = (y / 32) % 2 ? '#2f8f3a' : '#37a344'; g.fillRect(0, y, 256, 32); } }, [30, 6]);
    const grass = new T.Mesh(new T.PlaneGeometry(600, 120), new T.MeshLambertMaterial({ map: infield }));
    grass.rotation.x = -Math.PI / 2; grass.position.set(len / 2 - 20, 0, -64); grass.receiveShadow = true; scene.add(grass);
    const apron = new T.Mesh(new T.PlaneGeometry(600, 30), new T.MeshLambertMaterial({ color: 0x1b4f96 }));
    apron.rotation.x = -Math.PI / 2; apron.position.set(len / 2 - 20, 0, 19.5); scene.add(apron);
    // Números das raias na largada e linha de chegada
    for (let l = 1; l <= 8; l++) {
      const n = G3.tex(128, 128, (g) => { g.fillStyle = '#fff'; g.font = 'italic 900 100px "Barlow Condensed", Impact'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(l), 64, 70); });
      const m = new T.Mesh(new T.PlaneGeometry(0.9, 0.9), new T.MeshBasicMaterial({ map: n, transparent: true }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.PI / 2; m.position.set(-1.2, 0.02, this.laneZ(l)); scene.add(m);
    }
    this.finishMark = new T.Group();
    const fl = new T.Mesh(new T.PlaneGeometry(0.4, 8 * LANE_W), new T.MeshBasicMaterial({ color: 0xffffff }));
    fl.rotation.x = -Math.PI / 2; this.finishMark.add(fl);
    const gantryMat = new T.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.4, roughness: 0.4 });
    for (const z of [-5.6, 5.6]) { const p = new T.Mesh(new T.BoxGeometry(0.3, 4, 0.3), gantryMat); p.position.set(0, 2, z); this.finishMark.add(p); }
    const banner = G3.tex(512, 64, (g) => { g.fillStyle = '#0f172a'; g.fillRect(0, 0, 512, 64); g.fillStyle = '#facc15'; g.font = 'italic 900 48px "Barlow Condensed", Impact'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CHEGADA', 256, 34); });
    const top = new T.Mesh(new T.BoxGeometry(0.3, 0.8, 11.5), [new T.MeshBasicMaterial({ map: banner }), new T.MeshBasicMaterial({ map: banner }), gantryMat, gantryMat, gantryMat, gantryMat]);
    top.position.y = 4; this.finishMark.add(top);
    scene.add(this.finishMark);
    // Blocos de largada
    for (let l = 1; l <= 8; l++) { const b = new T.Mesh(new T.BoxGeometry(0.4, 0.15, 0.5), new T.MeshStandardMaterial({ color: 0xdc2626 })); b.position.set(-0.4, 0.08, this.laneZ(l)); scene.add(b); }
    // Arquibancadas e torcida dos dois lados
    const crowdTex = G3.tex(512, 256, (g) => {
      g.fillStyle = '#334155'; g.fillRect(0, 0, 512, 256);
      for (let r = 0; r < 16; r++) { g.fillStyle = r % 2 ? '#3b4a61' : '#2c3a4f'; g.fillRect(0, r * 16, 512, 16); for (let i = 0; i < 64; i++) { g.fillStyle = `hsl(${Math.random() * 360},${50 + Math.random() * 40}%,${45 + Math.random() * 25}%)`; g.beginPath(); g.arc(i * 8 + Math.random() * 3, r * 16 + 7, 3.2, 0, 7); g.fill(); } }
    }, [8, 1]);
    for (const [z, rot] of [[24, -0.6], [-46, 0.6]]) {
      const stand = new T.Mesh(new T.PlaneGeometry(640, 34), new T.MeshLambertMaterial({ map: crowdTex, side: T.DoubleSide }));
      stand.position.set(len / 2 - 20, 12, z); stand.rotation.x = rot * (z > 0 ? 1 : -1) + (z > 0 ? 0 : 0); stand.rotation.y = z > 0 ? Math.PI : 0;
      scene.add(stand);
      const roof = new T.Mesh(new T.BoxGeometry(640, 1, 10), new T.MeshStandardMaterial({ color: 0xe5e7eb }));
      roof.position.set(len / 2 - 20, 28, z + (z > 0 ? 4 : -4)); scene.add(roof);
    }
    // Torres de luz
    for (let x = -20; x < 260; x += 60) for (const z of [32, -54]) {
      const pole = new T.Mesh(new T.CylinderGeometry(0.4, 0.6, 36, 8), new T.MeshStandardMaterial({ color: 0x94a3b8 })); pole.position.set(x, 18, z); scene.add(pole);
      const lamp = new T.Mesh(new T.BoxGeometry(5, 3, 0.6), new T.MeshBasicMaterial({ color: 0xffffff })); lamp.position.set(x, 37, z); lamp.lookAt(x, 0, 0); scene.add(lamp);
    }
    this.r = { scene, camera, sun, camX: 0, len };
    this.rebuildRunners();
  },
  laneZ(l) { return (l - 4.5) * LANE_W; },
  // Corredores 3D animados: cada raia ganha um personagem diferente (o torcedor pode trocar com !nome).
  rebuildRunners() {
    if (!this.r) return;
    for (const rig of this.r.rigs || []) { rig.c.dispose(); rig.bubble.geometry.dispose(); rig.trail.geometry.dispose(); }
    this.r.rigs = this.runners.map((r) => {
      const kind = this.kindOvr?.[r.i] || RUN_KINDS[(r.i + (this.heat - 1) * this.runners.length) % RUN_KINDS.length];
      const c = new Character3D({ kind, height: RUN_H, plate: false, base: 'idle', tint: r.color });
      c.setTint(r.color);
      const tag = G3.label(trim(r.name, 12).toUpperCase(), { border: r.color, scale: 0.13 });
      tag.center.set(0.5, 0); tag.position.set(0, RUN_H + 0.35, 0); c.root.add(tag);
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 18), new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.22, depthWrite: false }));
      bubble.position.y = 1.4; bubble.visible = false; c.root.add(bubble);
      // Rastro do impulso (atrás do corredor, que corre para +X com o rosto em +Z do modelo)
      const trail = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(r.color), transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      trail.position.set(0, 1.3, -1.8); trail.rotation.y = Math.PI / 2; trail.visible = false; c.root.add(trail);
      this.r.scene.add(c.root);
      return { c, root: c.root, tag, bubble, trail, boost: 0, slip: 0 };
    });
  },
  onCharPick(user, k) {
    const i = this.fan?.get(uid({ user }));
    if (i == null || !this.runners[i]) return;
    (this.kindOvr ||= {})[i] = k;
    this.rebuildRunners();
  },
  draw() {
    if (!this.r) {
      this.init3d();
      background('#1e3a8a', '#60a5fa');
      title('CORRIDA DE TORCIDAS', W / 2, H / 2 - 20, 54, '#fff');
      text('Montando o estádio…', W / 2, H / 2 + 40, 26, '#e0f2fe', 'center', 700);
      three3dReady.then(() => this.init3d());
      return;
    }
    const now = performance.now(), dt = clamp((now - (this.lastT || now)) / 1000, 0, 0.1) || 1 / 60;
    this.lastT = now;
    const L = this.config.length;
    // A prova ocupa 200 unidades de pista na cena, qualquer que seja a distância configurada.
    const k = 200 / L;
    this.finishMark.position.set(L * k, 0, 0);
    const lead = Math.max(...this.runners.map((r) => r.pos));
    this.runners.forEach((r, i) => {
      const rig = this.r.rigs[i];
      rig.root.position.set(r.pos * k, 0, this.laneZ(r.lane));
      rig.root.rotation.set(0, Math.PI / 2, 0);
      const c = rig.c;
      if (this.phase === 'marks') { if (c.state !== 'idle' && !c.busy) c.play('idle'); c.timeScale = 1; }
      else if (this.phase === 'finish') {
        // Vencedor comemora sem parar; os outros param e respiram
        if (r === this.winner) { if (!c.busy) c.play('victory'); } else if (c.state === 'run') c.play('idle');
        c.timeScale = 1;
      } else {
        if (r.slip > 0 && !rig.slip) c.play(r.slip > 1.2 ? 'death' : 'hit', { hold: r.slip > 1.2 }); // escorregou na banana / derrubado
        else if (!r.slip && rig.slip) c.play('run', { fade: 0.15 });
        else if (!r.slip && r.boost > rig.boost + 0.5) c.play(r.mult >= 2.6 ? 'powerUp' : 'jump', { speed: 1.4, then: 'run' });
        else if (!r.slip && c.state !== 'run' && !c.busy) c.play('run');
        // Passada acompanha a velocidade do corredor
        c.timeScale = c.state === 'run' ? clamp(r.v / 3.4, 0.6, 1.9) : 1;
      }
      rig.slip = r.slip; rig.boost = r.boost;
      c.update(dt);
      rig.bubble.visible = r.shield > 0;
      rig.trail.visible = r.boost > 0;
      if (rig.trail.visible) { rig.trail.scale.x = 1 + Math.random() * 0.4; rig.trail.material.opacity = 0.18 + Math.random() * 0.12; }
    });
    // Câmera de TV acompanhando o líder pela lateral
    const target = lead * k;
    const c = this.r;
    c.camX += (target - c.camX) * (Math.abs(target - c.camX) > 15 ? 1 : 0.08);
    const finishing = this.phase === 'finish';
    // Câmera de TV na frente, de três quartos: os corredores vêm na direção dela e o rosto aparece.
    const marks = this.phase === 'marks';
    // Abre o enquadramento quando os corredores se separam, para ninguém sumir da tela.
    const last = Math.min(...this.runners.map((r) => r.pos)) * k;
    const spread = clamp(target - last, 0, 24);
    c.spread = (c.spread || 0) + (spread - (c.spread || 0)) * 0.05;
    const ahead = (finishing ? 5 : marks ? 8.5 : 9) + c.spread * 0.25, side = (finishing ? 4.5 : 7.5) + c.spread * 0.45, camY = (marks ? 2.8 : 3.0) + c.spread * 0.12;
    c.camera.position.set(c.camX + ahead, camY, side);
    c.camera.lookAt(c.camX - (marks ? 0.5 : 2.5) - c.spread * 0.45, marks ? 0.9 : 1.3, -0.4);
    c.sun.position.set(c.camX - 30, 50, 40); c.sun.target.position.set(c.camX, 0, 0);
    G3.render(c.scene, c.camera);
    this.drawHud();
  },
  drawHud() {
    const L = this.config.length;
    const order = [...this.runners].sort((a, b) => b.pos - a.pos);
    // Faixa olímpica: prova e cronômetro
    slant(16, 22, 400, 58, { fill: 'rgba(10,20,45,.92)', skew: 12, border: 'rgba(255,255,255,.2)' });
    title(`${L} M · BATERIA ${this.heat}`, 40, 52, 30, '#fff', 'left');
    slant(W - 220, 22, 204, 58, { fill: '#facc15', skew: 12 });
    const tt = this.phase === 'finish' ? this.finalT : this.raceT;
    num(`${tt.toFixed(2).replace('.', ',')}`, W - 118, 52, 38, '#0f172a');
    // Classificação ao vivo
    order.forEach((r, k) => {
      const y = 96 + k * 50;
      slant(16, y, W - 32, 44, { fill: k === 0 ? 'rgba(250,204,21,.18)' : 'rgba(10,20,45,.86)', skew: 10, border: k === 0 ? '#facc15' : null });
      num(String(k + 1), 44, y + 22, 28, k === 0 ? '#facc15' : '#fff');
      ctx.fillStyle = r.color; ctx.fillRect(66, y + 8, 8, 28);
      photo(r.photo || fakeFace(r.name + r.i), 82, y + 4, 36, 36, 6, (r.name[0] || '?').toUpperCase(), r.color);
      label(trim(r.name, 12).toUpperCase(), 128, y + 23, 20, '#fff', 'left', 400, F_TITLE);
      label(`RAIA ${r.lane}`, 300, y + 23, 13, 'rgba(255,255,255,.6)', 'left', 800);
      glossBar(370, y + 17, 210, 10, r.pos / L, r.color);
      num(`${Math.round(r.pos)} m`, W - 34, y + 23, 22, '#fff', 'right');
    });
    // Cartões e meta coletiva
    const cy = 96 + order.length * 50 + 10;
    this.log.slice(0, 2).forEach((l, k) => toast(l.user, trim(`@${trim(l.user.nick, 12)} ${l.msg}`, 34), 16, cy + 20 + k * 44, { color: l.color, alpha: clamp(l.t, 0, 1), size: 16 }));
    slant(16, 1130, W - 32, 110, { fill: 'rgba(10,20,45,.9)', skew: 12, border: 'rgba(255,255,255,.18)' });
    label('META COLETIVA DE LIKES', 40, 1154, 14, 'rgba(255,255,255,.7)', 'left', 800);
    num(`${this.goal.n}/${this.goal.need}`, 40, 1186, 34, '#facc15', 'left');
    label(`${Math.ceil(this.goal.t)}s · completa e ajuda quem está atrás`, 210, 1186, 15, '#fff', 'left', 700);
    glossBar(40, 1210, W - 100, 10, this.goal.n / this.goal.need, '#facc15');
    if (this.phase === 'marks') {
      const msg = this.timer > 2.6 ? 'ÀS SUAS MARCAS' : this.timer > 1.2 ? 'PREPARA…' : '';
      if (msg) { slant(W / 2 - 220, 540, 440, 84, { fill: 'rgba(10,20,45,.9)', skew: 14, border: '#facc15' }); title(msg, W / 2, 584, 46, '#fff'); }
      label(`Comente ${this.runners.map((r, i) => `${i + 1} = ${trim(r.name, 8)}`).join(' · ')}`, W / 2, 1100, 18, '#fff', 'center', 800);
    }
    if (this.phase === 'finish' && this.winner && this.timer < 12) {
      const w = this.winner;
      ctx.fillStyle = 'rgba(5,10,25,.72)'; ctx.fillRect(0, 380, W, 500);
      title('OURO', W / 2, 440, 50, '#facc15');
      photo(w.photo || fakeFace(w.name + w.i), W / 2 - 110, 480, 220, 220, 20, (w.name[0] || '?').toUpperCase(), w.color);
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 6; ctx.strokeRect(W / 2 - 110, 480, 220, 220);
      title(trim(w.name, 14).toUpperCase(), W / 2, 740, 50, '#fff');
      label(`${this.finalT.toFixed(2).replace('.', ',')} s · ${w.fans} torcedores`, W / 2, 790, 22, '#e0f2fe', 'center', 800);
      leaderboardSmall(this.top, W / 2 - 150, 850);
    }
  },
}, {
  length: 200,
  items: [
    { name: 'Azul', color: '#2563eb', photo: '' },
    { name: 'Vermelho', color: '#dc2626', photo: '' },
  ],
}));
