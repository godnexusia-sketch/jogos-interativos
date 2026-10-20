'use strict';

// Palco de Avatares: o espectador comenta o nick do Roblox e o avatar real dele aparece dançando.
const STAGE_MAX = 25;

registerGame({
  id: 'avatares',
  name: 'Palco Roblox',
  icon: '🕺',
  help: '<p>Comente o seu <b>nick do Roblox</b> (só o nick, ou <b>!nick seunick</b>) e o seu avatar entra dançando no palco.</p><p>🌹 Fica o dobro do tempo, com brilho · 🍩 2,8× maior e a câmera vai nele · 🕶️ Furacão que derruba todo mundo · 🌌 Chuva de 20 avatares seus.</p>',
  reset() {
    this.dancers = [];
    this.rain = [];
    this.cam = { x: W / 2, y: H / 2, z: 1, focus: null, t: 0 };
    this.storm = 0;
    this.log = [];
    this.known = new Map(); // espectador -> dados do Roblox
  },
  sample: () => pick(['builderman', 'Roblox', 'oi', 'kkk']),
  addLog(msg, color = '#fff') { this.log.unshift({ msg, color, t: 5 }); this.log.length = Math.min(this.log.length, 3); },
  dancer(id) { return this.dancers.find((d) => d.id === id); },
  place(id, user, rbx, tier = 0) {
    let d = this.dancer(id);
    const ttl = [45, 90, 240, 240, 300][tier];
    if (!d) {
      if (this.dancers.length >= STAGE_MAX) this.dancers.shift();
      d = { id, user, rbx, size: 1, ttl, tier: 0, phase: rand(0, 6), born: 0 };
      this.dancers.push(d);
      sfx.pop();
    }
    d.ttl = Math.max(d.ttl, ttl);
    d.tier = Math.max(d.tier, tier);
    d.size = [1, 1, 2.8, 4, 4][d.tier];
    return d;
  },
  async onEvent(ev) {
    const id = uid(ev);
    if (ev.type === 'chat') {
      const m = ev.text.trim().match(/^!nick\s+@?([A-Za-z0-9_]{3,20})$/i);
      const nick = m ? m[1] : looksLikeNick(ev.text) ? ev.text.trim().replace(/^@/, '') : null;
      if (!nick) { const d = this.dancer(id); if (d) d.ttl = Math.max(d.ttl, 20); return; }
      const rbx = await robloxLookup(nick);
      if (!rbx) { if (m) this.addLog(`@${trim(ev.user.nick, 12)}: nick "${trim(nick, 12)}" não existe`, '#ff8a3d'); return; }
      this.known.set(id, rbx);
      this.place(id, ev.user, rbx);
      this.addLog(`🕺 ${trim(rbx.name, 14)} entrou no palco`, '#25f4ee');
    } else if (ev.type === 'gift') {
      const tier = giftTier(ev);
      const d = this.place(id, ev.user, this.known.get(id) || null, tier);
      this.addLog(`🎁 @${trim(ev.user.nick, 12)} ${['', 'brilhou', 'virou destaque', 'chamou o FURACÃO', 'fez CHOVER avatares'][tier]}`, '#ffd23f');
      if (tier >= 2) { this.cam.focus = d; this.cam.t = tier === 4 ? 9 : 5.5; }
      if (tier === 3) { this.storm = 12; sfx.boom(); announcer.show('🌪️ FURACÃO', '#b36bff', 2, 70); }
      if (tier === 4) {
        for (let k = 0; k < 20; k++) this.rain.push({ d, x: rand(60, W - 60), y: -rand(100, 2400), vy: rand(180, 320), rot: rand(-1, 1) });
        announcer.show(`🌌 ${trim(ev.user.nick, 12)}`, '#ff6bd6', 2.5, 64);
        sfx.win();
      }
    }
  },
  slot(i, n) {
    // Formação em fileiras: as de trás menores (perspectiva).
    const perRow = 5;
    const row = Math.floor(i / perRow), col = i % perRow;
    const rowCount = Math.min(perRow, n - row * perRow);
    const scale = 1 - row * 0.12;
    const spacing = 130 * scale;
    return { x: W / 2 + (col - (rowCount - 1) / 2) * spacing, y: 1040 - row * 120, s: scale };
  },
  update(dt) {
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    for (const d of this.dancers) { d.ttl -= dt; d.born += dt; }
    this.dancers = this.dancers.filter((d) => d.ttl > 0);
    this.storm = Math.max(0, this.storm - dt);
    for (const r of this.rain) { r.y += r.vy * dt; r.rot += dt; }
    this.rain = this.rain.filter((r) => r.y < H + 200);
    const c = this.cam;
    c.t = Math.max(0, c.t - dt);
    if (c.t <= 0 || !this.dancers.includes(c.focus)) c.focus = null;
    const target = c.focus ? { ...this.slot(this.dancers.indexOf(c.focus), this.dancers.length), z: 1.3 } : { x: W / 2, y: H / 2, z: 1 };
    if (c.focus) target.y -= 200;
    c.x += (target.x - c.x) * Math.min(1, dt * 3);
    c.y += (target.y - c.y) * Math.min(1, dt * 3);
    c.z += (target.z - c.z) * Math.min(1, dt * 3);
  },
  drawDancer(d, x, y, s, extraRot = 0) {
    const t = performance.now() / 1000;
    const size = 150 * s * (d.rbx ? d.size : Math.min(2, d.size));
    const bounce = Math.abs(Math.sin(t * (d.tier >= 2 ? 6 : 4) + d.phase)) * 18 * s;
    const sway = Math.sin(t * 3 + d.phase) * (d.tier >= 2 ? 0.25 : 0.12);
    const squash = d.tier >= 2 ? Math.cos(t * 6 + d.phase) : 1;
    ctx.save();
    ctx.translate(x, y - bounce);
    ctx.rotate(sway + extraRot);
    ctx.scale(squash < 0 ? -1 : 1, 1);
    if (d.tier >= 1) { ctx.shadowColor = ['#fff', '#ffd23f', '#ff6bd6', '#25f4ee', '#b36bff'][d.tier]; ctx.shadowBlur = 30 + Math.sin(t * 8) * 10; }
    const img = getImg(d.rbx?.img);
    if (img) ctx.drawImage(img, -size / 2, -size, size, size);
    else {
      roundRect(-size * 0.22, -size * 0.55, size * 0.44, size * 0.5, 12, colorFor(d.user.nick));
      ctx.shadowBlur = 0;
      ctx.restore(); ctx.save(); ctx.translate(x, y - bounce);
      avatar(d.user, 0, -size * 0.72, size * 0.2, '#fff');
    }
    ctx.restore();
    const name = d.rbx?.name || d.user.nick;
    text(trim(name, 12), x, y - size - bounce - 6, Math.max(14, 18 * s * Math.sqrt(d.size)), d.tier ? '#ffd23f' : '#fff', 'center', 800);
  },
  draw() {
    background('#12002b', '#3a0a5e');
    const t = performance.now() / 1000;
    const c = this.cam;
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(c.z, c.z); ctx.translate(-c.x, -c.y);
    // Luzes do palco
    for (let k = 0; k < 6; k++) {
      ctx.save();
      ctx.translate(60 + k * 120, 0);
      ctx.rotate(Math.sin(t * 0.8 + k) * 0.35);
      const g = ctx.createLinearGradient(0, 0, 0, 1100);
      g.addColorStop(0, COLORS[k] + '66'); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.lineTo(120, 1100); ctx.lineTo(-120, 1100); ctx.fill();
      ctx.restore();
    }
    // Chão
    ctx.fillStyle = '#1b1b2f'; ctx.fillRect(-400, 700, W + 800, 900);
    for (let k = 0; k < 10; k++) { ctx.fillStyle = `hsla(${(t * 60 + k * 36) % 360},80%,55%,.25)`; ctx.fillRect(k * 72, 700, 70, 600); }
    const n = this.dancers.length;
    const order = this.dancers.map((d, i) => ({ d, i })).sort((a, b) => this.slot(a.i, n).y - this.slot(b.i, n).y);
    for (const { d, i } of order) {
      const p = this.slot(i, n);
      let x = p.x, y = p.y, rot = 0;
      if (this.storm > 0 && d.tier < 3) {
        const a = t * 3 + i;
        x = W / 2 + Math.cos(a) * (150 + i * 8); y = 760 + Math.sin(a) * 120; rot = a;
      }
      this.drawDancer(d, x, y, p.s, rot);
    }
    for (const r of this.rain) this.drawDancer(r.d, r.x, r.y, 0.7, r.rot);
    ctx.restore();

    // Interface fixa
    roundRect(20, 20, W - 40, 150, 22, 'rgba(0,0,0,.6)');
    text('COMENTE SEU NICK', W / 2, 62, 46, '#fff', 'center', 900);
    text('DO ROBLOX 🕺', W / 2, 115, 46, '#25f4ee', 'center', 900);
    text(`${n}/${STAGE_MAX} no palco`, W / 2, 152, 20, '#ddd', 'center', 700);
    if (c.focus) { roundRect(140, 190, W - 280, 54, 27, 'rgba(255,107,214,.85)'); text(`🎥 ${trim(c.focus.rbx?.name || c.focus.user.nick, 14)}`, W / 2, 217, 28); }
    if (!n) { text('O palco está vazio', W / 2, 560, 40); text('Comente seu nick do Roblox!', W / 2, 620, 32, '#ffd23f'); }
    this.log.forEach((l, k) => {
      const y = 1130 + k * 42;
      ctx.globalAlpha = clamp(l.t, 0, 1);
      roundRect(20, y - 19, W - 40, 38, 19, 'rgba(0,0,0,.6)');
      text(trim(l.msg, 42), 40, y, 19, l.color, 'left', 700);
      ctx.globalAlpha = 1;
    });
  },
});
