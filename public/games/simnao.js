'use strict';

// SIM ou NÃO: cada comentário é 1 voto (com pausa de 2s por pessoa); presente vale 10 votos por moeda.
registerGame({
  id: 'simnao',
  name: 'Sim ou Não',
  icon: '🏛️',
  help: '<p>Comente <b>SIM</b> ou <b>NÃO</b>. Cada comentário é 1 voto (no máximo 1 a cada 2s por pessoa).</p><p>🎁 Presente: +10 votos por moeda no lado que você votou por último.</p>',
  question: 'Você aprova a proposta?',
  cd: new Cooldown(2000),
  reset() { this.yes = 0; this.no = 0; this.side = new Map(); this.recent = []; this.shake = 0; },
  edit() {
    const r = editFields([{ label: 'Pergunta:', value: this.question }]);
    if (r) { this.question = r[0]; this.reset(); }
  },
  sample: () => (Math.random() < 0.55 ? 'sim' : 'não'),
  add(user, isYes, n) {
    if (isYes) this.yes += n; else this.no += n;
    this.recent.push({ user, yes: isYes, t: 2.5, x: isYes ? rand(80, 300) : rand(420, 640) });
    if (this.recent.length > 30) this.recent.shift();
  },
  onEvent(ev) {
    const id = uid(ev);
    if (ev.type === 'chat') {
      const t = ev.text.trim().toLowerCase();
      const isYes = /^(sim|s|yes|👍)\b/.test(t), isNo = /^(n[aã]o|n|no|👎)\b/.test(t);
      if (!isYes && !isNo) return;
      this.side.set(id, isYes);
      if (this.cd.ok(id)) this.add(ev.user, isYes, 1);
    } else if (ev.type === 'gift') {
      if (!this.side.has(id)) return;
      const isYes = this.side.get(id), n = 10 * coins(ev);
      this.add(ev.user, isYes, n);
      this.shake = 0.4;
      floatText(`+${n}`, isYes ? 190 : 530, 640, isYes ? '#7cff6b' : '#fe2c55', 56);
      if (giftTier(ev) >= 3) burst(isYes ? 190 : 530, 640, isYes ? '#7cff6b' : '#fe2c55', 60);
    }
  },
  update(dt) {
    this.shake = Math.max(0, this.shake - dt);
    for (const r of this.recent) r.t -= dt;
    this.recent = this.recent.filter((r) => r.t > 0);
  },
  draw() {
    background('#101624', '#1e1030');
    text('🏛️ SIM ou NÃO', W / 2, 100, 60, '#ffd23f');
    wrapText(this.question, W / 2, 200, W - 80, 46);
    const total = this.yes + this.no || 1;
    const py = this.yes / total;
    const sx = this.shake ? rand(-6, 6) : 0;
    const top = 330, h = 620;
    roundRect(40 + sx, top, W - 80, h, 30, 'rgba(255,255,255,.06)');
    const split = 40 + (W - 80) * (this.yes + this.no ? py : 0.5);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(40 + sx, top, W - 80, h, 30); ctx.clip();
    ctx.fillStyle = '#1f9d55'; ctx.fillRect(40 + sx, top, split - 40, h);
    ctx.fillStyle = '#c81e3a'; ctx.fillRect(split + sx, top, W - 40 - split, h);
    ctx.restore();
    text('SIM', 190, top + 90, 80);
    text('NÃO', 530, top + 90, 80);
    text(`${this.yes}`, 190, top + 220, 70);
    text(`${this.no}`, 530, top + 220, 70);
    text(`${Math.round(py * 100)}%`, 190, top + 310, 44, '#e8ffe8', 'center', 600);
    text(`${Math.round((1 - py) * 100)}%`, 530, top + 310, 44, '#ffe8e8', 'center', 600);
    for (const r of this.recent) {
      ctx.globalAlpha = clamp(r.t, 0, 1);
      avatar(r.user, r.x, top + h - 80 - (2.5 - r.t) * 60, 30);
      ctx.globalAlpha = 1;
    }
    const lead = this.yes === this.no ? 'EMPATE' : this.yes > this.no ? 'SIM ESTÁ GANHANDO' : 'NÃO ESTÁ GANHANDO';
    text(lead, W / 2, top + h + 70, 44, this.yes === this.no ? '#fff' : this.yes > this.no ? '#7cff6b' : '#fe2c55');
    text('Comente SIM ou NÃO', W / 2, H - 150, 42, '#25f4ee');
    text('🎁 presente = 10 votos por moeda', W / 2, H - 90, 30, '#ddd', 'center', 500);
  },
});
