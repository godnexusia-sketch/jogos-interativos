'use strict';

// Pipa: cada comentário vira uma pipa com a foto de quem comentou. Presente corta a pipa dos outros.
const KITE_MAX = 40;

registerGame({
  id: 'pipa',
  name: 'Pipa',
  icon: '🪁',
  help: '<p>Comente qualquer coisa e ganhe uma <b>pipa</b> com a sua foto. ❤️ Likes fazem a sua pipa subir. Comente <b>corta</b> para tentar cortar a pipa mais perto (1 a cada 8s).</p><p>🌹 Caça e corta 1 · 🍩 Escudo de 30s · 🕶️ Corta 3 · 🌌 Linha de ouro: corta 10.</p>',
  cd: new Cooldown(8000),
  kings: new Map(),
  reset() {
    this.kites = [];
    this.falling = [];
    this.respawn = new Map();
    this.log = [];
    this.windT = 12;
  },
  sample: () => pick(['oi', 'corta', 'bora', 'kkk', 'manda']),
  kite(id) { return this.kites.find((k) => k.id === id); },
  spawn(user) {
    const id = user.id || user.nick;
    if (this.kite(id) || this.kites.length >= KITE_MAX) return this.kite(id);
    if ((this.respawn.get(id) || 0) > performance.now()) return null;
    const k = { id, user, color: colorFor(user.nick), x: rand(80, W - 80), y: rand(250, 760), alt: 0, phase: rand(0, 6), shield: 0, hunt: [], kills: 0, born: 0, anchor: rand(60, W - 60) };
    this.kites.push(k);
    sfx.pop();
    return k;
  },
  nearestTargets(k, n) {
    return this.kites.filter((o) => o !== k && o.shield <= 0 && !k.hunt.includes(o)).sort((a, b) => dist(a, k) - dist(b, k)).slice(0, n);
  },
  cut(victim, by) {
    const i = this.kites.indexOf(victim);
    if (i < 0) return;
    this.kites.splice(i, 1);
    this.falling.push({ ...victim, vy: 0, rot: 0, t: 3 });
    this.respawn.set(victim.id, performance.now() + 10000);
    if (by) { by.kills++; addScore(this.kings, by.user.nick); this.addLog(`✂️ @${trim(by.user.nick, 10)} cortou @${trim(victim.user.nick, 10)}`, by.color); }
    burst(victim.x, victim.y, [victim.color, '#fff'], 24, 300);
    sfx.tone(500, 0.15, 'sawtooth', 0.08);
  },
  addLog(msg, color) { this.log.unshift({ msg, color, t: 6 }); this.log.length = Math.min(this.log.length, 4); },
  onEvent(ev) {
    const id = uid(ev);
    if (ev.type === 'chat') {
      const k = this.kite(id) || this.spawn(ev.user);
      if (k && /corta|cerol|linha/i.test(ev.text) && this.cd.ok(id)) {
        const [t] = this.nearestTargets(k, 1);
        if (t && Math.random() < 0.3) k.hunt.push(t);
        else if (t) floatText('errou!', k.x, k.y - 50, '#fff', 26);
      }
    } else if (ev.type === 'like') {
      const k = this.kite(id);
      if (k) k.alt = Math.min(300, k.alt + ev.count * 4);
    } else if (ev.type === 'gift') {
      const k = this.kite(id) || this.spawn(ev.user);
      if (!k) return;
      const tier = giftTier(ev), n = Math.min(5, ev.count || 1);
      if (tier === 2) { k.shield = Math.min(120, k.shield + 30 * n); this.addLog(`🛡️ @${trim(ev.user.nick, 12)} ganhou escudo`, '#25f4ee'); return; }
      const cuts = { 1: 1, 3: 3, 4: 10 }[tier] * n;
      k.hunt.push(...this.nearestTargets(k, cuts));
      if (tier >= 3) announcer.show(`${tier === 4 ? '🌟 LINHA DE OURO' : '✂️ CAÇADA'} @${trim(ev.user.nick, 10)}`, tier === 4 ? '#ffd23f' : '#fe2c55', 2, 46);
      if (tier === 4) k.gold = 10;
    }
  },
  update(dt) {
    const t = performance.now() / 1000;
    for (const l of this.log) l.t -= dt;
    this.log = this.log.filter((l) => l.t > 0);
    for (const k of this.kites) {
      k.born += dt;
      k.shield = Math.max(0, k.shield - dt);
      k.gold = Math.max(0, (k.gold || 0) - dt);
      k.alt = Math.max(0, k.alt - dt * 6);
      k.hunt = k.hunt.filter((o) => this.kites.includes(o));
      const target = k.hunt[0];
      if (target) {
        const d = dist(k, target);
        const sp = 900 * dt;
        k.x += ((target.x - k.x) / (d || 1)) * Math.min(sp, d);
        k.y += ((target.y - k.y) / (d || 1)) * Math.min(sp, d);
        if (d < 40) { if (target.shield > 0) { target.shield = 0; k.hunt.shift(); floatText('🛡️', target.x, target.y - 40); } else { this.cut(target, k); k.hunt.shift(); } }
      } else {
        const tx = k.anchor + Math.sin(t * 0.4 + k.phase) * 90;
        const ty = 300 + ((k.phase * 97) % 460) - k.alt + Math.sin(t * 0.9 + k.phase) * 30;
        k.x += (tx - k.x) * Math.min(1, dt * 1.2);
        k.y += (ty - k.y) * Math.min(1, dt * 1.2);
      }
    }
    for (const f of this.falling) { f.t -= dt; f.vy += 500 * dt; f.y += f.vy * dt; f.rot += dt * 8; }
    this.falling = this.falling.filter((f) => f.t > 0 && f.y < H + 80);
    // Vento embola duas pipas de vez em quando, mesmo sem presente.
    this.windT -= dt;
    if (this.windT <= 0) {
      this.windT = 12;
      if (this.kites.length >= 6) {
        const a = pick(this.kites);
        const [b] = this.nearestTargets(a, 1);
        if (b) { announcer.show('🌬️ EMBOLOU!', '#fff', 1.5, 46); this.cut(Math.random() < 0.5 ? b : a, null); }
      }
    }
  },
  drawKite(k, rot = 0) {
    const t = performance.now() / 1000;
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(rot + Math.sin(t * 2 + k.phase) * 0.12);
    const s = k.born < 0.4 ? k.born / 0.4 : 1;
    ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(0, -58); ctx.lineTo(46, 0); ctx.lineTo(0, 62); ctx.lineTo(-46, 0); ctx.closePath();
    ctx.fillStyle = k.gold > 0 ? '#ffd23f' : k.color; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(0, 56); ctx.moveTo(-40, 0); ctx.lineTo(40, 0); ctx.stroke();
    ctx.strokeStyle = k.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 56);
    for (let i = 1; i <= 6; i++) ctx.lineTo(Math.sin(t * 4 + i + k.phase) * 10, 56 + i * 14);
    ctx.stroke();
    ctx.restore();
    avatar(k.user, k.x, k.y, 27, '#fff');
    if (k.shield > 0) { ctx.beginPath(); ctx.arc(k.x, k.y, 62, 0, Math.PI * 2); ctx.strokeStyle = '#25f4ee'; ctx.lineWidth = 4; ctx.stroke(); }
    pill(`@${trim(k.user.nick, 12)}`, k.x, k.y - 72, { size: 15, bg: shade(k.color, -60), border: k.color });
  },
  draw() {
    background('#56b4f5', '#ffd6a5');
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    for (let i = 0; i < 4; i++) { const cx = (performance.now() / 60 + i * 260) % (W + 300) - 150; ctx.beginPath(); ctx.ellipse(cx, 230 + i * 120, 90, 28, 0, 0, Math.PI * 2); ctx.fill(); }
    // Laje e casas
    ctx.fillStyle = '#5c4033';
    for (let i = 0; i < 9; i++) ctx.fillRect(i * 82, 1010 - ((i * 37) % 70), 78, 300);
    ctx.fillStyle = '#3e2a20'; ctx.fillRect(0, 1060, W, 220);
    // Linhas
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
    for (const k of this.kites) { ctx.beginPath(); ctx.moveTo(k.anchor, 1060); ctx.quadraticCurveTo(k.anchor, k.y + 200, k.x, k.y + 50); ctx.stroke(); }
    for (const f of this.falling) { ctx.globalAlpha = clamp(f.t, 0, 1); this.drawKite(f, f.rot); ctx.globalAlpha = 1; }
    for (const k of this.kites) this.drawKite(k);

    roundRect(20, 20, W - 40, 110, 20, 'rgba(0,0,0,.55)');
    text('🪁 PIPA NA LIVE', 40, 56, 36, '#ffd23f', 'left', 900);
    text(`${this.kites.length}/${KITE_MAX} no céu`, W - 40, 56, 24, '#fff', 'right', 700);
    text('Comente para ganhar sua pipa · 🎁 corta as outras', W / 2, 102, 22, '#fff', 'center', 700);
    if (!this.kites.length) text('O céu está vazio… comente!', W / 2, 560, 44, '#fff');
    this.log.forEach((l, k) => {
      const y = 1100 + k * 42;
      ctx.globalAlpha = clamp(l.t, 0, 1);
      roundRect(20, y - 19, 430, 38, 19, 'rgba(0,0,0,.6)');
      text(trim(l.msg, 32), 36, y, 19, l.color, 'left', 700);
      ctx.globalAlpha = 1;
    });
    const rows = [...this.kings.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (rows.length) {
      roundRect(466, 1080, 234, 40 + rows.length * 36, 16, 'rgba(0,0,0,.6)');
      text('👑 REI DO CÉU', 482, 1100, 18, '#ffd23f', 'left', 800);
      rows.forEach(([n, v], i) => text(`${i + 1}. ${trim(n, 10)} ✂️${v}`, 482, 1136 + i * 36, 18, '#fff', 'left', 700));
    }
  },
});
