'use strict';

// Jogos de voz e IA: Apresentador IA, Roast da Foto, Seu Futuro, Máquina de Clipes e Festa Pixel 3D.
// A fala sai pela voz neural do servidor; o texto vem da IA (Claude com chave, ou o serviço grátis) ou de frases prontas.

const HOST_LOOKS = {
  brasa: { name: 'Brasa (espírito de fogo)', voice: 'locutor', head: '#fb923c', glow: '#f97316', ears: null, hair: 'flame' },
  holo: { name: 'Holograma', voice: 'thalita', head: '#67e8f9', glow: '#22d3ee', ears: null, hair: null, holo: true },
  robo: { name: 'Robô RX', voice: 'robo', head: '#94a3b8', glow: '#38bdf8', ears: 'antenna', hair: null, box: true },
  raposa: { name: 'Raposa Rita', voice: 'francisca', head: '#f97316', glow: '#fdba74', ears: 'fox', hair: null },
  gato: { name: 'Gato Tom', voice: 'antonio', head: '#a8a29e', glow: '#fde68a', ears: 'cat', hair: null },
  alien: { name: 'Zork, o alien', voice: 'esquilo', head: '#4ade80', glow: '#a3e635', ears: 'antenna2', hair: null, alien: true },
  vovo: { name: 'Vovó Cida', voice: 'vovo', head: '#f1c27d', glow: '#fef3c7', ears: null, hair: 'white', glasses: true },
};
const PERSONALITIES = { animado: 'muito animado, empolgado e positivo', engracado: 'engraçado, faz piadas leves e trocadilhos', fofo: 'fofo, carinhoso e acolhedor', sarcastico: 'levemente sarcástico mas nunca ofensivo', sabio: 'calmo e sábio, dá conselhos curtos', pirata: 'fala como um pirata divertido', locutor: 'locutor de rádio esportivo, cheio de energia' };
const HOST_CANNED = {
  reply: ['Boa pergunta, {user}! Eu diria que sim, mas só se tiver brigadeiro no meio.', 'Olha, {user}, essa eu vou pensar com carinho. Fica comigo aqui na live!', '{user}, adorei isso! Manda mais que eu tô respondendo todo mundo.', 'Hahaha, {user}, você é demais! A resposta é: depende do humor do dia.', 'Ô {user}, que pergunta difícil! Vou chutar: com certeza absoluta!', '{user}, você tirou as palavras da minha boca. Concordo totalmente!'],
  gift: ['Muito obrigado pelo presente, {user}! Você é incrível!', 'Uau, {user}! Valeu demais pelo {gift}!', '{user} mandou {gift}! A live agradece de coração!'],
  big: ['PARA TUDO! {user} mandou {gift}! Isso merece uma salva de palmas! Você é lenda!', 'Gente do céu! {user}, você é sensacional! Obrigado pelo {gift}!'],
  follow: ['Seja muito bem-vindo, {user}! Obrigado por seguir!', 'Chegou gente nova! Valeu por seguir, {user}!'],
  idle: ['E aí, galera! Manda uma pergunta no chat que eu respondo!', 'Tá quietinho aqui... alguém tem uma pergunta pra mim?', 'Quem tá curtindo a live solta um like!', 'Me pergunta qualquer coisa: comida, música, conselho... tô aqui pra isso!'],
  hype: ['Atenção todo mundo! {user} é a pessoa mais estilosa dessa live! Palmas pra {user}!', 'Um salve gigante pra {user}! Sem você essa live não seria a mesma!'],
};
function fillLine(str, d) { return String(str).replace(/\{(\w+)\}/g, (_, k) => d[k] ?? ''); }

// ---------------- Apresentador IA (AI Host) ----------------
defineGame({
  id: 'ai-host', name: 'Apresentador IA', genre: 'talk', icon: '🤖', color: '#22d3ee', three: true, ai: true, voice: true, speaksChat: true, answersChat: true,
  desc: 'Um apresentador com rosto e voz responde o chat em voz alta. Presentes furam a fila ou compram um elogio pessoal.',
  help: '<p>Mande uma <b>pergunta no chat</b> e o apresentador responde <b>em voz alta</b>. Ele também agradece presentes e dá boas-vindas a quem segue.</p><p>🎁 Presentes: <b>furar a fila</b> (sua pergunta vem primeiro) e <b>elogio pessoal</b>. No painel, clique em 🎙️ ao lado de um comentário para ele responder na hora.</p><p>Com a chave <b>ANTHROPIC_API_KEY</b> no Render, as respostas usam o Claude; sem chave, usa um serviço grátis (e frases prontas se ele falhar).</p>',
  settings: [
    { key: 'look', type: 'select', label: 'Apresentador', options: Object.entries(HOST_LOOKS).map(([k, v]) => [k, v.name]), default: 'holo' },
    { key: 'customHostName', type: 'text', label: 'Nome do apresentador (vazio = do visual)', default: '' },
    { key: 'hostVoice', type: 'voice', label: 'Voz', default: 'thalita' },
    { key: 'personality', type: 'select', label: 'Personalidade', options: Object.entries(PERSONALITIES).map(([k, v]) => [k, v.split(',')[0]]), default: 'animado' },
    { key: 'streamAbout', type: 'text', label: 'Sobre o que é a live', default: 'jogos interativos e diversão com a galera', max: 200 },
    { key: 'avoidTopics', type: 'text', label: 'Assuntos para evitar', default: 'política, religião, conteúdo adulto', max: 200 },
    { key: 'aiRepliesStyle', type: 'textarea', label: 'Instruções extras para a IA', default: '', rows: 3 },
    { key: 'aiReplies', type: 'toggle', label: 'Usar IA para responder (senão, frases prontas)', default: true, group: 'Comportamento' },
    { key: 'answerChat', type: 'toggle', label: 'Responder perguntas do chat', default: true, group: 'Comportamento' },
    { key: 'onlyQuestions', type: 'toggle', label: 'Só responder mensagens com "?" ', default: false, group: 'Comportamento' },
    { key: 'thankGifts', type: 'toggle', label: 'Agradecer presentes', default: true, group: 'Comportamento' },
    { key: 'bigGiftCoins', type: 'number', label: 'Presente grande a partir de (moedas)', min: 10, max: 10000, default: 100, group: 'Comportamento' },
    { key: 'welcomeFollowers', type: 'toggle', label: 'Dar boas-vindas a quem segue', default: true, group: 'Comportamento' },
    { key: 'idleLines', type: 'toggle', label: 'Falar sozinho quando o chat está parado', default: true, group: 'Comportamento' },
    { key: 'pace', type: 'select', label: 'Ritmo', options: [['2', 'Rápido'], ['5', 'Normal'], ['10', 'Calmo']], default: '5', group: 'Comportamento' },
    { key: 'showCaptions', type: 'toggle', label: 'Legenda do que ele fala', default: true, group: 'Visual' },
    { key: 'showPrompt', type: 'toggle', label: 'Mostrar a pergunta que está respondendo', default: true, group: 'Visual' },
    { key: 'scene', type: 'select', label: 'Cenário', options: [['studio', 'Estúdio'], ['neon', 'Neon'], ['space', 'Espaço']], default: 'studio', group: 'Visual' },
  ],
  actions: [{ id: 'ask_first', label: 'Furar a fila', icon: '⏫' }, { id: 'hype_me', label: 'Elogio pessoal', icon: '🌟' }, { id: 'say_hi', label: 'Dar oi', icon: '👋' }],
  bindings: [{ action: 'ask_first', trigger: 'gift', minCoins: 5 }, { action: 'hype_me', trigger: 'gift', minCoins: 99 }, { action: 'say_hi', trigger: 'follow' }],
  reset() { this.q = []; this.cur = null; this.busy = false; this.wait = 1; this.idleT = 25; this.caption = ''; this.capT = 0; this.mouth = 0; this.blink = 0; this.lastPrio = new Map(); if (this.r) { this.r.scene.remove(this.r.host); this.r = null; } },
  sample() { return pick(['qual sua comida favorita?', 'me dá um conselho', 'você gosta de música?', 'conta uma piada', 'qual o melhor time?']); },
  look() { return HOST_LOOKS[this.s.look] || HOST_LOOKS.holo; },
  hostName() { return this.s.customHostName || this.look().name.split(' (')[0]; },
  onSettings() { if (this.r && this.r.lookId !== this.s.look) { this.r.scene.remove(this.r.host); this.r.host = null; } },
  onChat(ev) {
    if (!this.s.answerChat || !ev.text || ev.text.length < 2) return;
    if (this.s.onlyQuestions && !ev.text.includes('?')) return;
    if (this.q.some((x) => uid(x) === uid(ev))) return;
    this.q.push({ ...ev, kind: 'reply' });
    if (this.q.length > 25) this.q.splice(0, this.q.length - 25);
  },
  onEvent(ev) {
    if (ev.type === 'gift' && this.s.thankGifts) { this.q.unshift({ ...ev, kind: coins(ev) >= this.s.bigGiftCoins ? 'big' : 'gift' }); if (this.q.length > 25) this.q.length = 25; }
  },
  onAction(id, a) {
    if (id === 'ask_first') { const i = this.q.findIndex((x) => uid(x) === uid(a)); if (i > 0) this.q.unshift(this.q.splice(i, 1)[0]); }
    else if (id === 'hype_me') this.q.unshift({ user: a.user, kind: 'hype' });
    else if (id === 'say_hi' && this.s.welcomeFollowers) this.q.push({ user: a.user, kind: 'follow' });
  },
  onHostCmd(b) { if (b.cmd === 'answer' && b.ev) { this.q = this.q.filter((x) => uid(x) !== uid(b.ev)); this.q.unshift({ ...b.ev, kind: 'reply', forced: true }); this.wait = 0; } },
  system() {
    return `Você é ${this.hostName()}, apresentador(a) de uma live no TikTok. Personalidade: ${PERSONALITIES[this.s.personality] || PERSONALITIES.animado}. ` +
      `A live é sobre: ${this.s.streamAbout}. Nunca fale sobre: ${this.s.avoidTopics}. ` +
      'Responda sempre em português do Brasil, em no máximo 2 frases curtas (até 35 palavras), falando diretamente com a pessoa pelo nome. ' +
      'Seja gentil, divertido e adequado para todas as idades. Não use emojis, hashtags, listas nem markdown: o texto será lido em voz alta. ' +
      'Se pedirem algo perigoso, ofensivo ou impróprio, recuse com bom humor e mude de assunto. ' + (this.s.aiRepliesStyle || '');
  },
  async speak(item) {
    this.busy = true;
    const user = item.user?.nick || 'galera', d = { user, gift: item.name || 'presente' };
    let text;
    if (item.kind === 'reply') {
      const fallback = fillLine(pick(HOST_CANNED.reply), d);
      text = this.s.aiReplies ? await ai.ask(`host:${uid(item)}:${item.text}`, this.system(), `${user} escreveu no chat: "${String(item.text).slice(0, 200)}"`, fallback, 120) : fallback;
    } else if (item.kind === 'gift' || item.kind === 'big') {
      const fallback = fillLine(pick(HOST_CANNED[item.kind]), d);
      text = this.s.aiReplies && item.kind === 'big' ? await ai.ask(`host:gift:${uid(item)}:${item.name}:${coins(item)}`, this.system(), `${user} acabou de mandar o presente ${item.name} (${coins(item)} moedas). Agradeça com muita empolgação.`, fallback, 90) : fallback;
    } else if (item.kind === 'follow') text = fillLine(pick(HOST_CANNED.follow), d);
    else if (item.kind === 'hype') text = this.s.aiReplies ? await ai.ask(`host:hype:${uid(item)}:${Math.floor(Date.now() / 60000)}`, this.system(), `Faça um elogio pessoal, exagerado e divertido para ${user}, que pagou por isso.`, fillLine(pick(HOST_CANNED.hype), d), 90) : fillLine(pick(HOST_CANNED.hype), d);
    else text = item.text || pick(HOST_CANNED.idle);
    if (this !== current) { this.busy = false; return; }
    this.cur = item; this.caption = text; this.capT = 0;
    voice.say(text, { voice: this.s.hostVoice || this.look().voice, prio: 'high', filter: true, maxLen: 320, onEnd: () => { this.busy = false; this.wait = Number(this.s.pace); this.capT = 0.01; } });
    if (!mixer.here) setTimeout(() => { this.busy = false; this.wait = Number(this.s.pace); }, 1500 + text.length * 55);
  },
  update(dt) {
    this.blink = (this.blink + dt) % 4;
    const lvl = mixer.here ? mixer.level() : (this.busy ? (Math.sin(performance.now() / 70) + 1) / 2 * 0.6 : 0);
    this.mouth += (lvl - this.mouth) * Math.min(1, dt * 18);
    if (this.capT > 0) { this.capT += dt; if (this.capT > 4) { this.caption = ''; this.capT = 0; this.cur = null; } }
    if (this.busy) return;
    this.wait -= dt;
    if (this.wait > 0) return;
    const item = this.q.shift();
    if (item) { this.idleT = 25; this.speak(item); return; }
    if (this.s.idleLines) { this.idleT -= dt; if (this.idleT <= 0) { this.idleT = rand(25, 45); this.speak({ kind: 'idle', text: pick(HOST_CANNED.idle) }); } }
  },
  buildHost() {
    const T = THREE, L = this.look(), g = new T.Group();
    const mat = (c, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
    const skin = L.holo ? new T.MeshStandardMaterial({ color: L.head, emissive: L.glow, emissiveIntensity: 0.6, transparent: true, opacity: 0.75, roughness: 0.2 }) : mat(L.head, L.hair === 'flame' ? { emissive: L.glow, emissiveIntensity: 0.5 } : {});
    const body = new T.Mesh(new T.CapsuleGeometry(1.1, 1.4, 8, 16), L.holo ? skin : mat(L.box ? '#475569' : '#1e293b')); body.position.y = -2.4; g.add(body);
    const head = new T.Group(); g.add(head);
    const skull = new T.Mesh(L.box ? new T.BoxGeometry(2.4, 2.2, 2.2) : new T.SphereGeometry(1.35, 40, 30), skin);
    if (L.alien) skull.scale.set(1, 1.15, 1);
    head.add(skull);
    const eyeW = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2 }), pupil = new T.MeshStandardMaterial({ color: L.alien ? '#111' : '#0f172a', roughness: 0.1 });
    const eyes = [];
    for (const s of [-1, 1]) {
      const e = new T.Mesh(new T.SphereGeometry(L.alien ? 0.42 : 0.3, 20, 14), L.alien ? pupil : eyeW); e.position.set(s * 0.5, 0.25, L.box ? 1.11 : 1.12); if (L.alien) e.scale.set(1, 1.4, 0.6);
      head.add(e); eyes.push(e);
      if (!L.alien) { const p = new T.Mesh(new T.SphereGeometry(0.15, 14, 10), pupil); p.position.set(s * 0.5, 0.22, L.box ? 1.36 : 1.38); head.add(p); eyes.push(p); }
    }
    const mouth = new T.Mesh(new T.CapsuleGeometry(0.16, 0.5, 6, 12), new T.MeshStandardMaterial({ color: '#7f1d1d' })); mouth.rotation.z = Math.PI / 2; mouth.position.set(0, -0.45, L.box ? 1.12 : 1.22); head.add(mouth);
    if (L.ears === 'fox' || L.ears === 'cat') for (const s of [-1, 1]) { const ear = new T.Mesh(new T.ConeGeometry(0.42, 0.9, 4), skin); ear.position.set(s * 0.85, 1.25, 0); ear.rotation.z = -s * 0.35; head.add(ear); }
    if (L.ears === 'antenna' || L.ears === 'antenna2') for (const s of (L.ears === 'antenna' ? [0] : [-1, 1])) { const st = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.9), mat('#cbd5e1')); st.position.set(s * 0.5, 1.6, 0); head.add(st); const ball = new T.Mesh(new T.SphereGeometry(0.16, 12, 10), new T.MeshStandardMaterial({ color: L.glow, emissive: L.glow, emissiveIntensity: 1 })); ball.position.set(s * 0.5, 2.1, 0); head.add(ball); }
    if (L.hair === 'flame') for (let i = 0; i < 7; i++) { const f = new T.Mesh(new T.ConeGeometry(0.35, 1.3, 8), new T.MeshStandardMaterial({ color: i % 2 ? '#facc15' : '#f97316', emissive: '#f97316', emissiveIntensity: 0.9 })); f.position.set((i - 3) * 0.32, 1.45 + Math.abs(i - 3) * -0.12, -0.2); head.add(f); f.userData.flame = i; }
    if (L.hair === 'white') { const h = new T.Mesh(new T.SphereGeometry(1.42, 30, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), mat('#f1f5f9')); h.position.y = 0.1; head.add(h); const bun = new T.Mesh(new T.SphereGeometry(0.5, 16, 12), mat('#f1f5f9')); bun.position.set(0, 1.4, -0.4); head.add(bun); }
    if (L.glasses) for (const s of [-1, 1]) { const ring = new T.Mesh(new T.TorusGeometry(0.36, 0.05, 8, 24), mat('#334155')); ring.position.set(s * 0.5, 0.25, 1.32); head.add(ring); }
    g.userData = { head, mouth, eyes };
    return g;
  },
  scene3d() {
    if (!G3.ready) return null;
    if (!this.r) {
      const T = THREE, scene = new T.Scene();
      G3.lights(scene, { hemi: 1, sun: 2, pos: [4, 8, 10] });
      const cam = new T.PerspectiveCamera(34, W / H, 0.1, 100); cam.position.set(0, 0.4, 21); cam.lookAt(0, -1.1, 0);
      const desk = new T.Mesh(new T.BoxGeometry(7, 1.4, 2.4), new T.MeshStandardMaterial({ color: '#0f172a', metalness: 0.4, roughness: 0.3 })); desk.position.set(0, -3.6, 1.6); scene.add(desk);
      const deskLine = new T.Mesh(new T.BoxGeometry(7.02, 0.12, 2.42), new T.MeshBasicMaterial({ color: '#22d3ee' })); deskLine.position.set(0, -2.95, 1.6); scene.add(deskLine);
      const mic = new T.Mesh(new T.CylinderGeometry(0.15, 0.2, 0.7, 12), new T.MeshStandardMaterial({ color: '#111827' })); mic.position.set(0.9, -2.6, 2.2); scene.add(mic);
      this.r = { scene, cam, host: null, lookId: null, deskLine };
    }
    const r = this.r;
    if (!r.host) { r.host = this.buildHost(); r.lookId = this.s.look; r.scene.add(r.host); }
    const bg = { studio: ['#0f172a', '#1e3a8a', '#0b1020'], neon: ['#1a0533', '#701a75', '#0f0420'], space: ['#000000', '#111a44', '#020617'] }[this.s.scene] || ['#0f172a', '#1e3a8a', '#0b1020'];
    if (r.bgKey !== this.s.scene) { r.scene.background = G3.skyTex(...bg); r.bgKey = this.s.scene; r.deskLine.material.color.set(this.look().glow); }
    return r;
  },
  draw() {
    const r = this.scene3d(), t = performance.now() / 1000;
    if (r) {
      const u = r.host.userData;
      u.head.rotation.y = Math.sin(t * 0.7) * 0.18; u.head.rotation.x = Math.sin(t * 1.1) * 0.05 - this.mouth * 0.08; u.head.position.y = Math.sin(t * 1.6) * 0.06;
      u.mouth.scale.set(1, 1 + this.mouth * 3.5, 1 + this.mouth * 0.8);
      const bl = this.blink > 3.85 ? 0.1 : 1; for (const e of u.eyes) e.scale.y = (e.geometry.parameters.radius > 0.35 ? 1.4 : 1) * bl;
      u.head.children.forEach((c) => { if (c.userData.flame !== undefined) c.scale.y = 1 + Math.sin(t * 9 + c.userData.flame) * 0.25; });
      G3.render(r.scene, r.cam);
    } else stageBg('blue');
    // Placa com o nome e o status
    slant(W / 2 - 190, 70, 380, 64, { fill: 'rgba(8,10,20,.85)', border: this.look().glow });
    title(this.hostName().toUpperCase(), W / 2, 100, 34, this.look().glow);
    pill(this.busy ? '🎙️ falando…' : this.q.length ? `📨 ${this.q.length} na fila` : '💬 mande uma pergunta', W / 2, 160, { size: 17, bg: 'rgba(0,0,0,.6)' });
    if (this.s.showPrompt && this.cur?.user && this.cur.kind === 'reply') toast(this.cur.user, trim(this.cur.text, 34), W / 2, 230, { align: 'center', color: this.look().glow, size: 20 });
    if (this.s.showCaptions && this.caption) { panel(40, 1000, W - 80, 170, { r: 22, from: 'rgba(15,23,42,.92)', to: 'rgba(2,6,23,.92)', border: hexA(this.look().glow, 0.6) }); textBlock(this.caption, W / 2, 1085, W - 130, 28, { maxLines: 4, minSize: 18 }); }
    // Próximos da fila
    this.q.filter((x) => x.user).slice(0, 6).forEach((x, i) => avatar(x.user, 60 + i * 56, 290, 22, '#fff'));
  },
  leave() { voice.stopAll(); },
});

// ---------------- Roast da Foto (Roast Your Photo) ----------------
defineGame({
  id: 'roast-your-photo', name: 'Roast da Foto', genre: 'party', icon: '🐶', color: '#f59e0b', ai: true, voice: true,
  desc: 'Um buldogue comediante zoa as fotos de perfil dos espectadores, uma de cada vez, ao vivo na live (zoeira leve, sem ofensa).',
  help: '<p>Comente <b>roast</b> (ou <b>me zoa</b>) para entrar na fila. O comediante mostra a sua foto e solta uma zoeira <b>leve</b> em voz alta.</p><p>🎁 Presentes: <b>furar a fila</b> e <b>vaia da plateia</b>. Com IA, as piadas são novas a cada vez (ela não vê a foto, só o nome).</p>',
  settings: [
    { key: 'speed', type: 'select', label: 'Ritmo', options: [['14', 'Calmo'], ['10', 'Normal'], ['7', 'Rápido']], default: '10' },
    { key: 'intensity', type: 'select', label: 'Intensidade', options: [['leve', 'Leve (para família)'], ['media', 'Média (provocadora, sem ofender)']], default: 'leve' },
    { key: 'aiRoast', type: 'toggle', label: 'Piadas novas com IA', default: true },
    { key: 'aiRoastStyle', type: 'textarea', label: 'Estilo das piadas (para a IA)', default: 'piadas curtas sobre o nome da pessoa, trocadilhos e situações do dia a dia', rows: 2 },
    { key: 'customRoasts', type: 'textarea', label: 'Suas piadas prontas (uma por linha, use {user})', default: '', rows: 4 },
    { key: 'ttsEnabled', type: 'toggle', label: 'Falar em voz alta', default: true },
    { key: 'roastVoice', type: 'voice', label: 'Voz do comediante', default: 'locutor' },
    { key: 'audienceDensity', type: 'select', label: 'Plateia', options: [['0', 'Sem plateia'], ['14', 'Pouca'], ['30', 'Cheia']], default: '30' },
    { key: 'spotlightColor', type: 'color', label: 'Cor do holofote', default: '#fde68a' },
  ],
  actions: [{ id: 'roast_me', label: 'Entrar na fila', icon: '🎤' }, { id: 'skip_the_line', label: 'Furar a fila', icon: '⏫' }, { id: 'heckle', label: 'Vaia da plateia', icon: '🍅' }],
  bindings: [{ action: 'roast_me', trigger: 'comment', text: 'roast,me zoa,zoa eu,zoa' }, { action: 'skip_the_line', trigger: 'gift', minCoins: 10 }, { action: 'heckle', trigger: 'gift', minCoins: 1 }],
  init() { loadData('lines').then((d) => (this.lines = d)); },
  reset() { this.q = new Queue(); this.cur = null; this.t = 2; this.line = ''; this.count = this.count || 0; this.laugh = 0; this.tomatoes = []; },
  sample() { return pick(['roast', 'me zoa', 'zoa eu']); },
  onAction(id, a) {
    if (id === 'roast_me') this.q.push(a.user);
    else if (id === 'skip_the_line') this.q.push(a.user, true);
    else if (id === 'heckle') { for (let i = 0; i < 6; i++) this.tomatoes.push({ x: rand(100, W - 100), y: 1300, t: -i * 0.1, tx: W / 2 + rand(-80, 80), ty: 560 }); playSound('sad', 'fx', 0.6); }
  },
  async roast(user) {
    const own = lines(this.s.customRoasts), bank = [...own, ...(this.lines?.roasts || [])];
    const fallback = fillLine(pick(bank.length ? bank : ['{user}, você é tão legal que nem consigo zoar!']), { user: user.nick });
    const sys = `Você é um buldogue comediante de stand-up numa live do TikTok. Faça UMA zoeira ${this.s.intensity === 'media' ? 'provocadora mas sem ofender' : 'bem leve, para toda a família'} sobre a pessoa, em português do Brasil, com no máximo 30 palavras. Você não vê a foto: brinque com o nome e situações do dia a dia. Nunca fale de aparência física, peso, raça, religião, gênero ou deficiência. Sem emojis, sem markdown. Estilo: ${this.s.aiRoastStyle}`;
    return this.s.aiRoast ? ai.ask(`roast:${user.id || user.nick}:${this.count}`, sys, `Zoe o espectador chamado ${user.nick}.`, fallback, 100) : fallback;
  },
  update(dt) {
    for (const tm of this.tomatoes) tm.t += dt * 1.5;
    this.tomatoes = this.tomatoes.filter((tm) => tm.t < 1.5);
    this.laugh = Math.max(0, this.laugh - dt);
    this.t -= dt;
    if (this.t > 0 || this.busy) return;
    const u = this.q.shift();
    if (!u) { this.cur = null; this.t = 1; return; }
    this.busy = true; this.cur = u; this.line = '…'; this.count++;
    this.roast(u).then((text) => {
      this.line = text;
      const done = () => { this.busy = false; this.laugh = 2; playSound('rimshot', 'fx', 0.8); setTimeout(() => playSound('applause', 'fx', 0.5), 400); this.t = Number(this.s.speed) / 2; };
      if (this.s.ttsEnabled && this === current) voice.say(text, { voice: this.s.roastVoice, prio: 'high', onEnd: done });
      else setTimeout(done, 2500 + text.length * 50);
    });
  },
  draw() {
    const t = performance.now() / 1000;
    if (!customBackground(this)) {
      ctx.fillStyle = '#1a0d0d'; ctx.fillRect(0, 0, W, H);
      // Cortina vermelha
      for (let i = 0; i < 14; i++) { const g = ctx.createLinearGradient(i * 52, 0, i * 52 + 52, 0); g.addColorStop(0, '#7f1d1d'); g.addColorStop(0.5, '#b91c1c'); g.addColorStop(1, '#7f1d1d'); ctx.fillStyle = g; ctx.fillRect(i * 52, 0, 52, 760); }
      ctx.fillStyle = '#451a03'; ctx.fillRect(0, 760, W, 70);
      const sg = ctx.createRadialGradient(W / 2, 640, 20, W / 2, 640, 360); sg.addColorStop(0, hexA(this.s.spotlightColor, 0.45)); sg.addColorStop(1, hexA(this.s.spotlightColor, 0)); ctx.fillStyle = sg; ctx.fillRect(0, 200, W, 700);
    }
    title('ROAST DA FOTO', W / 2, 60, 52, '#fbbf24');
    pill(`${this.count} zoados · fila: ${this.q.length} · comente "roast"`, W / 2, 108, { size: 17, bg: 'rgba(0,0,0,.6)' });
    // Quadro com a foto
    if (this.cur) {
      ctx.save(); ctx.translate(W / 2 + 120, 400); ctx.rotate(0.05);
      ctx.fillStyle = '#a16207'; ctx.fillRect(-120, -140, 240, 280); ctx.fillStyle = '#fef3c7'; ctx.fillRect(-104, -124, 208, 248);
      ctx.restore();
      avatar(this.cur, W / 2 + 120, 400, 92, '#a16207');
      pill('@' + trim(this.cur.nick, 14), W / 2 + 120, 560, { size: 20, bg: '#111', color: '#fbbf24' });
    }
    // Comediante buldogue
    const bob = Math.sin(t * (this.busy ? 9 : 2)) * 6;
    label('🐶', W / 2 - 130, 520 + bob, 200, '#fff', 'center', 400);
    label('🎤', W / 2 - 40, 600 + bob, 70, '#fff', 'center', 400);
    // Plateia
    const n = Number(this.s.audienceDensity);
    for (let i = 0; i < n; i++) { const x = (i % 15) * 50 + 10, y = 900 + Math.floor(i / 15) * 60 + (this.laugh ? Math.abs(Math.sin(t * 12 + i)) * -10 : 0); ctx.fillStyle = '#0c0a09'; ctx.beginPath(); ctx.arc(x, y, 20, 0, 7); ctx.fill(); ctx.fillRect(x - 22, y + 14, 44, 50); }
    if (this.laugh) label('😂 HAHAHA 😂', W / 2, 860, 30, '#fbbf24', 'center', 900);
    if (this.cur && this.line) { panel(40, 1030, W - 80, 160, { r: 22, from: '#fffbeb', to: '#fde68a', border: '#a16207', shadow: true }); textBlock(this.line, W / 2, 1110, W - 120, 27, { maxLines: 4, minSize: 17, color: '#1c1917', shadow: false }); }
    else if (!this.cur) title('QUEM QUER SER ZOADO?', W / 2, 1100, 38, '#fff');
    for (const tm of this.tomatoes) { if (tm.t < 0) continue; const k = Math.min(1, tm.t); label(tm.t > 1 ? '💥' : '🍅', tm.x + (tm.tx - tm.x) * k, tm.y + (tm.ty - tm.y) * k - Math.sin(k * Math.PI) * 200, 50, '#fff', 'center', 400); }
    this.q.list.slice(0, 7).forEach((u, i) => avatar(u, 50 + i * 54, 168, 20, '#fbbf24'));
  },
});

// ---------------- Seu Futuro (Guess Your Future) ----------------
defineGame({
  id: 'guess-your-future', name: 'Seu Futuro', genre: 'party', icon: '🔮', color: '#a855f7', ai: true, voice: true,
  desc: 'Uma gata vidente lê o futuro dos espectadores na bola de cristal. Comente para entrar na fila, veja três cartas de tarô virarem e ouça a previsão em voz alta.',
  help: '<p>Comente <b>futuro</b> (ou <b>lê minha sorte</b>) para entrar na fila. A vidente vira <b>três cartas de tarô</b> e fala a sua previsão em voz alta.</p><p>🎁 Presente <b>fura a fila</b>. Com IA, cada previsão é única.</p>',
  settings: [
    { key: 'speed', type: 'select', label: 'Ritmo', options: [['16', 'Calmo'], ['12', 'Normal'], ['8', 'Rápido']], default: '12' },
    { key: 'tone', type: 'select', label: 'Tom', options: [['positivo', 'Sempre positivo'], ['divertido', 'Divertido'], ['misterioso', 'Misterioso']], default: 'positivo' },
    { key: 'aiFortunes', type: 'toggle', label: 'Previsões novas com IA', default: true },
    { key: 'aiFortunesStyle', type: 'textarea', label: 'Estilo das previsões (para a IA)', default: 'previsões otimistas e engraçadas sobre amor, dinheiro, amizade e sorte', rows: 2 },
    { key: 'customFortunes', type: 'textarea', label: 'Suas previsões prontas (uma por linha, use {user})', default: '', rows: 4 },
    { key: 'ttsEnabled', type: 'toggle', label: 'Falar em voz alta', default: true },
    { key: 'fortuneVoice', type: 'voice', label: 'Voz da vidente', default: 'misterio' },
    { key: 'cardCount', type: 'number', label: 'Cartas', min: 1, max: 3, default: 3 },
  ],
  actions: [{ id: 'read_me', label: 'Entrar na fila', icon: '🔮' }, { id: 'skip_the_line', label: 'Furar a fila', icon: '⏫' }],
  bindings: [{ action: 'read_me', trigger: 'comment', text: 'futuro,sorte,le minha sorte,leia' }, { action: 'skip_the_line', trigger: 'gift', minCoins: 5 }],
  init() { loadData('lines').then((d) => (this.lines = d)); },
  reset() { this.q = new Queue(); this.cur = null; this.t = 2; this.line = ''; this.count = this.count || 0; this.cards = []; this.flip = 0; this.rng = makeRng('future'); },
  sample() { return pick(['futuro', 'sorte', 'leia meu futuro']); },
  onAction(id, a) { if (id === 'read_me') this.q.push(a.user); else this.q.push(a.user, true); },
  async fortune(user, cards) {
    const own = lines(this.s.customFortunes), bank = [...own, ...(this.lines?.fortunes || [])];
    const fallback = fillLine(pick(bank.length ? bank : ['{user}, vejo coisas boas no seu caminho!']), { user: user.nick });
    const sys = `Você é uma gata vidente misteriosa numa live do TikTok. Leia o futuro da pessoa a partir das cartas de tarô. Tom: ${this.s.tone}. Português do Brasil, no máximo 35 palavras, fale com a pessoa pelo nome. Nada de previsões ruins, de saúde ou de morte. Sem emojis e sem markdown. Estilo: ${this.s.aiFortunesStyle}`;
    return this.s.aiFortunes ? ai.ask(`future:${user.id || user.nick}:${this.count}`, sys, `Pessoa: ${user.nick}. Cartas: ${cards.map((c) => `${c[0]} (${c[2]})`).join(', ')}.`, fallback, 110) : fallback;
  },
  update(dt) {
    this.flip += dt;
    this.t -= dt;
    if (this.t > 0 || this.busy) return;
    const u = this.q.shift();
    if (!u) { this.cur = null; this.t = 1; return; }
    const deck = this.lines?.tarot || [['O Sol', '☀️', 'alegria']];
    this.busy = true; this.cur = u; this.count++; this.flip = 0; this.line = '';
    this.cards = this.rng.shuffle(deck).slice(0, this.s.cardCount);
    playSound('magic', 'fx', 0.7);
    this.fortune(u, this.cards).then((text) => {
      setTimeout(() => {
        this.line = text;
        const done = () => { this.busy = false; this.t = Number(this.s.speed) / 3; };
        if (this.s.ttsEnabled && this === current) voice.say(text, { voice: this.s.fortuneVoice, prio: 'high', onEnd: done });
        else setTimeout(done, 3000 + text.length * 50);
      }, 2200);
    });
  },
  draw() {
    const t = performance.now() / 1000;
    if (!customBackground(this)) { stageBg('purple', t, { floor: false }); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 760, W, H); }
    title('SEU FUTURO', W / 2, 60, 54, '#e9d5ff');
    pill(`${this.count} previsões · fila: ${this.q.length} · comente "futuro"`, W / 2, 108, { size: 17, bg: 'rgba(0,0,0,.6)' });
    // Vidente e bola de cristal
    label('🐈‍⬛', W / 2, 330 + Math.sin(t * 2) * 5, 170, '#fff', 'center', 400);
    label('🎩', W / 2 + 6, 220 + Math.sin(t * 2) * 5, 80, '#fff', 'center', 400);
    const g = ctx.createRadialGradient(W / 2, 520, 10, W / 2, 520, 110); g.addColorStop(0, 'rgba(233,213,255,.95)'); g.addColorStop(0.6, 'rgba(168,85,247,.6)'); g.addColorStop(1, 'rgba(88,28,135,.2)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, 520, 100, 0, 7); ctx.fill();
    ctx.fillStyle = '#4c1d95'; ctx.fillRect(W / 2 - 70, 610, 140, 30);
    if (this.cur) { ctx.globalAlpha = 0.85 + Math.sin(t * 4) * 0.15; avatar(this.cur, W / 2, 520, 62, '#e9d5ff'); ctx.globalAlpha = 1; pill('@' + trim(this.cur.nick, 14), W / 2, 670, { size: 20, bg: '#111', color: '#e9d5ff' }); }
    // Cartas de tarô virando
    this.cards.forEach((c, i) => {
      const x = W / 2 + (i - (this.cards.length - 1) / 2) * 190, y = 830, k = clamp((this.flip - 0.4 - i * 0.5) * 2, 0, 1), sx = Math.abs(Math.cos(k * Math.PI));
      ctx.save(); ctx.translate(x, y); ctx.scale(sx || 0.02, 1);
      const front = k > 0.5;
      ctx.fillStyle = front ? '#fef3c7' : '#4c1d95'; ctx.beginPath(); ctx.roundRect(-75, -110, 150, 220, 14); ctx.fill();
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 4; ctx.stroke();
      if (front) { label(c[1], 0, -20, 70, '#fff', 'center', 400); label(c[0], 0, 60, 18, '#4c1d95', 'center', 900); }
      else label('✦', 0, 0, 60, '#fbbf24', 'center', 400);
      ctx.restore();
    });
    if (this.line) { panel(40, 990, W - 80, 180, { r: 22, from: 'rgba(46,16,101,.95)', to: 'rgba(24,8,52,.95)', border: '#e9d5ff' }); textBlock(this.line, W / 2, 1080, W - 130, 26, { maxLines: 5, minSize: 17 }); }
    else if (!this.cur) title('QUEM QUER SABER O FUTURO?', W / 2, 1080, 34, '#e9d5ff');
    this.q.list.slice(0, 7).forEach((u, i) => avatar(u, 50 + i * 54, 168, 20, '#e9d5ff'));
  },
});

// ---------------- Máquina de Clipes (Clip Machine) ----------------
const CLIP_SLOTS = 8;
defineGame({
  id: 'clip-machine', name: 'Máquina de Clipes', genre: 'party', icon: '🎬', color: '#ef4444', noGuide: false,
  desc: 'Os seus próprios vídeos tocando na hora certa. Um vídeo de fundo roda em loop e, quando alguém manda presente, comenta, segue, compartilha ou curte, a tela corta para o vídeo ligado àquele gatilho e depois volta.',
  help: '<p>Envie os seus vídeos (MP4) nas configurações: um ou mais <b>vídeos de fundo</b> (ficam em loop) e até 8 <b>clipes</b>. Em ⚡ Gatilhos, ligue cada gatilho (presente, comentário, seguir…) ao clipe que deve tocar.</p><p>Os clipes entram numa fila e tocam um de cada vez, com a foto de quem disparou.</p>',
  settings: [
    { key: 'idleVideos', type: 'mediaList', accept: 'video', label: 'Vídeos de fundo (loop)', default: [] },
    ...Array.from({ length: CLIP_SLOTS }, (_, i) => ({ key: 'clip' + (i + 1), type: 'media', accept: 'video', label: `Clipe ${i + 1}`, default: '', group: 'Clipes' })),
    { key: 'clipFit', type: 'select', label: 'Encaixe do vídeo', options: [['cover', 'Preencher a tela'], ['contain', 'Mostrar inteiro']], default: 'cover' },
    { key: 'clipVolume', type: 'slider', label: 'Volume dos clipes', min: 0, max: 1, step: 0.05, default: 1 },
    { key: 'queueSize', type: 'slider', label: 'Tamanho máximo da fila', min: 1, max: 30, default: 10 },
    { key: 'showQueue', type: 'toggle', label: 'Mostrar a fila', default: true },
    { key: 'showViewerBadge', type: 'toggle', label: 'Mostrar quem disparou o clipe', default: true },
  ],
  actions: [...Array.from({ length: CLIP_SLOTS }, (_, i) => ({ id: 'play_clip_' + (i + 1), label: `Tocar clipe ${i + 1}`, icon: '🎬' })), { id: 'play_random', label: 'Clipe aleatório', icon: '🎲' }],
  bindings: [{ action: 'play_clip_1', trigger: 'gift', minCoins: 1 }, { action: 'play_clip_2', trigger: 'gift', minCoins: 99 }, { action: 'play_clip_3', trigger: 'follow' }, { action: 'play_clip_4', trigger: 'share' }],
  reset() { this.q = []; this.playing = null; this.idleIdx = 0; this.el?.remove(); this.el = null; this.syncVideo(); },
  enter() { this.syncVideo(); },
  leave() { this.el?.remove(); this.el = null; },
  sample() { return 'clipe'; },
  onAction(id, a) {
    const clips = Array.from({ length: CLIP_SLOTS }, (_, i) => this.s['clip' + (i + 1)]).map((src, i) => ({ src, i })).filter((c) => c.src);
    let c = id === 'play_random' ? pick(clips) : clips.find((x) => x.i === Number(id.split('_')[2]) - 1);
    if (!c) return;
    if (this.q.length >= this.s.queueSize) return;
    this.q.push({ ...c, user: a.user });
    if (!this.playing) this.next();
  },
  next() { this.playing = this.q.shift() || null; this.syncVideo(); },
  syncVideo() {
    if (current !== this) return;
    const idle = this.s.idleVideos || [];
    const src = this.playing ? this.playing.src : idle.length ? idle[this.idleIdx % idle.length].src : '';
    // O vídeo fica escondido e é desenhado no canvas (assim o HUD do jogo aparece por cima)
    if (!this.el) { this.el = document.createElement('video'); this.el.playsInline = true; this.el.style.cssText = 'position:absolute;width:2px;height:2px;opacity:0;pointer-events:none'; ovl.prepend(this.el); }
    this.el.loop = !this.playing && idle.length <= 1;
    this.el.muted = !this.playing || !mixer.here;
    this.el.volume = clamp(this.s.clipVolume * mixer.vol.master, 0, 1);
    this.el.onended = () => { if (this.playing) this.next(); else { this.idleIdx++; this.syncVideo(); } };
    if (this.el.dataset.src !== src) { this.el.dataset.src = src; if (src) { this.el.src = src; this.el.play().catch(() => { this.el.muted = true; this.el.play().catch(() => {}); }); } else this.el.removeAttribute('src'); }
  },
  onSettings() { this.syncVideo(); },
  update() { if (current === this && !this.el) this.syncVideo(); },
  draw() {
    if (!customBackground(this)) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); if (!this.el?.dataset.src) stageBg('red'); }
    const v = this.el;
    if (v?.dataset.src && v.readyState >= 2 && v.videoWidth) {
      const vw = v.videoWidth, vh = v.videoHeight, s = this.s.clipFit === 'contain' ? Math.min(W / vw, H / vh) : Math.max(W / vw, H / vh);
      ctx.drawImage(v, (W - vw * s) / 2, (H - vh * s) / 2, vw * s, vh * s);
    }
    if (!this.el?.dataset.src) { title('MÁQUINA DE CLIPES', W / 2, H / 2 - 40, 52); label('Envie os seus vídeos em Configurações do jogo', W / 2, H / 2 + 20, 22, '#fff', 'center', 700); }
    if (this.playing && this.s.showViewerBadge && this.playing.user) toast(this.playing.user, `🎬 clipe ${this.playing.i + 1}`, 30, 120, { color: '#ef4444', size: 20 });
    if (this.s.showQueue && this.q.length) { label(`FILA (${this.q.length})`, W - 30, 110, 16, '#fff', 'right', 900); this.q.slice(0, 6).forEach((c, i) => avatar(c.user, W - 50 - i * 50, 150, 20, '#ef4444')); }
  },
});

// ---------------- Festa Pixel 3D (Dance Party) ----------------
defineGame({
  id: 'dance-party', name: 'Festa Pixel 3D', genre: 'party', icon: '🧱', color: '#8b5cf6', three: true,
  desc: 'Os espectadores entram numa pista de bonecos de blocos e dançam juntos. Quem quiser usa a skin de Minecraft pelo nick. Presentes compram aura, flutuar, solo no holofote e modo VIP gigante.',
  help: '<p>Comente para entrar dançando. Para usar a sua <b>skin de Minecraft</b>, comente <b>!skin seunick</b>.</p><p>🎁 Presentes: <b>aura</b> brilhante, <b>flutuar</b>, <b>holofote</b> (solo na frente) e <b>VIP</b> gigante.</p>',
  settings: [
    { key: 'map', type: 'select', label: 'Cenário', options: [['club', 'Balada'], ['beach', 'Praia'], ['space', 'Espaço']], default: 'club' },
    { key: 'dance', type: 'select', label: 'Dança', options: [['mix', 'Misturada'], ['0', 'Balanço'], ['1', 'Mãos pra cima'], ['2', 'Pulinho']], default: 'mix' },
    { key: 'maxDancers', type: 'number', label: 'Máximo de dançarinos', min: 4, max: 40, default: 24 },
    { key: 'allowMinecraftSkins', type: 'toggle', label: 'Aceitar skins de Minecraft (!skin nick)', default: true },
    { key: 'auraSeconds', type: 'number', label: 'Segundos da aura', min: 3, max: 60, default: 15 },
    { key: 'floatSeconds', type: 'number', label: 'Segundos flutuando', min: 3, max: 60, default: 10 },
    { key: 'spotlightSeconds', type: 'number', label: 'Segundos do holofote', min: 3, max: 60, default: 10 },
    { key: 'vipSeconds', type: 'number', label: 'Segundos de VIP gigante', min: 5, max: 120, default: 20 },
    { key: 'autoSpawn', type: 'toggle', label: 'Bots quando a pista está vazia', default: true },
  ],
  actions: [{ id: 'join', label: 'Entrar', icon: '🕺' }, { id: 'aura', label: 'Aura', icon: '✨' }, { id: 'float', label: 'Flutuar', icon: '🎈' }, { id: 'spotlight', label: 'Holofote', icon: '🔦' }, { id: 'vip', label: 'VIP gigante', icon: '👑' }],
  bindings: [{ action: 'join', trigger: 'comment' }, { action: 'join', trigger: 'join' }, { action: 'aura', trigger: 'gift', minCoins: 1 }, { action: 'float', trigger: 'gift', minCoins: 10 }, { action: 'spotlight', trigger: 'gift', minCoins: 99 }, { action: 'vip', trigger: 'gift', minCoins: 299 }],
  reset() { this.d = []; this.spot = null; this.botT = 0; if (this.r) { for (const x of this.r.pool) this.r.scene.remove(x.b.root); this.r.pool = []; } },
  sample() { return pick(['bora', 'dança', '!skin Notch', 'uhuu']); },
  dancer(user) {
    const k = user.id || user.nick;
    let d = this.d.find((x) => x.k === k);
    if (d) return d;
    if (this.d.length >= this.s.maxDancers) { const bot = this.d.find((x) => x.user.bot); if (!bot || user.bot) return null; this.removeD(bot); }
    d = { k, user, skin: '', aura: 0, float: 0, vip: 0, style: this.s.dance === 'mix' ? hashStr(k) % 3 : Number(this.s.dance), ph: rand(0, 6), mesh: null };
    this.d.push(d);
    return d;
  },
  removeD(d) { this.d.splice(this.d.indexOf(d), 1); if (d.mesh) { this.r?.scene.remove(d.mesh.b.root); this.r.pool = this.r.pool.filter((x) => x !== d.mesh); } },
  onChat(ev) {
    const m = String(ev.text).match(/^!skin\s+([A-Za-z0-9_]{3,16})/i);
    if (m && this.s.allowMinecraftSkins) { const d = this.dancer(ev.user); if (d) { d.skin = m[1]; if (d.mesh) { this.r.scene.remove(d.mesh.b.root); this.r.pool = this.r.pool.filter((x) => x !== d.mesh); d.mesh = null; } } }
  },
  onAction(id, a) {
    const d = this.dancer(a.user);
    if (!d) return;
    if (id === 'aura') d.aura = this.s.auraSeconds;
    else if (id === 'float') d.float = this.s.floatSeconds;
    else if (id === 'spotlight') { this.spot = { d, t: this.s.spotlightSeconds }; voice.say(`Solo de ${a.user.nick}!`); }
    else if (id === 'vip') { d.vip = this.s.vipSeconds; sfx.win(); }
  },
  update(dt) {
    if (this.s.autoSpawn && this.d.length < 6) { this.botT -= dt; if (this.botT <= 0) { this.botT = 2; this.dancer(botUser('dp')); } }
    for (const d of this.d) { d.aura = Math.max(0, d.aura - dt); d.float = Math.max(0, d.float - dt); d.vip = Math.max(0, d.vip - dt); }
    if (this.spot && (this.spot.t -= dt) <= 0) this.spot = null;
  },
  // Boneco de blocos com a skin do Minecraft (cabeça e corpo pela imagem do mc-heads) ou com a foto no rosto.
  makeMesh(d) {
    const T = THREE;
    const b = makeBlocky3D(d.k, d.skin ? '' : d.user);
    if (d.skin) {
      const tex = G3.imageTex(`https://mc-heads.net/avatar/${d.skin}/128`);
      b.head.material[4] = new T.MeshStandardMaterial({ map: tex });
      const body = G3.imageTex(`https://mc-heads.net/body/${d.skin}/256`);
      b.torso.material = new T.MeshStandardMaterial({ map: body, transparent: true });
    }
    const tag = G3.label(trim(d.user.nick, 14), { scale: 0.12 }); tag.position.y = 3.1; b.root.add(tag);
    const aura = new T.Mesh(new T.SphereGeometry(1.6, 16, 12), new T.MeshBasicMaterial({ color: new T.Color().setHSL(hashStr(d.k) % 360 / 360, 0.9, 0.6), transparent: true, opacity: 0.25 })); aura.position.y = 1.5; b.root.add(aura);
    this.r.scene.add(b.root);
    const m = { b, tag, aura };
    this.r.pool.push(m);
    return m;
  },
  scene3d() {
    if (this.r || !G3.ready) return this.r;
    const T = THREE, scene = new T.Scene();
    G3.lights(scene, { hemi: 0.9, sun: 1.8, pos: [6, 20, 12] });
    const floor = new T.Mesh(new T.PlaneGeometry(40, 30), new T.MeshStandardMaterial({ map: G3.tex(256, 256, (g) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = `hsl(${(x * 40 + y * 70) % 360} 80% ${(x + y) % 2 ? 45 : 60}%)`; g.fillRect(x * 32, y * 32, 32, 32); } }), roughness: 0.4 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const lights = [];
    for (let i = 0; i < 4; i++) { const l = new T.PointLight(new T.Color().setHSL(i / 4, 1, 0.5), 60, 30); l.position.set((i - 1.5) * 6, 6, -2); scene.add(l); lights.push(l); }
    const cam = new T.PerspectiveCamera(44, W / H, 0.1, 200);
    this.r = { scene, cam, pool: [], lights, floor, mapKey: null };
    return this.r;
  },
  draw() {
    const r = this.scene3d(), t = performance.now() / 1000;
    if (r) {
      if (r.mapKey !== this.s.map) { r.mapKey = this.s.map; r.scene.background = this.s.map === 'beach' ? G3.skyTex('#38bdf8', '#7dd3fc', '#fde68a') : this.s.map === 'space' ? G3.skyTex('#000000', '#1e1b4b', '#020617') : G3.skyTex('#09090b', '#3b0764', '#0f0420'); }
      const n = this.d.length, perRow = 6;
      this.d.forEach((d, i) => {
        if (!d.mesh) d.mesh = this.makeMesh(d);
        const row = Math.floor(i / perRow), col = i % perRow, inRow = Math.min(perRow, n - row * perRow);
        let x = (col - (inRow - 1) / 2) * 2.4, z = -row * 2.6;
        const solo = this.spot && this.spot.d === d;
        if (solo) { x = 0; z = 4; }
        const b = d.mesh.b;
        danceBlocky(b, t + d.ph, d.style);
        b.root.position.set(x, (d.float > 0 ? 1.5 + Math.sin(t * 2) * 0.4 : 0) + b.root.position.y, z);
        b.root.scale.setScalar(d.vip > 0 ? 1.8 : solo ? 1.3 : 1);
        b.root.rotation.y = Math.sin(t * 0.8 + i) * 0.4;
        d.mesh.aura.visible = d.aura > 0 || d.vip > 0;
        d.mesh.aura.scale.setScalar(1 + Math.sin(t * 6) * 0.1);
        b.root.visible = !this.spot || solo || true;
      });
      r.lights.forEach((l, i) => { l.position.x = Math.sin(t * 1.3 + i * 1.6) * 8; l.intensity = 40 + Math.sin(t * 8 + i) * 30; });
      const rows = Math.ceil(n / perRow);
      r.cam.position.set(Math.sin(t * 0.15) * 5, 7 + rows * 0.9, 17 + rows * 2.2); r.cam.lookAt(0, 1.6, -rows * 1.2);
      G3.render(r.scene, r.cam);
    } else stageBg('purple');
    title('FESTA PIXEL 3D', W / 2, 56, 46, '#c4b5fd');
    pill(`${this.d.length} dançando · comente para entrar · !skin nick`, W / 2, 100, { size: 16, bg: 'rgba(0,0,0,.6)' });
    if (this.spot) pill(`🔦 SOLO: @${trim(this.spot.d.user.nick, 14)}`, W / 2, 150, { size: 22, bg: '#8b5cf6' });
  },
});
