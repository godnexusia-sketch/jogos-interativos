'use strict';

// Na tela de todos os jogos: o que cada interação faz ("COMO JOGAR") e o aviso de cada ação que acontece.
// A lista sai dos gatilhos do jogo (⚡ Gatilhos no painel), então muda sozinha na hora em que o dono configura:
// presente (com ícone e valor), comentário com palavra, likes, seguir, compartilhar e entrar.
// Cores: verde = ajuda, vermelho = atrapalha, amarelo = faz aparecer/entrar.

const LEGEND_DEFAULTS = { on: true, side: 'auto', when: 'auto', rows: 8, size: 1, feed: true, feedSecs: 4.5 };
liveCfg.legend = { ...LEGEND_DEFAULTS, ...store.get('live:legend', {}) };

// Emoji dos presentes mais comuns, até chegar a imagem real do presente (aprendida na primeira vez que alguém manda).
const GIFT_EMOJI = [
  [/rosa|rose/, '🌹'], [/rosquinha|donut/, '🍩'], [/perfume/, '🧴'], [/\bbon[eé]\b|\bcap\b/, '🧢'], [/confete|confetti/, '🎊'],
  [/tiktok/, '🎵'], [/^gg$/, '🎮'], [/casquinha|ice cream/, '🍦'], [/[oó]culos|sunglass/, '🕶️'], [/chap[eé]u|hat|bigode/, '🤠'],
  [/arma de dinheiro|money gun|dinheiro|money/, '💸'], [/gold mine|mina|ouro|gold/, '⛏️'], [/mishka|bear|urso/, '🧸'], [/tsuru|papel|crane/, '🕊️'],
  [/bast[aã]o|glow ?stick/, '🪄'], [/cora[cç][aã]o de dedo|finger heart/, '🫰'], [/m[aã]os em cora|heart hand/, '🫶'], [/cora[cç][aã]o|heart|love/, '💗'],
  [/bola|ball|futebol|soccer/, '⚽'], [/le[aã]o|lion/, '🦁'], [/universo|universe/, '🌌'], [/gal[aá]xia|galaxy/, '🌠'], [/foguete|rocket/, '🚀'],
  [/carro|car\b|sports car/, '🏎️'], [/avi[aã]o|jet|plane/, '✈️'], [/baleia|whale/, '🐋'], [/estrela|star/, '⭐'], [/doce|candy/, '🍬'],
  [/bolo|cake/, '🎂'], [/beijo|kiss/, '💋'], [/cerveja|beer/, '🍺'], [/coroa|crown/, '👑'], [/diamante|diamond/, '💎'], [/fogos|firework/, '🎆'],
  [/bal[aã]o|balloon/, '🎈'], [/pizza/, '🍕'], [/drag[aã]o|dragon/, '🐉'], [/unic[oó]rnio|unicorn/, '🦄'], [/castelo|castle/, '🏰'], [/microfone|mic/, '🎤'],
  [/caf[eé]|coffee/, '☕'], [/flor|flower/, '🌸'], [/chap[eé]u/, '🎩'], [/panda/, '🐼'], [/cachorr|dog|puppy/, '🐶'], [/gat[oa]|cat/, '🐱'],
];
function giftEmoji(name) { const n = String(name || '').toLowerCase(); return GIFT_EMOJI.find(([re]) => re.test(n))?.[1] || '🎁'; }

// Ajuda / atrapalha / aparece. Os jogos podem marcar `tone` na ação; aqui ficam os casos de cada jogo.
const TONES = {
  hurt: {
    'crowd-says': ['extra_strike'], 'battle-arena': ['attack_enemy', 'attack_left', 'attack_right'], 'flappy-battle': ['wreck', 'steal', 'reset_other'],
    'tower-war': ['wreck', 'steal', 'reset_other'], 'blob-battle': ['spawn_virus'], snake: ['add_bombs'], 'slap-arena': ['force_ko'],
    'car-race': ['oil_slick', 'weather_shift'], '1000-stairs': ['banana_peel', 'scratching_cat', 'granny', 'giant_foot', 'bus', 'minigun', 'black_flame_sorcerer', 'steal_win'],
    'log-rush': ['web_trap', 'croc_log', 'chainsaw', 'tnt_launch', 'meteor_shower', 'elephant_drop', 'steal_win'],
    'window-wipe': ['throw_egg', 'throw_tomato', 'throw_mud', 'throw_paint', 'throw_banana', 'throw_poop', 'throw_balloon', 'throw_brick', 'throw_fish', 'throw_ink', 'bomb', 'freeze', 'tornado', 'bird', 'take_life'],
    'fruit-slice': ['bomb', 'steal_win'], 'lunar-dash': ['planet_pull', 'enemy_charge', 'meteor_strike', 'gravity_well', 'ufo_lift', 'enemy_swarm'],
    'tower-stack': ['finger', 'axe', 'bomb', 'hulk', 'steal_win'], 'voxel-craft': ['zap', 'tnt', 'tornado', 'black_hole', 'steal_win'],
    'flappy-3d': ['gun', 'fan', 'train', 'black_hole', 'steal_win'], 'zombie-hill': ['spawn_walker', 'spawn_by_value'],
    'tank-battle': ['air_strike', 'black_hole', 'crazy_tank'], 'tung-tung-smash': ['smash'], 'roast-your-photo': ['heckle'],
    'only-climb': ['down_5', 'down_10', 'down_25', 'down_50', 'down_100', 'down_checkpoint', 'down_start', 'freeze'],
    'obby-tower': ['down_5', 'down_10', 'down_25', 'down_50', 'down_100', 'down_checkpoint', 'down_start', 'freeze'],
    'only-heaven': ['down_5', 'down_10', 'down_25', 'down_50', 'down_100', 'down_checkpoint', 'down_start', 'freeze'],
  },
  show: {
    'would-you-rather': ['boost', 'shake'], 'true-or-false': ['spotlight'], 'word-cross': ['shuffle'], 'word-swipe': ['shuffle'], 'word-hunt': ['new_board'],
    'battle-arena': ['join_left', 'join_right'], 'bridge-brawl': ['join_red', 'join_blue'], 'blob-battle': ['join_blob'], 'chainsaw-clash': ['join'], 'evo-monster': ['join'],
    'take-the-crown': ['join'], 'slap-arena': ['join'], 'stick-fighters': ['join'], 'dance-floor': ['join', 'spin', 'change_face', 'grow', 'change_place', 'spotlight', 'disco_ball', 'hype'],
    'car-race': ['join'], 'tank-battle': ['join_battle'], 'mma-clash': ['spawn_fighter'], 'ai-host': ['ask_first', 'hype_me', 'say_hi'],
    'roast-your-photo': ['roast_me', 'skip_the_line'], 'guess-your-future': ['read_me', 'skip_the_line'], 'dance-party': ['join', 'aura', 'float', 'spotlight', 'vip'],
    'clip-machine': ['play_clip_1', 'play_clip_2', 'play_clip_3', 'play_clip_4', 'play_clip_5', 'play_clip_6', 'play_clip_7', 'play_clip_8', 'play_random'],
  },
};
function actionTone(g, act) {
  if (act.tone) return act.tone;
  if (TONES.hurt[g.id]?.includes(act.id)) return 'hurt';
  if (TONES.show[g.id]?.includes(act.id)) return 'show';
  if (act.id === 'steal_win') return 'hurt';
  return 'help';
}
const TONE_COLOR = { help: '#4ade80', hurt: '#f87171', show: '#fde047' };
const TONE_MARK = { help: '▲', hurt: '▼', show: '★' };

// Regras dos jogos clássicos (eles não usam gatilhos): o mesmo formato da lista.
const RULES_CLASSIC = {
  votacao: [['comment', 'número do jogo', 'Vota no jogo', 'show'], ['gift', 'Presente', '+10 votos por moeda'], ['like', '25 likes', '+10 votos'], ['follow', 'Seguir', '+50 votos'], ['share', 'Compartilhar', '+100 votos']],
  simnao: [['comment', '"sim" ou "não"', '1 voto', 'show'], ['gift', 'Presente', 'votos por moeda'], ['like', '25 likes', 'vale 1 moeda'], ['follow', 'Seguir', 'vale 5 moedas'], ['share', 'Compartilhar', 'vale 10 moedas']],
  urna: [['comment', 'número do candidato', '1 voto', 'show'], ['gift', 'Presente', 'votos por moeda'], ['like', '25 likes', 'vale 1 moeda'], ['follow', 'Seguir', 'vale 5 moedas'], ['share', 'Compartilhar', 'vale 10 moedas']],
  chute: [['comment', '"chuta"', 'Chuta 1 bola'], ['gift', '1 a 9 🪙', '1 a 3 bolas'], ['gift', '10 a 99 🪙', '3 a 10 bolas'], ['gift', '100 a 999 🪙', 'Bolas de fogo gigantes'], ['gift', '1.000+ 🪙', 'Chuva de bolas de ouro'], ['like', '30 likes', '1 bola'], ['follow', 'Seguir', '1 bola'], ['share', 'Compartilhar', '3 bolas']],
  torcida: [['comment', 'nome ou número', 'Torce e empurra', 'show'], ['gift', '1 a 9 🪙', 'Impulso'], ['gift', '10 a 99 🪙', 'Casca de banana no rival'], ['gift', '100 a 999 🪙', 'Superarrancada'], ['gift', '1.000+ 🪙', 'Derruba todos os rivais'], ['follow', 'Seguir', '+4 m'], ['share', 'Compartilhar', '+7 m']],
  corrida: [['comment', '"carro"', 'Entra no racha', 'show'], ['like', 'Like', 'Empurrão'], ['gift', '1 a 9 🪙', 'Nitro'], ['gift', '10 a 99 🪙', 'Nitro + pedras na pista'], ['gift', '100 a 999 🪙', 'Mísseis em quem está na frente', 'hurt'], ['gift', '1.000+ 🪙', 'Raio: encolhe todo mundo', 'hurt'], ['follow', 'Seguir', 'Nitro'], ['share', 'Compartilhar', 'Nitro']],
  kart: [['comment', '"kart"', 'Entra na corrida', 'show'], ['like', 'Like', 'Empurrão'], ['gift', '1 a 9 🪙', 'Nitro'], ['gift', '10 a 99 🪙', 'Nitro + pedras na pista'], ['gift', '100 a 999 🪙', 'Mísseis em quem está na frente', 'hurt'], ['gift', '1.000+ 🪙', 'Raio: encolhe todo mundo', 'hurt'], ['follow', 'Seguir', 'Nitro'], ['share', 'Compartilhar', 'Nitro']],
  cobra: [['comment', '"cobra"', 'Entra na arena', 'show'], ['gift', '1 a 9 🪙', 'Turbo'], ['gift', '10 a 99 🪙', 'Cresce'], ['gift', '100 a 999 🪙', 'Escudo'], ['gift', '1.000+ 🪙', 'MEGA: cresce, escudo e ímã'], ['like', 'Like', 'Cresce'], ['follow', 'Seguir', '+8 de tamanho'], ['share', 'Compartilhar', 'Turbo']],
  combate: [['comment', '1 ou 2', 'Escolhe o lutador', 'show'], ['comment', 'qualquer coisa', 'Jab no rival', 'hurt'], ['gift', '1 a 9 🪙', 'Direto', 'hurt'], ['gift', '10 a 99 🪙', 'Chute', 'hurt'], ['gift', '100 a 999 🪙', 'Bola de energia', 'hurt'], ['gift', '1.000+ 🪙', 'Golpe final', 'hurt'], ['like', 'Like', 'Enche o especial'], ['share', 'Compartilhar', '+60% de especial']],
  pipa: [['join', 'Entrar na live', 'Ganha uma pipa', 'show'], ['like', 'Like', 'A pipa sobe'], ['comment', '"corta"', 'Tenta cortar a pipa perto', 'hurt'], ['gift', '1 a 9 🪙', 'Corta 1 a 3', 'hurt'], ['gift', '10 a 99 🪙', 'Escudo'], ['gift', '100 a 999 🪙', 'Caçada: corta 5 a 12', 'hurt'], ['gift', '1.000+ 🪙', 'Linha de ouro', 'hurt'], ['follow', 'Seguir', 'Escudo']],
  avatares: [['comment', 'nick do Roblox', 'Seu avatar entra', 'show'], ['like', 'Like', 'Dança mais animado'], ['gift', '1 a 9 🪙', 'Fica mais tempo'], ['gift', '10 a 99 🪙', 'Cresce e ganha câmera'], ['gift', '100 a 999 🪙', 'Furacão gira todo mundo', 'show'], ['gift', '1.000+ 🪙', 'Chuva de avatares seus', 'show']],
  flappy: [['comment', '"pula"', 'O pássaro voa'], ['like', '5 likes', 'O pássaro voa'], ['follow', 'Seguir', 'Limpa a sabotagem'], ['share', 'Compartilhar', 'Vento', 'hurt'], ['gift', '1 a 9 🪙', 'Ar turbulento', 'hurt'], ['gift', '10 a 99 🪙', 'Canos gigantes', 'hurt'], ['gift', '100 a 999 🪙', 'Visão escura', 'hurt'], ['gift', '1.000+ 🪙', 'Caos galáctico', 'hurt']],
  ilha: [['comment', '"entrar"', 'Pula na ilha', 'show'], ['like', '5 likes', 'Puxa pro centro'], ['gift', '1 a 9 🪙', 'Entra e corre'], ['gift', '10 a 99 🪙', 'Escudos contra queda'], ['gift', '100 a 999 🪙', 'Água congelada + escudos'], ['gift', '1.000+ 🪙', 'TSUNAMI nos outros', 'hurt'], ['follow', 'Seguir', 'Escudo'], ['share', 'Compartilhar', 'Escudo + corrida']],
  desfile: [['comment', 'qualquer coisa', 'Entra na fila', 'show'], ['comment', 'nick do Roblox', 'Desfila com o avatar', 'show'], ['like', 'Like', 'Aplausos'], ['gift', '1 a 9 🪙', 'Fura a fila'], ['gift', '10 a 99 🪙', 'Desfile dançando'], ['gift', '100 a 999 🪙', 'Salão piscando'], ['gift', '1.000+ 🪙', 'O GIGANTE'], ['follow', 'Seguir', 'Fura a fila']],
};
const TRIG_EMOJI = { comment: '💬', like: '❤️', follow: '⭐', share: '🔁', join: '👋', gift: '🎁' };

// Uma linha da lista: { img, emoji, what, coins, times, eff, icon, tone }
function legendItems(g) {
  if (g.legendItems) return g.legendItems();
  if (!g.v2) return (g.rules || RULES_CLASSIC[g.id] || []).map(([t, what, eff, tone = 'help']) => ({ emoji: TRIG_EMOJI[t], what, eff, tone, trig: t }));
  const out = [], seen = new Set();
  for (const b of g.binds) {
    if (b.on === false) continue;
    const act = g.actions.find((a) => a.id === b.action);
    if (!act) continue;
    let it;
    if (b.trigger === 'gift') {
      const gi = b.giftId ? giftInfo(b.giftId) : null, name = gi?.name || b.giftName;
      it = name ? { img: gi?.img || learnedGifts[b.giftId] || '', emoji: giftEmoji(gi?.en || name) !== '🎁' ? giftEmoji(gi?.en || name) : giftEmoji(name), what: name, coins: gi?.coins }
        : { emoji: '🎁', what: 'Presente', coins: (b.minCoins || 0) > 1 ? `${fmtK(b.minCoins)}+` : 'qualquer', any: true };
    } else if (b.trigger === 'comment') {
      const words = String(b.text || '').split(',').map((s) => s.trim()).filter(Boolean);
      it = { emoji: '💬', what: words.length ? `"${words.slice(0, 2).join('" ou "')}"` : 'Comentar' };
    } else if (b.trigger === 'like') it = { emoji: '❤️', what: (b.likes || 1) > 1 ? `${b.likes} likes` : 'Like' };
    else it = { emoji: TRIGGERS[b.trigger]?.icon || '•', what: TRIGGERS[b.trigger]?.name || b.trigger };
    Object.assign(it, { trig: b.trigger, times: Math.max(1, Math.round(b.count || 1)), eff: act.label, icon: act.icon, tone: actionTone(g, act) });
    const key = `${it.trig}|${it.what}|${it.eff}|${it.times}`;
    if (seen.has(key)) continue;
    seen.add(key); out.push(it);
  }
  // Presentes específicos primeiro (do mais barato ao mais caro), depois o resto na ordem dos gatilhos
  const rank = (it) => (it.trig === 'gift' ? (it.any ? 1 : 0) : 2);
  return out.map((it, i) => ({ it, i })).sort((a, b) => rank(a.it) - rank(b.it) || (a.it.coins ?? 0) - (b.it.coins ?? 0) || a.i - b.i).map((x) => x.it);
}

// Onde fica a lista em cada jogo (para não cobrir o placar ou o jogo). side: left|right, y: topo da lista.
const LEGEND_POS = {
  'only-climb': { split: true, y: 290 }, 'obby-tower': { split: true, y: 290 }, 'only-heaven': { split: true, y: 290 },
  '1000-stairs': { split: true, y: 300 }, 'log-rush': { split: true, y: 300 }, 'lunar-dash': { split: true, y: 300 }, 'tower-stack': { split: true, y: 300 },
  'voxel-craft': { split: true, y: 300 }, 'flappy-3d': { split: true, y: 300 }, 'window-wipe': { split: true, y: 300 },
  cobra: { side: 'right', y: 420 }, 'boys-vs-girls': { y: 470 }, 'messi-vs-ronaldo': { y: 470 }, 'horse-race': { side: 'right', y: 640 },
  'snake': { side: 'left', y: 520 }, 'take-the-crown': { side: 'left', y: 520 },
  votacao: { y: 850, cycle: true }, simnao: { y: 760, cycle: true }, urna: { y: 760, cycle: true },
};
const legendState = { t: 0 };
const CROWDED_GENRES = ['trivia', 'word'];
function drawItemRow(it, x, y, w, rh, sz) {
  const tone = TONE_COLOR[it.tone] || '#fff';
  ctx.fillStyle = 'rgba(8,10,24,.74)'; ctx.beginPath(); ctx.roundRect(x, y, w, rh - 4, 10); ctx.fill();
  ctx.fillStyle = tone; ctx.beginPath(); ctx.roundRect(x, y, 5, rh - 4, [10, 0, 0, 10]); ctx.fill();
  const ic = rh - 10, cy = y + (rh - 4) / 2;
  const img = it.img ? getImg(proxImgUrl(it.img)) : null;
  if (img) ctx.drawImage(img, x + 10, cy - ic / 2, ic, ic);
  else label(it.emoji || '🎁', x + 10 + ic / 2, cy + 1, ic * 0.8, '#fff', 'center', 400);
  // O que mandar (e quanto vale)
  const tx = x + 14 + ic, half = (w - (tx - x)) * 0.46;
  label(trim(it.what, Math.max(6, Math.floor(half / (8 * sz)))), tx, cy - (it.coins != null ? 7 * sz : 0), 15 * sz, '#ffe08a', 'left', 900);
  if (it.coins != null) label(`${typeof it.coins === 'number' ? fmtK(it.coins) : it.coins} 🪙${it.times > 1 ? `  ×${it.times}` : ''}`, tx, cy + 10 * sz, 12 * sz, 'rgba(255,255,255,.78)', 'left', 800);
  else if (it.times > 1) label(`×${it.times}`, tx + half - 4, cy, 12 * sz, '#fff', 'right', 900);
  // O que acontece
  const ex = tx + half + 2;
  label(TONE_MARK[it.tone] || '', ex + 6 * sz, cy + 1, 13 * sz, tone, 'center', 900);
  label(trim(`${it.icon ? it.icon + ' ' : ''}${it.eff}`, Math.max(8, Math.floor((x + w - ex - 16) / (7.4 * sz)))), ex + 15 * sz, cy + 1, 15 * sz, '#fff', 'left', 800);
}
function drawLegendList(items, x, y, w, rows, sz, head, pageKey) {
  const rh = Math.round(40 * sz), pages = Math.ceil(items.length / rows);
  const page = Math.floor(legendState.t / 7 + pageKey) % pages, show = items.slice(page * rows, page * rows + rows);
  const fade = pages > 1 ? clamp(Math.min((legendState.t % 7) * 3, (7 - (legendState.t % 7)) * 3), 0, 1) : 1;
  // Cabeçalho
  ctx.fillStyle = 'rgba(8,10,24,.86)'; ctx.beginPath(); ctx.roundRect(x, y, w, 28 * sz, 14 * sz); ctx.fill();
  label(head, x + 12, y + 14 * sz, 15 * sz, '#fff', 'left', 900, F_TITLE);
  if (pages > 1) label(`${page + 1}/${pages}`, x + w - 10, y + 14 * sz, 13 * sz, 'rgba(255,255,255,.7)', 'right', 800);
  ctx.save(); ctx.globalAlpha *= fade;
  show.forEach((it, i) => drawItemRow(it, x, y + 32 * sz + i * rh, w, rh, sz));
  ctx.restore();
}
function drawLegend(g) {
  const L = liveCfg.legend;
  if (!L.on || g.noLegend || g.s?.showLegend === false) return;
  const items = legendItems(g);
  if (!items.length) return;
  legendState.t += 1 / 60;
  // Jogos de tela cheia (quiz, palavras, votação): a lista aparece 15s a cada 45s para não cobrir as perguntas
  const pos0 = g.legendPos || LEGEND_POS[g.id] || {}, cycle = L.when === 'cycle' || (L.when !== 'always' && (pos0.cycle ?? CROWDED_GENRES.includes(g.genre)));
  let alpha = 1;
  if (cycle) { const c = (performance.now() / 1000) % 45; if (c > 15) return; alpha = clamp(Math.min(c * 2, (15 - c) * 2), 0, 1); }
  ctx.globalAlpha = alpha;
  const sz = clamp(Number(L.size) || 1, 0.7, 1.4), w = Math.round(310 * sz), rows = clamp(Math.round(L.rows) || 8, 3, 16);
  const pos = { side: 'left', y: CROWDED_GENRES.includes(g.genre) ? 720 : 250, ...pos0 };
  if (L.side === 'left' || L.side === 'right') pos.side = L.side;
  if (L.side === 'split') pos.split = true;
  ctx.save();
  if (pos.split && L.side !== 'left' && L.side !== 'right') {
    // Ajuda de um lado, atrapalha do outro
    const good = items.filter((it) => it.tone !== 'hurt'), bad = items.filter((it) => it.tone === 'hurt');
    const ws = Math.round(244 * sz);
    if (good.length) drawLegendList(good, 8, pos.y, ws, rows, sz * 0.9, '▲ AJUDA', 0);
    if (bad.length) drawLegendList(bad, W - 8 - ws, pos.y, ws, rows, sz * 0.9, '▼ ATRAPALHA', 0.5);
  } else {
    const x = pos.side === 'right' ? W - 8 - w : 8;
    drawLegendList(items, x, pos.y, w, rows, sz, '📋 COMO JOGAR', 0);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------- Aviso de cada ação: foto · ícone do presente ×quantidade → efeito ----------
const actFeed = {
  items: [],
  push(g, b, args, times) {
    if (!liveCfg.legend.feed || g !== current) return;
    const act = g.actions.find((a) => a.id === b.action);
    if (!act || act.hidden) return;
    const ev = args.ev || {}, gi = ev.type === 'gift' ? (ev.giftId ? giftInfo(ev.giftId) : null) : null;
    const it = {
      user: args.user, tone: actionTone(g, act), eff: act.label, icon: act.icon, times,
      img: ev.type === 'gift' ? ev.img || gi?.img || learnedGifts[ev.giftId] || '' : '',
      emoji: ev.type === 'gift' ? giftEmoji(gi?.en || ev.name) : TRIG_EMOJI[b.trigger] || '•',
      qty: ev.type === 'gift' ? ev.count || 1 : ev.type === 'like' ? ev.count || b.likes || 1 : 0,
      t: liveCfg.legend.feedSecs || 4.5, k: 0,
    };
    // Mesma pessoa, mesmo presente e mesmo efeito em sequência: soma no aviso que já está na tela
    const same = this.items.find((x) => x.user?.nick === it.user?.nick && x.eff === it.eff && x.emoji === it.emoji && x.img === it.img);
    if (same) { same.qty += it.qty; same.times += times; same.t = it.t; same.k = 0; return; }
    this.items.unshift(it);
    this.items.length = Math.min(this.items.length, 4);
  },
  update(dt) { for (const i of this.items) { i.t -= dt; i.k = Math.min(1, i.k + dt * 5); } this.items = this.items.filter((i) => i.t > 0); },
  draw() {
    if (!liveCfg.legend.feed || !this.items.length) return;
    const x2 = W - 10, w = 330, rh = 46;
    this.items.forEach((it, i) => {
      const y = 880 - i * (rh + 6), a = clamp(Math.min(it.t, 1), 0, 1), x = x2 - w + (1 - it.k) * 60;
      const tone = TONE_COLOR[it.tone];
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(8,10,24,.86)'; ctx.beginPath(); ctx.roundRect(x, y, w, rh, rh / 2); ctx.fill();
      ctx.strokeStyle = tone; ctx.lineWidth = 2.5; ctx.stroke();
      avatar(it.user || { nick: '?' }, x + 23, y + rh / 2, 17, tone);
      label(trim(it.user?.nick || '', 10), x + 46, y + 14, 12, 'rgba(255,255,255,.8)', 'left', 800);
      // ícone do presente/interação + quantidade
      const img = it.img ? getImg(proxImgUrl(it.img)) : null;
      if (img) ctx.drawImage(img, x + 46, y + 20, 22, 22); else label(it.emoji, x + 57, y + 32, 18, '#fff', 'center', 400);
      if (it.qty > 0) label(`×${fmtK(it.qty)}`, x + 71, y + 32, 15, '#ffe08a', 'left', 900);
      label('→', x + 122, y + rh / 2 + 1, 18, tone, 'center', 900);
      label(trim(`${it.icon ? it.icon + ' ' : ''}${it.eff}${it.times > 1 ? ` ×${it.times}` : ''}`, 22), x + 136, y + rh / 2 + 1, 15, '#fff', 'left', 900);
      ctx.restore();
    });
  },
};

// ---------- Gatilhos dos jogos clássicos ----------
// Os clássicos têm as regras dentro do jogo; aqui o dono ajusta quanto vale cada coisa (por jogo):
// quantos likes valem 1 moeda, quanto vale seguir/compartilhar, multiplicador dos presentes,
// presente específico com valor próprio e palavras no comentário que valem como presente.
const VALOR_PADRAO = { likes: 25, follow: SOCIAL_COINS.follow, share: SOCIAL_COINS.share, mult: 1, gifts: [], words: [] };
function valoresDe(g) { return { ...VALOR_PADRAO, ...(liveCfg.valores?.[g?.id] || {}) }; }
function valoresClassico(g, ev) {
  const v = valoresDe(g);
  if (ev.type === 'like') return v.likes > 0 ? [{ ...ev, count: Math.max(1, Math.round((ev.count || 1) * (25 / v.likes))) }] : [];
  if (ev.type === 'social') {
    const share = ev.action === 'share', n = Number(share ? v.share : v.follow), pad = share ? SOCIAL_COINS.share : SOCIAL_COINS.follow;
    if (!(n > 0)) return [];
    return n === pad ? [ev] : [{ type: 'gift', user: ev.user, name: share ? 'Compartilhar' : 'Seguir', giftId: 'social-' + ev.action, diamonds: n, count: 1, synthetic: true }];
  }
  if (ev.type === 'gift' && !ev.synthetic) {
    const r = (v.gifts || []).find((x) => (x.id && String(x.id) === String(ev.giftId)) || (x.name && norm(x.name) === norm(ev.name || '')));
    if (r && !(Number(r.coins) > 0)) return []; // valor 0 = esse presente não faz nada no jogo
    const d = r ? Number(r.coins) : (ev.diamonds || 1) * (Number(v.mult) || 1);
    return [{ ...ev, diamonds: Math.max(1, Math.round(d)) }];
  }
  if (ev.type === 'chat') {
    const out = [ev];
    for (const w of v.words || []) if (w.text && Number(w.coins) > 0 && keywordHit(ev.text, w.text)) out.push({ type: 'gift', user: ev.user, name: w.text, giftId: 'palavra', diamonds: Number(w.coins), count: 1, synthetic: true });
    return out;
  }
  return [ev];
}
// "Como jogar" dos clássicos com os valores escolhidos
const legendItemsBase = legendItems;
legendItems = function (g) {
  const items = legendItemsBase(g);
  if (g.v2 || g.legendItems) return items;
  const v = valoresDe(g), out = items.map((it) => (it.trig === 'like' ? { ...it, what: String(it.what).replace(/^\d+\s*likes?/i, `${v.likes} likes`) } : it));
  for (const r of v.gifts || []) if (r.name || r.id) { const gi = r.id ? giftInfo(r.id) : null; out.unshift({ img: gi?.img || '', emoji: giftEmoji(gi?.en || r.name || ''), what: gi?.name || r.name, coins: Number(r.coins) > 0 ? Number(r.coins) : undefined, eff: Number(r.coins) > 0 ? `vale ${r.coins} 🪙` : 'não conta', tone: Number(r.coins) > 0 ? 'help' : 'hurt', trig: 'gift' }); }
  for (const w of v.words || []) if (w.text && Number(w.coins) > 0) out.push({ emoji: '💬', what: `"${String(w.text).split(',')[0].trim()}"`, eff: `vale ${w.coins} 🪙`, tone: 'help', trig: 'comment' });
  return out;
};
