'use strict';

// Personagens 3D por cima dos jogos desenhados em 2D (1000 Degraus, Limpa Vidros, Corta Frutas…).
// Uma camada transparente do tamanho da tela, com câmera reta: o jogo diz onde fica cada personagem em
// pixels da tela (x, y = pés) e a altura em pixels; a camada desenha todos de uma vez no ponto em que
// o jogo chamar draw() (o HUD que vier depois fica por cima). Quem não for pedido num quadro sai da tela.
const charLayer = {
  renderer: null, scene: null, cam: null, chars: new Map(), used: new Set(), q: 0.6, failed: false,
  ensure() {
    if (this.renderer) return true;
    if (this.failed || !G3.ready) return false;
    try {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      r.setPixelRatio(1); r.setSize(Math.round(W * this.q), Math.round(H * this.q), false); r.setClearColor(0x000000, 0);
      r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer = r;
    } catch { this.failed = true; return false; }
    const T = THREE, sc = new T.Scene();
    sc.add(new T.HemisphereLight(0xffffff, 0x3a3f66, 1.3));
    const key = new T.DirectionalLight(0xffffff, 2.3); key.position.set(200, 400, 600); sc.add(key);
    const rim = new T.DirectionalLight(0x9ef0ff, 1.1); rim.position.set(-300, 200, -400); sc.add(rim);
    // Câmera reta: 1 unidade = 1 pixel da tela; y para cima é negativo da tela
    this.cam = new T.OrthographicCamera(0, W, 0, -H, -2000, 2000); this.cam.position.set(0, 0, 1000); this.cam.lookAt(0, 0, 0);
    this.scene = sc;
    return true;
  },
  // Personagem com nome fixo neste jogo (cria na primeira vez; troca se o tipo mudar)
  get(key, kind, { height = 120, base = 'idle', user = null } = {}) {
    if (!this.ensure()) return null;
    let c = this.chars.get(key);
    if (c && (c.kind !== kind || c.hPx !== height)) { c.dispose(); this.chars.delete(key); c = null; }
    if (!c) {
      c = new Character3D({ kind, height, plate: false, base, user });
      c.hPx = height; c.root.rotation.y = 0.35;
      // A sombra redonda deitada não faz sentido na câmera reta
      if (c.shadow) c.shadow.visible = false;
      if (c.ring) c.ring.visible = false;
      this.scene.add(c.root); this.chars.set(key, c);
    }
    this.used.add(key);
    return c;
  },
  // Coloca nos pixels da tela (x, y = onde ficam os pés); facing: giro (0 = de frente, + = olhando para a direita)
  place(c, x, y, facing) { if (!c) return; c.root.position.set(x, -y, 0); if (facing != null) c.root.rotation.y = facing; },
  draw(dt = 1 / 60) {
    if (!this.renderer) return;
    for (const [k, c] of this.chars) if (!this.used.has(k)) { c.dispose(); this.chars.delete(k); }
    this.used.clear();
    if (!this.chars.size) return;
    for (const c of this.chars.values()) c.update(dt);
    this.renderer.render(this.scene, this.cam);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
  },
  clear() { for (const c of this.chars.values()) c.dispose(); this.chars.clear(); this.used.clear(); },
};
