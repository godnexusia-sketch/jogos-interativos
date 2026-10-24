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
    if (c.mode === 'yt') { this.playing = false; return yt.cmd({ cmd: 'play' }); }
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
  next() { if (this.cfg.mode === 'yt') return yt.cmd({ cmd: 'next' }); if (this.cfg.mode === 'list' && this.cfg.tracks.length) { this.el?.pause(); this.playTrack((this.idx + 1) % this.cfg.tracks.length); } },
  stop(keepYt) {
    if (!keepYt) yt.pause();
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

// ---------- Música do YouTube ----------
// O dono cola o link (vídeo, música, shorts ou playlist). Quem toca é o player oficial do YouTube escondido na
// tela onde sai o som (a tela da live; o painel, se não houver tela). O painel manda os comandos (tocar, pausar,
// próxima, anterior, ir para um minuto) e recebe de volta a música, o tempo e a duração para a barra.
function ytParse(link) {
  const s = String(link || '').trim();
  if (/^[\w-]{11}$/.test(s)) return { id: s };
  let u; try { u = new URL(/^https?:/.test(s) ? s : 'https://' + s); } catch { return null; }
  if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/.test(u.hostname)) return null;
  const list = u.searchParams.get('list') || '';
  let id = u.searchParams.get('v') || '';
  if (!id && u.hostname.endsWith('youtu.be')) id = u.pathname.slice(1, 12);
  if (!id) { const m = u.pathname.match(/\/(?:shorts|embed|live|v)\/([\w-]{11})/); if (m) id = m[1]; }
  if (id && !/^[\w-]{11}$/.test(id)) id = '';
  return id || list ? { id, list: /^RD/.test(list) ? '' : list } : null; // listas "RD" (mix automático) não abrem fora do YouTube
}
const yt = {
  player: null, apiP: null, idx: -1, playing: false, last: null,
  get cfg() { const c = music.cfg; return c.yt || (c.yt = { list: [], shuffle: false, loop: true }); },
  api() {
    if (!this.apiP) this.apiP = new Promise((resolve) => {
      if (window.YT?.Player) return resolve();
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
      const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
    });
    return this.apiP;
  },
  async ensure() {
    if (this.player) return this.player;
    await this.api();
    // Player invisível (precisa existir na página para tocar o som)
    const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:0;bottom:0;width:320px;height:180px;opacity:0.01;pointer-events:none;z-index:-1;overflow:hidden';
    const host = document.createElement('div'); host.id = 'ytHost'; box.appendChild(host); document.body.appendChild(box);
    this.player = await new Promise((resolve) => {
      const p = new YT.Player('ytHost', { width: 320, height: 180, playerVars: { autoplay: 1, controls: 0, playsinline: 1, rel: 0, iv_load_policy: 3 },
        events: { onReady: () => resolve(p), onStateChange: (e) => this.onState(e), onError: (e) => this.onError(e) } });
    });
    setInterval(() => this.report(), 1000);
    return this.player;
  },
  vol() { return Math.round(clamp((mixer.vol.music ?? 0.35) * (mixer.vol.master ?? 1) * (mixer.here ? 1 : 0), 0, 1) * 100); },
  async play(i) {
    const L = this.cfg.list;
    if (!L.length) return;
    i = ((i % L.length) + L.length) % L.length;
    music.stop(true);
    const p = await this.ensure(), it = L[i];
    this.idx = i; this.playing = true; this.cfg.cur = i;
    p.setVolume(this.vol());
    if (it.list && !it.id) p.loadPlaylist({ list: it.list, listType: 'playlist', index: 0 });
    else if (it.list) p.loadPlaylist({ list: it.list, listType: 'playlist' }), setTimeout(() => p.loadVideoById?.(it.id), 400);
    else p.loadVideoById(it.id);
    music.playing = true; music.now = it.title || 'YouTube';
  },
  // Comandos vindos do painel (só a tela que toca o som executa)
  async cmd(b) {
    if (Array.isArray(b.list)) this.cfg.list = b.list; // a lista vem junto do comando (não depende da ordem das mensagens)
    if (!mixer.here) return;
    const p = this.player, L = this.cfg.list;
    if (b.cmd === 'play') { if (Number.isInteger(b.i)) return this.play(b.i); if (p && this.idx >= 0 && p.getPlayerState?.() === 2) { p.playVideo(); this.playing = true; music.playing = true; } else this.play(this.idx >= 0 ? this.idx : this.cfg.cur || 0); }
    else if (b.cmd === 'pause') { p?.pauseVideo?.(); this.playing = false; music.playing = false; }
    else if (b.cmd === 'next') this.step(1);
    else if (b.cmd === 'prev') { if (p && p.getCurrentTime?.() > 5) p.seekTo(0, true); else this.step(-1); }
    else if (b.cmd === 'seek' && p) { p.seekTo(Math.max(0, Number(b.sec) || 0), true); }
    else if (b.cmd === 'stop') { p?.stopVideo?.(); this.playing = false; }
    if (!L.length) this.playing = false;
    setTimeout(() => this.report(), 300);
  },
  step(d) {
    const p = this.player, it = this.cfg.list[this.idx];
    // Dentro de uma playlist: anda nela; senão anda na lista do painel
    if (it?.list && p?.getPlaylist?.()?.length) { const n = p.getPlaylist().length, k = p.getPlaylistIndex(); if ((d > 0 && k < n - 1) || (d < 0 && k > 0)) { d > 0 ? p.nextVideo() : p.previousVideo(); return; } }
    const L = this.cfg.list; if (!L.length) return;
    this.play(this.cfg.shuffle && d > 0 && L.length > 1 ? (this.idx + 1 + Math.floor(Math.random() * (L.length - 1))) % L.length : this.idx + d);
  },
  onState(e) {
    if (e.data === YT.PlayerState.ENDED) { const it = this.cfg.list[this.idx]; if (!(it?.list && this.player.getPlaylistIndex() < this.player.getPlaylist().length - 1)) { if (this.cfg.loop !== false || this.idx < this.cfg.list.length - 1) this.step(1); else this.playing = false; } }
    if (e.data === YT.PlayerState.PLAYING) this.playing = true;
    this.report();
  },
  onError(e) {
    // 101/150: o dono do vídeo não deixa tocar fora do YouTube. Pula para a próxima.
    this.lastError = e.data === 101 || e.data === 150 ? 'Esse vídeo não pode tocar fora do YouTube (bloqueado pelo dono). Pulei.' : 'Não deu para tocar esse link. Pulei.';
    this.report();
    if (this.cfg.list.length > 1) setTimeout(() => this.step(1), 1500); else this.playing = false;
  },
  report() {
    const p = this.player;
    if (!p?.getPlayerState) return;
    if (!mixer.here && p.getPlayerState() === 1) { p.pauseVideo(); this.playing = false; } // a tela da live assumiu o som
    p.setVolume?.(this.vol());
    const d = p.getVideoData?.() || {}, st = { t: 'ytState', idx: this.idx, title: d.title || this.cfg.list[this.idx]?.title || '', author: d.author || '', vid: d.video_id || '', cur: p.getCurrentTime?.() || 0, dur: p.getDuration?.() || 0, playing: p.getPlayerState() === 1, buffering: p.getPlayerState() === 3, err: this.lastError || '' };
    this.lastError = '';
    this.last = st;
    window.onYtState?.(st);
    if (mixer.here && typeof busSend === 'function') busSend(st);
  },
  pause() { try { this.player?.pauseVideo?.(); } catch {} this.playing = false; },
};
