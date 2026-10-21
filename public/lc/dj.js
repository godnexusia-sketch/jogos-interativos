'use strict';

// DJ Pad (sons disparados pelo painel ou por eventos da live) e música de fundo (sua playlist ou trilhas geradas na hora).

const DJ_DEFAULT_PADS = ['airhorn', 'applause', 'drumroll', 'rimshot', 'buzzer', 'correct', 'sad', 'boing', 'fanfare', 'boom', 'siren', 'cash']
  .map((s, i) => ({ id: 'pad' + i, name: SOUNDS[s][0], src: s, color: COLORS[i % COLORS.length], trigger: 'manual', on: true }));

const djPad = {
  get cfg() { return liveCfg.dj || (liveCfg.dj = { pads: DJ_DEFAULT_PADS, cols: 4 }); },
  play(id) {
    const p = this.cfg.pads.find((x) => x.id === id);
    if (p && p.on !== false) { playSound(p.src, 'dj'); this.flash = { id, t: performance.now() }; }
  },
  onEvent(ev) {
    for (const p of this.cfg.pads) {
      if (p.on === false || !p.trigger || p.trigger === 'manual') continue;
      let hit = false;
      if (p.trigger === 'gift' && ev.type === 'gift') hit = p.giftId ? String(p.giftId) === String(ev.giftId) : coins(ev) >= (p.min || 1);
      else if (p.trigger === 'comment' && ev.type === 'chat') hit = keywordHit(ev.text, p.keyword) && Boolean(p.keyword);
      else if (p.trigger === 'follow') hit = ev.type === 'social' && ev.action !== 'share';
      else if (p.trigger === 'share') hit = ev.type === 'social' && ev.action === 'share';
      else if (p.trigger === 'join') hit = ev.type === 'join';
      if (hit) playSound(p.src, 'dj');
    }
  },
  loaded() {},
};

// ---------- Música ----------
// Trilhas geradas na hora (sem arquivo, sem direitos autorais): acordes, baixo e bateria num sequenciador simples.
const MUSIC_STYLES = {
  chill: { name: 'Lo-fi tranquilo', bpm: 82, chords: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62]], wave: 'triangle', drums: 'soft', lead: false },
  festa: { name: 'Festa eletrônica', bpm: 124, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], wave: 'sawtooth', drums: 'house', lead: true },
  arcade: { name: 'Arcade 8-bit', bpm: 140, chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], wave: 'square', drums: 'chip', lead: true },
  quiz: { name: 'Suspense de quiz', bpm: 100, chords: [[57, 60, 64], [57, 60, 65], [56, 59, 64], [57, 60, 64]], wave: 'triangle', drums: 'tick', lead: false },
  epico: { name: 'Épico de batalha', bpm: 112, chords: [[50, 57, 62], [46, 53, 58], [48, 55, 60], [45, 52, 57]], wave: 'sawtooth', drums: 'epic', lead: true },
  funk: { name: 'Batida funk', bpm: 130, chords: [[52, 55, 59], [52, 55, 59], [50, 54, 57], [48, 52, 55]], wave: 'square', drums: 'funk', lead: false },
};
const music = {
  get cfg() { return liveCfg.music || (liveCfg.music = { mode: 'gen', style: 'chill', tracks: [], shuffle: false }); },
  playing: false, el: null, node: null, idx: 0, timer: null, step: 0, nextT: 0,
  start() {
    this.stop();
    if (!mixer.here) { this.playing = true; return; }
    const ac = mixer.init();
    if (!ac) return;
    this.playing = true;
    const c = this.cfg;
    if (c.mode === 'list' && c.tracks.length) this.playTrack(this.idx % c.tracks.length);
    else { this.step = 0; this.nextT = ac.currentTime + 0.1; this.timer = setInterval(() => this.schedule(), 50); }
  },
  playTrack(i) {
    const c = this.cfg, ac = mixer.init();
    this.idx = i;
    const t = c.tracks[i];
    if (!t) return;
    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.src = t.src;
    el.onended = () => { if (this.playing) this.playTrack(c.shuffle ? randInt(0, c.tracks.length - 1) : (this.idx + 1) % c.tracks.length); };
    try { this.node = ac.createMediaElementSource(el); this.node.connect(mixer.ch.music); } catch {}
    el.play().catch(() => {});
    this.el = el;
    this.now = t.name;
  },
  next() { if (this.cfg.mode === 'list' && this.cfg.tracks.length) { this.el?.pause(); this.playTrack((this.idx + 1) % this.cfg.tracks.length); } },
  stop() {
    this.playing = false;
    clearInterval(this.timer); this.timer = null;
    if (this.el) { this.el.onended = null; this.el.pause(); this.el = null; }
    try { this.node?.disconnect(); } catch {}
    this.now = '';
  },
  toggle() { this.playing ? this.stop() : this.start(); },
  // Sequenciador: agenda as notas um pouco à frente do relógio do áudio.
  schedule() {
    const ac = mixer.init(), st = MUSIC_STYLES[this.cfg.style] || MUSIC_STYLES.chill;
    this.now = st.name;
    const spb = 60 / st.bpm / 4; // semicolcheia
    while (this.nextT < ac.currentTime + 0.2) {
      this.note16(this.step, this.nextT, st, spb);
      this.nextT += spb; this.step++;
    }
  },
  note16(step, t, st, spb) {
    const out = mixer.ch.music, ac = mixer.ctx || sfx.ac;
    const bar = Math.floor(step / 16) % st.chords.length, s = step % 16, chord = st.chords[bar];
    const hz = (m) => 440 * 2 ** ((m - 69) / 12);
    const tone = (m, d, type, v, detune = 0) => {
      const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
      o.type = type; o.frequency.value = hz(m); o.detune.value = detune;
      f.type = 'lowpass'; f.frequency.value = type === 'square' ? 2400 : 1800;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + d + 0.05);
    };
    const hit = (freq, d, v, type = 'noise') => {
      if (type === 'kick') { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(out); o.start(t); o.stop(t + d); return; }
      const b = ac.createBuffer(1, Math.max(1, ac.sampleRate * d), ac.sampleRate), data = b.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = b; f.type = 'highpass'; f.frequency.value = freq; g.gain.value = v;
      src.connect(f).connect(g).connect(out); src.start(t);
    };
    // Acorde (pad) no começo do compasso, baixo nas batidas
    if (s === 0) chord.forEach((m, i) => tone(m, spb * 15, st.wave === 'square' ? 'square' : 'triangle', 0.035, i * 4));
    if (s % 4 === 0 || (st.drums === 'house' && s % 4 === 2)) tone(chord[0] - 12, spb * (st.drums === 'house' ? 1.5 : 3), st.wave === 'sawtooth' ? 'sawtooth' : 'triangle', 0.09);
    // Bateria
    const d = st.drums;
    if (d === 'house' || d === 'chip' || d === 'funk' || d === 'epic') { if (s % 4 === 0 || (d === 'funk' && [3, 6, 10].includes(s))) hit(0, 0.3, 0.5, 'kick'); }
    else if (d === 'soft' && (s === 0 || s === 10)) hit(0, 0.25, 0.35, 'kick');
    if (s === 4 || s === 12) hit(1500, 0.18, d === 'soft' ? 0.06 : 0.12);
    if (d !== 'tick' ? s % 2 === 0 : s % 4 === 0) hit(7000, 0.04, d === 'soft' ? 0.025 : 0.04);
    if (d === 'epic' && s % 8 === 6) hit(900, 0.3, 0.12);
    // Melodia simples sorteada dentro do acorde
    if (st.lead && (s % 4 === 2 || s % 8 === 7) && Math.random() < 0.7) tone(pick(chord) + 12 + pick([0, 0, 2, -1]), spb * 2, st.wave, 0.03);
    if (d === 'tick' && s % 4 === 0) tone(chord[2] + 24, 0.05, 'sine', 0.02);
  },
};
