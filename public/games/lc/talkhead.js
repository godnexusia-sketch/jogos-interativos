'use strict';

// ---------------- Apresentador IA com cabeças falantes ----------------
// Padrão: três cabeças 3D enviadas pelo dono (busto, máscara facial e caveira). Os modelos não têm boca
// animada, então aqui é criado um "morph" de queixo em cada um (a parte de baixo do rosto desce com a voz)
// e uma boca escura que abre no volume da fala. Também dá para escolher qualquer personagem da lista.
const TALK_HEADS = {
  busto: { name: 'Busto Falante', file: 'cabeca_busto', voice: 'locutor', glow: '#e2e8f0', finish: 'marmore', hide: [], nose: [0, 0.138, 0.133], headH: 0.25 },
  mascara: { name: 'Máscara Holográfica', file: 'cabeca_mascara', voice: 'thalita', glow: '#22d3ee', finish: 'holograma', hide: [/occluder/i], nose: [0, 0.002, 0.114], headH: 7.4 },
  caveira: { name: 'Caveira Falante', file: 'cabeca_caveira', voice: 'robo', glow: '#a78bfa', finish: 'cromo', hide: [], nose: [0, 0.048, 0.201], headH: 0.4, mouthK: 0.32, chinK: 0.6 },
};
const HEAD_FINISH = {
  marmore: () => new THREE.MeshPhysicalMaterial({ color: 0xf3f0ea, roughness: 0.35, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.3 }),
  ouro: () => new THREE.MeshStandardMaterial({ color: 0xf5c542, metalness: 1, roughness: 0.22 }),
  cromo: () => new THREE.MeshStandardMaterial({ color: 0xd7dde8, metalness: 1, roughness: 0.12 }),
  pele: () => new THREE.MeshPhysicalMaterial({ color: 0xd9a37f, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0xffc4a3) }),
  holograma: () => new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 0.7, transparent: true, opacity: 0.82, roughness: 0.15, metalness: 0.3 }),
  neon: () => new THREE.MeshStandardMaterial({ color: 0x1e1b4b, emissive: 0xa855f7, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.6 }),
};

(() => {
  const g = GAMES.find((x) => x.id === 'ai-host');
  if (!g) return;
  // Apresentador: as cabeças primeiro (padrão) e depois todos os personagens da lista
  const lookSet = g.settings.find((s) => s.key === 'look');
  lookSet.options = [...Object.entries(TALK_HEADS).map(([k, v]) => ['h:' + k, `🗣️ ${v.name}`]), ...ALL_KINDS.map((k) => ['c:' + k, `🧍 ${CHARACTERS[k].name}`])];
  lookSet.default = 'h:busto';
  lookSet.label = 'Apresentador (cabeças falantes ou personagem da lista)';
  addSettings(g, [{ key: 'finish', type: 'select', label: 'Acabamento da cabeça', group: 'Visual', default: '', options: [['', 'Padrão da cabeça'], ['marmore', 'Mármore'], ['ouro', 'Ouro'], ['cromo', 'Cromado'], ['pele', 'Pele'], ['holograma', 'Holograma'], ['neon', 'Neon']] }]);
  g.desc = 'Uma cabeça falante 3D (busto, máscara holográfica ou caveira — ou qualquer personagem da lista) responde o chat em voz alta, mexendo a boca com a voz. Presentes furam a fila ou compram um elogio pessoal.';
  const base = { buildHost: g.buildHost, draw: g.draw, onSettings: g.onSettings };

  Object.assign(g, {
    lookKey() { const v = this.s.look || ''; return v.startsWith('h:') && TALK_HEADS[v.slice(2)] ? v : v.startsWith('c:') && CHARACTERS[v.slice(2)] ? v : 'h:busto'; },
    look() {
      const k = this.lookKey();
      if (k.startsWith('h:')) { const h = TALK_HEADS[k.slice(2)]; return { name: h.name, voice: h.voice, glow: h.glow }; }
      const c = CHARACTERS[k.slice(2)]; return { name: c.name, voice: 'antonio', glow: c.accent };
    },
    onSettings() { if (this.r && (this.r.lookId !== this.lookKey() || this.r.finish !== this.s.finish)) { this.r.host?.userData.dispose?.(); this.r.scene.remove(this.r.host); this.r.host = null; } },
    buildHost() {
      const k = this.lookKey(), grp = new THREE.Group(), head = new THREE.Group(), mouth = new THREE.Object3D();
      grp.add(head);
      grp.userData = { head, mouth, eyes: [] };
      this.r && (this.r.finish = this.s.finish);
      if (k.startsWith('c:')) {
        // Personagem de corpo inteiro como apresentador
        const c = new Character3D({ kind: k.slice(2), height: 5.2, plate: false, base: 'idle' });
        c.root.position.y = -4.6; head.add(c.root);
        grp.userData.char = c; grp.userData.dispose = () => c.dispose();
        return grp;
      }
      const H = TALK_HEADS[k.slice(2)];
      // Reflexos para os acabamentos metálicos (cromado, ouro, mármore com verniz)
      if (this.r && !this.r.envSet) {
        this.r.envSet = true;
        const scene = this.r.scene;
        import('/vendor/jsm/environments/RoomEnvironment.js').then(({ RoomEnvironment }) => { const pm = new THREE.PMREMGenerator(G3.init()); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); }).catch(() => {});
      }
      Assets3D.load(H.file).then((gltf) => {
        if (!this.r || this.r.host !== grp) return;
        const T = THREE, model = gltf.scene.clone(true);
        const mat = (HEAD_FINISH[this.s.finish] || HEAD_FINISH[H.finish])();
        const [nx, ny, nz] = H.nose, hh = H.headH, mouthY = ny - hh * (H.mouthK || 0.14), chinY = ny - hh * (H.chinK || 0.3), drop = hh * 0.07;
        let lipZ = nz - hh * 0.04;
        model.traverse((o) => {
          if (!o.isMesh) return;
          if (H.hide.some((h) => h.test(o.name) || h.test(o.parent?.name || ''))) { o.visible = false; return; }
          o.castShadow = true;
          o.material = /eye/i.test(o.name) ? new T.MeshPhysicalMaterial({ color: 0x1b1f2a, roughness: 0.05, clearcoat: 1 }) : mat;
          if (/eye/i.test(o.name)) return;
          // Cria o morph do queixo: vértices da frente, entre a boca e o queixo, descem com a fala
          const geo = o.geometry = o.geometry.clone(), pos = geo.attributes.position, disp = new Float32Array(pos.count * 3), v = new T.Vector3();
          o.updateWorldMatrix(true, false);
          // deslocamento "para baixo" do mundo convertido para o espaço da malha
          const down = new T.Vector3(0, -drop, 0).applyMatrix3(new T.Matrix3().setFromMatrix4(o.matrixWorld.clone().invert()));
          const zFront = nz - hh * 0.55;
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
            if (Math.abs(v.y - mouthY) < hh * 0.02 && Math.abs(v.x - nx) < hh * 0.05) lipZ = Math.max(lipZ, v.z);
            if (v.y > mouthY || v.y < chinY - hh * 0.12 || v.z < zFront) continue;
            const wy = v.y > chinY ? (mouthY - v.y) / (mouthY - chinY) : 1 - (chinY - v.y) / (hh * 0.12);
            const wz = clamp((v.z - zFront) / (nz - zFront), 0, 1), wx = clamp(1 - Math.abs(v.x - nx) / (hh * 0.45), 0, 1);
            const w = clamp(wy, 0, 1) * wz * wx;
            disp[i * 3] = down.x * w; disp[i * 3 + 1] = down.y * w; disp[i * 3 + 2] = down.z * w;
          }
          geo.morphAttributes.position = [new T.BufferAttribute(disp, 3)];
          geo.morphTargetsRelative = true;
          o.updateMorphTargets(); o.morphTargetInfluences[0] = 0;
          (grp.userData.jaws ||= []).push(o);
        });
        // Boca: elipse escura que abre com a voz, colada na frente dos lábios
        const mouthMesh = new T.Mesh(new T.CircleGeometry(hh * 0.06, 32), new T.MeshBasicMaterial({ color: H.finish === 'holograma' ? 0x0e7490 : 0x3b0a0a }));
        mouthMesh.position.set(nx, mouthY + hh * 0.005, lipZ + hh * 0.006); mouthMesh.scale.set(1, 0.05, 1);
        model.add(mouthMesh);
        // Encaixa a cabeça no enquadramento do estúdio (a cabeça ocupa ~3,4 unidades de altura)
        const sc = 3.4 / hh; model.scale.setScalar(sc);
        model.position.set(-nx * sc, -ny * sc + 0.2, -nz * sc + 0.9);
        head.add(model);
        grp.userData.mouthMesh = mouthMesh; grp.userData.model = model;
        // Brilho atrás da cabeça
        const halo = new T.Mesh(new T.RingGeometry(2.5, 2.7, 64), new T.MeshBasicMaterial({ color: H.glow, transparent: true, opacity: 0.55, toneMapped: false })); halo.position.set(0, 0.3, -2.6); grp.add(halo);
        grp.userData.halo = halo;
      });
      grp.userData.dispose = () => {};
      return grp;
    },
    draw() {
      const r = this.r, u = r?.host?.userData;
      if (u) {
        const m = clamp(this.mouth * 1.8, 0, 1);
        for (const o of u.jaws || []) o.morphTargetInfluences[0] = m;
        if (u.mouthMesh) u.mouthMesh.scale.set(1.5 + m * 0.3, 0.04 + m * 0.75, 1);
        if (u.halo) u.halo.material.opacity = 0.35 + m * 0.5;
        if (u.char) { u.char.update(1 / 60); if (this.busy && !u.char.busy && Math.random() < 0.02) u.char.play(pick(['interact', 'taunt', 'victory'])); }
      }
      base.draw.call(this);
      if (r && r.lookId !== this.lookKey()) r.lookId = this.lookKey();
    },
  });
})();
