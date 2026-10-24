'use strict';

// ---------------- Aula ao Vivo ----------------
// O chat comenta o que quer aprender ("quero aprender frações", "aula de logaritmo", "o que é fotossíntese").
// O jogo reconhece o tema, a IA monta uma aula curta (título, pontos, exemplo e uma pergunta) e a professora
// 3D explica na lousa, com voz. A primeira aula pode começar de graça; para TROCAR de conteúdo alguém precisa
// mandar moedas (presente ligado à ação "Trocar a aula"): vale o pedido de quem mandou, senão o mais pedido.
// Sem IA, há aulas prontas para os temas mais comuns.

const AULA_PRONTAS = {
  'fracoes': { t: 'Frações', p: ['Fração é uma parte de um inteiro dividido em partes iguais.', 'O número de cima é o numerador: quantas partes pegamos.', 'O número de baixo é o denominador: em quantas partes o inteiro foi dividido.', 'Para somar frações com o mesmo denominador, some só os numeradores.', 'Com denominadores diferentes, primeiro deixe todos iguais (MMC).'], ex: '1/4 + 2/4 = 3/4 · 1/2 + 1/3 = 3/6 + 2/6 = 5/6', q: 'Quanto é 1/5 + 2/5?', o: ['3/10', '3/5', '2/5', '1/5'], a: 'B' },
  'equacao do 1 grau': { t: 'Equação do 1º grau', p: ['Equação é uma igualdade com um valor desconhecido, o x.', 'O objetivo é deixar o x sozinho de um lado.', 'O que soma de um lado passa subtraindo para o outro.', 'O que multiplica passa dividindo.', 'No fim, confira trocando o x pelo resultado.'], ex: '2x + 6 = 14 → 2x = 8 → x = 4', q: 'Em 3x − 3 = 12, quanto vale x?', o: ['3', '4', '5', '6'], a: 'C' },
  'logaritmo': { t: 'Logaritmo', p: ['Logaritmo responde: a base elevada a quanto dá o número?', 'log₂ 8 = 3 porque 2³ = 8.', 'Log de um produto é a soma dos logs.', 'Log de uma potência: o expoente sai multiplicando.', 'Sem base escrita, a base é 10: log 1000 = 3.'], ex: 'log₃ 9 + log₃ 3 = 2 + 1 = 3', q: 'Quanto é log₂ 16?', o: ['2', '3', '4', '8'], a: 'C' },
  'teorema de pitagoras': { t: 'Teorema de Pitágoras', p: ['Vale para triângulos retângulos (com um ângulo de 90°).', 'O lado maior, oposto ao ângulo reto, é a hipotenusa.', 'Os outros dois lados são os catetos.', 'Hipotenusa² = cateto² + cateto².', 'Trios famosos: 3-4-5, 6-8-10, 5-12-13.'], ex: 'Catetos 6 e 8: h² = 36 + 64 = 100 → h = 10', q: 'Catetos 5 e 12. Quanto mede a hipotenusa?', o: ['13', '17', '15', '11'], a: 'A' },
  'fotossintese': { t: 'Fotossíntese', p: ['É como as plantas produzem o próprio alimento.', 'Acontece nos cloroplastos, que têm clorofila (o verde).', 'A planta usa luz do sol, água e gás carbônico.', 'Produz glicose (energia) e libera oxigênio.', 'Por isso as plantas são essenciais para o ar que respiramos.'], ex: 'gás carbônico + água + luz → glicose + oxigênio', q: 'Que gás as plantas liberam na fotossíntese?', o: ['Gás carbônico', 'Nitrogênio', 'Oxigênio', 'Hélio'], a: 'C' },
  'sistema solar': { t: 'Sistema Solar', p: ['O Sol é a estrela no centro, e tudo gira em volta dele.', 'São 8 planetas: Mercúrio, Vênus, Terra, Marte, Júpiter, Saturno, Urano e Netuno.', 'Os 4 primeiros são rochosos; os outros são gigantes gasosos ou de gelo.', 'Júpiter é o maior planeta.', 'A Terra é o único planeta conhecido com vida.'], ex: 'Ordem: Minha Velha Traga Meu Jantar: Sopa, Uva, Nozes', q: 'Qual é o maior planeta do Sistema Solar?', o: ['Saturno', 'Júpiter', 'Terra', 'Netuno'], a: 'B' },
  'porcentagem': { t: 'Porcentagem', p: ['Porcentagem é uma fração com denominador 100.', '25% = 25/100 = 0,25.', 'Para achar x% de um valor, multiplique o valor por x e divida por 100.', '10% é só dividir por 10; 50% é a metade.', 'Aumento de 20%: multiplique por 1,2. Desconto de 20%: por 0,8.'], ex: '30% de 200 = 200 × 30 ÷ 100 = 60', q: 'Quanto é 20% de 150?', o: ['20', '25', '30', '35'], a: 'C' },
};
const AULA_RE = /^(?:!aula|aula de|aula sobre|quero aprender(?: sobre)?|quero saber(?: sobre)?|me ensina(?: sobre)?|ensina(?: sobre)?|me explica|explica|explique|o que (?:e|é|sao|são))\s+(?:(?:o|a|os|as|de|do|da|dos|das|um|uma)\s+)?(.{2,40}?)[?!. ]*$/i;
const aulaKey = (t) => norm(t).replace(/\b(o|a|os|as|de|do|da|dos|das)\b/g, ' ').replace(/\s+/g, ' ').trim();

defineGame({
  id: 'live-class', name: 'Aula ao Vivo', genre: 'talk', icon: '👩‍🏫', color: '#16a34a', ai: true, voice: true, hasChars: true, speaksChat: true, legendPos: { side: 'left', y: 812, cycle: false },
  desc: 'O chat comenta o que quer aprender e a professora 3D explica na lousa, com voz, exemplo e uma pergunta no final. Para trocar de conteúdo, alguém manda moedas.',
  help: '<p>Comente <b>"quero aprender …"</b>, <b>"aula de …"</b>, <b>"o que é …"</b> ou <b>!aula …</b>. O pedido entra na lista da tela.</p><p>A professora explica ponto por ponto, mostra um <b>exemplo</b> e faz uma <b>pergunta</b> (responda A, B, C ou D). Depois repete a aula.</p><p>🎁 Para <b>trocar de conteúdo</b>, mande o presente da ação "Trocar a aula" (padrão: 10 moedas ou mais): vale o seu pedido, ou o mais pedido da lista.</p>',
  settings: [
    { key: 'firstFree', type: 'toggle', label: 'A primeira aula começa de graça (sem moedas)', default: true },
    { key: 'startTopic', type: 'text', label: 'Tema da primeira aula (vazio = espera o chat pedir)', default: '' },
    { key: 'level', type: 'select', label: 'Nível da explicação', options: [['crianca', 'Criança'], ['fundamental', 'Ensino fundamental'], ['medio', 'Ensino médio'], ['vestibular', 'Vestibular/ENEM']], default: 'medio' },
    { key: 'minSlide', type: 'number', label: 'Segundos mínimos em cada ponto', min: 4, max: 60, default: 9 },
    { key: 'quizSeconds', type: 'number', label: 'Segundos para responder a pergunta', min: 10, max: 120, default: 25 },
    { key: 'loopPause', type: 'number', label: 'Pausa antes de repetir a aula (s)', min: 3, max: 120, default: 12 },
    charSetting('character', 'Professora (personagem)'),
    NARRATE_SETTING('Professora explica em voz alta'),
  ],
  actions: [{ id: 'change_topic', label: 'Trocar a aula', icon: '🔄', tone: 'show' }, { id: 'repeat_point', label: 'Repetir a explicação', icon: '🔁' }, { id: 'next_point', label: 'Próximo ponto', icon: '⏭️' }],
  bindings: [{ action: 'change_topic', trigger: 'gift', minCoins: 10 }, { action: 'repeat_point', trigger: 'like', likes: 100 }],
  kind() { return this.charOverride && CHARACTERS[this.charOverride] ? this.charOverride : pickKind(this.s.character || 'maga', 0, 'live-class'); },
  onCharPick(user, k) { this.charOverride = k; },
  // Na lista "Como jogar": o pedido por comentário também aparece
  legendItems() { return [{ emoji: '💬', what: '"quero aprender …"', eff: 'Pede uma aula', icon: '📚', tone: 'show', trig: 'comment', times: 1 }, { emoji: '💬', what: 'A, B, C ou D', eff: 'Responde a pergunta', icon: '✅', tone: 'help', trig: 'comment', times: 1 }, ...legendItems({ ...this, legendItems: null })]; },
  reset() {
    this.reqs = new Map(); this.lastReq = new Map(); this.points = new Points(this.id); this.feed = new Feed(3);
    this.lesson = null; this.st = 'idle'; this.t = 0; this.i = 0; this.loading = null; this.right = []; this.tried = new Set();
    if (this.s.startTopic) this.start(this.s.startTopic, null);
  },
  onSettings() { this.reset(); },
  sample() { return this.st === 'quiz' ? pick(['a', 'b', 'c', 'd']) : pick(['quero aprender frações', 'aula de logaritmo', 'o que é fotossíntese', 'me ensina porcentagem', '!aula sistema solar']); },
  onChat(ev) {
    const txt = String(ev.text || '').trim();
    if (this.st === 'quiz') { const lt = norm(txt).replace(/^letra /, '').replace(/ /g, ''); if (/^[abcd]$/.test(lt)) return this.answer(ev, lt.toUpperCase()); }
    const m = txt.match(AULA_RE);
    if (!m) return;
    const topic = m[1].trim().replace(/\s+/g, ' ');
    if (voice.clean(topic) !== topic || aulaKey(topic).length < 2) return; // palavrão ou vazio não vira aula
    const k = aulaKey(topic), r = this.reqs.get(k) || { topic, users: [], n: 0, t: 0 };
    if (!r.users.some((u) => uid({ user: u }) === uid(ev))) { r.users.push(ev.user); r.n++; }
    r.t = Date.now(); this.reqs.set(k, r); this.lastReq.set(uid(ev), k);
    this.feed.push(ev.user, `📚 pediu: ${trim(topic, 22)}`, '#86efac');
    // Sem aula ainda: a primeira começa sozinha
    if (!this.lesson && !this.loading && this.s.firstFree) this.start(topic, ev.user, k);
  },
  onAction(id, a) {
    if (id === 'change_topic') {
      const k = this.lastReq.get(uid(a)) && this.reqs.has(this.lastReq.get(uid(a))) ? this.lastReq.get(uid(a)) : [...this.reqs.entries()].sort((x, y) => y[1].n - x[1].n || y[1].t - x[1].t)[0]?.[0];
      if (!k) { this.feed.push(a.user, 'comente "quero aprender …" primeiro!', '#fde047'); return; }
      this.start(this.reqs.get(k).topic, a.user, k);
    } else if (id === 'repeat_point' && this.st === 'point') { this.t = 0; this.speakPoint(); this.feed.push(a.user, '🔁 repetindo'); }
    else if (id === 'next_point' && this.st === 'point') this.t = 999;
  },
  // Monta a aula (IA ou pronta) e começa
  async start(topic, user, key = aulaKey(topic)) {
    if (this.loading === key) return;
    this.loading = key; this.loadingTopic = topic; this.loadT = 0;
    this.reqs.delete(key);
    if (user) this.feed.push(user, `🔄 trocou para: ${trim(topic, 20)}`, '#fde047');
    const lv = { crianca: 'uma criança de 8 anos', fundamental: 'um aluno do ensino fundamental', medio: 'um aluno do ensino médio', vestibular: 'um vestibulando (ENEM)' }[this.s.level] || 'um aluno do ensino médio';
    const ready = AULA_PRONTAS[key] || Object.entries(AULA_PRONTAS).find(([k]) => key.includes(k) || k.includes(key))?.[1];
    const sys = 'Você é uma professora brasileira didática e animada numa live do TikTok. Responda SÓ no formato pedido, em português do Brasil, frases curtas e corretas.';
    const prompt = `Prepare uma aula curta sobre "${topic}" para ${lv}. Formato exato, uma coisa por linha:\nTITULO: (título curto)\nPONTO: (explicação de 1 frase, até 120 letras)\nPONTO: …\n(de 4 a 6 linhas PONTO)\nEXEMPLO: (um exemplo concreto, até 120 letras)\nPERGUNTA: (pergunta de múltipla escolha sobre a aula)\nA) …\nB) …\nC) …\nD) …\nRESPOSTA: (só a letra certa)\nSe o tema não for de estudo ou for impróprio, escreva só: RECUSA`;
    let L = null;
    const txt = await ai.ask('aula:' + key + ':' + this.s.level, sys, prompt, '', 800, { raw: true });
    if (txt && !/^\s*RECUSA/i.test(txt)) L = this.parse(txt, topic);
    if (!L && ready) L = { t: ready.t, p: ready.p, ex: ready.ex, q: ready.q, o: ready.o, a: ready.a };
    if (this.loading !== key) return; // outro pedido chegou no meio
    this.loading = null;
    if (!L) { this.feed.push(user || { nick: 'aula' }, `não consegui preparar "${trim(topic, 16)}"`, '#f87171'); if (!this.lesson) this.st = 'idle'; return; }
    this.lesson = { ...L, by: user, topic }; this.points.clear?.();
    this.i = 0; this.st = 'point'; this.t = 0; this.speakPoint(true);
    const c = charLayer.chars.get('teacher'); c?.play('victory', { speed: 1.2 });
  },
  parse(txt, topic) {
    const rows = txt.split('\n').map((l) => l.trim()).filter(Boolean), get = (re) => rows.find((l) => re.test(l))?.replace(re, '').trim();
    const p = rows.filter((l) => /^(PONTO|[-•]|\d+[.)])\s*:?/i.test(l)).map((l) => l.replace(/^(PONTO|[-•]|\d+[.)])\s*:?\s*/i, '').trim()).filter((l) => l.length > 3).slice(0, 6);
    const o = ['A', 'B', 'C', 'D'].map((x) => rows.find((l) => new RegExp(`^${x}[).:-]\\s*`).test(l))?.replace(/^[A-D][).:-]\s*/, '').trim());
    const a = (get(/^RESPOSTA\s*:?\s*/i) || '').toUpperCase().match(/[ABCD]/)?.[0];
    if (p.length < 2) return null;
    return { t: get(/^T[IÍ]TULO\s*:?\s*/i) || topic, p, ex: get(/^EXEMPLO\s*:?\s*/i) || '', q: get(/^PERGUNTA\s*:?\s*/i) || '', o: o.every(Boolean) ? o : null, a: a || null };
  },
  speakPoint(first) {
    const L = this.lesson; if (!L) return;
    const line = this.st === 'example' ? `Exemplo: ${L.ex}` : L.p[this.i];
    narrate(this, first ? `Aula de hoje: ${L.t}. ${line}` : line);
    const c = charLayer.chars.get('teacher'); if (c && !c.busy) c.play(pick(['cast', 'interact', 'taunt']), { speed: 1.1 });
  },
  answer(ev, letter) {
    const k = uid(ev); if (this.tried.has(k)) return; this.tried.add(k);
    if (letter === this.lesson.a) { const pts = Math.max(10, 100 - this.right.length * 10); this.right.push({ user: ev.user, pts }); this.points.add(ev.user, pts); if (this.right.length === 1) sfx.confirm(); }
  },
  pointSecs(s) { return clamp(String(s || '').length / 12 + 2.5, this.s.minSlide, 40); },
  update(dt) {
    this.feed.update(dt); this.loadT = (this.loadT || 0) + dt;
    const L = this.lesson; if (!L || this.loading) return;
    this.t += dt;
    if (this.st === 'point' && this.t > this.pointSecs(L.p[this.i]) + (this.i === 0 ? 3 : 0)) {
      this.t = 0;
      if (this.i < L.p.length - 1) { this.i++; this.speakPoint(); }
      else if (L.ex) { this.st = 'example'; this.speakPoint(); }
      else this.toQuiz();
    } else if (this.st === 'example' && this.t > this.pointSecs(L.ex)) this.toQuiz();
    else if (this.st === 'quiz' && this.t > this.s.quizSeconds) {
      this.st = 'answer'; this.t = 0;
      const i = 'ABCD'.indexOf(L.a);
      narrate(this, `A resposta certa é a letra ${L.a}: ${L.o[i]}. ${this.right[0] ? `Parabéns, ${this.right[0].user.nick}!` : ''}`);
      const c = charLayer.chars.get('teacher'); c?.play(this.right.length ? 'victory' : 'taunt');
    } else if (this.st === 'answer' && this.t > 8) { this.st = 'loop'; this.t = 0; }
    else if (this.st === 'loop' && this.t > this.s.loopPause) { this.st = 'point'; this.i = 0; this.t = 0; this.speakPoint(true); }
  },
  toQuiz() {
    const L = this.lesson; this.t = 0;
    if (!L.q || !L.o || !L.a) { this.st = 'loop'; return; }
    this.st = 'quiz'; this.right = []; this.tried = new Set();
    narrate(this, `Pergunta: ${L.q} A: ${L.o[0]}. B: ${L.o[1]}. C: ${L.o[2]}. D: ${L.o[3]}.`);
  },
  draw() {
    const t = performance.now() / 1000;
    // Sala de aula: parede, lousa verde com moldura de madeira
    if (!customBackground(this)) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2b1d14'); g.addColorStop(0.75, '#4a3426'); g.addColorStop(1, '#23170f'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    const bx = 24, by = 150, bw = W - 48, bh = 640;
    ctx.fillStyle = '#7c4a24'; ctx.beginPath(); ctx.roundRect(bx - 14, by - 14, bw + 28, bh + 28, 18); ctx.fill();
    const bg = ctx.createLinearGradient(0, by, 0, by + bh); bg.addColorStop(0, '#1f4d3a'); bg.addColorStop(1, '#173a2c'); ctx.fillStyle = bg; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = 'rgba(255,255,255,.04)'; for (let k = 0; k < 7; k++) ctx.fillRect(bx + ((k * 173) % bw), by, 60, bh);
    title('AULA AO VIVO', W / 2, 56, 46, '#fef3c7');
    const L = this.lesson, chalk = '#f8fafc', yellow = '#fde68a';
    if (this.loading) {
      label('preparando a aula de', W / 2, by + 220, 30, chalk, 'center', 700);
      mathLines(this.loadingTopic, bw - 60, 44).slice(0, 2).forEach((l, i) => label(l, W / 2, by + 280 + i * 52, 44, yellow, 'center', 900));
      label('.'.repeat(1 + Math.floor(t * 3) % 3), W / 2, by + 400, 60, chalk, 'center', 900);
    } else if (!L) {
      label('O que você quer aprender hoje?', W / 2, by + 140, 34, yellow, 'center', 900);
      ['Comente:', '"quero aprender frações"', '"aula de logaritmo"', '"o que é fotossíntese"', '!aula sistema solar'].forEach((s, i) => label(s, W / 2, by + 220 + i * 52, i ? 30 : 26, i ? chalk : 'rgba(255,255,255,.7)', 'center', 800));
    } else {
      pill(`📚 ${trim(L.t, 34)}`, W / 2, by + 34, { size: 22, bg: 'rgba(0,0,0,.35)', color: yellow });
      if (this.st === 'point' || this.st === 'loop' || this.st === 'example') {
        // Ponto atual grande; os anteriores pequenos em cima
        let y = by + 84;
        L.p.slice(0, this.st === 'point' ? this.i : L.p.length).slice(-3).forEach((pt) => { mathLines('✓ ' + pt, bw - 60, 20, 700).slice(0, 2).forEach((l) => { label(l, bx + 30, y, 20, 'rgba(248,250,252,.55)', 'left', 700); y += 26; }); y += 6; });
        const cur = this.st === 'example' ? `Exemplo: ${L.ex}` : this.st === 'loop' ? 'Repetindo a aula já já…' : L.p[this.i];
        const lines = mathLines(cur, bw - 70, 34, 900).slice(0, 6);
        const y0 = Math.max(y + 30, by + bh / 2 - lines.length * 22);
        lines.forEach((l, i) => label(l, W / 2, y0 + i * 44, 34, this.st === 'example' ? yellow : chalk, 'center', 900));
        if (this.st === 'point') label(`${this.i + 1} / ${L.p.length}`, bx + bw - 20, by + bh - 24, 18, 'rgba(255,255,255,.6)', 'right', 800);
      } else if (this.st === 'quiz' || this.st === 'answer') {
        mathLines('❓ ' + L.q, bw - 60, 30, 900).slice(0, 4).forEach((l, i) => label(l, W / 2, by + 100 + i * 40, 30, yellow, 'center', 900));
        L.o.forEach((o, i) => {
          const y = by + 290 + i * 74, ok = this.st === 'answer' && 'ABCD'[i] === L.a;
          ctx.fillStyle = ok ? 'rgba(34,197,94,.35)' : 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.roundRect(bx + 30, y, bw - 60, 62, 16); ctx.fill();
          if (ok) { ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 4; ctx.stroke(); }
          label('ABCD'[i], bx + 62, y + 32, 30, ok ? '#86efac' : yellow, 'center', 900, F_TITLE);
          label(trim(o, 34), bx + 96, y + 32, 26, chalk, 'left', 800);
        });
        if (this.st === 'quiz') hudTimer(bx + bw - 50, by + 40, 30, this.s.quizSeconds - this.t, this.s.quizSeconds, '#86efac');
        this.right.slice(0, 8).forEach((r, i) => avatar(r.user, bx + 50 + i * 54, by + bh - 40, 22, '#86efac'));
      }
    }
    // Professora 3D ao lado da lousa
    const c = charLayer.get('teacher', this.kind(), { height: 300 });
    if (c) { charLayer.place(c, W - 150, 1150, -0.5); if (!c.busy && c.state !== 'idle') c.play('idle'); charLayer.draw(); }
    // Pedidos da live
    // Pedidos da live (embaixo da lista "Como jogar")
    const reqs = [...this.reqs.values()].sort((a, b) => b.n - a.n || b.t - a.t).slice(0, 2), py = 1030;
    if (reqs.length) {
      panel(12, py, 400, 44 + reqs.length * 48, { r: 18, from: 'rgba(15,23,42,.9)', to: 'rgba(15,23,42,.8)' });
      label(`📚 PEDIDOS (${this.reqs.size}) · 🎁 troca a aula`, 28, py + 22, 16, '#fde68a', 'left', 900);
      reqs.forEach((r, i) => { const y = py + 62 + i * 48; avatar(r.users[0], 42, y, 18, '#fde68a'); label(trim(r.topic, 20), 70, y, 20, '#fff', 'left', 800); label(`×${r.n}`, 396, y, 18, '#86efac', 'right', 900); });
    } else if (L) pill('Comente "quero aprender …" · 🎁 troca a aula', 214, py + 24, { size: 15, bg: 'rgba(0,0,0,.55)', color: '#fde68a' });
    this.feed.draw(20, 110);
  },
});
