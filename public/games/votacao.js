'use strict';

// Votação com 4 opções: cada pessoa tem 1 voto (pode trocar); presente soma votos por moeda.
registerGame({
  id: 'votacao',
  name: 'Votação',
  icon: '🗳️',
  help: '<p>Comente <b>1</b>, <b>2</b>, <b>3</b> ou <b>4</b> para votar (1 voto por pessoa, pode trocar).</p><p>🎁 Presente: +10 votos por moeda na sua opção.</p>',
  question: 'Qual jogo agora?',
  options: ['Corrida', 'Flappy', 'Cobra IA', 'Surpresa'],
  reset() { this.votes = [0, 0, 0, 0]; this.bonus = [0, 0, 0, 0]; this.voters = new Map(); this.pulse = [0, 0, 0, 0]; },
  edit() {
    const r = editFields([{ label: 'Pergunta:', value: this.question }, ...this.options.map((o, i) => ({ label: `Opção ${i + 1}:`, value: o }))]);
    if (!r) return;
    [this.question, ...this.options] = r;
    this.reset();
  },
  sample: () => String(randInt(1, 4)),
  vote(id, i) {
    const prev = this.voters.get(id);
    if (prev === i) return;
    if (prev !== undefined) this.votes[prev]--;
    this.voters.set(id, i);
    this.votes[i]++;
    this.pulse[i] = 1;
  },
  onEvent(ev) {
    const id = uid(ev);
    if (ev.type === 'chat') {
      const m = ev.text.trim().match(/^([1-4])\b/);
      if (m) this.vote(id, Number(m[1]) - 1);
    } else if (ev.type === 'gift') {
      const i = this.voters.get(id);
      if (i === undefined) return;
      this.bonus[i] += 10 * coins(ev);
      this.pulse[i] = 1;
      floatText(`+${10 * coins(ev)} ${trim(ev.user.nick, 12)}`, W / 2, 400 + i * 185, COLORS[i]);
    }
  },
  update(dt) { this.pulse = this.pulse.map((p) => Math.max(0, p - dt * 2)); },
  draw() {
    background('#1b1036', '#0a2a3a');
    text('🗳️ VOTAÇÃO', W / 2, 110, 64, '#25f4ee');
    wrapText(this.question, W / 2, 230, W - 80, 52);
    const totals = this.votes.map((v, i) => v + this.bonus[i]);
    const sum = totals.reduce((a, b) => a + b, 0) || 1;
    const lead = Math.max(...totals);
    this.options.forEach((opt, i) => {
      const y = 360 + i * 185, x = 50, w = W - 100, h = 140;
      roundRect(x, y, w, h, 24, 'rgba(255,255,255,.08)');
      const pct = totals[i] / sum;
      if (pct > 0) roundRect(x, y, Math.max(48, w * pct), h, 24, COLORS[i] + 'cc');
      if (this.pulse[i] > 0) { ctx.globalAlpha = this.pulse[i] * 0.5; roundRect(x, y, w, h, 24, '#fff'); ctx.globalAlpha = 1; }
      text(`${i + 1}`, x + 50, y + h / 2, 72);
      text(trim(opt, 18), x + 110, y + h / 2 - 18, 44, '#fff', 'left');
      text(`${totals[i]} votos · ${Math.round(pct * 100)}%`, x + 110, y + h / 2 + 34, 30, '#eee', 'left', 500);
      if (totals[i] === lead && lead > 0) text('👑', x + w - 50, y + h / 2, 60);
    });
    text('Comente o número da opção!', W / 2, H - 150, 40, '#ffd23f');
    text(`${this.voters.size} pessoas votaram`, W / 2, H - 90, 30, '#ccc', 'center', 500);
  },
});
