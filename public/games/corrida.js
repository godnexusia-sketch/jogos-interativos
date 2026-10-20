'use strict';

// Corrida Maluca: avenida à noite vista de lado. Quem comenta "carro" ou "moto" entra com o @ em cima do veículo.
// Comentários e likes empurram; presentes viram nitro, óleo, míssil e bomba no líder.
const RACE_LEN = 3000; // metros
const PX_PER_M = 7;
const LANES = 6, ROAD_TOP = 318, ROAD_BOT = 858;
const CAR_MAX = 12;
const CAR_TYPES = ['sedan', 'hatch', 'pickup', 'fusca', 'esportivo', 'perua'];
const CAR_COLORS = ['#c0392b', '#e1b12c', '#2980b9', '#ecf0f1', '#8e44ad', '#16a085', '#d35400', '#2c3e50', '#e84393', '#27ae60'];

// Desenha um veículo de lado, virado para a direita, com a base em y = 0 e largura ~150.
function drawVehicle(type, color) {
  const dark = shade(color, -60), light = shade(color, 50);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(75, 2, 74, 7, 0, 0, Math.PI * 2); ctx.fill();
  if (type === 'moto') {
    for (const wx of [32, 112]) { ctx.beginPath(); ctx.arc(wx, -16, 16, 0, 7); ctx.fillStyle = '#111'; ctx.fill(); ctx.beginPath(); ctx.arc(wx, -16, 8, 0, 7); ctx.fillStyle = '#9aa3ad'; ctx.fill(); }
    const g = ctx.createLinearGradient(0, -50, 0, -14); g.addColorStop(0, light); g.addColorStop(1, dark);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(30, -26); ctx.lineTo(60, -44); ctx.lineTo(104, -44); ctx.lineTo(124, -26); ctx.lineTo(96, -20); ctx.lineTo(50, -20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(66, -60, 22, 22);
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.roundRect(60, -84, 30, 30, 8); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(80, -92, 13, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(150,200,255,.8)'; ctx.fillRect(84, -96, 9, 6);
    ctx.fillStyle = '#ffe9a8'; ctx.fillRect(122, -36, 6, 6);
    ctx.restore();
    return;
  }
  const spec = {
    sedan: { cab: [[38, -38], [52, -58], [98, -58], [116, -38]], body: -38, len: 150 },
    hatch: { cab: [[40, -38], [50, -60], [104, -60], [118, -38]], body: -38, len: 140 },
    pickup: { cab: [[66, -40], [76, -62], [112, -62], [122, -40]], body: -42, len: 156 },
    fusca: { cab: [[34, -38], [56, -66], [94, -66], [116, -38]], body: -36, len: 140, round: true },
    esportivo: { cab: [[52, -34], [72, -50], [106, -50], [124, -34]], body: -32, len: 152 },
    perua: { cab: [[34, -40], [44, -62], [128, -62], [136, -40]], body: -40, len: 152 },
  }[type];
  const L = spec.len;
  // Carroceria
  const bg = ctx.createLinearGradient(0, spec.body - 6, 0, -8);
  bg.addColorStop(0, light); bg.addColorStop(0.45, color); bg.addColorStop(1, dark);
  ctx.fillStyle = bg;
  ctx.beginPath();
  if (spec.round) { ctx.moveTo(6, -14); ctx.quadraticCurveTo(4, -40, 34, -40); ctx.lineTo(116, -40); ctx.quadraticCurveTo(L + 2, -40, L, -14); }
  else { ctx.moveTo(4, -12); ctx.lineTo(4, spec.body + 6); ctx.quadraticCurveTo(6, spec.body, 20, spec.body); ctx.lineTo(L - 14, spec.body + 2); ctx.quadraticCurveTo(L, spec.body + 4, L, -16); }
  ctx.lineTo(L - 4, -8); ctx.lineTo(8, -8); ctx.closePath(); ctx.fill();
  // Cabine e vidros
  ctx.fillStyle = shade(color, -15);
  ctx.beginPath(); spec.cab.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
  const [a, b, c, d] = spec.cab;
  const wg = ctx.createLinearGradient(0, b[1], 0, a[1]);
  wg.addColorStop(0, '#cfe6ff'); wg.addColorStop(1, '#4a6a8c');
  ctx.fillStyle = wg;
  const inset = 4, mid = (b[0] + c[0]) / 2;
  ctx.beginPath(); ctx.moveTo(a[0] + inset + 2, a[1] - 2); ctx.lineTo(b[0] + inset, b[1] + inset); ctx.lineTo(mid - 3, b[1] + inset); ctx.lineTo(mid - 3, a[1] - 2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(mid + 3, a[1] - 2); ctx.lineTo(mid + 3, c[1] + inset); ctx.lineTo(c[0] - inset, c[1] + inset); ctx.lineTo(d[0] - inset - 2, d[1] - 2); ctx.closePath(); ctx.fill();
  if (type === 'pickup') { ctx.fillStyle = dark; ctx.fillRect(8, -50, 54, 10); }
  // Detalhes: friso, maçaneta, faróis
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(14, spec.body + 3, L - 34, 2);
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(mid, spec.body + 2); ctx.lineTo(mid, -12); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(mid + 8, spec.body + 9, 10, 3);
  ctx.fillStyle = '#fff6c9'; ctx.beginPath(); ctx.roundRect(L - 8, spec.body + 6, 8, 7, 2); ctx.fill();
  ctx.fillStyle = '#ff2b2b'; ctx.beginPath(); ctx.roundRect(2, spec.body + 6, 6, 8, 2); ctx.fill();
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(4, -14, 12, 5); ctx.fillRect(L - 16, -14, 12, 5);
  // Rodas
  for (const wx of [32, L - 32]) {
    ctx.beginPath(); ctx.arc(wx, -10, 15, 0, 7); ctx.fillStyle = '#0d0d0d'; ctx.fill();
    const rg = ctx.createRadialGradient(wx - 3, -13, 1, wx, -10, 9);
    rg.addColorStop(0, '#f2f4f7'); rg.addColorStop(1, '#7b8590');
    ctx.beginPath(); ctx.arc(wx, -10, 8.5, 0, 7); ctx.fillStyle = rg; ctx.fill();
    ctx.beginPath(); ctx.arc(wx, -10, 2.5, 0, 7); ctx.fillStyle = '#333'; ctx.fill();
  }
  ctx.restore();
}

const vehicleCache = new Map();
function vehicleSprite(type, color) {
  const key = type + color;
  let c = vehicleCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = 170 * SCALE; c.height = 110 * SCALE;
    const g = c.getContext('2d');
    g.scale(SCALE, SCALE); g.translate(10, 100);
    const real = ctx; ctxSwap(g); drawVehicle(type, color); ctxSwap(real);
    vehicleCache.set(key, c);
  }
  return c;
}

registerGame({
  id: 'corrida',
  name: 'Corrida Maluca',
  icon: '🏁',
  help: '<p>Comente <b>carro</b> ou <b>moto</b> para entrar na pista (até 12). Com 2 pilotos a largada começa.</p><p>💬 Comentário e ❤️ like: empurrão. 🌹 Nitro · 🍩 Óleo em quem vem atrás · 🕶️ Míssil em quem está na frente · 🌌 Bomba no líder.</p><p>Quem não está correndo e manda presente ataca o líder.</p>',
  cd: new Cooldown(1000),
  wins: new Map(),
  raceNo: 1,
  reset() {
    this.cars = [];
    this.next = [];
    this.phase = 'lobby';
    this.timer = 0;
    this.podium = [];
    this.log = [];
    this.giftCards = [];
    this.oil = [];
    this.missiles = [];
    this.cam = 0;
    this.leaderId = null;
  },
  sample() { return this.phase === 'race' ? pick(['vai!', 'acelera', 'bora']) : pick(['carro', 'moto', 'carro']); },
  car(id) { return this.cars.find((c) => c.id === id); },
  ranked() { return [...this.cars].sort((a, b) => b.pos - a.pos); },
  addLog(msg, color = '#fff', icon = '🏁') { this.log.unshift({ msg, color, icon, t: 7 }); this.log.length = Math.min(this.log.length, 3); },
  addGift(user, gift, action, target) { this.giftCards.unshift({ user, gift, action, target, t: 6 }); this.giftCards.length = Math.min(this.giftCards.length, 2); },
  newCar(entry) {
    const lane = this.cars.length % LANES;
    return { ...entry, pos: -rand(0, 4) - Math.floor(this.cars.length / LANES) * 12, lane, laneY: lane, speed: rand(20, 22.5), boost: 0, stun: 0, spin: 0, shake: 0, wheel: 0, tag: null };
  },
  join(ev, kind) {
    const id = uid(ev);
    if (this.car(id) || this.next.some((n) => n.id === id)) return;
    const entry = { id, user: ev.user, kind, type: kind === 'moto' ? 'moto' : pick(CAR_TYPES), color: pick(CAR_COLORS) };
    if (this.phase === 'race' || this.phase === 'finish') { if (this.next.length < CAR_MAX) this.next.push(entry); return; }
    if (this.cars.length >= CAR_MAX) return;
    this.cars.push(this.newCar(entry));
    sfx.pop();
    this.addLog(`@${trim(ev.user.nick, 12)} entrou de ${kind}`, '#25f4ee', kind === 'moto' ? '🏍️' : '🚗');
    if (this.cars.length >= 2 && this.phase === 'lobby') { this.phase = 'countdown'; this.timer = 30; }
  },
  onEvent(ev) {
    const id = uid(ev);
    if (ev.type === 'chat') {
      const t = ev.text.trim().toLowerCase();
      if (/\b(carro|moto|!entrar|entrar)\b/.test(t)) return this.join(ev, /moto/.test(t) ? 'moto' : 'carro');
      const c = this.car(id);
      if (c && this.phase === 'race' && this.cd.ok(id)) c.pos += 4;
    } else if (ev.type === 'like') {
      const c = this.car(id);
      if (c && this.phase === 'race') c.pos += Math.min(10, ev.count);
    } else if (ev.type === 'gift') {
      if (this.phase !== 'race') {
        if (this.phase !== 'finish') this.join(ev, 'carro');
        const c = this.car(id);
        if (c) c.boost = 4;
        return;
      }
      this.gift(ev);
    }
  },
  gift(ev) {
    const me = this.car(uid(ev));
    const tier = giftTier(ev);
    const order = this.ranked();
    const who = `@${trim(ev.user.nick, 12)}`;
    const leader = order[0];
    if (!me) {
      this.hit(leader, tier >= 3 ? 60 : 30, 1.5, 'ATINGIDO!');
      this.addGift(ev.user, ev.name, 'ATAQUE', leader.user.nick);
      return;
    }
    const idx = order.indexOf(me);
    if (tier === 1) {
      me.boost = Math.min(10, me.boost + 3 * (ev.count || 1));
      this.addGift(ev.user, ev.name, 'NITRO', null);
    } else if (tier === 2) {
      const behind = order[idx + 1];
      this.oil.push({ pos: me.pos - 6, lane: me.lane, t: 8 });
      if (behind) this.hit(behind, 25, 2, 'RODOU!');
      this.addGift(ev.user, ev.name, 'ÓLEO', behind?.user.nick);
    } else if (tier === 3) {
      const target = order[idx - 1] || order[idx + 1];
      if (target) this.missiles.push({ from: me, to: target, t: 0 });
      me.boost = Math.max(me.boost, 3);
      this.addGift(ev.user, ev.name, 'MÍSSIL', target?.user.nick);
    } else {
      const target = leader === me ? order[1] : leader;
      if (target) {
        for (const c of this.cars) if (c !== me && Math.abs(c.pos - target.pos) < 40) this.hit(c, c === target ? 120 : 50, 3, c === target ? 'BOMBA!' : 'RODOU!');
        announcer.show(`💣 ${who}`, '#fe2c55', 2.5, 60);
        sfx.boom();
      }
      me.boost = Math.max(me.boost, 5);
      this.addGift(ev.user, ev.name, 'BOMBA NO LÍDER', target?.user.nick);
    }
  },
  hit(c, back, stun, tag) {
    if (!c) return;
    c.pos -= back;
    c.stun = Math.max(c.stun, stun);
    c.spin = 1;
    c.shake = 0.5;
    c.tag = { text: tag, t: 1.6 };
    const p = this.carXY(c);
    burst(p.x + 75, p.y - 30, ['#ff8a3d', '#ffd23f', '#fe2c55'], 30, 350);
  },
  update(dt) {
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    for (const g of this.giftCards) g.t -= dt;
    this.giftCards = this.giftCards.filter((g) => g.t > 0);
    this.oil = this.oil.filter((o) => (o.t -= dt) > 0);
    for (const c of this.cars) {
      c.shake = Math.max(0, c.shake - dt); c.spin = Math.max(0, c.spin - dt);
      if (c.tag && (c.tag.t -= dt) <= 0) c.tag = null;
      c.laneY += (c.lane - c.laneY) * Math.min(1, dt * 4);
    }
    if (this.phase === 'countdown') {
      this.timer -= dt;
      if (this.timer <= 0) { this.phase = 'race'; this.timer = 0; sfx.win(); announcer.show('GO!', '#7cff6b', 1.2, 130); }
      else if (this.timer < 3.05 && Math.ceil(this.timer) !== this.lastBeep) { this.lastBeep = Math.ceil(this.timer); sfx.tone(600, 0.15, 'square', 0.08); announcer.show(String(this.lastBeep), '#ffd23f', 0.8, 130); }
    } else if (this.phase === 'race') {
      this.timer += dt;
      for (const c of this.cars) {
        c.boost = Math.max(0, c.boost - dt);
        c.stun = Math.max(0, c.stun - dt);
        const wave = Math.sin(this.timer * 0.5 + c.speed * 3) * 1.5;
        const v = c.stun > 0 ? 4 : (c.speed + wave) * (c.boost > 0 ? 1.7 : 1);
        c.pos += v * dt;
        c.wheel += v * dt;
        for (const o of this.oil) if (o.lane === c.lane && Math.abs(c.pos - o.pos) < 3 && c.stun <= 0) { c.stun = 1.5; c.spin = 1; c.tag = { text: 'RODOU!', t: 1.4 }; }
      }
      for (const m of this.missiles) {
        m.t += dt;
        if (m.t >= 0.9 && !m.done) { m.done = true; this.hit(m.to, 70, 2.5, 'MÍSSIL!'); sfx.boom(); }
      }
      this.missiles = this.missiles.filter((m) => !m.done);
      const lead = this.ranked()[0];
      if (lead && lead.id !== this.leaderId) {
        if (this.leaderId) this.addLog(`@${trim(lead.user.nick, 12)} assumiu a liderança!`, '#ffd23f', '👑');
        this.leaderId = lead.id;
      }
      if (lead && lead.pos >= RACE_LEN) {
        this.phase = 'finish';
        this.timer = 12;
        this.podium = this.ranked().slice(0, 3);
        addScore(this.wins, this.podium[0].user.nick);
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
        for (const n of next) this.cars.push(this.newCar(n));
        if (this.cars.length >= 2) { this.phase = 'countdown'; this.timer = 30; }
      }
    }
    // Câmera segue o líder (ou a largada antes da corrida)
    const lead = this.ranked()[0];
    const target = lead ? lead.pos : 0;
    this.cam += (target - this.cam) * Math.min(1, dt * 2.5);
  },
  laneCenter(l) { return ROAD_TOP + 40 + (l + 0.5) * ((ROAD_BOT - ROAD_TOP - 60) / LANES); },
  carXY(c) { return { x: 470 + (c.pos - this.cam) * PX_PER_M - 150, y: this.laneCenter(c.laneY) + 28 }; },
  drawCity() {
    const g = ctx.createLinearGradient(0, 0, 0, ROAD_TOP);
    g.addColorStop(0, '#05060d'); g.addColorStop(1, '#14182b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    let x = 0, k = 0;
    while (x < W) {
      const bw = 50 + ((k * 37) % 60), bh = 120 + ((k * 53) % 160);
      ctx.fillStyle = k % 2 ? '#0f1322' : '#141a2e'; ctx.fillRect(x, ROAD_TOP - bh, bw, bh);
      for (let wy = ROAD_TOP - bh + 10; wy < ROAD_TOP - 10; wy += 14) for (let wx = x + 6; wx < x + bw - 6; wx += 12) {
        if (((wx * 7 + wy * 13 + k) % 5) < 2) { ctx.fillStyle = ((wx + wy) % 3) ? 'rgba(255,214,120,.85)' : 'rgba(180,220,255,.7)'; ctx.fillRect(wx, wy, 6, 8); }
      }
      x += bw + 4; k++;
    }
    // Pista: asfalto, faixas de proteção e meio-fio
    const rg = ctx.createLinearGradient(0, ROAD_TOP, 0, ROAD_BOT);
    rg.addColorStop(0, '#2a2c33'); rg.addColorStop(1, '#1b1d22');
    ctx.fillStyle = rg; ctx.fillRect(0, ROAD_TOP, W, ROAD_BOT - ROAD_TOP);
    for (const y of [ROAD_TOP, ROAD_BOT - 16]) for (let i = 0; i < W; i += 30) { ctx.fillStyle = (i / 30) % 2 ? '#f2f2f2' : '#d62828'; ctx.fillRect(i, y, 30, 16); }
    ctx.fillStyle = '#f5c518'; ctx.fillRect(0, ROAD_TOP + 18, W, 4); ctx.fillRect(0, ROAD_BOT - 22, W, 4);
    ctx.fillStyle = '#3a3d45'; ctx.fillRect(0, ROAD_BOT, W, 26);
    for (let i = 0; i < W; i += 46) { ctx.fillStyle = '#f5c518'; ctx.fillRect(i + 10, ROAD_BOT + 8, 16, 6); }
    // Plateia embaixo
    const sg = ctx.createLinearGradient(0, ROAD_BOT + 26, 0, H);
    sg.addColorStop(0, '#101320'); sg.addColorStop(1, '#03040a');
    ctx.fillStyle = sg; ctx.fillRect(0, ROAD_BOT + 26, W, H);
    for (let i = 0; i < 60; i++) { ctx.fillStyle = '#05060b'; ctx.beginPath(); ctx.arc((i * 47) % W, H - 30 - (i % 3) * 18, 16, 0, 7); ctx.fill(); ctx.fillRect((i * 47) % W - 16, H - 30 - (i % 3) * 18, 32, 60); }
    for (let i = 0; i < 8; i++) { const lg = ctx.createRadialGradient(40 + i * 92, H - 120, 1, 40 + i * 92, H - 120, 24); lg.addColorStop(0, 'rgba(255,255,255,.9)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = lg; ctx.fillRect(i * 92 + 16, H - 144, 48, 48); }
  },
  draw() {
    cachedScene('corrida-city', () => this.drawCity());
    // Faixas tracejadas que andam com a câmera
    const off = -((this.cam * PX_PER_M) % 80);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (let l = 1; l < LANES; l++) {
      const y = ROAD_TOP + 40 + l * ((ROAD_BOT - ROAD_TOP - 60) / LANES);
      for (let x = off; x < W; x += 80) ctx.fillRect(x, y - 2, 40, 4);
    }
    // Linha de largada e chegada
    for (const [m, txt] of [[0, 'LARGADA'], [RACE_LEN, 'CHEGADA']]) {
      const x = 470 + (m - this.cam) * PX_PER_M;
      if (x < -40 || x > W + 40) continue;
      for (let y = ROAD_TOP + 22; y < ROAD_BOT - 22; y += 16) for (let k = 0; k < 2; k++) { ctx.fillStyle = ((y / 16 + k) | 0) % 2 ? '#fff' : '#111'; ctx.fillRect(x + k * 12, y, 12, 16); }
      pill(txt, x + 12, ROAD_TOP + 40, { size: 14, bg: '#111' });
    }
    for (const o of this.oil) {
      const x = 470 + (o.pos - this.cam) * PX_PER_M - 60;
      ctx.globalAlpha = clamp(o.t, 0, 1);
      ctx.fillStyle = '#050505'; ctx.beginPath(); ctx.ellipse(x, this.laneCenter(o.lane) + 26, 46, 12, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(120,80,200,.35)'; ctx.beginPath(); ctx.ellipse(x - 8, this.laneCenter(o.lane) + 24, 20, 5, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    const order = this.ranked();
    const drawn = [...this.cars].sort((a, b) => a.laneY - b.laneY);
    for (const c of drawn) {
      const p = this.carXY(c);
      if (p.x < -170) continue;
      const sx = c.shake ? rand(-3, 3) : 0;
      // Faróis
      const lg = ctx.createLinearGradient(p.x + 150, 0, p.x + 260, 0);
      lg.addColorStop(0, 'rgba(255,240,180,.35)'); lg.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(p.x + 150, p.y - 30); ctx.lineTo(p.x + 260, p.y - 48); ctx.lineTo(p.x + 260, p.y - 6); ctx.closePath(); ctx.fill();
      if (c.boost > 0) {
        const tg = ctx.createLinearGradient(p.x - 160, 0, p.x + 10, 0);
        tg.addColorStop(0, 'rgba(70,160,255,0)'); tg.addColorStop(1, 'rgba(120,200,255,.75)');
        ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(p.x - 60, p.y - 22, 100, 14, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#7fd8ff'; ctx.beginPath(); ctx.moveTo(p.x + 4, p.y - 28); ctx.lineTo(p.x - 30 - rand(0, 16), p.y - 22); ctx.lineTo(p.x + 4, p.y - 16); ctx.fill();
      }
      ctx.save();
      ctx.translate(p.x + 75 + sx, p.y - 30);
      if (c.spin > 0) ctx.rotate(Math.sin(c.spin * Math.PI * 4) * 0.5);
      ctx.drawImage(vehicleSprite(c.type, c.color), -85, -70, 170, 110);
      ctx.restore();
      // Etiqueta com posição e @
      const rank = order.indexOf(c) + 1;
      const tx = p.x + 60, ty = p.y - (c.type === 'moto' ? 128 : 94);
      ctx.font = `800 16px ${F_TEXT}`;
      const tw = ctx.measureText(`@${trim(c.user.nick, 12)}`).width + 70;
      panel(tx - 6, ty - 15, tw, 30, { r: 8, from: 'rgba(10,12,20,.92)', to: 'rgba(10,12,20,.92)', border: rank === 1 ? '#ffc93c' : 'rgba(255,255,255,.2)', shadow: false });
      posBadge(rank, tx + 10, ty, 22);
      avatar(c.user, tx + 34, ty, 10, c.color);
      label(`@${trim(c.user.nick, 12)}`, tx + 50, ty + 1, 16, '#fff', 'left', 800);
      if (rank === 1) text('👑', tx + 10, ty - 24, 20);
      if (c.tag) { ctx.globalAlpha = clamp(c.tag.t, 0, 1); pill(`🛢️ ${c.tag.text}`, tx + tw / 2, ty - 34, { bg: '#b91c1c', size: 15 }); ctx.globalAlpha = 1; }
    }
    // Carros muito atrás aparecem como seta na borda
    const behind = order.filter((c) => this.carXY(c).x < -170).length;
    if (behind) pill(`◀ +${behind} atrás`, 70, ROAD_BOT - 50, { size: 15, bg: 'rgba(0,0,0,.8)' });
    for (const m of this.missiles) {
      const a = this.carXY(m.from), b = this.carXY(m.to);
      const k = m.t / 0.9;
      const x = a.x + 150 + (b.x + 75 - a.x - 150) * k, y = a.y - 40 + (b.y - a.y) * k - Math.sin(k * Math.PI) * 60;
      text('🚀', x, y, 34);
    }
    this.drawHud(order);
    if (this.phase === 'finish') this.drawPodium();
  },
  drawHud(order) {
    panel(16, 16, W - 32, 112, { r: 16, from: 'rgba(20,22,34,.95)', to: 'rgba(8,9,15,.95)' });
    title('CORRIDA MALUCA', 36, 46, 26, '#ff9f1c', 'left');
    label(`CORRIDA #${this.raceNo}`, 380, 46, 14, '#9aa0b4', 'left', 900);
    const st = this.phase === 'race' ? 'EM CORRIDA' : this.phase === 'countdown' ? `LARGADA ${Math.ceil(this.timer)}s` : this.phase === 'finish' ? 'CHEGADA' : 'SALA ABERTA';
    pill(st, 535, 46, { bg: this.phase === 'race' ? '#14532d' : '#3b2f0b', color: this.phase === 'race' ? '#7cff6b' : '#ffd23f', size: 14 });
    num(fmtTime(this.timer), W - 34, 46, 30, '#fff', 'right');
    const lead = order[0];
    if (lead) {
      label('LÍDER', 220, 94, 15, '#ffd23f', 'right', 900);
      label(`@${trim(lead.user.nick, 14)}`, 230, 94, 18, '#fff', 'left', 800);
      pill(`FALTAM ${Math.max(0, (RACE_LEN - lead.pos) / 1000).toFixed(2).replace('.', ',')} km`, 540, 94, { bg: '#2a2f45', size: 15 });
    } else label('Comente CARRO ou MOTO para entrar na corrida', W / 2, 94, 18, '#fff', 'center', 800);
    // Posições
    panel(16, 138, W - 32, 92, { r: 14, from: 'rgba(14,16,26,.92)', to: 'rgba(6,7,12,.92)', shadow: false });
    order.slice(0, 6).forEach((c, i) => {
      const x = 28 + (i % 3) * 228, y = 162 + Math.floor(i / 3) * 44;
      ctx.beginPath(); ctx.roundRect(x, y - 17, 218, 34, 8); ctx.fillStyle = i === 0 ? 'rgba(255,201,60,.18)' : 'rgba(255,255,255,.05)'; ctx.fill();
      posBadge(i + 1, x + 16, y, 24);
      ctx.drawImage(vehicleSprite(c.type, c.color), x + 32, y - 14, 40, 26);
      label(`@${trim(c.user.nick, 9)}`, x + 76, y + 1, 15, '#fff', 'left', 800);
      const gap = i === 0 ? '+0m' : `-${Math.round(order[0].pos - c.pos)}m`;
      label(gap, x + 210, y + 1, 14, i === 0 ? '#7cff6b' : '#ff8a8a', 'right', 900);
    });
    if (!order.length) label('Nenhum piloto ainda', W / 2, 184, 18, '#9aa0b4', 'center', 800);
    // Barra de progresso da corrida
    const by = 904;
    panel(16, by - 26, W - 32, 52, { r: 12, from: 'rgba(14,16,26,.95)', to: 'rgba(6,7,12,.95)', shadow: false });
    label('LARGADA', 32, by, 13, '#7cff6b', 'left', 900);
    label('CHEGADA', W - 32, by, 13, '#ffd23f', 'right', 900);
    const x0 = 112, x1 = W - 112;
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(x0, by - 2, x1 - x0, 4);
    for (let k = 1; k <= 5; k++) { const x = x0 + (x1 - x0) * k / 6; ctx.fillStyle = '#4dc3ff'; ctx.fillRect(x - 1, by - 10, 2, 20); label(String(k), x, by - 16, 10, '#9aa0b4', 'center', 800); }
    for (const c of [...order].reverse()) {
      const x = x0 + (x1 - x0) * clamp(c.pos / RACE_LEN, 0, 1);
      ctx.beginPath(); ctx.arc(x, by, c === order[0] ? 9 : 6, 0, 7); ctx.fillStyle = c === order[0] ? '#ffd23f' : c.color; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
    // Avisos (esquerda) e presentes (direita)
    this.log.forEach((l, k) => {
      const y = 966 + k * 40;
      ctx.globalAlpha = clamp(l.t, 0, 1);
      panel(16, y - 16, 330, 32, { r: 8, from: 'rgba(10,12,20,.9)', to: 'rgba(10,12,20,.9)', border: l.color, shadow: false });
      label(`${l.icon} ${trim(l.msg, 30)}`, 26, y + 1, 14, '#fff', 'left', 800);
      ctx.globalAlpha = 1;
    });
    this.giftCards.forEach((g, k) => {
      const y = 952 + k * 64;
      ctx.globalAlpha = clamp(g.t, 0, 1);
      panel(360, y - 4, W - 376, 56, { r: 10, from: 'rgba(60,20,90,.95)', to: 'rgba(25,8,40,.95)', border: '#b36bff', shadow: false });
      avatar(g.user, 386, y + 24, 18, '#b36bff');
      label(`@${trim(g.user.nick, 11)} enviou ${trim(g.gift, 10)}`, 412, y + 14, 14, '#fff', 'left', 800);
      label(`${g.action}${g.target ? ' → @' + trim(g.target, 10) : ''}`, 412, y + 36, 13, '#ffd23f', 'left', 800);
      ctx.globalAlpha = 1;
    });
    if (this.phase === 'lobby' || this.phase === 'countdown') {
      panel(60, 1100, W - 120, 96, { r: 22, from: 'rgba(20,24,40,.95)', to: 'rgba(8,9,15,.95)', border: '#ff9f1c' });
      title(this.phase === 'lobby' ? 'COMENTE CARRO OU MOTO' : `LARGADA EM ${Math.ceil(this.timer)}s`, W / 2, 1136, 26, '#ff9f1c');
      label(`${this.cars.length}/${CAR_MAX} pilotos${this.phase === 'lobby' ? ' · mínimo 2' : ' · ainda dá tempo de entrar'}`, W / 2, 1172, 17, '#ddd', 'center', 800);
    } else if (this.next.length) pill(`${this.next.length} na fila para a próxima corrida`, W / 2, 1150, { size: 16 });
  },
  drawPodium() {
    ctx.fillStyle = 'rgba(0,0,0,.82)'; ctx.fillRect(0, 0, W, H);
    title('PÓDIO', W / 2, 220, 70, '#ffd23f');
    const spots = [{ i: 1, x: 170, h: 200 }, { i: 0, x: 360, h: 280 }, { i: 2, x: 550, h: 150 }];
    for (const s of spots) {
      const c = this.podium[s.i];
      const col = ['#ffc93c', '#d7dde8', '#e08a3c'][s.i];
      panel(s.x - 90, 860 - s.h, 180, s.h, { r: 14, from: shade(col, 20), to: shade(col, -50) });
      num(`${s.i + 1}º`, s.x, 860 - s.h + 60, 64, '#1a1a1a');
      if (!c) continue;
      ctx.drawImage(vehicleSprite(c.type, c.color), s.x - 80, 860 - s.h - 92, 160, 104);
      avatar(c.user, s.x, 860 - s.h - 140, s.i === 0 ? 46 : 38, col);
      label(`@${trim(c.user.nick, 10)}`, s.x, 860 - s.h - 196, 20, '#fff', 'center', 800);
    }
    leaderboard(this.wins, 'Vitórias na live', W / 2, 940, 3, 28);
    text(`Próxima sala em ${Math.ceil(this.timer)}s`, W / 2, 1180, 30, '#ddd', 'center', 700);
  },
});
