'use strict';

// Esqueleto automático para os personagens que vieram sem articulação.
// Lê a forma do modelo (pontos extremos, larguras por altura) e monta um esqueleto:
//   humano      quadril, coluna, peito, pescoço, cabeça, ombro/cotovelo/mão e quadril/joelho/pé dos dois lados
//   quadrupede  corpo, cabeça, rabo e quatro patas
//   ave         corpo, cabeça, duas asas e pés
// Cada vértice ganha pesos dos ossos mais próximos (pele que dobra) e, no humano, a parte de baixo
// da cabeça ganha um "morph" de queixo para falar. O resultado é guardado uma vez por modelo e as
// cópias usam o mesmo esqueleto-molde. As poses (andar, socar, dançar…) ficam em AutoRig.pose().
const AutoRig = {
  cache: new Map(),
  // Molde articulado (uma vez por personagem)
  template(gltf, def) {
    const key = def.file;
    if (this.cache.has(key)) return this.cache.get(key);
    let out = null;
    try { out = this.build(gltf, def); } catch (err) { console.warn('esqueleto automático falhou:', def.name, err?.message || err); }
    this.cache.set(key, out);
    return out;
  },
  build(gltf, def) {
    const T = THREE, type = def.rig || 'humano';
    gltf.scene.updateMatrixWorld(true);
    // 1) Junta as malhas com a transformação aplicada (e a frente virada para +Z)
    const yawM = new T.Matrix4().makeRotationY(def.yaw || 0), parts = [];
    gltf.scene.traverse((o) => {
      if (!o.isMesh || o.visible === false) return;
      const src = o.geometry, geo = new T.BufferGeometry();
      const m = yawM.clone().multiply(o.matrixWorld), nm = new T.Matrix3().getNormalMatrix(m);
      // Posições e normais em ponto flutuante (os arquivos otimizados vêm quantizados)
      const fl = (a) => { const f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c); return new T.BufferAttribute(f, a.itemSize); };
      geo.setAttribute('position', fl(src.attributes.position));
      if (src.attributes.normal) geo.setAttribute('normal', fl(src.attributes.normal));
      for (const n of ['uv', 'color']) if (src.attributes[n]) geo.setAttribute(n, src.attributes[n]);
      if (src.index) geo.setIndex(src.index);
      for (const gr of src.groups) geo.addGroup(gr.start, gr.count, gr.materialIndex);
      // Já tinha esqueleto (sem animação): aplica a pose atual dele antes de juntar
      if (o.isSkinnedMesh && o.skeleton) {
        o.skeleton.update();
        const pa = geo.attributes.position, na = geo.attributes.normal, si = src.attributes.skinIndex, sw = src.attributes.skinWeight;
        const bm = o.skeleton.boneMatrices, M = new T.Matrix4(), Bm = new T.Matrix4(), N = new T.Matrix3(), P = new T.Vector3();
        for (let i = 0; i < pa.count; i++) {
          M.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
          for (let c = 0; c < 4; c++) { const w = sw.getComponent(i, c); if (!w) continue; Bm.fromArray(bm, si.getComponent(i, c) * 16); for (let e = 0; e < 16; e++) M.elements[e] += Bm.elements[e] * w; }
          M.premultiply(o.bindMatrixInverse).multiply(o.bindMatrix);
          P.fromBufferAttribute(pa, i).applyMatrix4(M); pa.setXYZ(i, P.x, P.y, P.z);
          if (na) { N.getNormalMatrix(M); P.fromBufferAttribute(na, i).applyMatrix3(N).normalize(); na.setXYZ(i, P.x, P.y, P.z); }
        }
      }
      geo.applyMatrix4(m);
      if (geo.attributes.normal) geo.attributes.normal.needsUpdate = true;
      parts.push({ geo, mat: o.material });
    });
    if (!parts.length) return null;
    // 2) Medidas
    const box = new T.Box3(); for (const p of parts) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); }
    const min = box.min, max = box.max, H = max.y - min.y, Wd = max.x - min.x, D = max.z - min.z, cz = (min.z + max.z) / 2;
    let cx = (min.x + max.x) / 2;
    const verts = []; for (const p of parts) { const a = p.geo.attributes.position; for (let i = 0; i < a.count; i++) verts.push([a.getX(i), a.getY(i), a.getZ(i)]); }
    // Centro pela mediana (uma capa ou cachecol de um lado só não tira o eixo do corpo do lugar)
    { const xs = verts.map((v) => v[0]).sort((a, b) => a - b); cx = xs[xs.length >> 1]; }
    const pct = (arr, q) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
    const V = (x, y, z) => new T.Vector3(x, y, z);
    const J = {}; // juntas (posição) e segmentos (osso → [início, fim])
    let segs;
    if (type === 'humano') {
      const r = def.rigCfg || {};
      const neckY = min.y + H * (r.neck ?? 0.8), hipY = min.y + H * (r.hip ?? 0.5), chestY = hipY + (neckY - hipY) * 0.62, spineY = hipY + (neckY - hipY) * 0.3;
      const chestBand = verts.filter((v) => v[1] > chestY && v[1] < neckY).map((v) => Math.abs(v[0] - cx));
      const tw = Math.max(Wd * 0.08, pct(chestBand, r.torso ?? 0.35));
      const side = (s) => verts.filter((v) => Math.sign(v[0] - cx) === s);
      const hand = (s) => { const c = side(s).filter((v) => v[1] > min.y + H * (r.handMin ?? 0.28) && v[1] < neckY + H * 0.05); if (!c.length) return V(cx + s * tw * 2, chestY, cz); const lim = pct(c.map((v) => Math.abs(v[0] - cx)), 0.985); const e = c.filter((v) => Math.abs(v[0] - cx) >= lim); return V(e.reduce((a, v) => a + v[0], 0) / e.length, e.reduce((a, v) => a + v[1], 0) / e.length, e.reduce((a, v) => a + v[2], 0) / e.length); };
      const foot = (s) => { const c = side(s).filter((v) => v[1] < hipY); if (!c.length) return V(cx + s * tw * 0.5, min.y, cz); const lim = pct(c.map((v) => v[1]), 0.03); const e = c.filter((v) => v[1] <= lim); return V(e.reduce((a, v) => a + v[0], 0) / e.length, min.y + H * 0.03, e.reduce((a, v) => a + v[2], 0) / e.length); };
      J.hips = V(cx, hipY, cz); J.spine = V(cx, spineY, cz); J.chest = V(cx, chestY, cz); J.neck = V(cx, neckY, cz); J.top = V(cx, max.y, cz);
      for (const [s, n] of [[1, 'L'], [-1, 'R']]) {
        const sh = V(cx + s * tw, neckY - H * 0.04, cz), hd = hand(s);
        if (Math.abs(hd.x - cx) < tw * 1.05) hd.x = cx + s * tw * 1.15; // mão colada no corpo: puxa um pouco para fora
        J['sh' + n] = sh; J['el' + n] = sh.clone().lerp(hd, 0.5); J['ha' + n] = hd;
        const hp = V(cx + s * Math.max(tw * 0.45, Wd * 0.06), hipY - H * 0.03, cz), ft = foot(s);
        J['hp' + n] = hp; J['kn' + n] = hp.clone().lerp(ft, 0.5).add(V(0, 0, H * 0.015)); J['ft' + n] = ft;
      }
      J.core = { neckY, hipY, x: tw * (+r.core || 0.9), noArms: Boolean(r.noArms), on: r.core !== false };
      segs = { hips: ['hips', 'spine'], spine: ['spine', 'chest'], chest: ['chest', 'neck'], head: ['neck', 'top'],
        uArmL: ['shL', 'elL'], fArmL: ['elL', 'haL'], uArmR: ['shR', 'elR'], fArmR: ['elR', 'haR'],
        uLegL: ['hpL', 'knL'], lLegL: ['knL', 'ftL'], uLegR: ['hpR', 'knR'], lLegR: ['knR', 'ftR'] };
    } else if (type === 'quadrupede') {
      const legTop = min.y + H * 0.42, front = max.z, back = min.z;
      J.body = V(cx, min.y + H * 0.55, cz); J.head = V(cx, min.y + H * 0.7, front - D * 0.2); J.tail = V(cx, min.y + H * 0.6, back + D * 0.12);
      for (const [n, sx, sz] of [['FL', 1, 1], ['FR', -1, 1], ['BL', 1, -1], ['BR', -1, -1]]) {
        const c = verts.filter((v) => v[1] < legTop && Math.sign(v[0] - cx) === sx && Math.sign(v[2] - cz) === sz);
        const x = c.length ? c.reduce((a, v) => a + v[0], 0) / c.length : cx + sx * Wd * 0.3, z = c.length ? c.reduce((a, v) => a + v[2], 0) / c.length : cz + sz * D * 0.3;
        J['leg' + n] = V(x, legTop, z); J['paw' + n] = V(x, min.y, z);
      }
    } else { // ave
      const bodyHalf = pct(verts.filter((v) => v[1] > min.y + H * 0.3 && v[1] < min.y + H * 0.7).map((v) => Math.abs(v[0] - cx)), 0.6);
      J.body = V(cx, min.y + H * 0.45, cz); J.head = V(cx, min.y + H * 0.72, cz + D * 0.05);
      J.wingL = V(cx + bodyHalf * 0.8, min.y + H * 0.6, cz); J.wingR = V(cx - bodyHalf * 0.8, min.y + H * 0.6, cz);
      J.feet = V(cx, min.y + H * 0.15, cz); J.bodyHalf = bodyHalf;
    }
    // 3) Ossos (rotação de repouso = identidade, posição = junta relativa ao pai)
    const bones = {}, mk = (name, pos, parent) => { const b = new T.Bone(); b.name = 'ar_' + name; b.position.copy(pos); if (parent) { parent.add(b); b.position.sub(parent.userData.abs); } b.userData.abs = pos.clone(); bones[name] = b; return b; };
    let rootBone;
    if (type === 'humano') {
      rootBone = mk('hips', J.hips); mk('spine', J.spine, bones.hips); mk('chest', J.chest, bones.spine); mk('head', J.neck, bones.chest);
      for (const n of ['L', 'R']) { mk('uArm' + n, J['sh' + n], bones.chest); mk('fArm' + n, J['el' + n], bones['uArm' + n]); mk('uLeg' + n, J['hp' + n], bones.hips); mk('lLeg' + n, J['kn' + n], bones['uLeg' + n]); }
    } else if (type === 'quadrupede') {
      rootBone = mk('body', J.body); mk('head', J.head, bones.body); mk('tail', J.tail, bones.body);
      for (const n of ['FL', 'FR', 'BL', 'BR']) mk('leg' + n, J['leg' + n], bones.body);
    } else {
      rootBone = mk('body', J.body); mk('head', J.head, bones.body); mk('wingL', J.wingL, bones.body); mk('wingR', J.wingR, bones.body); mk('feet', J.feet, bones.body);
    }
    const order = Object.keys(bones), idx = Object.fromEntries(order.map((n, i) => [n, i]));
    // 4) Pesos
    const segList = type === 'humano' ? Object.entries(segs).map(([b, [a, c]]) => ({ b: idx[b], a: J[a], c: J[c], arm: /Arm/.test(b) })) : null;
    const tmp = new T.Vector3(), ab = new T.Vector3(), ap = new T.Vector3();
    const dSeg = (p, a, c) => { ab.subVectors(c, a); ap.subVectors(p, a); const t = clamp(ap.dot(ab) / Math.max(1e-9, ab.lengthSq()), 0, 1); return tmp.copy(a).addScaledVector(ab, t).distanceTo(p); };
    const headJawY = J.neck ? [J.neck.y, J.neck.y + (J.top.y - J.neck.y) * 0.42] : null;
    // Peso de um ponto (lista de ossos e forças)
    const weightAt = (P) => {
      if (type === 'humano') {
        // Miolo do corpo (tronco e pernas) não segue os braços (evita esticar ombreiras e peito ao levantar o braço)
        const core = J.core.on && P.y < J.core.neckY && Math.abs(P.x - cx) < J.core.x;
        // Abaixo do quadril só o que está bem mais perto da mão do que da perna segue o braço
        const sd = P.x > cx ? 'L' : 'R';
        const legZone = P.y < J.core.hipY && dSeg(P, J['el' + sd], J['ha' + sd]) > Math.min(dSeg(P, J['hp' + sd], J['kn' + sd]), dSeg(P, J['kn' + sd], J['ft' + sd])) * 0.7;
        const ds = segList.filter((s) => !s.arm || !(core || legZone || J.core.noArms)).map((s) => ({ b: s.b, d: dSeg(P, s.a, s.c) })).sort((x, y) => x.d - y.d).slice(0, 3);
        const e = H * 0.01; return ds.map((s) => ({ b: s.b, w: 1 / Math.pow(s.d + e, 7) }));
      }
      let b = 'body';
      if (type === 'quadrupede') {
        if (P.y < J.legFL.y) { const sx = Math.sign(P.x - cx), sz = Math.sign(P.z - cz); b = 'leg' + (sz >= 0 ? 'F' : 'B') + (sx >= 0 ? 'L' : 'R'); }
        else if (P.z > J.head.z - D * 0.05) b = 'head';
        else if (P.z < J.tail.z + D * 0.05) b = 'tail';
      } else if (P.y < J.feet.y) b = 'feet';
      else if (Math.abs(P.x - cx) > J.bodyHalf * 1.05 && P.y > min.y + H * 0.25) b = P.x > cx ? 'wingL' : 'wingR';
      else if (P.y > J.head.y) b = 'head';
      return [{ b: idx[b], w: 1 }];
    };
    for (const p of parts) {
      const a = p.geo.attributes.position, n = a.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), jaw = new Float32Array(n * 3);
      const P = new T.Vector3();
      let hasJaw = false;
      // Peças soltas pequenas (luva, ombreira, placa de robô) se movem inteiras: acha as peças ligadas
      const par = new Int32Array(n).map((_, i) => i), find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; }, join = (x, y) => { x = find(x); y = find(y); if (x !== y) par[x] = y; };
      const ix = p.geo.index; if (ix) for (let f = 0; f + 2 < ix.count; f += 3) { join(ix.getX(f), ix.getX(f + 1)); join(ix.getX(f), ix.getX(f + 2)); }
      else for (let f = 0; f + 2 < n; f += 3) { join(f, f + 1); join(f, f + 2); }
      const keyOf = new Map(), q = H * 1e-4; for (let i = 0; i < n; i++) { const k = Math.round(a.getX(i) / q) + ',' + Math.round(a.getY(i) / q) + ',' + Math.round(a.getZ(i) / q); const o = keyOf.get(k); if (o === undefined) keyOf.set(k, i); else join(i, o); }
      const comp = new Map(); for (let i = 0; i < n; i++) { const r = find(i); let c = comp.get(r); if (!c) { c = { min: new T.Vector3(Infinity, Infinity, Infinity), max: new T.Vector3(-Infinity, -Infinity, -Infinity) }; comp.set(r, c); } P.fromBufferAttribute(a, i); c.min.min(P); c.max.max(P); }
      for (const c of comp.values()) if (c.max.distanceTo(c.min) < H * 0.16) c.w = weightAt(c.min.clone().add(c.max).multiplyScalar(0.5));
      for (let i = 0; i < n; i++) {
        P.fromBufferAttribute(a, i);
        const w = comp.get(find(i)).w || weightAt(P);
        // Queixo: frente e parte de baixo da cabeça
        if (type === 'humano' && P.y > headJawY[0] && P.y < headJawY[1] && P.z > cz) { const k = 1 - (P.y - headJawY[0]) / (headJawY[1] - headJawY[0]), f = clamp((P.z - cz) / (D * 0.5), 0, 1); jaw[i * 3 + 1] = -H * 0.025 * k * f; hasJaw = true; }
        const tot = w.reduce((s, x) => s + x.w, 0);
        w.forEach((x, k) => { si[i * 4 + k] = x.b; sw[i * 4 + k] = x.w / tot; });
      }
      p.geo.setAttribute('skinIndex', new T.BufferAttribute(si, 4));
      p.geo.setAttribute('skinWeight', new T.BufferAttribute(sw, 4));
      if (hasJaw) { p.geo.morphAttributes.position = [new T.BufferAttribute(jaw, 3)]; p.geo.morphTargetsRelative = true; }
    }
    // 5) Monta o molde: um grupo com o osso-raiz e as malhas com pele
    const root = new T.Group(); root.name = 'autorig';
    root.add(rootBone); root.updateMatrixWorld(true);
    const skeleton = new T.Skeleton(order.map((n) => bones[n]));
    for (const p of parts) {
      const sm = new T.SkinnedMesh(p.geo, p.mat); sm.castShadow = true; sm.frustumCulled = false;
      if (p.geo.morphAttributes.position) { sm.updateMorphTargets(); sm.name = 'ar_jawmesh'; }
      root.add(sm); sm.bind(skeleton);
    }
    // Direções de repouso dos segmentos (para mirar braços e pernas)
    const rest = {};
    if (segs) for (const [b, [a, c]] of Object.entries(segs)) rest[b] = J[c].clone().sub(J[a]).normalize();
    return { scene: root, type, names: order, rest, H, minY: min.y, reach: def.rigCfg?.reach };
  },

  // ---------- Poses ----------
  // Aplica a pose do estado no personagem (bones = mapa nome→osso da cópia). k = 0..1 do estado, hk = arco 0→1→0.
  pose(inst, state, t, k, hk, dt, talk) {
    const T = THREE, B = inst.bones, sm = Math.min(1, dt * 14);
    const q = inst.q || (inst.q = { a: new T.Quaternion(), b: new T.Quaternion(), e: new T.Euler() });
    const setE = (b, x, y, z) => { if (!b) return; q.e.set(x, y, z); q.a.setFromEuler(q.e); b.quaternion.slerp(q.a, sm); };
    if (inst.type === 'humano') return this.poseHuman(inst, state, t, k, hk, setE, sm, talk);
    if (inst.type === 'quadrupede') {
      const run = state === 'run' || state === 'walk' || state.startsWith('strafe'), sp = state === 'run' ? 12 : 7, a = run ? 0.55 : 0;
      setE(B.legFL, Math.sin(t * sp) * a, 0, 0); setE(B.legBR, Math.sin(t * sp) * a, 0, 0); setE(B.legFR, -Math.sin(t * sp) * a, 0, 0); setE(B.legBL, -Math.sin(t * sp) * a, 0, 0);
      const atk = ['punch', 'kick', 'slash', 'stab', 'jumpAttack', 'heavy', 'cast', 'shoot', 'throw'].includes(state);
      setE(B.head, atk ? 0.6 * hk : state === 'hit' ? -0.5 * hk : Math.sin(t * 2) * 0.08 + (talk ? Math.sin(t * 16) * 0.12 : 0), Math.sin(t * 0.9) * 0.2, 0);
      setE(B.tail, 0.2, Math.sin(t * (state === 'victory' || state === 'taunt' ? 22 : 5)) * 0.5, 0);
      setE(B.body, state === 'hit' ? -0.2 * hk : atk ? 0.15 * hk : 0, 0, 0);
      return;
    }
    // ave: asas batem em voo, pulo e comemoração; cabeça bica no ataque
    const flap = ['jump', 'jumpLong', 'victory', 'powerUp', 'spawnAir', 'run', 'taunt', 'spin'].includes(state) ? Math.sin(t * 22) * 0.9 : Math.sin(t * 2) * 0.05;
    setE(B.wingL, 0, 0, 0.35 + flap); setE(B.wingR, 0, 0, -0.35 - flap);
    const peck = ['punch', 'kick', 'slash', 'stab', 'jumpAttack', 'heavy', 'cast', 'shoot', 'throw'].includes(state);
    setE(B.head, peck ? 0.8 * hk : state === 'hit' ? -0.5 * hk : Math.sin(t * 3) * 0.1 + (talk ? Math.sin(t * 15) * 0.15 : 0), Math.sin(t * 1.3) * 0.3, 0);
    setE(B.feet, state === 'walk' || state === 'run' ? Math.sin(t * 14) * 0.3 : 0, 0, 0);
  },
  poseHuman(inst, s, t, k, hk, setE, sm, talk) {
    const T = THREE, B = inst.bones, R = inst.rest;
    const v = (x, y, z) => new T.Vector3(x, y, z).normalize();
    // Mira um segmento (braço/perna) numa direção do corpo, compensando a rotação do pai
    const qa = new T.Quaternion(), qp = new T.Quaternion(), qt = new T.Quaternion();
    const aim = (name, dir, parentWorld) => {
      const b = B[name]; if (!b) return null;
      qa.setFromUnitVectors(R[name], dir); // rotação no espaço do corpo
      qt.copy(parentWorld).invert().multiply(qa);
      b.quaternion.slerp(qt, sm);
      return qa.clone();
    };
    const eul = (x, y, z) => new T.Quaternion().setFromEuler(new T.Euler(x, y, z));
    // Tronco
    let hipsQ = eul(0, 0, 0), spX = 0, spY = 0, chX = 0, hdX = 0, hdY = Math.sin(t * 0.7) * 0.15, hdZ = 0, hipsY = 0;
    // Direções padrão = as do próprio modelo (parado ele fica exatamente como foi feito)
    const rot = (d, ax, ay = 0, az = 0) => d.clone().applyEuler(new T.Euler(ax, ay, az));
    // Modelo feito de braços abertos (pose em T): abaixa os braços para ficar natural
    const tp = Math.abs(R.uArmL.x) > 0.75 && Math.abs(R.uArmR.x) > 0.75;
    const bL = tp ? v(0.32, -1, 0.06) : R.uArmL, bR = tp ? v(-0.32, -1, 0.06) : R.uArmR, bfL = tp ? v(0.18, -1, 0.2) : R.fArmL, bfR = tp ? v(-0.18, -1, 0.2) : R.fArmR;
    let uaL = bL, faL = bfL, uaR = bR, faR = bfR;
    let ulL = R.uLegL, llL = R.lLegL, ulR = R.uLegR, llR = R.lLegR;
    const br = Math.sin(t * 2.2) * 0.03, up = inst.reach ?? 0.65; // up < 1: braços sobem menos (modelos com ombreiras grandes)
    const guard = () => { uaL = v(0.35, -0.6, 0.55); faL = v(0, 0.55, 0.8); uaR = v(-0.35, -0.6, 0.55); faR = v(0, 0.55, 0.8); spX = 0.12; };
    if (s === 'walk' || s === 'run' || s.startsWith('strafe') || s === 'walkBack') {
      const f = s === 'walk' ? 7 : 11, a = s === 'walk' ? 0.55 : 0.95, ph = t * f, sn = Math.sin(ph), cs = Math.cos(ph);
      // Passada: gira pernas e braços em volta do eixo lateral, a partir da pose do modelo
      ulL = rot(R.uLegL, -sn * a); llL = rot(R.lLegL, -sn * a + Math.max(0, -cs) * 0.8); ulR = rot(R.uLegR, sn * a); llR = rot(R.lLegR, sn * a + Math.max(0, cs) * 0.8);
      uaL = rot(bL, sn * a * 0.7); faL = rot(bfL, sn * a * 0.7 - 0.35); uaR = rot(bR, -sn * a * 0.7); faR = rot(bfR, -sn * a * 0.7 - 0.35);
      spX = s === 'run' ? 0.18 : 0.06; spY = sn * 0.12; hipsY = Math.abs(cs) * 0.04;
    } else if (s === 'fightIdle' || s === 'blocking') { guard(); if (s === 'blocking') { faL = v(0.1, 1, 0.3); faR = v(-0.1, 1, 0.3); uaL = v(0.4, -0.2, 0.8); uaR = v(-0.4, -0.2, 0.8); } }
    else if (s === 'punch' || s === 'stab' || s === 'blockAttack') { guard(); uaR = v(-0.1, 0.05, 1).lerp(v(-0.35, -0.6, 0.55), 1 - hk).normalize(); faR = v(0, 0.1, 1).lerp(v(0, 0.55, 0.8), 1 - hk).normalize(); spY = -0.5 * hk; }
    else if (s === 'slash' || s === 'heavy' || s === 'jumpAttack') { guard(); const a = k * Math.PI; uaR = v(-0.3, Math.cos(a), Math.sin(a) + 0.2); faR = uaR.clone(); spY = -0.6 * hk; spX = 0.25 * hk; }
    else if (s === 'kick') { guard(); ulR = v(0, -0.1 * (1 - hk) - 0.05, 1).lerp(v(0, -1, 0), 1 - hk).normalize(); llR = v(0, 0.1, 1).lerp(v(0, -1, 0), 1 - hk).normalize(); spX = -0.25 * hk; }
    else if (s === 'cast' || s === 'shoot' || s === 'throw' || s === 'powerUp' && false) { uaR = v(-0.15, 0.2, 1); faR = v(-0.1, 0.25, 1); uaL = v(0.15, 0.1, 1); faL = v(0.1, 0.2, 1); spX = 0.1; }
    else if (s === 'hit' || s === 'blockHit') { uaL = v(0.8, 0.2, -0.3); uaR = v(-0.8, 0.2, -0.3); faL = uaL.clone(); faR = uaR.clone(); spX = -0.45 * hk; hdX = -0.5 * hk; }
    else if (s === 'block') { uaL = v(0.4, -0.2, 0.8); faL = v(0.15, 1, 0.3); uaR = v(-0.4, -0.2, 0.8); faR = v(-0.15, 1, 0.3); hdX = 0.2; }
    else if (s === 'victory' || s === 'powerUp' || s === 'spawn' || s === 'spawnAir') { const w = Math.sin(t * 9) * 0.2, uy = up * 2 - 1; uaL = v(0.35 + (1 - up), uy, 0.1 + (1 - up) * 0.4); faL = v(0.2 + w, 1, 0); uaR = v(-0.35 - (1 - up), uy, 0.1 + (1 - up) * 0.4); faR = v(-0.2 - w, 1, 0); hdX = -0.25; }
    else if (s === 'taunt' || s === 'interact' || s === 'use') { uaR = v(-0.9, up - 0.5, 0.2); faR = v(-0.2 + Math.sin(t * 10) * 0.6, 1, 0.1); uaL = v(0.35, -0.5, 0.4); faL = v(-0.4, 0.2, 0.6); hdY = -0.25; hdZ = 0.15; }
    else if (s === 'dodge' || s === 'dodgeL' || s === 'dodgeR' || s === 'dodgeF') { guard(); spX = -0.3 * hk; spY = (s === 'dodgeL' ? 0.5 : s === 'dodgeR' ? -0.5 : 0) * hk; }
    else if (s === 'jump' || s === 'jumpLong' || s === 'standUp') { uaL = v(0.5, 0.8, 0.2); faL = v(0.3, 1, 0); uaR = v(-0.5, 0.8, 0.2); faR = v(-0.3, 1, 0); ulL = v(0, -1, 0.6 * hk); llL = v(0, -1, -0.4 * hk); ulR = v(0, -1, 0.6 * hk); llR = v(0, -1, -0.4 * hk); }
    else if (s === 'sit' || s === 'pickup') { ulL = v(0.05, -0.1, 1); llL = v(0, -1, 0.1); ulR = v(-0.05, -0.1, 1); llR = v(0, -1, 0.1); }
    else if (s === 'channel') { uaL = v(0.6, 0.6, 0.6); faL = v(0.2, 0.8, 0.6); uaR = v(-0.6, 0.6, 0.6); faR = v(-0.2, 0.8, 0.6); }
    else if (s === 'death' || s === 'deadPose') { uaL = v(1, 0.3, 0); faL = uaL.clone(); uaR = v(-1, 0.3, 0); faR = uaR.clone(); }
    else if (s === 'dance') { const ph = t * 6; uaL = v(0.6, Math.sin(ph), 0.3); faL = v(0.3, 1, 0.2); uaR = v(-0.6, -Math.sin(ph), 0.3); faR = v(-0.3, 1, 0.2); spY = Math.sin(ph) * 0.3; }
    else { // parado: respira e balança os braços de leve
      const sw = Math.sin(t * 1.3) * 0.06; uaL = rot(bL, -sw, 0, 0.02); faL = rot(bfL, -sw); uaR = rot(bR, sw, 0, -0.02); faR = rot(bfR, sw); spX = br;
    }
    // Falando: cabeça acompanha e uma mão gesticula
    if (talk) { hdX += Math.sin(t * 9) * 0.06; if (s === 'idle') { uaR = v(-0.35, -0.5, 0.6); faR = v(-0.2, 0.3 + Math.sin(t * 5) * 0.4, 0.9); } }
    // Aplica (pais antes dos filhos)
    if (B.hips) { B.hips.position.y = B.hips.userData.restY + hipsY * inst.H; }
    setE(B.spine, spX * 0.5, spY * 0.5, 0); setE(B.chest, spX * 0.5, spY * 0.5, 0); setE(B.head, hdX, hdY, hdZ);
    const chestW = new THREE.Quaternion(); B.chest.updateWorldMatrix(true, false); B.chest.getWorldQuaternion(chestW);
    const rootW = new THREE.Quaternion(); inst.root.getWorldQuaternion(rootW); chestW.premultiply(rootW.clone().invert());
    const hipsW = new THREE.Quaternion(); B.hips.getWorldQuaternion(hipsW); hipsW.premultiply(rootW.clone().invert());
    for (const [n, ua, fa] of [['L', uaL, faL], ['R', uaR, faR]]) { const u = aim('uArm' + n, ua, chestW); if (u) aim('fArm' + n, fa, chestW.clone().multiply(B['uArm' + n].quaternion)); }
    for (const [n, ul, ll] of [['L', ulL, llL], ['R', ulR, llR]]) { const u = aim('uLeg' + n, ul, hipsW); if (u) aim('lLeg' + n, ll, hipsW.clone().multiply(B['uLeg' + n].quaternion)); }
    void qp; void hipsQ;
  },
};
