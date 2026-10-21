'use strict';

// ---------------- Lutadores 3D (id stick-fighters) ----------------
// Duelo um contra um com personagens 3D animados (GLB com esqueleto). Mesmas regras de antes:
// fila → dois no palco → o vencedor fica. O dano sai no quadro do golpe da animação, o defensor
// reage (bloqueia, desvia ou apanha) e a câmera acompanha os momentos importantes.
const F3D_X = 1.0;
const F3D_MOVES = [
  // arma 0: mãos e pés
  [{ s: 'punch', dmg: 1, reach: 0.55 }, { s: 'punch', dmg: 1, reach: 0.55 }, { s: 'kick', dmg: 1.3, reach: 0.7 }],
  // arma 1: arma do personagem (espada, machado, adaga, varinha)
  [{ s: 'slash', dmg: 1.6, reach: 0.6 }, { s: 'stab', dmg: 1.5, reach: 0.7 }, { s: 'jumpAttack', dmg: 2.1, reach: 0.8, heavy: true }],
  // arma 2: golpe especial (rajada de energia ou giro pesado)
  [{ s: 'cast', dmg: 2.4, reach: 0, ranged: true, heavy: true }, { s: 'spin', dmg: 2.6, reach: 0.6, heavy: true }, { s: 'slash', dmg: 2, reach: 0.6 }],
];

// DuelBase primeiro: as funções deste jogo (update, reset, ko…) substituem as da base.
defineGame(Object.assign({}, DuelBase, {
  id: 'stick-fighters', name: 'Lutadores 3D', genre: 'battle', icon: '🥋', color: '#3b82f6', three: true,
  desc: 'Duelos um contra um com lutadores 3D animados. Quem entra na live vai para a fila; presentes dão vida, arma e golpe especial. Quem vence fica no palco.',
  help: '<p>Entre na live (ou comente) para entrar na <b>fila</b>. Dois lutam por vez e o vencedor fica. Cada espectador ganha sempre o mesmo personagem 3D, com a foto e o nome na placa.</p><p>🎁 Presentes dão <b>vida</b>: com 300+ você luta com a <b>arma</b> do personagem e com 1.000+ libera o <b>golpe especial</b>. ❤️ Likes curam quem está no palco. Comentários de quem está lutando aparecem num balão em cima do lutador.</p>',
  settings: [
    ...DUEL_COMMON,
    { key: 'fightPace', type: 'slider', label: 'Ritmo da luta', min: 0.5, max: 2, step: 0.1, default: 1 },
    { key: 'swordHpThreshold', type: 'number', label: 'Vida para lutar com arma', min: 50, max: 5000, default: 300 },
    { key: 'pistolHpThreshold', type: 'number', label: 'Vida para o golpe especial', min: 100, max: 20000, default: 1000 },
    { key: 'fxLevel', type: 'slider', label: 'Intensidade dos efeitos', min: 0.2, max: 1, step: 0.1, default: 1, group: 'Visual' },
    { key: 'camMoves', type: 'toggle', label: 'Câmera dinâmica (aproxima no nocaute)', default: true, group: 'Visual' },
    { key: 'chatBubbles', type: 'toggle', label: 'Balão com o comentário de quem está lutando', default: true, group: 'Visual' },
  ],
  actions: [{ id: 'join', label: 'Entrar na fila', icon: '🚶' }, { id: 'grow_hp', label: 'Mais vida', icon: '💪' }, { id: 'heal_stage', label: 'Curar o palco', icon: '❤️' }, { id: 'special', label: 'Golpe especial agora', icon: '⚡' }],
  bindings: [{ action: 'join', trigger: 'join' }, { action: 'join', trigger: 'comment' }, { action: 'grow_hp', trigger: 'gift', minCoins: 1 }, { action: 'heal_stage', trigger: 'like', likes: 10 }],
  sample() { return pick(['eu', 'luta', 'bora']); },
  weapon(e) { return e.max >= this.s.pistolHpThreshold ? 2 : e.max >= this.s.swordHpThreshold ? 1 : 0; },
  enter() { Assets3D.preload([...HERO_KINDS, ...UNDEAD_KINDS.slice(0, 2)]); },
  leave() { this.dispose3d(); },
  reset() {
    DuelBase.reset.call(this);
    this.exch = null; this.proj = []; this.hitStop = 0; this.countdown = 0;
    if (this.r) { for (const c of this.r.chars.values()) c.dispose(); this.r.chars.clear(); this.r.fx.clear(); }
  },
  onAction(id, a) {
    if (id === 'join') {
      const isNew = !this.find(a.user);
      this.join(a.user);
      if (isNew) { this.feed.push(a.user, 'entrou na fila 🥋', '#93c5fd'); this.hype(0.08); }
    } else if (id === 'grow_hp') {
      const before = this.find(a.user), wBefore = before ? this.weapon(before) : 0;
      const n = a.coins * this.s.hpPerCoin, e = this.addHp(a.user, n), w = this.weapon(e);
      this.feed.push(a.user, `💪 +${fmtK(n)} de vida${w > wBefore ? (w === 2 ? ' · GOLPE ESPECIAL!' : ' · ARMA!') : ''}`, '#22e3ee');
      this.powerUp(e, a.coins, w > wBefore);
    } else if (id === 'heal_stage') {
      for (const e of [this.a, this.b]) if (e) { e.hp = Math.min(e.max, e.hp + 5); this.sparkle(e, '#4ade80', 6, '+5'); }
    } else if (id === 'special') {
      const e = this.find(a.user) || this.a;
      if (e && (e === this.a || e === this.b)) e.forceSpecial = true;
    }
  },
  onChat(ev) {
    if (!this.s.chatBubbles) return;
    const e = [this.a, this.b].find((x) => x && x.k === (ev.user.id || ev.user.nick));
    if (e) this.charOf(e)?.say(ev.text, { color: '#ffffff', secs: 3.5 });
  },
  onEvent(ev) {
    // Toda curtida dá um pulinho na torcida; presentes grandes fazem a arena explodir em luz.
    if (ev.type === 'like') this.hype(Math.min(0.05, (ev.count || 1) * 0.004));
    if (ev.type === 'gift') this.hype(Math.min(0.6, Math.log10(1 + coins(ev)) * 0.15));
  },
  // Troca de personagem (presente de troca ou !nome): o novo aparece no mesmo lugar, com faíscas
  onCharPick(user) {
    const key = user.id || user.nick, r = this.r, c = r?.chars.get(key);
    if (!c) return;
    const pos = c.root.position.clone(), rot = c.root.rotation.y;
    c.dispose(); r.chars.delete(key); this.syncChars();
    const n = r.chars.get(key);
    if (n) { n.root.position.copy(pos); n.root.rotation.y = rot; n.entering = false; n.play('spawnAir'); r.fx.burst(pos.clone().setY(1.2), { color: ['#22e3ee', '#ffffff', '#fde047'], n: 30, speed: 4, up: 2, size: 0.25, life: 0.8 }); }
  },
  hype(n) { if (this.r) this.r.arena.hype = Math.min(1, this.r.arena.hype + n); },

  // ---------- Cena ----------
  scene3d() {
    if (this.r || !G3.ready) return this.r;
    const T = THREE, scene = new T.Scene();
    const arena = buildArena(scene, { floor: '#22314f', rim: '#3b82f6', rim2: '#ef4444', logo: 'LUTA', radius: 6.5 });
    const cam = new T.PerspectiveCamera(40, W / H, 0.1, 200);
    const dir = new CamDirector(cam, { pos: [0, 2.9, 10.8], look: [0, 1.35, 0] });
    const fx = new FX3D(scene, 260);
    this.r = { scene, cam, dir, fx, arena, chars: new Map() };
    return this.r;
  },
  dispose3d() {
    if (!this.r) return;
    for (const c of this.r.chars.values()) c.dispose();
    this.r.chars.clear(); this.r.fx.clear();
  },
  charOf(e) { return e && this.r?.chars.get(e.k); },
  // Cria/remove os personagens de quem está no palco; cuida da entrada e de ir para o lugar certo.
  syncChars() {
    const r = this.r;
    const on = [this.a, this.b].filter(Boolean);
    for (const [k, c] of r.chars) if (!on.some((e) => e.k === k)) { c.dispose(); r.chars.delete(k); }
    on.forEach((e) => {
      let c = r.chars.get(e.k);
      const side = e === this.a ? -1 : 1;
      if (!c) {
        const kind = e.user.bot ? kindFor(e.user, UNDEAD_KINDS) : kindFor(e.user);
        c = new Character3D({ kind, user: e.user, loadout: ['none', 'weapon', 'special'][this.weapon(e)], height: 2, tint: side < 0 ? '#2563eb' : '#dc2626', hp: true, base: 'fightIdle' });
        c.root.position.set(side * 6, 0, -0.6);
        c.entering = true;
        if (e.user.bot) c.setTag('BOT · DEMONSTRAÇÃO');
        r.scene.add(c.root); r.chars.set(e.k, c);
      }
      c.side = side; c.targetX = side * F3D_X;
      const lo = ['none', 'weapon', 'special'][this.weapon(e)];
      if (c.loadoutName !== lo) c.setLoadout(lo);
      c.setHp(e.hp / Math.max(1, e.max));
      c.setCrown(e.wins > 0);
    });
  },
  // Move cada lutador até o lugar dele (correndo) e vira para o adversário.
  moveChars(dt) {
    const r = this.r;
    for (const c of r.chars.values()) {
      if (c.dead) continue;
      const x = c.root.position.x, tx = c.targetX + (c.lunge || 0);
      const dx = tx - x;
      if (Math.abs(dx) > 0.06 && !c.lunging) {
        const sp = c.entering ? 6 : 3.2;
        c.root.position.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt);
        c.root.position.z += (0 - c.root.position.z) * Math.min(1, dt * 3);
        c.root.rotation.y = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (!c.busy && c.state !== 'run') c.play('run', { once: true });
        c.moving = true;
      } else if (c.lunging) {
        c.root.position.x += (tx - x) * Math.min(1, dt * 14);
      } else if (c.moving || c.entering) {
        c.moving = false;
        c.root.rotation.y = c.side < 0 ? Math.PI / 2 : -Math.PI / 2;
        if (c.entering) {
          c.entering = false;
          // Chegada: poeira, tremida e provocação
          r.fx.burst(new THREE.Vector3(c.root.position.x, 0.1, c.root.position.z), { color: '#cbd5e1', n: 18, speed: 3, up: 0.6, gravity: -1, tex: 'smoke', additive: false, size: 0.6, life: 0.8 });
          r.dir.shake(0.08, 0.2);
          c.play('taunt');
        } else c.play('fightIdle');
      } else c.root.rotation.y = c.side < 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  },

  // ---------- Luta ----------
  // Chamado pela base em cada quadro da fase de luta: decide a próxima troca de golpes.
  fight(dt) {
    if (!this.r) { this.fight2d(dt); return; }
    const A = this.charOf(this.a), B = this.charOf(this.b);
    if (!A || !B || A.entering || B.entering || A.moving || B.moving) return;
    if (this.exch) return;
    this.t -= dt * this.s.fightPace;
    if (this.t > 0 || A.busy || B.busy) return;
    this.t = rand(0.35, 0.8);
    const atkE = this.a.forceSpecial ? this.a : this.b.forceSpecial ? this.b : Math.random() < 0.5 ? this.a : this.b;
    const defE = atkE === this.a ? this.b : this.a;
    const special = Boolean(atkE.forceSpecial); atkE.forceSpecial = false;
    const tier = special ? 2 : this.weapon(atkE);
    const mv = special ? F3D_MOVES[2][0] : pick(F3D_MOVES[tier]);
    // Reação decidida na hora do golpe (mesma sequência em todas as telas)
    const roll = Math.random();
    const reaction = mv.heavy ? (roll < 0.12 ? 'dodge' : 'hit') : roll < 0.16 ? 'dodge' : roll < 0.36 ? 'block' : 'hit';
    const dmg = Math.round((8 + Math.sqrt(atkE.max) * 0.9) * mv.dmg * rand(0.75, 1.25));
    this.exch = { atkE, defE, mv, reaction, dmg, t: 0 };
    this.attack(this.exch);
  },
  attack(x) {
    const r = this.r, A = this.charOf(x.atkE), D = this.charOf(x.defE);
    // Avança um pouco para alcançar o adversário
    A.lunge = -A.side * x.mv.reach; A.lunging = true;
    // O defensor se prepara um instante antes do impacto
    if (x.reaction === 'block') setTimeout(() => { if (!D.disposed && !D.dead) D.play('block', { speed: 1.4 }); }, 120);
    A.play(x.mv.s, {
      speed: x.mv.s === 'cast' ? 1.2 : 1.15,
      onImpact: () => {
        if (x.mv.ranged) this.fireProjectile(x);
        else this.impact(x);
      },
    });
    if (x.mv.heavy && this.s.camMoves) r.dir.focus(A.root.position, { secs: 0.9, dist: 6.2, height: 1.4, side: -A.side * 0.8 });
  },
  fireProjectile(x) {
    const r = this.r, A = this.charOf(x.atkE), D = this.charOf(x.defE);
    const col = new THREE.Color(A.def.accent);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({ color: col, toneMapped: false }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: Tex3D.spark(), color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    glow.scale.setScalar(1.4); orb.add(glow);
    orb.position.set(A.root.position.x - A.side * 0.6, 1.3, A.root.position.z + 0.1);
    r.scene.add(orb);
    this.proj.push({ m: orb, x, to: D.root.position.x + A.side * 0.2, v: -A.side * 9, trail: 0 });
    sfx.tone(520, 0.12, 'sine', 0.06); sfx.tone(780, 0.1, 'triangle', 0.05, 0.05);
  },
  // Golpe acertou (ou foi bloqueado/desviado): dano, reação, efeitos, som.
  impact(x) {
    const r = this.r, A = this.charOf(x.atkE), D = this.charOf(x.defE);
    A.lunging = false; A.lunge = 0;
    this.exch = null;
    if (!D || D.dead) return;
    const at = new THREE.Vector3((A.root.position.x + D.root.position.x) / 2 + A.side * 0.15, 1.3, 0.3);
    if (x.reaction === 'dodge') {
      D.play(pick(['dodge', 'dodgeL', 'dodgeR']), { speed: 1.3 });
      r.fx.text(new THREE.Vector3(D.root.position.x, 2.4, 0.4), 'DESVIOU!', { color: '#e0f2fe', size: 0.55 });
      r.fx.burst(at, { color: '#e0f2fe', n: 6, speed: 2, size: 0.15, life: 0.3 });
      sfx.tone(900, 0.05, 'sine', 0.04);
      return;
    }
    let dmg = x.dmg;
    if (x.reaction === 'block') {
      dmg = Math.max(1, Math.round(dmg * 0.25));
      D.play('blockHit');
      r.fx.burst(at, { color: ['#93c5fd', '#ffffff'], n: 14, speed: 4, size: 0.18, life: 0.35 });
      r.fx.ring(at, { color: '#93c5fd', size: 1.6, flat: false, life: 0.3 });
      sfx.tone(330, 0.06, 'square', 0.06);
    } else {
      D.play('hit', { speed: 1.2 });
      D.hitFlash(0xffffff, 1);
      const heavy = x.mv.heavy;
      r.fx.burst(at, { color: heavy ? ['#fde047', '#fb923c', '#ffffff'] : ['#fde047', '#ffffff'], n: heavy ? 40 : 22, speed: heavy ? 7 : 5, size: heavy ? 0.3 : 0.22, life: 0.5 });
      r.fx.ring(at, { color: heavy ? '#fb923c' : '#fde047', size: heavy ? 3 : 2, flat: false });
      r.dir.shake(heavy ? 0.22 : 0.1, heavy ? 0.35 : 0.18);
      this.hitStop = heavy ? 0.09 : 0.04;
      sfx.tone(heavy ? 110 : 170, 0.1, 'sawtooth', 0.09); sfx.tone(60, 0.12, 'sine', 0.1);
    }
    x.defE.hp -= dmg;
    D.setHp(x.defE.hp / Math.max(1, x.defE.max));
    r.fx.text(new THREE.Vector3(D.root.position.x + rand(-0.2, 0.2), 2.3, 0.4), `-${fmtK(dmg)}`, { color: x.reaction === 'block' ? '#93c5fd' : x.mv.heavy ? '#fb923c' : '#fde047', size: x.mv.heavy ? 0.85 : 0.65 });
  },
  ko(w) {
    DuelBase.ko.call(this, w);
    const r = this.r;
    if (!r) return;
    const l = w === this.a ? this.b : this.a, W3 = this.charOf(w), L3 = this.charOf(l);
    this.exch = null;
    if (L3) { L3.dead = true; L3.play('death', { hold: true }); L3.hitFlash(0xff3b3b, 1); L3.setHp(0); r.fx.burst(new THREE.Vector3(L3.root.position.x, 1, 0), { color: ['#ef4444', '#ffffff', '#fbbf24'], n: 50, speed: 7, size: 0.3 }); }
    if (W3) {
      W3.lunging = false; W3.lunge = 0;
      setTimeout(() => { if (!W3.disposed) W3.play('victory', { then: 'taunt' }); }, 500);
      W3.setCrown(true);
      if (this.s.camMoves) { r.dir.slow(0.8); r.dir.focus(W3.root.position, { secs: Math.max(1.5, (this.s.winHold || 3) - 0.3), dist: 6.8, height: 1.5, side: -W3.side * 0.5 }); }
      r.fx.burst(new THREE.Vector3(W3.root.position.x, 2.6, 0), { color: ['#fde047', '#60a5fa', '#f472b6', '#4ade80'], n: 60, speed: 6, size: 0.25, tex: 'star', additive: false, gravity: -4, up: 4, life: 1.6 });
    }
    this.hype(0.6);
  },
  powerUp(e, coinsN, upgraded) {
    const c = this.charOf(e);
    if (!c) return;
    const big = Math.log10(1 + coinsN);
    if (!c.busy && !c.entering) c.play('powerUp', { speed: 1.3 });
    const p = new THREE.Vector3(c.root.position.x, 0.2, c.root.position.z);
    this.r.fx.burst(p, { color: [c.def.accent, '#ffffff', '#22e3ee'], n: 12 + big * 14, speed: 2.5, up: 4, gravity: 1.5, size: 0.25, life: 1 });
    this.r.fx.ring(p.clone().setY(0.05), { color: c.def.accent, size: 2.5 + big });
    this.r.fx.text(new THREE.Vector3(c.root.position.x, 2.5, 0.4), `+${fmtK(coinsN * this.s.hpPerCoin)}`, { color: '#4ade80', size: 0.7 });
    if (upgraded) { c.setTag(this.weapon(e) === 2 ? 'GOLPE ESPECIAL' : 'ARMADO'); this.r.dir.shake(0.12, 0.3); sfx.confirm(); }
    c.setHp(e.hp / Math.max(1, e.max));
  },
  sparkle(e, color, n, txt) {
    const c = this.charOf(e);
    if (!c) return;
    this.r.fx.burst(new THREE.Vector3(c.root.position.x, 1.2, 0), { color: [color, '#ffffff'], n, speed: 1.5, up: 2, gravity: 0.5, size: 0.18, tex: 'star', additive: false, life: 0.9 });
    if (txt && Math.random() < 0.5) this.r.fx.text(new THREE.Vector3(c.root.position.x, 2.4, 0.4), txt, { color, size: 0.45, life: 0.7 });
  },
  // Sem WebGL: a luta continua com a lógica antiga (sem animação), para o jogo não parar.
  fight2d(dt) {
    this.t -= dt * this.s.fightPace;
    if (this.t > 0) return;
    this.t = rand(0.45, 0.9);
    const atk = Math.random() < 0.5 ? this.a : this.b, def = atk === this.a ? this.b : this.a;
    if (Math.random() < 0.18) return;
    def.hp -= Math.round((8 + Math.sqrt(atk.max) * 0.9) * [1, 1.6, 2.4][this.weapon(atk)] * rand(0.7, 1.3));
  },
  update(dt) {
    const r = this.r;
    // Congela um instante no impacto (sensação de peso) e câmera lenta no nocaute.
    if (this.hitStop > 0) { this.hitStop -= dt; dt *= 0.05; }
    const k = r ? r.dir.timeScale : 1;
    DuelBase.update.call(this, dt * k);
    if (this.ph === 'intro') this.countdown = this.t;
    if (!r) return;
    r.fx.level = this.s.fxLevel;
    this.syncChars();
    this.moveChars(dt * k);
    for (const c of r.chars.values()) c.update(dt * k);
    // Projéteis
    for (let i = this.proj.length - 1; i >= 0; i--) {
      const p = this.proj[i];
      p.m.position.x += p.v * dt * k;
      p.trail -= dt;
      if (p.trail <= 0) { p.trail = 0.03; r.fx.burst(p.m.position, { color: p.m.material.color.getStyle(), n: 2, speed: 0.6, up: 0.2, gravity: 0, size: 0.3, life: 0.35 }); }
      if ((p.v > 0 && p.m.position.x >= p.to) || (p.v < 0 && p.m.position.x <= p.to) || !this.charOf(p.x.defE)) {
        r.scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); p.m.children[0]?.material.dispose();
        this.proj.splice(i, 1);
        if (this.charOf(p.x.defE)) this.impact(p.x); else this.exch = null;
      }
    }
    // Troca de golpes travada (alguém saiu do palco no meio): libera.
    if (this.exch && (!this.charOf(this.exch.atkE) || !this.charOf(this.exch.defE) || (this.exch.t += dt) > 3)) { const A = this.charOf(this.exch?.atkE); if (A) { A.lunging = false; A.lunge = 0; } this.exch = null; }
    r.fx.update(dt);
    r.arena.update(performance.now() / 1000, dt);
  },
  draw() {
    const r = this.scene3d(), t = performance.now() / 1000;
    if (r) {
      r.dir.update(1 / 60, t);
      G3.render(r.scene, r.cam);
    } else if (!customBackground(this)) stageBg('blue', t, { floor: true });
    // Topo: título e barras de vida
    title('LUTADORES 3D', W / 2, 54, 44, '#93c5fd');
    hudFighter(24, 96, 330, this.a, { color: '#3b82f6', extra: ['', 'ARMA', 'ESPECIAL'][this.a ? this.weapon(this.a) : 0] });
    hudFighter(W - 24 - 330, 96, 330, this.b, { color: '#ef4444', flip: true, extra: ['', 'ARMA', 'ESPECIAL'][this.b ? this.weapon(this.b) : 0] });
    if (this.a && this.b) { ctx.save(); ctx.translate(W / 2, 142); ctx.rotate(-0.08); label('VS', 0, 0, 40, '#fff', 'center', 900); ctx.restore(); }
    // Chamadas
    if (this.ph === 'intro') {
      const n = Math.ceil(this.t / 0.5);
      const k = 1 - ((this.t % 0.5) / 0.5);
      ctx.globalAlpha = 1 - k * 0.6;
      title(n > 1 ? String(n - 1) : 'LUTEM!', W / 2, 440, 90 + k * 40, n > 1 ? '#fff' : '#facc15');
      ctx.globalAlpha = 1;
    }
    if (this.ph === 'ko') {
      const k = Math.min(1, ((this.s.winHold || 3) - this.t) * 3);
      ctx.save(); ctx.translate(W / 2, 420); ctx.scale(0.6 + k * 0.4, 0.6 + k * 0.4); ctx.globalAlpha = k;
      title(this.koText, 0, 0, 110, '#ff2d55');
      ctx.restore();
      if (this.winner) {
        // Cartão do vencedor embaixo, sem tapar o personagem
        const y = 870, w = W - 120;
        ctx.globalAlpha = k;
        ctx.fillStyle = 'rgba(10,12,30,.9)'; ctx.beginPath(); ctx.roundRect(60, y, w, 96, 26); ctx.fill();
        ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3; ctx.stroke();
        avatar(this.winner.user, 116, y + 48, 36, '#facc15');
        label(`${trim(this.winner.user.nick, 18)} VENCEU`, 168, y + 36, 30, '#fff', 'left', 900);
        label(this.winner.wins > 1 ? `🔥 ${this.winner.wins} vitórias seguidas` : 'primeira vitória · fica no palco', 168, y + 70, 18, '#fde68a', 'left', 800);
        ctx.globalAlpha = 1;
      }
    }
    if (this.ph === 'wait' && (!this.a || !this.b)) {
      pill(this.a ? 'esperando um desafiante… entre na live!' : 'entre na live para lutar', W / 2, 760, { size: 22, bg: 'rgba(10,12,30,.85)', border: '#3b82f6' });
    }
    // Fila embaixo
    ctx.fillStyle = 'rgba(8,10,22,.78)'; ctx.beginPath(); ctx.roundRect(20, 990, W - 40, 112, 24); ctx.fill();
    label(`PRÓXIMOS (${this.q.length})`, 44, 1016, 16, '#93c5fd', 'left', 900);
    this.q.slice(0, 9).forEach((e, i) => {
      const x = 62 + i * 72;
      e.qIn = Math.min(1, (e.qIn || 0) + 0.08);
      const s = 0.4 + 0.6 * (1 - Math.pow(1 - e.qIn, 3));
      avatar(e.user, x, 1062, 26 * s, e.user.bot ? '#64748b' : '#fff');
      label(fmtK(e.hp), x, 1100, 13, '#fff', 'center', 900);
    });
    if (!this.q.length) label('ninguém na fila', 44, 1062, 18, 'rgba(255,255,255,.55)', 'left', 700);
    if (this.s.showLeaderboard) hudBoard([...this.streaks.values()].sort((x, y) => y.value - x.value), W - 260, 830, 240, { title: 'MAIS VITÓRIAS', n: this.s.leaderboardSize, rowH: 30 });
    this.feed.draw(20, 210);
  },
}));
