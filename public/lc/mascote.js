'use strict';

// Personagens em todos os jogos:
//  • Mascote: nos jogos que ainda não têm personagens próprios, um personagem 3D da lista fica na tela
//    (sorteado e fixo para cada jogo) e reage aos comentários, likes, presentes, seguidores e entradas.
//  • Troca por presente: um presente escolhido no painel (padrão "Coração pra mim") troca o personagem de
//    quem mandou — o que ele pediu com !nome, ou um sorteado. Nos jogos com um personagem só, troca o principal.
//  • Lista na tela: todos os personagens com a foto e o comando, quando alguém comenta !personagens,
//    de tempos em tempos e pelo botão do painel.
// Jogos com personagens próprios marcam hasChars: true (o mascote não aparece neles).

const HAS_CHARS = ['ai-host', 'stick-fighters', 'battle-arena', 'dance-floor', 'only-climb', 'obby-tower', 'only-heaven', 'tower-war', 'territory-war', 'zombie-hill', 'mma-clash'];
Object.assign(CHAR_DEFAULTS, { mascotOn: true, mascotPos: 'right', mascotKind: '', changeGiftId: '7934', changeGiftName: 'Coração pra mim', galleryEvery: 10, galleryCmd: true });

const mascot = {
  renderer: null, scene: null, cam: null, char: null, kind: '', over: new Map(), react: 0,
  hidden() { const c = charCfg(); return !c.mascotOn || !current || current.hasChars || HAS_CHARS.includes(current.id) || !G3.ready; },
  kindNow() { return this.over.get(current.id) || pickKind(charCfg().mascotKind, 0, current.id); },
  ensure() {
    if (this.renderer) return true;
    try {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      r.setPixelRatio(1); r.setSize(320, 420, false); r.setClearColor(0x000000, 0);
      r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer = r;
    } catch { this.failed = true; return false; }
    const T = THREE, sc = new T.Scene();
    sc.add(new T.HemisphereLight(0xffffff, 0x3a3f66, 1.25));
    const key = new T.DirectionalLight(0xffffff, 2.2); key.position.set(2, 4, 5); sc.add(key);
    const rim = new T.DirectionalLight(0x9ef0ff, 1.4); rim.position.set(-3, 3, -4); sc.add(rim);
    // Pedestal brilhante
    const ped = new T.Mesh(new T.CylinderGeometry(0.75, 0.85, 0.16, 32), new T.MeshStandardMaterial({ color: 0x1b2148, metalness: 0.5, roughness: 0.3, emissive: 0x2236a8, emissiveIntensity: 0.35 }));
    ped.position.y = -0.08; sc.add(ped);
    const ring = new T.Mesh(new T.TorusGeometry(0.82, 0.03, 8, 48), new T.MeshBasicMaterial({ color: 0x22e3ee, toneMapped: false })); ring.rotation.x = Math.PI / 2; sc.add(ring);
    this.cam = new T.PerspectiveCamera(30, 320 / 420, 0.1, 50); this.cam.position.set(0, 1.25, 5.6); this.cam.lookAt(0, 1.05, 0);
    this.scene = sc; this.fx = new FX3D(sc, 60);
    return true;
  },
  set(kind) { this.over.set(current.id, kind); },
  draw(dt) {
    if (this.hidden() || this.failed || !this.ensure()) return;
    const k = this.kindNow();
    if (!this.char || this.kind !== k) {
      const old = this.char;
      this.char?.dispose();
      this.char = new Character3D({ kind: k, height: 1.9, plate: false, base: 'idle' });
      this.char.root.rotation.y = -0.25; this.char.bubble.userData.w = 1.7;
      this.scene.add(this.char.root); this.kind = k;
      if (old) { this.char.play('spawnAir'); this.fx.burst(new THREE.Vector3(0, 1, 0), { color: ['#22e3ee', '#ffffff', '#fde047'], n: 30, speed: 3, up: 2, size: 0.18, life: 0.8 }); }
    }
    this.react = Math.max(0, this.react - dt);
    this.char.update(dt); this.fx.update(dt);
    this.char.root.rotation.y = -0.25 + Math.sin(performance.now() / 2200) * 0.25;
    this.renderer.render(this.scene, this.cam);
    const w = 172, h = 226, left = charCfg().mascotPos === 'left';
    ctx.drawImage(this.renderer.domElement, left ? 4 : W - w - 4, 930, w, h);
  },
  // Reações aos eventos da live
  onEvent(ev) {
    if (this.hidden() || !this.char) return;
    const c = this.char, nick = trim(ev.user?.nick || '', 12);
    if (ev.type === 'gift') { c.play(coins(ev) >= 100 ? 'powerUp' : 'victory', { speed: 1.3 }); c.say(`valeu ${nick}! 🎁`, { secs: 2.2 }); this.fx.burst(new THREE.Vector3(0, 1.4, 0), { color: ['#fde047', '#f472b6', '#ffffff'], n: Math.min(40, 10 + Math.log2(1 + coins(ev)) * 4), speed: 3, up: 2, size: 0.15, tex: 'star', additive: false, life: 1 }); this.react = 1.5; return; }
    if (this.react > 0) return;
    if (ev.type === 'social') { c.play(ev.action === 'share' ? 'taunt' : 'victory'); c.say(ev.action === 'share' ? `obrigado por compartilhar, ${nick}!` : `bem-vindo, ${nick}!`, { secs: 2.2 }); this.react = 2; }
    else if (ev.type === 'join' && Math.random() < 0.3) { c.play('interact'); c.say(`oi ${nick}!`, { secs: 1.8 }); this.react = 2.5; }
    else if (ev.type === 'like' && Math.random() < 0.25) { c.play('jump', { speed: 1.4 }); this.fx.burst(new THREE.Vector3(0, 1.6, 0), { color: ['#f472b6', '#ffffff'], n: 5, speed: 1.2, up: 1.5, gravity: 0.5, size: 0.12, tex: 'star', additive: false, life: 0.8 }); this.react = 1.2; }
    else if (ev.type === 'chat' && Math.random() < 0.35) { c.play(pick(['interact', 'taunt', 'victory'])); this.react = 2; }
  },
};

// ---------- Troca por presente e lista na tela ----------
const charLive = {
  wish: new Map(), // !nome pedido recentemente (vale para o presente de troca)
  lastGallery: 0,
  isChangeGift(ev) { const c = charCfg(); return ev.type === 'gift' && ((c.changeGiftId && String(ev.giftId) === String(c.changeGiftId)) || (c.changeGiftName && norm(ev.name || '') === norm(c.changeGiftName))); },
  onEvent(ev) {
    const c = charCfg();
    if (ev.type === 'chat') {
      const t = String(ev.text || '').trim();
      if (c.galleryCmd && /^!(personagens|lista|skins|bonecos)$/i.test(t)) { this.showGallery(); return; }
      const m = t.match(/^(?:!|personagem\s+|boneco\s+|skin\s+)(.{2,24})$/i), k = m && charByName(m[1]);
      if (k) this.wish.set(charKeyOf(ev.user), { k, t: Date.now() });
    }
    if (this.isChangeGift(ev)) this.change(ev.user);
    mascot.onEvent(ev);
  },
  // Troca o personagem de quem mandou o presente
  change(user) {
    const key = charKeyOf(user), w = this.wish.get(key), cur = CHAR_PICKS.get(key);
    const pool = current?.charPool || HERO_KINDS; // o jogo pode limitar (ex.: Colina dos Zumbis só zumbis e caveiras)
    let k = w && Date.now() - w.t < 5 * 60e3 && pool.includes(w.k) ? w.k : null;
    if (!k) { const opts = pool.filter((x) => x !== cur && x !== mascot.kind); k = opts.length ? opts[Math.floor(Math.random() * opts.length)] : pool[0]; }
    CHAR_PICKS.set(key, k);
    const name = CHARACTERS[k]?.name || k;
    if (current.hasChars || HAS_CHARS.includes(current.id)) current.onCharPick?.(user, k);
    else mascot.set(k);
    announcer.show(`${trim(user?.nick || '', 14)} trocou para ${name}!`, '#9ef0ff', 2.5, 36);
  },
  showGallery() {
    if (Date.now() - this.lastGallery < 20000) return;
    this.lastGallery = Date.now();
    const c = charCfg(), ovl = document.getElementById('ovl');
    if (!ovl) return;
    ovl.querySelector('.chgal')?.remove();
    const gift = c.changeGiftName || 'presente';
    const el = document.createElement('div');
    el.className = 'chgal';
    el.innerHTML = `<h2>ESCOLHA SEU PERSONAGEM</h2><p class="chgal-how">comente <b>!nome</b> · mande <b>🎁 ${escHtml(gift)}</b> para trocar</p>
      <div class="chgal-grid">${(current?.charPool || HERO_KINDS).map((k) => `<div class="chgal-c" style="--c1:${CHARACTERS[k].accent}"><img src="/assets/chars/fotos/${k}.webp" alt="" onerror="this.style.visibility='hidden'"><b>${escHtml(CHARACTERS[k].name)}</b><small>!${escHtml(norm(CHARACTERS[k].name).replace(/\s+/g, ''))}</small></div>`).join('')}</div>`;
    ovl.append(el);
    setTimeout(() => el.classList.add('out'), 13000);
    setTimeout(() => el.remove(), 13600);
  },
  tick(dt) {
    const every = Number(charCfg().galleryEvery) || 0;
    if (!every) return;
    this.t = (this.t || 0) + dt;
    if (this.t >= every * 60) { this.t = 0; this.showGallery(); }
  },
};
