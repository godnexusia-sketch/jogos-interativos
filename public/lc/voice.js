'use strict';

// Áudio da live: mixer com canais (jogo, voz, música, efeitos, DJ) e a voz neural gerada no servidor.
// O som sai pela própria página, então a fonte Link do LIVE Studio e o OBS capturam junto com o jogo.

const mixer = {
  ch: {},
  vol: { master: 1, game: 0.8, voice: 1, music: 0.35, fx: 0.8, dj: 0.9, ...store.get('mixer', {}) },
  here: true, // este navegador toca som? (o painel se cala quando há uma tela da live conectada)
  analyser: null,
  init() {
    const ac = sfx.ac;
    if (!ac || this.ch.master) return ac;
    this.ch.master = ac.createGain();
    this.ch.master.connect(ac.destination);
    for (const k of ['game', 'voice', 'music', 'fx', 'dj']) { this.ch[k] = ac.createGain(); this.ch[k].connect(this.ch.master); }
    this.analyser = ac.createAnalyser();
    this.analyser.fftSize = 512;
    this.ch.voice.connect(this.analyser);
    sfx.out = this.ch.game;
    this.apply();
    return ac;
  },
  apply() {
    if (!this.ch.master) return;
    for (const [k, v] of Object.entries(this.vol)) if (this.ch[k]) this.ch[k].gain.value = k === 'master' ? (this.here ? v : 0) : v;
  },
  set(k, v) { this.vol[k] = v; store.set('mixer', this.vol); this.apply(); },
  setHere(on) { this.here = on; this.apply(); if (!on) voice.stopAll(); },
  // Nível do som da voz agora (0–1), para a boca do apresentador mexer.
  level() {
    if (!this.analyser || !voice.speaking) return 0;
    const a = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(a);
    let s = 0;
    for (const v of a) s += ((v - 128) / 128) ** 2;
    return clamp(Math.sqrt(s / a.length) * 4, 0, 1);
  },
};

// Vozes prontas: voz neural + tom + velocidade. Personagens são originais (nada de marcas).
const VOICES = [
  { id: 'francisca', name: 'Francisca (BR)', v: 'pt-BR-FranciscaNeural' },
  { id: 'antonio', name: 'Antônio (BR)', v: 'pt-BR-AntonioNeural' },
  { id: 'thalita', name: 'Thalita (BR)', v: 'pt-BR-ThalitaMultilingualNeural' },
  { id: 'locutor', name: 'Locutor de rádio', v: 'pt-BR-AntonioNeural', r: 12, p: -6 },
  { id: 'robo', name: 'Robô', v: 'pt-BR-AntonioNeural', r: 5, p: -35 },
  { id: 'esquilo', name: 'Esquilo', v: 'pt-BR-FranciscaNeural', r: 25, p: 60 },
  { id: 'gigante', name: 'Gigante', v: 'pt-BR-AntonioNeural', r: -18, p: -60 },
  { id: 'vovo', name: 'Vovó', v: 'pt-BR-FranciscaNeural', r: -22, p: -12 },
  { id: 'crianca', name: 'Criança', v: 'pt-BR-ThalitaMultilingualNeural', r: 8, p: 40 },
  { id: 'misterio', name: 'Vidente misteriosa', v: 'pt-BR-ThalitaMultilingualNeural', r: -15, p: -18 },
  { id: 'raquel', name: 'Raquel (Portugal)', v: 'pt-PT-RaquelNeural' },
  { id: 'duarte', name: 'Duarte (Portugal)', v: 'pt-PT-DuarteNeural' },
  { id: 'dalia', name: 'Dalia (Espanhol)', v: 'es-MX-DaliaNeural' },
  { id: 'jorge', name: 'Jorge (Espanhol)', v: 'es-MX-JorgeNeural' },
  { id: 'ava', name: 'Ava (Inglês)', v: 'en-US-AvaMultilingualNeural' },
  { id: 'andrew', name: 'Andrew (Inglês)', v: 'en-US-AndrewMultilingualNeural' },
];
const voiceById = (id) => VOICES.find((x) => x.id === id) || VOICES[0];

// Palavrões comuns (filtro ligado por padrão no leitor de comentários).
const BAD_WORDS = ['porra', 'caralho', 'merda', 'puta', 'puto', 'foda', 'fodase', 'buceta', 'cu', 'viado', 'arrombado', 'corno', 'piranha', 'vagabunda', 'desgraça', 'cacete', 'pinto', 'rola', 'pau no cu', 'fdp', 'vsf', 'pqp', 'krl', 'crl', 'tnc', 'otario', 'babaca', 'idiota', 'retardado'];

const voice = {
  queue: [],
  speaking: false,
  cur: null,
  cache: new Map(),
  // Filtro: tira palavrões e palavras bloqueadas do texto falado.
  clean(text) {
    const st = liveCfg.stream;
    let words = [...(st.muteWords || [])];
    if (st.profanity !== false) words = words.concat(BAD_WORDS);
    let t = String(text);
    for (const w of words) {
      const n = norm(w);
      if (!n) continue;
      t = t.replace(new RegExp(`(^|[^\\p{L}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}])`, 'giu'), '$1');
    }
    // Links e repetições ("kkkkkkkk") atrapalham a voz.
    return t.replace(/https?:\/\/\S+/g, '').replace(/(.)\1{3,}/g, '$1$1$1').replace(/\s+/g, ' ').trim();
  },
  // Fala um texto. prio: 'high' fura a fila (ex.: apresentador respondendo).
  say(text, { voice: vid, prio = 'normal', onStart, onEnd, maxLen = 300, filter = true } = {}) {
    let t = filter ? this.clean(text) : String(text);
    if (!t || !mixer.here) { onEnd?.(); return; }
    if (t.length > maxLen) t = t.slice(0, maxLen);
    const item = { t, vp: voiceById(vid || liveCfg.stream.voice), onStart, onEnd };
    item.buf = this.load(item); // já começa a baixar enquanto espera a vez
    if (prio === 'high') this.queue.unshift(item); else this.queue.push(item);
    if (this.queue.length > 12) this.queue.splice(1, this.queue.length - 12).forEach((x) => x.onEnd?.());
    this.next();
  },
  load(item) {
    const { v, r = 0, p = 0 } = item.vp;
    const url = `/api/tts?t=${encodeURIComponent(item.t)}&v=${v}&r=${r}&p=${p}`;
    if (this.cache.has(url)) return this.cache.get(url);
    const pr = fetch(url).then((res) => { if (!res.ok) throw new Error('tts'); return res.arrayBuffer(); })
      .then((ab) => { const ac = mixer.init(); return ac.decodeAudioData(ab); });
    pr.catch(() => this.cache.delete(url));
    this.cache.set(url, pr);
    if (this.cache.size > 80) this.cache.delete(this.cache.keys().next().value);
    return pr;
  },
  async next() {
    if (this.speaking || !this.queue.length) return;
    const item = this.queue.shift();
    this.speaking = true;
    const done = () => { if (this.cur !== item) return; this.cur = null; this.speaking = false; item.onEnd?.(); setTimeout(() => this.next(), 120); };
    this.cur = item;
    try {
      const buf = await item.buf;
      if (this.cur !== item) return;
      const ac = mixer.init();
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(mixer.ch.voice);
      src.onended = done;
      item.src = src;
      item.onStart?.(buf.duration);
      src.start();
    } catch {
      // Sem voz do servidor: usa a voz do navegador (não sai na captura, mas pelo menos fala).
      if (this.cur !== item) return;
      try {
        const u = new SpeechSynthesisUtterance(item.t);
        u.lang = item.vp.v.slice(0, 5);
        u.onend = done; u.onerror = done;
        item.onStart?.(item.t.length / 14);
        speechSynthesis.speak(u);
      } catch { done(); }
    }
  },
  skip() { try { this.cur?.src?.stop(); } catch {} try { speechSynthesis.cancel(); } catch {} },
  stopAll() { this.queue.forEach((x) => x.onEnd?.()); this.queue = []; this.skip(); },
};

// Leitor de comentários e shoutouts (Voz e chat no painel).
const commentReader = {
  last: new Map(),
  onChat(ev) {
    const st = liveCfg.stream;
    if (!st.readComments || !ev.text) return;
    if (current?.speaksChat) return; // o jogo atual já responde o chat por voz (apresentador IA)
    const k = uid(ev), now = performance.now();
    if (now - (this.last.get(k) || 0) < (st.readGap || 4) * 1000) return;
    this.last.set(k, now);
    if (voice.queue.length > 6) return;
    const msg = String(st.readFormat || '{user} disse: {comment}').replace('{user}', ev.user?.nick || '').replace('{comment}', String(ev.text).slice(0, st.readMax || 120));
    voice.say(msg);
  },
};
