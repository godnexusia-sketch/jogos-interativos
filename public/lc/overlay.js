'use strict';

// Camada da live, por cima de qualquer jogo: alertas, efeitos, widgets (metas, top doadores, timer…) e shoutouts.
// Efeitos são desenhados no canvas; alertas e widgets são HTML (aceitam GIF e vídeo) numa camada 720×1280 sobre o jogo.

const ALERT_DEFAULTS = {
  on: true,
  font: 'Barlow',
  gift: { on: true, text: '{user} mandou {gift} ×{count}', sub: '{coins} moedas', sound: 'chime', media: '', read: false, pos: 'top', size: 'small', color: '#ff2d55', style: 'bubble', secs: 4, min: 1, other: true, variations: [] },
  follow: { on: true, text: '{user} começou a seguir!', sub: 'Obrigado! 💖', sound: 'pop', media: '', read: false, pos: 'top', size: 'small', color: '#ffc93c', style: 'bubble', secs: 3.5 },
  share: { on: true, text: '{user} compartilhou a live!', sub: '🔁 valeu demais', sound: 'whoosh', media: '', read: false, pos: 'top', size: 'small', color: '#22e3ee', style: 'bubble', secs: 3 },
  join: { on: false, text: 'Olá {user}!', sub: 'Bem-vindo à live', sound: '', media: '', read: false, pos: 'bottom', size: 'small', color: '#7cff6b', style: 'sticker', secs: 2.5, once: true, gap: 3 },
  likes: { on: false, text: '{user} mandou {count} likes!', sub: '❤️❤️❤️', sound: 'pop', media: '', read: false, pos: 'middle', size: 'small', color: '#ff6bd6', style: 'burst', secs: 3, min: 100 },
  milestones: [], // { on, metric: likes|followers|coins|shares|comments, every, text, sound, media, read }
};
const EFFECT_DEFAULTS = {
  likeFountain: { on: true, amount: 'some', from: 'anywhere', size: 1, pics: true },
  followBalloon: { on: true, size: 1, sound: true, secs: 6 },
  sharePlane: { on: true, size: 1, sound: true, trail: 'both' },
  giftFirework: { on: true, min: 10, size: 1, sound: true, name: true },
  giftFx: { on: true, max: 9, size: 1, sound: true },
};
const STREAM_DEFAULTS = {
  voice: 'francisca', readComments: false, readFormat: '{user} disse: {comment}', readMax: 120, readGap: 4,
  readShoutouts: true, shoutoutMsg: 'Salve @{username}! Obrigado por estar aqui!', shoutoutNoUser: 'Valeu por assistir, galera!',
  profanity: true, muteWords: [], audioOnPanel: false, countSim: true, readAll: true,
};

const liveCfg = {
  alerts: deepMerge(ALERT_DEFAULTS, store.get('live:alerts', {})),
  effects: deepMerge(EFFECT_DEFAULTS, store.get('live:effects', {})),
  widgets: store.get('live:widgets', null) || [],
  stream: { ...STREAM_DEFAULTS, ...store.get('live:stream', {}) },
  dj: store.get('live:dj', null),
  music: store.get('live:music', null),
  chars: store.get('live:chars', null),
  save(key, data, share = true) {
    this[key] = data;
    store.set('live:' + key, data);
    if (share && typeof shareConfig === 'function') shareConfig('live:' + key, data);
    this.changed(key);
  },
  apply(key, data) { if (key in this) { this[key] = data; store.set('live:' + key, data); this.changed(key); } },
  changed(key) {
    if (key === 'widgets') widgets.render();
    if (key === 'stream' && this.stream.mix) { Object.assign(mixer.vol, this.stream.mix); mixer.apply(); }
    if (key === 'stream') { scores.countSim = this.stream.countSim !== false; if (typeof updateAudioHere === 'function') updateAudioHere(); }
    if (key === 'dj') djPad?.loaded?.();
    if (key === 'chars' && typeof applyRoster === 'function') applyRoster();
  },
};
function deepMerge(base, over) {
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(over || {})) out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) ? { ...base[k], ...v } : v;
  return out;
}

// ---------- Números da sessão ----------
const stats = {
  reset() {
    this.likes = 0; this.coins = 0; this.followers = 0; this.shares = 0; this.comments = 0; this.joins = 0; this.gifts = 0;
    this.byCoins = new Map(); this.byLikes = new Map(); this.giftCount = new Map(); this.jar = []; this.lastFollower = null;
    this.started = Date.now();
  },
  bump(map, user, n) { const k = user?.id || user?.nick || '?'; const r = map.get(k) || { user, value: 0 }; r.user = user; r.value += n; map.set(k, r); },
  top(map, n) { return [...map.values()].sort((a, b) => b.value - a.value).slice(0, n); },
  onEvent(ev) {
    if (ev.type === 'chat') this.comments++;
    else if (ev.type === 'like') { this.likes += ev.count || 1; this.bump(this.byLikes, ev.user, ev.count || 1); }
    else if (ev.type === 'gift') {
      const c = coins(ev);
      this.coins += c; this.gifts += ev.count || 1;
      this.bump(this.byCoins, ev.user, c);
      const gk = ev.giftId || ev.name;
      this.giftCount.set(gk, (this.giftCount.get(gk) || 0) + (ev.count || 1));
      this.jar.push({ img: ev.img, name: ev.name, n: Math.min(ev.count || 1, 30), t: 0 });
      if (this.jar.length > 120) this.jar.shift();
    } else if (ev.type === 'social') { if (ev.action === 'share') this.shares++; else { this.followers++; this.lastFollower = ev.user; } }
    else if (ev.type === 'join') this.joins++;
  },
};
stats.reset();

// ---------- Sons prontos (gerados na hora) ----------
const SOUNDS = {
  chime: ['Sino', (t) => { [880, 1320, 1760].forEach((f, i) => t(f, 0.5, 'sine', 0.12, i * 0.08)); }],
  pop: ['Pop', (t) => { t(500, 0.08, 'sine', 0.18); t(900, 0.12, 'sine', 0.14, 0.05); }],
  whoosh: ['Vento', (t, n) => n(0.5, 800, 0.2)],
  coin: ['Moeda', (t) => { t(988, 0.08, 'square', 0.08); t(1319, 0.3, 'square', 0.08, 0.08); }],
  fanfare: ['Fanfarra', (t) => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => t(f, i === 5 ? 0.6 : 0.16, 'sawtooth', 0.07, i * 0.13)); }],
  airhorn: ['Buzina', (t) => { for (let i = 0; i < 3; i++) { t(415, 0.25, 'sawtooth', 0.12, i * 0.3); t(830, 0.25, 'sawtooth', 0.06, i * 0.3); } }],
  applause: ['Aplausos', (t, n) => { for (let i = 0; i < 26; i++) n(0.05, 2500 + Math.random() * 2000, 0.06 + Math.random() * 0.06, i * 0.06 + Math.random() * 0.04); }],
  drumroll: ['Rufar', (t, n) => { for (let i = 0; i < 40; i++) n(0.03, 300, 0.06 + i * 0.002, i * 0.045); n(0.4, 200, 0.3, 1.85); t(80, 0.5, 'sine', 0.3, 1.85); }],
  rimshot: ['Ba-dum-tss', (t, n) => { t(160, 0.12, 'sine', 0.3); t(120, 0.12, 'sine', 0.3, 0.18); n(0.5, 6000, 0.12, 0.38); }],
  buzzer: ['Errou', (t) => { t(140, 0.6, 'square', 0.12); t(147, 0.6, 'square', 0.12); }],
  correct: ['Acertou', (t) => { t(1046, 0.12, 'triangle', 0.15); t(1568, 0.4, 'triangle', 0.15, 0.12); }],
  sad: ['Trombone triste', (t) => { [392, 370, 349, 311].forEach((f, i) => t(f, i === 3 ? 0.9 : 0.4, 'sawtooth', 0.08, i * 0.42)); }],
  boing: ['Boing', (t, n, s) => s(200, 700, 0.4, 'sine', 0.2)],
  laser: ['Laser', (t, n, s) => s(1800, 200, 0.3, 'square', 0.08)],
  siren: ['Sirene', (t, n, s) => { for (let i = 0; i < 3; i++) { s(600, 1200, 0.35, 'sawtooth', 0.06, i * 0.7); s(1200, 600, 0.35, 'sawtooth', 0.06, i * 0.7 + 0.35); } }],
  boom: ['Explosão', (t, n) => { n(0.9, 400, 0.5); t(55, 0.8, 'sine', 0.35); }],
  cash: ['Caixa registradora', (t, n) => { t(2093, 0.1, 'square', 0.06); t(2637, 0.4, 'square', 0.06, 0.1); n(0.15, 5000, 0.08, 0.02); }],
  crickets: ['Grilos', (t) => { for (let i = 0; i < 6; i++) for (let k = 0; k < 3; k++) t(4200, 0.03, 'sine', 0.05, i * 0.35 + k * 0.05); }],
  levelup: ['Subiu de nível', (t) => { [523, 659, 784, 988, 1175, 1568].forEach((f, i) => t(f, 0.1, 'square', 0.06, i * 0.07)); }],
  heartbeat: ['Suspense', (t) => { for (let i = 0; i < 4; i++) { t(60, 0.15, 'sine', 0.4, i * 0.8); t(55, 0.2, 'sine', 0.35, i * 0.8 + 0.2); } }],
  bell: ['Gongo', (t) => { [220, 440, 663, 881].forEach((f, i) => t(f, 2.2, 'sine', 0.12 / (i + 1))); }],
  scratch: ['Disco arranhado', (t, n, s) => { s(900, 200, 0.12, 'sawtooth', 0.08); s(300, 1100, 0.12, 'sawtooth', 0.08, 0.13); }],
  kiss: ['Beijinho', (t, n, s) => s(1400, 2600, 0.1, 'sine', 0.15)],
  magic: ['Mágica', (t) => { for (let i = 0; i < 10; i++) t(1200 + i * 180, 0.25, 'sine', 0.05, i * 0.04); }],
  wow: ['Uau (sintetizado)', (t, n, s) => { s(300, 600, 0.3, 'sawtooth', 0.08); s(600, 350, 0.5, 'sawtooth', 0.08, 0.3); }],
};
// Toca um som: nome pronto, arquivo enviado (/api/media/…) ou link. ch = canal do mixer.
const soundBuffers = new Map();
function playSound(src, ch = 'fx', vol = 1) {
  if (!src || !mixer.here) return;
  const ac = mixer.init();
  if (!ac) return;
  const out = ac.createGain();
  out.gain.value = vol;
  out.connect(mixer.ch[ch] || mixer.ch.fx);
  if (SOUNDS[src]) {
    const t0 = ac.currentTime;
    const tone = (f, d, type, v, w = 0) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0 + w);
      g.gain.setValueAtTime(v, t0 + w); g.gain.exponentialRampToValueAtTime(0.0001, t0 + w + d);
      o.connect(g).connect(out); o.start(t0 + w); o.stop(t0 + w + d + 0.05);
    };
    const noise = (d, freq, v, w = 0) => {
      const b = ac.createBuffer(1, Math.max(1, ac.sampleRate * d), ac.sampleRate), data = b.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = v;
      s.connect(f).connect(g).connect(out); s.start(t0 + w);
    };
    const sweep = (f1, f2, d, type, v, w = 0) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f1, t0 + w); o.frequency.exponentialRampToValueAtTime(f2, t0 + w + d);
      g.gain.setValueAtTime(v, t0 + w); g.gain.exponentialRampToValueAtTime(0.0001, t0 + w + d);
      o.connect(g).connect(out); o.start(t0 + w); o.stop(t0 + w + d + 0.05);
    };
    SOUNDS[src][1](tone, noise, sweep);
    return;
  }
  let p = soundBuffers.get(src);
  if (!p) {
    p = fetch(src).then((r) => r.arrayBuffer()).then((ab) => ac.decodeAudioData(ab));
    p.catch(() => soundBuffers.delete(src));
    soundBuffers.set(src, p);
  }
  p.then((buf) => { const s = ac.createBufferSource(); s.buffer = buf; s.connect(out); s.start(); activeSources.add(s); s.onended = () => activeSources.delete(s); }).catch(() => {});
}
const activeSources = new Set();
function stopAllSounds() { for (const s of activeSources) { try { s.stop(); } catch {} } activeSources.clear(); }

// ---------- Camada HTML sobre o jogo ----------
const ovl = document.getElementById('ovl');
function fmtTpl(str, d) {
  return String(str || '').replace(/\{(\w+)\}/g, (_, k) => (d[k] ?? ''));
}
const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function mediaTag(src, cls = '') {
  if (!src) return '';
  return /\.(mp4|webm)(\?|$)/i.test(src) ? `<video class="${cls}" src="${escHtml(src)}" autoplay muted playsinline loop></video>` : `<img class="${cls}" src="${escHtml(src)}" alt="">`;
}
const picUrl = (u) => picList(u)[0] || '';

// ---------- Alertas ----------
const alerts = {
  queue: [], busy: false, greeted: new Set(), lastJoin: 0, likeAcc: new Map(),
  onEvent(ev) {
    const A = liveCfg.alerts;
    if (!A.on) return;
    if (ev.type === 'gift') {
      const c = coins(ev);
      const vars = (A.gift.variations || []).filter((v) => v.on !== false && (v.giftId ? String(v.giftId) === String(ev.giftId) : c >= (v.min || 0)));
      // A variação mais específica (presente exato, depois o maior mínimo) ganha
      vars.sort((a, b) => (b.giftId ? 1e9 : b.min || 0) - (a.giftId ? 1e9 : a.min || 0));
      const conf = vars[0] ? { ...A.gift, ...vars[0] } : A.gift.on && A.gift.other !== false && c >= (A.gift.min || 1) ? A.gift : null;
      if (conf) this.push(conf, { user: ev.user?.nick, gift: ev.name, count: ev.count || 1, coins: fmtNum(c) }, ev);
    } else if (ev.type === 'social') {
      const conf = ev.action === 'share' ? A.share : A.follow;
      if (conf.on) this.push(conf, { user: ev.user?.nick }, ev);
    } else if (ev.type === 'join' && A.join.on) {
      const k = uid(ev), now = performance.now();
      if (A.join.once && this.greeted.has(k)) return;
      if (now - this.lastJoin < (A.join.gap || 3) * 1000) return;
      this.greeted.add(k); this.lastJoin = now;
      this.push(A.join, { user: ev.user?.nick }, ev);
    } else if (ev.type === 'like' && A.likes.on) {
      const k = uid(ev), acc = (this.likeAcc.get(k) || 0) + (ev.count || 1);
      if (acc >= (A.likes.min || 100)) { this.likeAcc.set(k, 0); this.push(A.likes, { user: ev.user?.nick, count: acc }, ev); }
      else this.likeAcc.set(k, acc);
    }
    this.milestones(ev);
  },
  mileLast: {},
  milestones(ev) {
    const metric = { like: 'likes', gift: 'coins', chat: 'comments' }[ev.type] || (ev.type === 'social' ? (ev.action === 'share' ? 'shares' : 'followers') : null);
    if (!metric) return;
    const total = { likes: stats.likes, coins: stats.coins, comments: stats.comments, shares: stats.shares, followers: stats.followers }[metric];
    for (const m of liveCfg.alerts.milestones || []) {
      if (m.on === false || m.metric !== metric || !(m.every > 0)) continue;
      const step = Math.floor(total / m.every);
      const k = m.id || m.metric + m.every;
      if (step > (this.mileLast[k] || 0)) {
        this.mileLast[k] = step;
        const names = { likes: 'likes', coins: 'moedas', comments: 'comentários', shares: 'compartilhamentos', followers: 'seguidores' };
        this.push({ pos: 'middle', size: 'large', color: '#ffc93c', style: 'burst', secs: 5, sound: 'fanfare', ...m, text: m.text || 'Chegamos a {total} {metric}!' }, { total: fmtNum(step * m.every), metric: names[metric] }, null);
      }
    }
  },
  push(conf, data, ev) {
    if (this.queue.length > 8) return;
    this.queue.push({ conf, data, ev });
    this.next();
  },
  next() {
    if (this.busy || !this.queue.length) return;
    const { conf, data, ev } = this.queue.shift();
    this.busy = true;
    const el = document.createElement('div');
    el.className = `alert pos-${conf.pos || 'top'} size-${conf.size || 'medium'} style-${conf.style || 'bubble'}`;
    el.style.setProperty('--c', conf.color || '#ff2d55');
    el.style.fontFamily = `${liveCfg.alerts.font || 'Barlow'}, Barlow, sans-serif`;
    const gimg = ev?.img ? proxImgUrl(ev.img) : '';
    el.innerHTML = `${conf.media ? mediaTag(conf.media, 'al-media') : ''}
      <div class="al-box">${ev?.user ? avatarHtml(ev.user, 'al-pic') : ''}
        <div class="al-txt"><b>${escHtml(fmtTpl(conf.text, data))}</b>${conf.sub ? `<span>${escHtml(fmtTpl(conf.sub, data))}</span>` : ''}</div>
        ${gimg ? `<img class="al-gift" src="${escHtml(gimg)}" alt="" onerror="this.remove()">` : ''}</div>`;
    ovl.append(el);
    playSound(conf.sound, 'fx');
    if (conf.read) voice.say(fmtTpl(conf.text, data));
    const secs = clamp(Number(conf.secs) || 4, 1, 20);
    setTimeout(() => el.classList.add('out'), secs * 1000);
    setTimeout(() => { el.remove(); this.busy = false; this.next(); }, secs * 1000 + 450);
  },
  clear() { this.queue = []; ovl.querySelectorAll('.alert').forEach((e) => e.remove()); this.busy = false; },
};

// Shoutout: cartão com a foto e a mensagem, lido em voz alta.
function shoutout(user, msg) {
  const st = liveCfg.stream;
  const text = msg || (user ? fmtTpl(st.shoutoutMsg, { username: user.nick, user: user.nick }) : st.shoutoutNoUser);
  const el = document.createElement('div');
  el.className = 'shout';
  el.innerHTML = `${user ? avatarHtml(user, 'shout-pic') : '<span class="shout-ic">📣</span>'}<div><small>SHOUTOUT</small><b>${escHtml(text)}</b></div>`;
  ovl.append(el);
  playSound('fanfare', 'fx', 0.6);
  if (st.readShoutouts) voice.say(text, { prio: 'high' });
  setTimeout(() => el.classList.add('out'), 6000);
  setTimeout(() => el.remove(), 6500);
}

// ---------- Efeitos (canvas) ----------
const fx = {
  items: [],
  onEvent(ev) {
    const E = liveCfg.effects;
    if (ev.type === 'like' && E.likeFountain.on) {
      const n = { few: 0.5, some: 1, lots: 2.5 }[E.likeFountain.amount] || 1;
      const k = Math.min(6, Math.round(n * Math.ceil((ev.count || 1) / 8)) || (Math.random() < n ? 1 : 0));
      for (let i = 0; i < k; i++) this.heart(ev.user, i === 0 && E.likeFountain.pics);
    } else if (ev.type === 'social' && ev.action !== 'share' && E.followBalloon.on) {
      this.items.push({ k: 'balloon', user: ev.user, x: rand(120, W - 120), y: H + 120, t: 0, life: E.followBalloon.secs || 6, s: E.followBalloon.size || 1, hue: rand(0, 360) });
      if (E.followBalloon.sound) playSound('pop', 'fx', 0.6);
    } else if (ev.type === 'social' && ev.action === 'share' && E.sharePlane.on) {
      const ltr = Math.random() < 0.5;
      this.items.push({ k: 'plane', user: ev.user, x: ltr ? -120 : W + 120, y: rand(220, 700), vx: ltr ? 260 : -260, t: 0, life: 4.5, s: E.sharePlane.size || 1, trail: E.sharePlane.trail });
      if (E.sharePlane.sound) playSound('whoosh', 'fx', 0.7);
    } else if (ev.type === 'gift') {
      const c = coins(ev);
      if (E.giftFirework.on && c >= (E.giftFirework.min || 10)) {
        this.items.push({ k: 'rocket', user: ev.user, img: ev.img, name: E.giftFirework.name ? ev.user?.nick : '', x: rand(140, W - 140), y: H + 40, ty: rand(300, 560), t: 0, life: 4, rings: (ev.count || 1) >= 20 ? 3 : (ev.count || 1) >= 5 ? 2 : 1, s: E.giftFirework.size || 1, boom: false });
        if (E.giftFirework.sound) playSound('laser', 'fx', 0.4);
      } else if (E.giftFx.on && c <= (E.giftFx.max || 9) && ev.img) {
        this.items.push({ k: 'giftfx', img: ev.img, user: ev.user, t: 0, life: 2.2, s: E.giftFx.size || 1, x: rand(200, W - 200), y: rand(500, 800) });
        if (E.giftFx.sound) playSound('coin', 'fx', 0.5);
      }
    }
  },
  heart(user, withPic) {
    const from = liveCfg.effects.likeFountain.from;
    const x = from === 'left' ? rand(40, 200) : from === 'right' ? rand(W - 200, W - 40) : from === 'middle' ? rand(W / 2 - 120, W / 2 + 120) : rand(40, W - 40);
    this.items.push({ k: 'heart', user: withPic ? user : null, x, y: H + 30, vx: rand(-30, 30), vy: rand(-260, -160), t: 0, life: rand(2.5, 4), s: (liveCfg.effects.likeFountain.size || 1) * rand(0.7, 1.3), hue: pick([340, 350, 0, 320, 300]), sway: rand(0, 6) });
    if (this.items.length > 300) this.items.splice(0, 50);
  },
  test(kind) {
    const u = typeof fakeUser === 'function' ? fakeUser() : { nick: 'teste' };
    if (kind === 'like') for (let i = 0; i < 12; i++) this.heart(u, i === 0);
    else if (kind === 'follow') this.onEvent({ type: 'social', action: 'follow', user: u });
    else if (kind === 'share') this.onEvent({ type: 'social', action: 'share', user: u });
    else if (kind === 'firework') this.onEvent({ type: 'gift', user: u, name: 'Rosquinha', diamonds: 30, count: 5 });
    else if (kind === 'giftfx') this.onEvent({ type: 'gift', user: u, name: 'Rosa', diamonds: 1, count: 1 });
  },
  update(dt) {
    for (const it of this.items) {
      it.t += dt;
      if (it.k === 'heart') { it.x += (it.vx + Math.sin(it.t * 3 + it.sway) * 40) * dt; it.y += it.vy * dt; }
      else if (it.k === 'balloon') { it.y -= (H + 300) / it.life * dt; it.x += Math.sin(it.t * 1.5) * 20 * dt; }
      else if (it.k === 'plane') { it.x += it.vx * dt; it.y += Math.sin(it.t * 2) * 40 * dt; }
      else if (it.k === 'rocket') {
        if (!it.boom) {
          it.y += (it.ty - it.y) * Math.min(1, dt * 3);
          if (it.t > 1.1) {
            it.boom = true;
            for (let r = 0; r < it.rings; r++) {
              const n = 14 + r * 6;
              for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; it.parts = it.parts || []; it.parts.push({ x: it.x, y: it.y, vx: Math.cos(a) * (200 + r * 110), vy: Math.sin(a) * (200 + r * 110), d: r * 0.18 }); }
            }
            if (liveCfg.effects.giftFirework.sound) playSound('boom', 'fx', 0.35);
          }
        } else for (const p of it.parts) { if (it.t - 1.1 < p.d) continue; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy = p.vy * 0.97 + 120 * dt; }
      }
    }
    this.items = this.items.filter((it) => it.t < it.life);
  },
  draw() {
    for (const it of this.items) {
      const a = clamp(Math.min(it.t * 4, (it.life - it.t) * 2), 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      if (it.k === 'heart') {
        if (it.user) avatar(it.user, it.x, it.y, 22 * it.s, '#ff4d8d');
        else drawHeart(it.x, it.y, 22 * it.s, `hsl(${it.hue} 95% 62%)`);
      } else if (it.k === 'balloon') {
        const r = 62 * it.s;
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(it.x, it.y + r * 1.15); ctx.quadraticCurveTo(it.x + 14, it.y + r * 1.8, it.x - 6, it.y + r * 2.6); ctx.stroke();
        const gr = ctx.createRadialGradient(it.x - r * 0.35, it.y - r * 0.4, r * 0.1, it.x, it.y, r * 1.2);
        gr.addColorStop(0, `hsl(${it.hue} 100% 80%)`); gr.addColorStop(1, `hsl(${it.hue} 85% 45%)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(it.x, it.y, r, r * 1.15, 0, 0, 7); ctx.fill();
        avatar(it.user, it.x, it.y - 4, r * 0.62, '#fff');
        pill(`⭐ ${trim(it.user?.nick || '', 14)}`, it.x, it.y + r * 1.15 + 16, { size: 15, bg: 'rgba(0,0,0,.65)', color: '#ffc93c' });
      } else if (it.k === 'plane') {
        const dir = Math.sign(it.vx), s = it.s;
        if (it.trail !== 'none') { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.setLineDash([10, 12]); ctx.beginPath(); ctx.moveTo(it.x - dir * 50 * s, it.y); ctx.lineTo(it.x - dir * 260 * s, it.y + Math.sin(it.t * 2) * 20); ctx.stroke(); ctx.setLineDash([]); }
        ctx.translate(it.x, it.y); ctx.scale(dir * s, s);
        ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.moveTo(60, 0); ctx.lineTo(-50, -34); ctx.lineTo(-24, 0); ctx.lineTo(-50, 30); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.moveTo(60, 0); ctx.lineTo(-24, 0); ctx.lineTo(-38, 14); ctx.closePath(); ctx.fill();
        ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
        ctx.globalAlpha = a;
        pill(`🔁 ${trim(it.user?.nick || '', 14)}`, it.x - dir * 10, it.y + 52 * s, { size: 15, bg: 'rgba(0,0,0,.65)', color: '#22e3ee' });
      } else if (it.k === 'rocket') {
        if (!it.boom) { avatar(it.user, it.x, it.y, 26 * it.s, '#ffc93c'); burstTrail(it.x, it.y + 30); }
        else {
          const img = it.img ? getImg(proxImgUrl(it.img)) : null;
          for (const p of it.parts) {
            if (it.t - 1.1 < p.d) continue;
            if (img) ctx.drawImage(img, p.x - 16 * it.s, p.y - 16 * it.s, 32 * it.s, 32 * it.s);
            else { ctx.fillStyle = p.c || (p.c = pick(['#ffc93c', '#ff2d55', '#22e3ee', '#fff'])); ctx.beginPath(); ctx.arc(p.x, p.y, 5 * it.s, 0, 7); ctx.fill(); }
          }
          if (it.name) { ctx.globalAlpha = a * clamp((it.t - 1.1) * 3, 0, 1); pill(it.name, it.x, it.y, { size: 20, bg: 'rgba(0,0,0,.7)', color: '#ffc93c' }); }
        }
      } else if (it.k === 'giftfx') {
        const img = it.img ? getImg(proxImgUrl(it.img)) : null;
        const k = Math.sin(clamp(it.t / it.life, 0, 1) * Math.PI), sz = (120 + 160 * k) * it.s;
        ctx.globalAlpha = a;
        if (img) ctx.drawImage(img, it.x - sz / 2, it.y - sz / 2 - it.t * 40, sz, sz);
      }
      ctx.restore();
    }
  },
  clear() { this.items = []; },
};
function drawHeart(x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.8, y - r * 1.3, x, y - r * 0.45);
  ctx.bezierCurveTo(x + r * 0.8, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
  ctx.fill();
}
function burstTrail(x, y) { for (let i = 0; i < 2; i++) particles.push({ x: x + rand(-6, 6), y, vx: rand(-20, 20), vy: rand(60, 160), life: 0.5, max: 0.5, color: pick(['#ffc93c', '#ff8a3d', '#fff']), size: rand(3, 7), noGravity: true }); }

// ---------- Widgets ----------
const WIDGET_TYPES = {
  giftGoal: { name: 'Meta de moedas', icon: '🪙', desc: 'Soma as moedas dos presentes até a meta.', def: { title: 'Meta de presentes', target: 1000 } },
  giftCountGoal: { name: 'Meta de um presente', icon: '🎁', desc: 'Conta um presente escolhido, ex.: 100 Rosas.', def: { title: 'Meta de Rosas', target: 100, giftId: '', giftName: 'Rose' } },
  likeGoal: { name: 'Meta de likes', icon: '❤️', desc: 'Enche com os likes da live.', def: { title: 'Meta de likes', target: 10000 } },
  followGoal: { name: 'Meta de seguidores', icon: '⭐', desc: 'Enche a cada novo seguidor.', def: { title: 'Meta de seguidores', target: 50 } },
  shareGoal: { name: 'Meta de compartilhamentos', icon: '🔁', desc: 'Enche a cada compartilhamento.', def: { title: 'Compartilhamentos', target: 20 } },
  topGifters: { name: 'Top doadores', icon: '🏆', desc: 'Quem mais mandou moedas nesta live.', def: { title: 'Top doadores', n: 3 } },
  topLikers: { name: 'Top likes', icon: '💗', desc: 'Quem mais curtiu nesta live.', def: { title: 'Top likes', n: 3 } },
  timer: { name: 'Timer', icon: '⏱️', desc: 'Contagem regressiva; presentes podem somar tempo.', def: { title: 'A live acaba em', minutes: 30, secsPerCoin: 0, max: 240 } },
  ticker: { name: 'Mensagens rolando', icon: '📜', desc: 'Suas mensagens passando na tela.', def: { text: 'Siga a live! ⭐\nMande um presente para jogar 🎁', speed: 60, dir: 'left' } },
  media: { name: 'Imagem, GIF ou vídeo', icon: '🖼️', desc: 'Sua mídia na tela; arraste e redimensione.', def: { src: '', w: 220 } },
  giftJar: { name: 'Pote de presentes', icon: '🫙', desc: 'Cada presente cai no pote e acumula.', def: { title: 'Pote da live' } },
  lastFollower: { name: 'Último seguidor', icon: '🙋', desc: 'Mostra quem seguiu por último.', def: { title: 'Último seguidor' } },
  scoreBoard: { name: 'Placar salvo', icon: '📋', desc: 'Pontos que os espectadores juntaram no jogo atual.', def: { title: 'Melhores jogadores', n: 5 } },
};
const widgets = {
  els: new Map(),
  timers: {}, // id -> segundos restantes
  render() {
    for (const [id, el] of this.els) if (!liveCfg.widgets.find((w) => w.id === id && w.on !== false)) { el.remove(); this.els.delete(id); }
    for (const w of liveCfg.widgets) {
      if (w.on === false) continue;
      let el = this.els.get(w.id);
      if (!el) { el = document.createElement('div'); el.className = 'widget w-' + w.type; el.dataset.id = w.id; ovl.append(el); this.els.set(w.id, el); el.dataset.sig = ''; }
      el.style.left = (w.x ?? 20) + 'px'; el.style.top = (w.y ?? 200) + 'px';
      el.style.transform = `scale(${w.scale || 1})`;
      if (w.type === 'timer' && this.timers[w.id] === undefined) this.timers[w.id] = (w.minutes || 30) * 60;
      if (w.type === 'media') { const sig = w.src + '|' + w.w; if (el.dataset.sig !== sig) { el.dataset.sig = sig; el.innerHTML = w.src ? mediaTag(w.src) : '<div class="w-empty">Escolha uma mídia</div>'; el.style.width = (w.w || 220) + 'px'; } }
      if (w.type === 'ticker') { const sig = w.text + w.speed + w.dir; if (el.dataset.sig !== sig) { el.dataset.sig = sig; const msgs = lines(w.text).map(escHtml).join(' <i>•</i> '); el.innerHTML = `<div class="tk ${w.dir === 'up' ? 'up' : ''}" style="animation-duration:${Math.max(6, 1200 / (w.speed || 60))}s"><span>${msgs}</span><span>${msgs}</span></div>`; } }
    }
    this.tick(0);
  },
  goalHtml(w, cur, icon) {
    const pct = clamp(cur / Math.max(1, w.target), 0, 1);
    return `<div class="wg-head"><span>${icon} ${escHtml(w.title || '')}</span><b>${fmtK(cur)} / ${fmtK(w.target)}</b></div><div class="bar"><i style="width:${pct * 100}%"></i></div>`;
  },
  listHtml(w, rows, unit) {
    return `<div class="wg-head"><span>${escHtml(w.title || '')}</span></div>${rows.length ? rows.map((r, i) => `<div class="wl"><em>${i + 1}</em>${avatarHtml(r.user)}<span>${escHtml(trim(r.user?.nick || '?', 16))}</span><b>${fmtK(r.value)}${unit}</b></div>`).join('') : '<div class="w-empty">Ninguém ainda</div>'}`;
  },
  tickT: 0,
  tick(dt) {
    this.tickT -= dt;
    for (const w of liveCfg.widgets) {
      if (w.type === 'timer' && w.on !== false && this.timers[w.id] > 0 && !this.timerPaused?.[w.id]) this.timers[w.id] = Math.max(0, this.timers[w.id] - dt);
    }
    if (this.tickT > 0) return;
    this.tickT = 0.25;
    for (const w of liveCfg.widgets) {
      const el = this.els.get(w.id);
      if (!el) continue;
      let html = null;
      if (w.type === 'giftGoal') html = this.goalHtml(w, stats.coins, '🪙');
      else if (w.type === 'giftCountGoal') html = this.goalHtml(w, stats.giftCount.get(w.giftId) || stats.giftCount.get(w.giftName) || 0, '🎁');
      else if (w.type === 'likeGoal') html = this.goalHtml(w, stats.likes, '❤️');
      else if (w.type === 'followGoal') html = this.goalHtml(w, stats.followers, '⭐');
      else if (w.type === 'shareGoal') html = this.goalHtml(w, stats.shares, '🔁');
      else if (w.type === 'topGifters') html = this.listHtml(w, stats.top(stats.byCoins, w.n || 3), ' 🪙');
      else if (w.type === 'topLikers') html = this.listHtml(w, stats.top(stats.byLikes, w.n || 3), ' ❤️');
      else if (w.type === 'scoreBoard') html = this.listHtml(w, scores.top(current?.id, w.n || 5).map((r) => ({ user: r, value: r.pts })), ' pts');
      else if (w.type === 'timer') { const s = this.timers[w.id] ?? 0; html = `<div class="wg-head"><span>⏱️ ${escHtml(w.title || '')}</span></div><div class="tm ${s < 60 ? 'warn' : ''}">${Math.floor(s / 3600) ? Math.floor(s / 3600) + ':' : ''}${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}</div>${w.secsPerCoin ? `<small>+${w.secsPerCoin}s por moeda</small>` : ''}`; }
      else if (w.type === 'lastFollower') html = `<div class="wg-head"><span>🙋 ${escHtml(w.title || '')}</span></div>${stats.lastFollower ? `<div class="wl">${avatarHtml(stats.lastFollower)}<span>${escHtml(trim(stats.lastFollower.nick, 18))}</span></div>` : '<div class="w-empty">Aguardando…</div>'}`;
      else if (w.type === 'giftJar') { const items = stats.jar.slice(-40); html = `<div class="wg-head"><span>🫙 ${escHtml(w.title || '')}</span><b>${fmtK(stats.coins)} 🪙</b></div><div class="jar">${items.map((g) => (g.img ? `<img src="${escHtml(proxImgUrl(g.img))}" alt="" onerror="this.replaceWith('🎁')">` : '<i>🎁</i>')).join('')}</div>`; }
      if (html !== null && el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }
    }
  },
  onEvent(ev) {
    if (ev.type !== 'gift') return;
    for (const w of liveCfg.widgets) if (w.type === 'timer' && w.secsPerCoin > 0 && this.timers[w.id] !== undefined) this.timers[w.id] = Math.min((w.max || 240) * 60, this.timers[w.id] + coins(ev) * w.secsPerCoin);
  },
  timerCmd(id, cmd, v) {
    const w = liveCfg.widgets.find((x) => x.id === id);
    if (!w) return;
    this.timerPaused = this.timerPaused || {};
    if (cmd === 'add') this.timers[id] = Math.min((w.max || 240) * 60, (this.timers[id] || 0) + v);
    else if (cmd === 'reset') this.timers[id] = (w.minutes || 30) * 60;
    else if (cmd === 'pause') this.timerPaused[id] = !this.timerPaused[id];
  },
};

// Tudo que a camada da live faz com cada evento.
const overlay = {
  onEvent(ev) {
    stats.onEvent(ev);
    alerts.onEvent(ev);
    fx.onEvent(ev);
    widgets.onEvent(ev);
    djPad?.onEvent?.(ev);
    commentReader.onEvent(ev); // locutor: fala cada interação
    if (ev.type === 'gift' && ev.giftId && ev.img && learnedGifts[ev.giftId] !== ev.img) { learnedGifts[ev.giftId] = ev.img; store.set('giftImgs', learnedGifts); }
  },
  update(dt) { fx.update(dt); widgets.tick(dt); },
  draw() { fx.draw(); },
  panic() { voice.stopAll(); stopAllSounds(); alerts.clear(); fx.clear(); music?.stop?.(); ovl.querySelectorAll('.shout').forEach((e) => e.remove()); },
};
