'use strict';

// Personagens 3D de verdade (GLB com esqueleto e animações) para os jogos.
// Modelos: KayKit Adventurers + Skeletons, de Kay Lousberg (CC0). Ficam em /assets/chars:
// cada personagem só com a malha (~0,3 MB) e um arquivo único com as animações compartilhadas.
// Tudo carrega sob demanda: nada é baixado até um jogo pedir um personagem.
//
// Peças:
//   Assets3D      carrega e guarda GLB (um download por arquivo, reaproveitado por todas as cópias)
//   CHARACTERS    catálogo de personagens (arquivo, acessórios, cor de destaque)
//   Character3D   um personagem na cena: animador de estados, placa com foto e nome, balão de fala, tinta do time
//   FX3D          partículas 3D com orçamento (faíscas, poeira, aura, anel de impacto, números de dano)
//   CamDirector   câmera com tremida, aproximação em momentos importantes e câmera lenta
//   hudFighter    barra de vida 2D com foto (HUD por cima da cena)

const CHARACTERS = {
  cavaleiro: { name: 'Cavaleiro', file: 'cavaleiro', accent: '#60a5fa', props: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword'], weapon: ['1H_Sword', 'Round_Shield'], special: ['2H_Sword'] },
  barbaro: { name: 'Bárbaro', file: 'barbaro', accent: '#f97316', props: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug'], weapon: ['1H_Axe', 'Barbarian_Round_Shield'], special: ['2H_Axe'] },
  maga: { name: 'Maga', file: 'maga', accent: '#a78bfa', props: ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'], weapon: ['1H_Wand', 'Spellbook'], special: ['2H_Staff'] },
  ladino: { name: 'Ladino', file: 'ladino', accent: '#34d399', props: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'], weapon: ['Knife', 'Knife_Offhand'], special: ['2H_Crossbow'] },
  encapuzado: { name: 'Encapuzado', file: 'encapuzado', accent: '#22d3ee', props: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'], weapon: ['Knife', 'Knife_Offhand'], special: ['1H_Crossbow'] },
  esqueleto: { name: 'Esqueleto', file: 'esqueleto', accent: '#e5e7eb', props: [], weapon: [], special: [], undead: true },
  esq_guerreiro: { name: 'Esqueleto Guerreiro', file: 'esq_guerreiro', accent: '#fbbf24', props: [], weapon: [], special: [], undead: true },
  esq_mago: { name: 'Esqueleto Mago', file: 'esq_mago', accent: '#c084fc', props: [], weapon: [], special: [], undead: true },
  esq_ladino: { name: 'Esqueleto Ladino', file: 'esq_ladino', accent: '#94a3b8', props: [], weapon: [], special: [], undead: true },
  // Pacote enviado pelo dono (Poly Pizza). family 'quat': animações próprias no arquivo (Quaternius);
  // family 'static': modelo sem esqueleto, animado por movimento procedural (pulo, inclinação, giro, amassar e esticar).
  aventureiro: { name: 'Aventureiro', file: 'aventureiro', family: 'quat', accent: '#4ade80', props: [], weapon: [], special: [] },
  swat: { name: 'Agente', file: 'swat', family: 'quat', accent: '#60a5fa', props: [], weapon: [], special: [] },
  astronauta: { name: 'Astronauta', file: 'astronauta', family: 'quat', accent: '#e2e8f0', props: [], weapon: [], special: [] },
  cactoro: { name: 'Cactoro', file: 'cactoro', family: 'quat', accent: '#22c55e', props: [], weapon: [], special: [] },
  sapo: { name: 'Sapo', file: 'sapo', family: 'quat', accent: '#84cc16', props: [], weapon: [], special: [] },
  observador: { name: 'Olhão', file: 'observador', family: 'static', yaw: -Math.PI / 2, accent: '#f472b6', props: [], weapon: [], special: [] },
  robo: { name: 'Robô', file: 'robo', family: 'static', yaw: -Math.PI / 2, accent: '#38bdf8', props: [], weapon: [], special: [] },
  super_robo: { name: 'Super Robô', file: 'super_robo', family: 'static', accent: '#f97316', props: [], weapon: [], special: [] },
  orangotango: { name: 'Orangotango', file: 'orangotango', family: 'static', yaw: Math.PI, accent: '#ea580c', props: [], weapon: [], special: [] },
  soldado: { name: 'Soldado', file: 'soldado', family: 'static', accent: '#a3a3a3', props: [], weapon: [], special: [] },
  // Segundo pacote do dono (Poly Pizza)
  touro: { name: 'Touro', file: 'touro', family: 'quat', accent: '#b45309', props: [], weapon: [], special: [] },
  demonio: { name: 'Demônio', file: 'demonio', family: 'quat', accent: '#ef4444', props: [], weapon: [], special: [] },
  dragao_evoluido: { name: 'Dragão Evoluído', file: 'dragao_evoluido', family: 'quat', accent: '#a855f7', props: [], weapon: [], special: [] },
  mech: { name: 'Mech', file: 'mech', family: 'quat', accent: '#f59e0b', props: [], weapon: [], special: [] },
  caveira: { name: 'Caveira', file: 'caveira', family: 'quat', accent: '#e5e7eb', props: [], weapon: [], special: [] },
  cachorro: { name: 'Cachorro', file: 'cachorro', family: 'static', accent: '#d97706', props: [], weapon: [], special: [] },
  zumbi: { name: 'Zumbi', file: 'zumbi', family: 'static', accent: '#65a30d', props: [], weapon: [], special: [] },
  alien: { name: 'Alien', file: 'alien', family: 'static', yaw: -Math.PI / 2, accent: '#22c55e', props: [], weapon: [], special: [] },
  esqueleto_alien: { name: 'Esqueleto Alien', file: 'esqueleto_alien', family: 'static', yaw: -Math.PI / 2, accent: '#a3e635', props: [], weapon: [], special: [] },
  explorador: { name: 'Explorador', file: 'explorador', family: 'static', accent: '#ca8a04', props: [], weapon: [], special: [] },
  astronauta_retro: { name: 'Astronauta Retrô', file: 'astronauta_retro', family: 'static', accent: '#f8fafc', props: [], weapon: [], special: [] },
  cenoura: { name: 'Cenoura', file: 'cenoura', family: 'static', yaw: -Math.PI / 2, accent: '#f97316', props: [], weapon: [], special: [] },
  banana: { name: 'Banana', file: 'banana', family: 'static', yaw: -Math.PI / 2, accent: '#facc15', props: [], weapon: [], special: [] },
  olho_invocador: { name: 'Olho Invocador', file: 'olho_invocador', family: 'static', yaw: -Math.PI / 2, accent: '#8b5cf6', props: [], weapon: [], special: [] },
  olho_mago: { name: 'Olho Mago', file: 'olho_mago', family: 'static', yaw: -Math.PI / 2, accent: '#6366f1', props: [], weapon: [], special: [] },
  lalobot: { name: 'Lalobot', file: 'lalobot', family: 'static', yaw: -Math.PI / 2, accent: '#06b6d4', props: [], weapon: [], special: [] },
  esqueletinho: { name: 'Esqueletinho', file: 'esqueletinho', family: 'static', yaw: -Math.PI / 2, accent: '#cbd5e1', props: [], weapon: [], special: [] },
  fantasia_esqueleto: { name: 'Fantasia de Esqueleto', file: 'fantasia_esqueleto', family: 'static', yaw: -Math.PI / 2, accent: '#94a3b8', props: [], weapon: [], special: [] },
  dragao: { name: 'Dragão', file: 'dragao', family: 'static', accent: '#dc2626', props: [], weapon: [], special: [] },
  robo_articulado: { name: 'Robô Articulado', file: 'robo_articulado', family: 'static', accent: '#64748b', props: [], weapon: [], special: [] },
  mech_andador: { name: 'Mech Andador', file: 'mech_andador', family: 'static', accent: '#78716c', props: [], weapon: [], special: [] },
  mech_aranha: { name: 'Mech Aranha', file: 'mech_aranha', family: 'static', accent: '#57534e', props: [], weapon: [], special: [] },
};
const KAYKIT_HEROES = ['cavaleiro', 'barbaro', 'maga', 'ladino', 'encapuzado'];
const PACK_KINDS = ['aventureiro', 'swat', 'astronauta', 'cactoro', 'sapo', 'observador', 'robo', 'super_robo', 'orangotango', 'soldado'];
const PACK2_KINDS = ['touro', 'demonio', 'dragao_evoluido', 'mech', 'caveira', 'cachorro', 'zumbi', 'alien', 'esqueleto_alien', 'explorador', 'astronauta_retro', 'cenoura', 'banana', 'olho_invocador', 'olho_mago', 'lalobot', 'esqueletinho', 'fantasia_esqueleto', 'dragao', 'robo_articulado', 'mech_andador', 'mech_aranha'];
const ALL_KINDS = Object.keys(CHARACTERS).filter((k) => !CHARACTERS[k].undead);
// Personagens ativos (escolhidos no painel em 🧍 Personagens). Os jogos usam esta lista; ela muda ao vivo.
// Padrão: todos à disposição em todos os jogos.
const HERO_KINDS = [...ALL_KINDS];
const CHAR_DEFAULTS = { enabled: [...ALL_KINDS], viewerPick: true, fixed: '', known: [...ALL_KINDS] };
function charCfg() {
  const c = { ...CHAR_DEFAULTS, ...(typeof liveCfg !== 'undefined' && liveCfg.chars || {}) };
  // Personagem novo (que ainda não existia quando a lista foi salva) já entra ativo
  const known = new Set(c.known || PACK_KINDS);
  const fresh = ALL_KINDS.filter((k) => !known.has(k));
  if (fresh.length) c.enabled = [...new Set([...c.enabled, ...fresh])];
  c.known = [...ALL_KINDS];
  return c;
}
function applyRoster() {
  const c = charCfg(), on = c.enabled.filter((k) => CHARACTERS[k] && !CHARACTERS[k].undead);
  HERO_KINDS.splice(0, HERO_KINDS.length, ...(c.fixed && CHARACTERS[c.fixed] ? [c.fixed] : on.length ? on : PACK_KINDS));
}
applyRoster();
// Configuração "Personagem" para qualquer jogo: vazio = automático (um dos ativos no painel).
function charSetting(key, label, group = 'Personagens') {
  return { key, type: 'select', label, group, default: '', options: [['', 'Automático (dos ativos no painel)'], ...ALL_KINDS.map((k) => [k, CHARACTERS[k].name])] };
}
// Automático: sorteio fixo por jogo (seed = id do jogo), para cada jogo ter a sua cara e não repetir sempre os mesmos.
function pickKind(choice, i = 0, seed = current?.id || '') {
  if (choice && CHARACTERS[choice]) return choice;
  if (!HERO_KINDS.length) return 'sapo';
  let h = 0; for (const c of String(seed)) h = (h * 131 + c.charCodeAt(0)) >>> 0;
  return HERO_KINDS[(h + i * 7) % HERO_KINDS.length];
}
// Acrescenta configurações a um jogo já registrado (os *3d.js que melhoram jogos antigos)
function addSettings(g, list) { const at = g.settings.findIndex((x) => x.key === 'whoCanPlay'); g.settings.splice(at < 0 ? g.settings.length : at, 0, ...list); g.s = loadSettings(g); }

// Espectador escolhe o próprio personagem pelo chat: "!sapo", "!robô", "personagem astronauta".
const CHAR_PICKS = new Map();
const charKeyOf = (u) => String(u?.id || u?.nick || '?');
function charByName(txt) {
  const flat = (x) => norm(x).replace(/[\s_-]+/g, ''), n = flat(txt);
  return Object.keys(CHARACTERS).find((k) => !CHARACTERS[k].undead && (flat(CHARACTERS[k].name) === n || flat(k) === n));
}
function charPickFromChat(ev) {
  if (ev.type !== 'chat' || !charCfg().viewerPick) return null;
  const m = String(ev.text || '').trim().match(/^(?:!|personagem\s+|boneco\s+|skin\s+)(.{2,24})$/i);
  const k = m && charByName(m[1]);
  if (!k || !HERO_KINDS.includes(k)) return null;
  CHAR_PICKS.set(charKeyOf(ev.user), k);
  return k;
}
// Monstros para os bots de demonstração: os esqueletos clássicos e os monstros do segundo pacote
const UNDEAD_KINDS = ['esqueleto', 'esq_guerreiro', 'esq_mago', 'esq_ladino', 'zumbi', 'caveira', 'esqueletinho', 'esqueleto_alien'];
// Mesmo espectador, mesmo personagem (em todas as telas e jogos).
function kindFor(user, list = HERO_KINDS) {
  if (list === HERO_KINDS) { const pk = CHAR_PICKS.get(charKeyOf(user)); if (pk && HERO_KINDS.includes(pk)) return pk; }
  let h = 0; for (const c of String(user?.id || user?.nick || '?')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

// Estados do animador → clipes do arquivo de animações. Listas = variações sorteadas.
const ANIM = {
  idle: ['Idle'], fightIdle: ['Idle_Combat', 'Unarmed_Idle'], walk: ['Walking_A'], walkBack: ['Walking_Backwards'], run: ['Running_A'], strafeL: ['Running_Strafe_Left'], strafeR: ['Running_Strafe_Right'],
  punch: ['Unarmed_Melee_Attack_Punch_A', 'Unarmed_Melee_Attack_Punch_B'], kick: ['Unarmed_Melee_Attack_Kick'],
  slash: ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Chop'], stab: ['1H_Melee_Attack_Stab'], jumpAttack: ['1H_Melee_Attack_Jump_Chop'], spin: ['2H_Melee_Attack_Spin'], heavy: ['2H_Melee_Attack_Chop'],
  block: ['Block'], blocking: ['Blocking'], blockHit: ['Block_Hit'], blockAttack: ['Block_Attack'],
  dodge: ['Dodge_Backward'], dodgeL: ['Dodge_Left'], dodgeR: ['Dodge_Right'], dodgeF: ['Dodge_Forward'],
  hit: ['Hit_A', 'Hit_B'], death: ['Death_A', 'Death_B'], deadPose: ['Death_A_Pose'],
  victory: ['Cheer'], taunt: ['Taunt', 'Taunt_Longer'], jump: ['Jump_Full_Short'], jumpLong: ['Jump_Full_Long'], spawn: ['Spawn_Ground'], spawnAir: ['Spawn_Air'],
  cast: ['Spellcast_Shoot'], powerUp: ['Spellcast_Raise'], channel: ['Spellcast_Long'], throw: ['Throw'], interact: ['Interact'], use: ['Use_Item'], pickup: ['PickUp'],
  sit: ['Sit_Floor_Idle'], standUp: ['Lie_StandUp'], shoot: ['1H_Ranged_Shoot'],
};
// Mesmos estados para os personagens Quaternius (nomes de clipe sem o prefixo "CharacterArmature|").
const QUAT_ANIM = {
  idle: ['Idle', 'Idle_Neutral', 'Flying_Idle', 'Idle_2'], fightIdle: ['Idle_Sword', 'Idle', 'Idle_Neutral', 'Flying_Idle'], walk: ['Walk', 'Flying_Idle'], walkBack: ['Run_Back', 'Walk', 'Flying_Idle'], run: ['Run', 'Gallop', 'Fast_Flying'], strafeL: ['Run_Left', 'Run', 'Gallop', 'Fast_Flying'], strafeR: ['Run_Right', 'Run', 'Gallop', 'Fast_Flying'],
  punch: ['Punch_Left', 'Punch_Right', 'Punch', 'Attack', 'Headbutt', 'Attack_Headbutt'], kick: ['Kick_Left', 'Kick_Right', 'Kick', 'Attack_Kick'], slash: ['Sword_Slash', 'Punch_Right', 'Attack', 'Headbutt', 'Attack_Headbutt'], stab: ['Punch_Right', 'Punch', 'Attack', 'Headbutt'], jumpAttack: ['Sword_Slash', 'Kick_Right', 'Attack_Kick', 'Headbutt'], spin: ['Roll', 'Jump', 'Gallop_Jump'], heavy: ['Sword_Slash', 'Kick_Left', 'Attack_Headbutt', 'Shoot_Big', 'Attack'],
  block: ['Duck', 'HitRecieve_2', 'HitReact', 'No'], blocking: ['Duck', 'Idle'], blockHit: ['HitRecieve_2', 'HitRecieve', 'HitRecieve_1', 'HitReact', 'Idle_HitReact_Left'], blockAttack: ['Punch_Left', 'Punch', 'Attack'],
  dodge: ['Roll', 'Duck', 'Jump_NoHeight', 'No'], dodgeL: ['Roll', 'Duck', 'Idle_HitReact_Left', 'No'], dodgeR: ['Roll', 'Duck', 'Idle_HitReact_Right', 'No'], dodgeF: ['Roll', 'Jump', 'Gallop_Jump'],
  hit: ['HitRecieve', 'HitRecieve_2', 'HitRecieve_1', 'HitReact', 'Idle_HitReact_Left', 'Idle_HitReact_Right'], death: ['Death'], deadPose: ['Death'],
  victory: ['Wave', 'Yes', 'Dance', 'Hello'], taunt: ['Yes', 'Wave', 'No', 'Dance'], jump: ['Jump', 'Roll', 'Gallop_Jump', 'Jump_NoHeight'], jumpLong: ['Jump', 'Roll', 'Gallop_Jump'], spawn: ['Wave', 'Yes', 'Hello'], spawnAir: ['Jump_Land', 'Jump_Landing', 'Jump_toIdle', 'Jump', 'Wave', 'Yes'],
  cast: ['Gun_Shoot', 'Weapon', 'Shoot_Big', 'Shoot_Small', 'Punch_Right', 'Attack', 'Headbutt'], powerUp: ['Yes', 'Wave', 'Interact', 'Dance', 'Hello'], channel: ['Interact', 'Idle', 'Flying_Idle'], throw: ['Punch_Right', 'Punch', 'Weapon', 'Shoot_Small', 'Attack'], interact: ['Interact', 'Yes', 'Pickup', 'Eating'], use: ['Interact', 'Yes', 'Pickup'], pickup: ['Interact', 'Duck', 'Pickup', 'Eating'],
  sit: ['Duck', 'Idle', 'Idle_Headlow', 'Eating'], standUp: ['Jump_Land', 'Jump_Landing', 'Jump_toIdle', 'Idle'], shoot: ['Gun_Shoot', 'Weapon', 'Shoot_Small', 'Shoot_Big', 'Punch', 'Attack'],
};
// Duração (s) dos estados quando o personagem não tem esqueleto (movimento procedural).
const PROC_DUR = { jump: 0.55, jumpLong: 0.75, punch: 0.45, kick: 0.5, slash: 0.5, stab: 0.45, jumpAttack: 0.7, spin: 0.7, heavy: 0.65, cast: 0.6, shoot: 0.4, throw: 0.5, hit: 0.4, blockHit: 0.35, block: 0.5, dodge: 0.5, dodgeL: 0.5, dodgeR: 0.5, dodgeF: 0.5, death: 0.9, victory: 1.3, taunt: 1.1, powerUp: 1, spawn: 0.8, spawnAir: 0.7, interact: 0.7, use: 0.7, pickup: 0.6, standUp: 0.6 };

// Estados que repetem (os outros tocam uma vez e voltam para o estado base).
const LOOPS = new Set(['idle', 'fightIdle', 'walk', 'walkBack', 'run', 'strafeL', 'strafeR', 'blocking', 'sit', 'channel']);
// Momento do golpe (fração do clipe) para o dano sair junto com a animação.
const IMPACT_AT = { punch: 0.42, kick: 0.45, slash: 0.45, stab: 0.5, jumpAttack: 0.55, spin: 0.5, heavy: 0.55, cast: 0.5, throw: 0.5, shoot: 0.35, blockAttack: 0.5 };
const REDUCED_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const Assets3D = {
  base: '/assets/chars/',
  cache: new Map(),
  loaderP: null,
  failed: new Set(),
  get THREE() { return THREE; },
  async modules() {
    if (!this.loaderP) {
      this.loaderP = three3dReady.then(() => Promise.all([import('/vendor/jsm/loaders/GLTFLoader.js'), import('/vendor/jsm/utils/SkeletonUtils.js')]))
        .then(([L, S]) => ({ loader: new L.GLTFLoader(), clone: S.clone }));
      this.loaderP.catch(() => { this.loaderP = null; });
    }
    return this.loaderP;
  },
  // Um GLB (cacheado). Falha → rejeita; quem chamou usa o reserva.
  load(file) {
    if (!this.cache.has(file)) {
      const p = this.modules().then(({ loader }) => loader.loadAsync(this.base + file + '.glb'));
      p.catch((err) => { console.warn('modelo 3D não carregou:', file, err?.message || err); this.cache.delete(file); this.failed.add(file); });
      this.cache.set(file, p);
    }
    return this.cache.get(file);
  },
  anims() {
    if (!this.animP) {
      this.animP = this.load('animacoes').then((g) => {
        const map = new Map();
        for (const c of g.animations) map.set(c.name, c);
        return map;
      });
      this.animP.catch(() => { this.animP = null; });
    }
    return this.animP;
  },
  // Pré-carrega os personagens de um jogo (chame no enter() do jogo).
  preload(kinds) { this.anims().catch(() => {}); for (const k of kinds) this.load(CHARACTERS[k]?.file || k).catch(() => {}); },
  status() { return { loaded: [...this.cache.keys()], failed: [...this.failed] }; },
};

// ---------- Texturas pequenas compartilhadas ----------
const Tex3D = {
  _c: {},
  get(name, draw, size = 64) {
    if (this._c[name]) return this._c[name];
    const c = document.createElement('canvas'); c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return (this._c[name] = t);
  },
  spark() { return this.get('spark', (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.85)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); }); },
  smoke() { return this.get('smoke', (g, s) => { for (let i = 0; i < 6; i++) { const x = s / 2 + Math.cos(i) * s * 0.12, y = s / 2 + Math.sin(i * 1.7) * s * 0.12; const r = g.createRadialGradient(x, y, 0, x, y, s * 0.4); r.addColorStop(0, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); } }, 128); },
  ring() { return this.get('ring', (g, s) => { g.strokeStyle = '#fff'; g.lineWidth = s * 0.06; g.shadowColor = '#fff'; g.shadowBlur = s * 0.08; g.beginPath(); g.arc(s / 2, s / 2, s * 0.4, 0, 7); g.stroke(); }, 256); },
  star() { return this.get('star', (g, s) => { g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.2 : s * 0.48; g.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r); } g.fill(); }); },
  shadow() { return this.get('shadow', (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); }, 128); },
};

// ---------- Placa com foto e nome (fica sempre virada para a câmera) ----------
function makeNameplate(user, accent) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 176;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  sp.renderOrder = 30; sp.center.set(0.5, 0);
  const st = { img: null, hp: null, crown: false, tag: '' };
  const draw = () => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, 512, 176);
    const nick = trim(user?.nick || '?', 16);
    g.font = '800 44px Barlow, sans-serif';
    const tw = Math.min(330, g.measureText(nick).width);
    const w = tw + 150, x0 = 256 - w / 2;
    // Cápsula
    g.fillStyle = 'rgba(10,12,24,.82)'; g.beginPath(); g.roundRect(x0, 40, w, 92, 46); g.fill();
    g.lineWidth = 5; g.strokeStyle = accent; g.stroke();
    // Foto (ou inicial) num círculo com moldura
    const cx = x0 + 50, cy = 86, r = 40;
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip();
    if (st.img) { const s = Math.min(st.img.naturalWidth, st.img.naturalHeight); g.drawImage(st.img, (st.img.naturalWidth - s) / 2, (st.img.naturalHeight - s) / 2, s, s, cx - r, cy - r, r * 2, r * 2); }
    else { g.fillStyle = colorFor(user?.id || user?.nick || '?'); g.fillRect(cx - r, cy - r, r * 2, r * 2); g.fillStyle = '#fff'; g.font = '900 44px Barlow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(initialOf(user), cx, cy + 2); }
    g.restore();
    g.lineWidth = 5; g.strokeStyle = '#fff'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    g.fillStyle = '#fff'; g.font = '800 44px Barlow, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(nick, x0 + 104, st.hp === null ? 88 : 76, tw);
    if (st.hp !== null) {
      const bx = x0 + 104, bw = w - 130;
      g.fillStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.roundRect(bx, 100, bw, 14, 7); g.fill();
      g.fillStyle = st.hp > 0.4 ? '#22c55e' : st.hp > 0.2 ? '#f59e0b' : '#ef4444'; g.beginPath(); g.roundRect(bx, 100, Math.max(8, bw * clamp(st.hp, 0, 1)), 14, 7); g.fill();
    }
    if (st.crown) { g.fillStyle = '#fbbf24'; g.beginPath(); g.moveTo(cx - 30, 30); g.lineTo(cx - 30, 4); g.lineTo(cx - 15, 18); g.lineTo(cx, 0); g.lineTo(cx + 15, 18); g.lineTo(cx + 30, 4); g.lineTo(cx + 30, 30); g.closePath(); g.fill(); g.strokeStyle = '#78350f'; g.lineWidth = 3; g.stroke(); }
    if (st.tag) { g.font = '900 26px Barlow, sans-serif'; const tw2 = g.measureText(st.tag).width + 28; g.fillStyle = accent; g.beginPath(); g.roundRect(256 - tw2 / 2, 138, tw2, 34, 17); g.fill(); g.fillStyle = '#0b1020'; g.textAlign = 'center'; g.fillText(st.tag, 256, 156); }
    t.needsUpdate = true;
  };
  draw();
  loadUserImg(user, (img) => { st.img = img; draw(); });
  sp.userData = {
    setHp(f) { const v = f === null ? null : Math.round(clamp(f, 0, 1) * 50) / 50; if (v !== st.hp) { st.hp = v; draw(); } },
    setCrown(on) { if (on !== st.crown) { st.crown = on; draw(); } },
    setTag(s) { if (s !== st.tag) { st.tag = s; draw(); } },
  };
  return sp;
}

// Balão de fala/reação acima da cabeça (comentário da pessoa, "!" quando apanha, coração com like…).
function makeBubble() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 192;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, opacity: 0 }));
  sp.renderOrder = 31; sp.center.set(0.5, 0);
  sp.userData.show = (txt, { color = '#ffffff', ink = '#0b1020', secs = 3 } = {}) => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, 512, 192);
    g.font = '800 38px Barlow, sans-serif';
    const lines = []; let line = '';
    for (const w of String(txt).slice(0, 90).split(/\s+/)) { const tt = line ? line + ' ' + w : w; if (g.measureText(tt).width > 440 && line) { lines.push(line); line = w; } else line = tt; }
    lines.push(line);
    const L = lines.slice(0, 2), bw = Math.min(480, Math.max(...L.map((l) => g.measureText(l).width)) + 44), bh = 30 + L.length * 44;
    const x0 = 256 - bw / 2, y0 = 160 - bh;
    g.fillStyle = color; g.beginPath(); g.roundRect(x0, y0, bw, bh, 26); g.fill();
    g.beginPath(); g.moveTo(236, 158); g.lineTo(256, 186); g.lineTo(276, 158); g.fill();
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    L.forEach((l, i) => g.fillText(l, 256, y0 + 37 + i * 44, 440));
    t.needsUpdate = true;
    sp.userData.t = secs; sp.userData.total = secs;
  };
  sp.userData.t = 0;
  sp.userData.tick = (dt) => {
    const d = sp.userData;
    if (d.t <= 0) { sp.material.opacity = 0; return; }
    d.t -= dt;
    const k = Math.min(1, (d.total - d.t) * 6, d.t * 3);
    sp.material.opacity = clamp(k, 0, 1);
    const s = 0.85 + 0.15 * clamp(k, 0, 1);
    sp.scale.set(sp.userData.w * s, sp.userData.w * s * 192 / 512, 1);
  };
  return sp;
}

// ---------- Personagem ----------
class Character3D {
  // kind: chave de CHARACTERS · user: espectador (foto e nome na placa) · loadout: 'none' | 'weapon' | 'special'
  // height: altura em unidades da cena · tint: cor da capa/time · plate: mostra a placa
  constructor({ kind = 'cavaleiro', user = null, loadout = 'none', height = 2, tint = null, plate = true, hp = false, base = 'idle' } = {}) {
    this.kind = CHARACTERS[kind] ? kind : 'cavaleiro';
    this.def = CHARACTERS[this.kind];
    this.user = user; this.loadoutName = loadout; this.height = height; this.tint = tint;
    this.base = base; this.state = null; this.ready = false; this.failed = false; this.disposed = false;
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    this.timeScale = 1;
    this.pending = [];
    this.events = [];
    this.flash = 0;
    // Sombra suave no chão (barata e funciona mesmo sem sombra em tempo real).
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: Tex3D.shadow(), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; sh.scale.setScalar(height * 0.75); sh.renderOrder = 1;
    this.root.add(sh); this.shadow = sh;
    // Anel do time no chão (os personagens sem capa também ficam identificados pela cor)
    if (tint) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(height * 0.3, height * 0.38, 32), new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.renderOrder = 2; this.root.add(ring); this.ring = ring;
    }
    // Enquanto carrega: silhueta pulsando (estado de carregamento visível).
    this.placeholder = new THREE.Mesh(new THREE.CapsuleGeometry(height * 0.22, height * 0.5, 4, 10), new THREE.MeshStandardMaterial({ color: tint || this.def.accent, transparent: true, opacity: 0.35, roughness: 0.4 }));
    this.placeholder.position.y = height * 0.5; this.body.add(this.placeholder);
    if (plate && user) { this.plate = makeNameplate(user, tint || this.def.accent); this.plate.position.y = height * 1.12; this.plate.scale.set(height * 0.95, height * 0.95 * 176 / 512, 1); this.root.add(this.plate); }
    if (hp && this.plate) this.plate.userData.setHp(1);
    this.bubble = makeBubble(); this.bubble.userData.w = height * 1.25; this.bubble.position.y = height * (plate && user ? 1.48 : 1.2); this.root.add(this.bubble);
    this.load();
  }
  async load() {
    try {
      const fam = this.def.family || 'kaykit';
      const [{ clone }, gltf, shared] = await Promise.all([Assets3D.modules(), Assets3D.load(this.def.file), fam === 'kaykit' ? Assets3D.anims() : null]);
      if (this.disposed) return;
      const model = clone(gltf.scene);
      // Escala pela altura real do modelo e pés no chão (calculado uma vez por tipo).
      if (!gltf.userData.h) { const b = new THREE.Box3().setFromObject(gltf.scene); gltf.userData.h = b.max.y - b.min.y || 2.4; gltf.userData.minY = b.min.y; }
      const sc = this.height / gltf.userData.h;
      model.scale.multiplyScalar(sc);
      model.position.y -= (gltf.userData.minY || 0) * sc;
      let clips = shared;
      if (fam === 'quat') {
        if (!gltf.userData.clips) { gltf.userData.clips = new Map(); for (const c of gltf.animations) gltf.userData.clips.set(c.name.split('|').pop(), c); }
        clips = gltf.userData.clips;
      }
      this.animMap = fam === 'quat' ? QUAT_ANIM : ANIM;
      this.staticMode = fam === 'static';
      this.mats = [];
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false;
        // Material próprio de cada cópia: permite piscar no dano e pintar a capa do time.
        o.material = o.material.clone();
        o.material.emissive = new THREE.Color(0x000000);
        if (/Cape|Cloak/.test(o.name)) { (this.capeMats ||= []).push(o.material); if (this.tint) o.material.color.set(this.tint); }
        this.mats.push(o.material);
      });
      this.model = model;
      this.setLoadout(this.loadoutName);
      this.body.remove(this.placeholder); this.placeholder.geometry.dispose(); this.placeholder.material.dispose(); this.placeholder = null;
      // Pivô: recebe o giro de frente do modelo e o movimento procedural dos personagens sem esqueleto.
      this.pivot = new THREE.Group(); this.pivot.add(model); this.pivot.rotation.y = this.def.yaw || 0;
      this.body.add(this.pivot);
      if (!this.staticMode) {
        this.mixer = new THREE.AnimationMixer(model);
        this.clips = clips;
        this.actions = new Map();
        this.mixer.addEventListener('finished', (e) => this.onFinished(e.action));
      }
      this.ready = true;
      this.play(this.base);
      for (const p of this.pending.splice(0)) this.play(p[0], p[1]);
    } catch (err) {
      if (this.disposed) return;
      this.failed = true;
      this.useFallback();
    }
  }
  // Reserva: boneco articulado procedural do próprio projeto, com poses para os mesmos estados.
  useFallback() {
    if (this.placeholder) { this.body.remove(this.placeholder); this.placeholder = null; }
    const rig = makeHuman({ color: this.tint || this.def.accent, photo: this.user || '', seed: this.user?.nick || this.kind, gloves: true });
    rig.root.scale.setScalar(this.height / 2.9);
    this.body.add(rig.root);
    this.rig = rig;
    this.mats = [];
    rig.root.traverse((o) => { if (o.isMesh && o.material?.emissive) this.mats.push(o.material); });
    this.ready = true;
    this.play(this.base);
  }
  setLoadout(name) {
    this.loadoutName = name;
    if (!this.model) return;
    const show = new Set(name === 'special' ? this.def.special : name === 'weapon' ? this.def.weapon : []);
    this.model.traverse((o) => { if (this.def.props.includes(o.name)) o.visible = show.has(o.name); });
  }
  clipFor(state) {
    const names = (this.animMap || ANIM)[state] || [state];
    const ok = names.filter((n) => this.clips?.has(n));
    return ok.length ? this.clips.get(ok[Math.floor(Math.random() * ok.length)]) : null;
  }
  // Toca um estado. Opções: onImpact (no momento do golpe), then (estado seguinte), speed, hold (fica no último quadro), fade.
  play(state, opts = {}) {
    if (this.disposed) return;
    if (!this.ready) { if (LOOPS.has(state)) this.base = state; else this.pending.push([state, opts]); return; }
    if (LOOPS.has(state) && !opts.once) this.base = state;
    this.state = state;
    this.stateT = 0;
    this.onImpact = opts.onImpact || null;
    this.impactAt = opts.impactAt ?? IMPACT_AT[state] ?? 0.5;
    this.impactDone = !this.onImpact;
    this.then = opts.then || null;
    this.hold = Boolean(opts.hold);
    if (this.rig || this.staticMode) { this.fbDur = (opts.dur || (LOOPS.has(state) ? Infinity : PROC_DUR[state] || 0.6)) / (this.staticMode ? opts.speed || 1 : 1); return; }
    const clip = this.clipFor(state);
    if (!clip) { if (this.onImpact) { this.onImpact(); this.impactDone = true; } return; }
    let a = this.actions.get(clip.name);
    if (!a) { a = this.mixer.clipAction(clip); this.actions.set(clip.name, a); }
    const loop = LOOPS.has(state);
    a.reset();
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    a.clampWhenFinished = !loop;
    a.timeScale = opts.speed || 1;
    a.setEffectiveWeight(1);
    const fade = opts.fade ?? (loop ? 0.25 : 0.12);
    if (this.cur && this.cur !== a) { a.play(); this.cur.crossFadeTo(a, fade, false); } else a.fadeIn(fade).play();
    this.cur = a;
    this.curDur = clip.duration / (opts.speed || 1);
  }
  onFinished(action) {
    if (action !== this.cur || this.hold) return;
    const next = this.then; this.then = null;
    if (next) this.play(next); else this.play(this.base);
  }
  get proc() { return Boolean(this.rig || this.staticMode); }
  get busy() { return this.state && !LOOPS.has(this.state) && !this.hold && (this.proc ? this.stateT < this.fbDur : this.cur?.isRunning()); }
  // Reações visuais
  say(text, o) { this.bubble.userData.show(text, o); }
  hitFlash(color = 0xffffff, k = 1) { this.flash = k; this.flashColor = new THREE.Color(color); }
  // Troca a cor da capa/roupa do time (ex.: "trocar roupa" na pista de dança)
  setTint(c) { this.tint = c; for (const m of this.capeMats || []) m.color.set(c); this.ring?.material.color.set(c); }
  setHp(f) { this.plate?.userData.setHp(f); }
  setCrown(on) { this.plate?.userData.setCrown(on); }
  setTag(s) { this.plate?.userData.setTag(s); }
  faceTo(x, z) { this.root.rotation.y = Math.atan2(x - this.root.position.x, z - this.root.position.z); }
  update(dt) {
    if (this.disposed) return;
    const d = dt * this.timeScale;
    this.stateT = (this.stateT || 0) + d;
    if (this.mixer) this.mixer.update(d);
    else if (this.rig) this.fallbackPose();
    else if (this.staticMode) this.staticPose();
    // Golpe no tempo certo da animação
    if (!this.impactDone && this.state) {
      const dur = this.proc ? this.fbDur : this.curDur || 0.6;
      if (this.stateT >= dur * this.impactAt) { this.impactDone = true; const f = this.onImpact; this.onImpact = null; f?.(); }
    }
    if (this.proc && !LOOPS.has(this.state) && !this.hold && this.stateT >= this.fbDur) { const next = this.then; this.then = null; this.play(next || this.base); }
    if (this.placeholder) { const k = 0.25 + 0.15 * Math.sin(performance.now() / 180); this.placeholder.material.opacity = k; }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 5);
      for (const m of this.mats || []) { m.emissive.copy(this.flashColor).multiplyScalar(this.flash * 0.9); }
    }
    this.bubble.userData.tick(dt);
  }
  // Personagem sem esqueleto: o corpo inteiro se mexe (pula, inclina, gira, amassa e estica) conforme o estado.
  staticPose() {
    const p = this.pivot, t = this.stateT, s = this.state, D = this.fbDur, h = this.height;
    const k = D === Infinity ? 0 : clamp(t / D, 0, 1), hk = Math.sin(k * Math.PI), now = performance.now() / 1000 + this.root.id;
    let x = 0, y = 0, z = 0, rx = 0, ry = this.def.yaw || 0, rz = 0, sy = 1;
    if (s === 'walk' || s === 'run' || s === 'strafeL' || s === 'strafeR' || s === 'walkBack') { const f = s === 'walk' ? 8 : 12, ph = Math.abs(Math.sin(now * f)); y = ph * 0.13 * h; rz = Math.sin(now * f) * 0.09; rx = 0.12; sy = 0.92 + ph * 0.12; }
    else if (['punch', 'slash', 'stab', 'cast', 'heavy', 'shoot', 'throw', 'blockAttack'].includes(s)) { z = hk * 0.3 * h; rx = 0.35 * hk; sy = 1 - 0.08 * hk; }
    else if (s === 'kick' || s === 'jumpAttack') { y = hk * 0.35 * h; z = hk * 0.25 * h; rx = -0.4 * hk; }
    else if (s === 'spin') { ry += k * Math.PI * 2; y = hk * 0.2 * h; }
    else if (s === 'hit' || s === 'blockHit') { rx = -0.4 * hk; z = -0.15 * h * hk; sy = 1 - 0.18 * hk; }
    else if (s === 'block' || s === 'blocking' || s === 'sit' || s === 'pickup') sy = 0.82;
    else if (s === 'dodge' || s === 'dodgeF') { z = (s === 'dodge' ? -1 : 1) * 0.35 * h * hk; rx = (s === 'dodge' ? -0.5 : 0.5) * hk; y = hk * 0.15 * h; }
    else if (s === 'dodgeL' || s === 'dodgeR') { x = (s === 'dodgeL' ? 1 : -1) * 0.4 * h * hk; rz = (s === 'dodgeL' ? -0.6 : 0.6) * hk; }
    else if (s === 'death' || s === 'deadPose') { rx = -Math.min(Math.PI / 2, (s === 'deadPose' ? 9 : t) * 4); y = -0.05 * h; }
    else if (s === 'jump' || s === 'jumpLong' || s === 'spawnAir' || s === 'standUp') { y = hk * (s === 'jumpLong' ? 0.6 : 0.45) * h; sy = k < 0.15 || k > 0.85 ? 0.82 : 1.08; rx = -0.15 * hk; }
    else if (s === 'victory' || s === 'taunt' || s === 'spawn' || s === 'interact' || s === 'use') { const b = Math.abs(Math.sin(t * 9)); y = b * 0.3 * h; sy = 0.88 + b * 0.2; rz = Math.sin(t * 6) * 0.15; }
    else if (s === 'powerUp' || s === 'channel') { ry += k * Math.PI * 4; y = hk * 0.3 * h; sy = 1 + hk * 0.15; }
    else { y = Math.abs(Math.sin(now * 2.2)) * 0.03 * h; sy = 1 + Math.sin(now * 2.2) * 0.025; rz = Math.sin(now * 1.1) * 0.03; }
    p.position.set(x, y, z); p.rotation.set(rx, ry, rz); p.scale.set(1 + (1 - sy) * 0.5, sy, 1 + (1 - sy) * 0.5);
  }
  fallbackPose() {
    const t = this.stateT, s = this.state, k = Math.min(1, t / Math.max(0.1, this.fbDur === Infinity ? 1 : this.fbDur)), hk = Math.sin(k * Math.PI);
    const now = performance.now() / 1000;
    const guard = { torso: [0.12, 0, 0], y: -0.05 + Math.sin(now * 5) * 0.03, sL: [-1.1, 0, 0.3], eL: [-1.9], sR: [-1.0, 0, -0.3], eR: [-2], hL: [-0.3], kL: [0.5], hR: [0.25], kR: [0.4] };
    let p = guard;
    if (s === 'walk' || s === 'run') p = runPose(now, s === 'run' ? 1 : 0.6);
    else if (s === 'punch' || s === 'slash' || s === 'stab' || s === 'cast' || s === 'heavy') p = { ...guard, sR: [-1.6 * hk - 1 * (1 - hk), 0, -0.1], eR: [-2 * (1 - hk)], torso: [0.2, -0.6 * hk, 0] };
    else if (s === 'kick' || s === 'jumpAttack' || s === 'spin') p = { ...guard, hR: [-1.6 * hk], kR: [0.2], torso: [-0.3 * hk, 0, 0] };
    else if (s === 'hit' || s === 'blockHit') p = { ...guard, torso: [-0.5 * hk, 0.2, 0], head: [-0.5 * hk, 0, 0] };
    else if (s === 'block' || s === 'blocking') p = { ...guard, sL: [-1.6, 0, 0.6], eL: [-2.3], sR: [-1.6, 0, -0.6], eR: [-2.3] };
    else if (s === 'victory' || s === 'powerUp' || s === 'taunt') p = { ...guard, sL: [-2.9, 0, 0.3], sR: [-2.9, 0, -0.3], eL: [-0.3], eR: [-0.3], y: Math.abs(Math.sin(now * 6)) * 0.15 };
    else if (s === 'dodge' || s === 'dodgeL' || s === 'dodgeR') p = { ...guard, torso: [-0.4 * hk, 0, 0], y: -0.2 * hk };
    poseHuman(this.rig, p);
    this.rig.root.rotation.x = s === 'death' || s === 'deadPose' ? -Math.min(1.5, t * 3) : 0;
  }
  dispose() {
    this.disposed = true;
    this.mixer?.stopAllAction();
    if (this.model) this.mixer?.uncacheRoot(this.model);
    this.root.parent?.remove(this.root);
    this.root.traverse((o) => {
      // Geometrias do GLB são compartilhadas entre as cópias (ficam no cache); as do reserva são só deste boneco.
      if (o.isMesh && this.rig && o.geometry) o.geometry.dispose();
      if (o.isMesh || o.isSprite) { const m = o.material; if (m) { if (o.isSprite) m.map?.dispose(); m.dispose(); } }
    });
    this.shadow.geometry.dispose();
    this.ring?.geometry.dispose();
  }
}

// ---------- Partículas 3D com orçamento ----------
// Uma reserva fixa de sprites: nunca cria além do limite, então não pesa em lives longas.
class FX3D {
  constructor(scene, max = 260) {
    this.scene = scene; this.max = REDUCED_MOTION ? Math.floor(max / 3) : max;
    this.free = []; this.live = []; this.rings = []; this.texts = [];
    this.level = 1;
    for (let i = 0; i < this.max; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: Tex3D.spark(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      s.visible = false; s.renderOrder = 12; scene.add(s); this.free.push(s);
    }
  }
  // opts: color (ou lista), n, speed, size, life, gravity, up (empurrão para cima), tex ('spark'|'smoke'|'star'), additive
  burst(pos, { color = '#ffffff', n = 20, speed = 4, size = 0.25, life = 0.7, gravity = -6, up = 1.5, tex = 'spark', spread = 1, additive = true } = {}) {
    n = Math.round(n * this.level);
    const cols = Array.isArray(color) ? color : [color];
    for (let i = 0; i < n && this.free.length; i++) {
      const s = this.free.pop();
      s.material.map = Tex3D[tex]?.() || Tex3D.spark();
      s.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      s.material.color.set(cols[i % cols.length]);
      s.material.opacity = 1;
      s.position.copy(pos);
      const th = Math.random() * Math.PI * 2, ph = Math.acos(rand(-1, 1));
      const v = speed * rand(0.4, 1);
      s.userData = { vx: Math.sin(ph) * Math.cos(th) * v * spread, vy: Math.abs(Math.cos(ph)) * v * 0.6 + up * rand(0.5, 1.2), vz: Math.sin(ph) * Math.sin(th) * v * spread, life: life * rand(0.6, 1.2), t: 0, size: size * rand(0.6, 1.3), g: gravity, grow: tex === 'smoke' ? 2.2 : 0 };
      s.scale.setScalar(s.userData.size);
      s.visible = true;
      this.live.push(s);
    }
  }
  // Anel de impacto no chão ou de frente para a câmera.
  ring(pos, { color = '#ffffff', size = 2.5, life = 0.45, flat = true } = {}) {
    if (this.rings.length > 10) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: Tex3D.ring(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.position.copy(pos); if (flat) m.rotation.x = -Math.PI / 2;
    m.userData = { t: 0, life, size, flat };
    this.scene.add(m); this.rings.push(m);
  }
  // Número de dano que sobe e some.
  text(pos, str, { color = '#fde047', size = 0.9, life = 0.9 } = {}) {
    if (this.texts.length > 14) return;
    const c = document.createElement('canvas'); c.width = 256; c.height = 96;
    const g = c.getContext('2d'); g.font = '900 72px Barlow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 12; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(str, 128, 50); g.fillStyle = color; g.fillText(str, 128, 50);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    s.renderOrder = 40; s.position.copy(pos); s.userData = { t: 0, life, size, vx: rand(-0.6, 0.6) };
    this.scene.add(s); this.texts.push(s);
  }
  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const s = this.live[i], d = s.userData;
      d.t += dt;
      if (d.t >= d.life) { s.visible = false; this.live.splice(i, 1); this.free.push(s); continue; }
      d.vy += d.g * dt;
      s.position.x += d.vx * dt; s.position.y += d.vy * dt; s.position.z += d.vz * dt;
      if (s.position.y < 0.05) { s.position.y = 0.05; d.vy *= -0.3; d.vx *= 0.7; d.vz *= 0.7; }
      const k = d.t / d.life;
      s.material.opacity = 1 - k * k;
      s.scale.setScalar(d.size * (1 + d.grow * k));
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const m = this.rings[i], d = m.userData; d.t += dt;
      const k = d.t / d.life;
      if (k >= 1) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); this.rings.splice(i, 1); continue; }
      m.scale.setScalar(d.size * (0.2 + k * 1.2)); m.material.opacity = 1 - k;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const s = this.texts[i], d = s.userData; d.t += dt;
      const k = d.t / d.life;
      if (k >= 1) { this.scene.remove(s); s.material.map.dispose(); s.material.dispose(); this.texts.splice(i, 1); continue; }
      const pop = k < 0.15 ? 0.6 + k / 0.15 * 0.6 : 1.2 - (k - 0.15) * 0.3;
      s.scale.set(d.size * pop * 2.6, d.size * pop, 1);
      s.position.y += dt * 1.2; s.position.x += d.vx * dt;
      s.material.opacity = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    }
  }
  clear() {
    for (const s of this.live) { s.visible = false; this.free.push(s); }
    this.live = [];
    for (const m of this.rings) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    for (const s of this.texts) { this.scene.remove(s); s.material.map.dispose(); s.material.dispose(); }
    this.rings = []; this.texts = [];
  }
}

// ---------- Câmera ----------
class CamDirector {
  constructor(cam, { pos = [0, 3, 10], look = [0, 1.2, 0] } = {}) {
    this.cam = cam;
    this.basePos = new THREE.Vector3(...pos); this.baseLook = new THREE.Vector3(...look);
    this.pos = this.basePos.clone(); this.look = this.baseLook.clone();
    this.shakeT = 0; this.shakeA = 0; this.focusT = 0; this.slowT = 0;
    this.drift = 0.6;
  }
  shake(amount = 0.15, secs = 0.25) { if (REDUCED_MOTION) amount *= 0.25; this.shakeA = Math.max(this.shakeA, amount); this.shakeT = Math.max(this.shakeT, secs); }
  // Aproxima de um ponto por alguns segundos (vitória, golpe especial).
  focus(target, { secs = 2, dist = 4.5, height = 1.6, side = 0 } = {}) {
    this.focusT = secs;
    this.focusLook = new THREE.Vector3(target.x, target.y + 1, target.z);
    this.focusPos = new THREE.Vector3(target.x + side, target.y + height, target.z + dist);
  }
  slow(secs = 0.6) { this.slowT = REDUCED_MOTION ? 0 : secs; }
  // Fator de tempo para o jogo (câmera lenta no nocaute).
  get timeScale() { return this.slowT > 0 ? 0.3 : 1; }
  update(dt, t) {
    this.slowT = Math.max(0, this.slowT - dt);
    let tp = this.basePos.clone(), tl = this.baseLook.clone();
    tp.x += Math.sin(t * 0.25) * this.drift; tp.y += Math.sin(t * 0.33) * this.drift * 0.25;
    if (this.focusT > 0) { this.focusT -= dt; tp = this.focusPos; tl = this.focusLook; }
    const k = 1 - Math.exp(-dt * (this.focusT > 0 ? 3.5 : 2));
    this.pos.lerp(tp, k); this.look.lerp(tl, k);
    this.cam.position.copy(this.pos);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeA * Math.min(1, this.shakeT * 6);
      this.cam.position.x += rand(-a, a); this.cam.position.y += rand(-a, a);
    } else this.shakeA = 0;
    this.cam.lookAt(this.look);
  }
}

// ---------- Cenário de arena reutilizável ----------
// Palco octogonal com borda de luz, torcida em silhueta animada, holofotes e névoa: profundidade em vários planos.
function buildArena(scene, { floor = '#1e293b', rim = '#3b82f6', rim2 = '#ef4444', sky = ['#05060f', '#141a3a', '#2a1440'], crowd = true, radius = 7, logo = 'ARENA' } = {}) {
  const T = THREE;
  scene.background = G3.skyTex(...sky);
  scene.fog = new T.Fog(sky[1], 18, 60);
  G3.lights(scene, { hemi: 0.55, sun: 1.6, pos: [6, 20, 10], sky: 0xbfd4ff, ground: 0x221133 });
  // Holofotes coloridos dos dois lados
  const spots = [];
  for (const [x, c] of [[-8, rim], [8, rim2]]) {
    const s = new T.SpotLight(c, 260, 40, 0.5, 0.6, 1.4); s.position.set(x, 12, 6); s.target.position.set(x * 0.15, 0, 0); scene.add(s, s.target); spots.push(s);
  }
  const key = new T.SpotLight(0xffffff, 380, 50, 0.55, 0.5, 1.2); key.position.set(0, 16, 8); key.castShadow = false; scene.add(key);
  // Palco
  const top = G3.tex(1024, 1024, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, w * 0.1, w / 2, w / 2, w * 0.5); gr.addColorStop(0, shade(floor, 18)); gr.addColorStop(1, shade(floor, -25));
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 4;
    for (let i = 0; i < 16; i++) { g.beginPath(); g.moveTo(w / 2, w / 2); g.lineTo(w / 2 + Math.cos(i / 16 * 7 * 0.9) * w, w / 2 + Math.sin(i / 16 * 7 * 0.9) * w); g.stroke(); }
    g.strokeStyle = rim; g.lineWidth = 14; g.globalAlpha = 0.7; g.beginPath(); g.arc(w / 2, w / 2, w * 0.18, 0, 7); g.stroke();
    g.globalAlpha = 0.12; g.fillStyle = '#fff'; g.font = '900 120px Barlow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(logo, w / 2, w / 2);
    g.globalAlpha = 1;
  });
  const stage = new T.Mesh(new T.CylinderGeometry(radius, radius * 1.06, 0.8, 8), [new T.MeshStandardMaterial({ color: shade(floor, -40), roughness: 0.6, metalness: 0.3 }), new T.MeshStandardMaterial({ map: top, roughness: 0.55, metalness: 0.1 }), new T.MeshStandardMaterial({ color: 0x000000 })]);
  stage.rotation.y = Math.PI / 8; stage.position.y = -0.4; stage.receiveShadow = true; scene.add(stage);
  // Borda de luz (duas cores, uma para cada lado)
  const rimMat = (c) => new T.MeshBasicMaterial({ color: c, toneMapped: false });
  for (let i = 0; i < 8; i++) {
    const a0 = i / 8 * Math.PI * 2, a1 = (i + 1) / 8 * Math.PI * 2, r = radius * 1.005;
    const p0 = new T.Vector3(Math.cos(a0) * r, 0.02, Math.sin(a0) * r), p1 = new T.Vector3(Math.cos(a1) * r, 0.02, Math.sin(a1) * r);
    const len = p0.distanceTo(p1);
    const bar = new T.Mesh(new T.BoxGeometry(len, 0.08, 0.12), rimMat((p0.x + p1.x) < 0 ? rim : rim2));
    bar.position.copy(p0.clone().add(p1).multiplyScalar(0.5));
    bar.rotation.set(0, -Math.atan2(p1.z - p0.z, p1.x - p0.x), 0);
    scene.add(bar);
  }
  // Chão ao redor (escuro, reflete a luz dos holofotes)
  const ground = new T.Mesh(new T.CircleGeometry(60, 48), new T.MeshStandardMaterial({ color: 0x0b0f1e, roughness: 0.35, metalness: 0.5 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.8; ground.receiveShadow = true; scene.add(ground);
  // Torcida em silhueta (instâncias: corpo + cabeça), em arquibancadas na penumbra. Pula mais com o "hype" da live.
  let crowdMesh = null, headMesh = null;
  if (crowd) {
    const N = 300;
    crowdMesh = new T.InstancedMesh(new T.CapsuleGeometry(0.34, 0.42, 3, 8), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), N);
    headMesh = new T.InstancedMesh(new T.SphereGeometry(0.27, 10, 8), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), N);
    crowdMesh.frustumCulled = headMesh.frustumCulled = false;
    const cols = [rim, rim2, '#f8fafc', '#facc15', '#a78bfa', '#34d399', '#64748b'].map((c) => new T.Color(c).multiplyScalar(0.16));
    const skins = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'].map((c) => new T.Color(c).multiplyScalar(0.22));
    const seats = [];
    for (let i = 0; i < N; i++) {
      const row = i % 6, a = Math.PI * (1.08 + (i / N) * 0.84) + rand(-0.012, 0.012);
      const r = radius + 4 + row * 1.25;
      seats.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: -0.2 + row * 0.75, ph: rand(0, 7), sp: rand(4, 8), arms: Math.random() < 0.3 });
      crowdMesh.setColorAt(i, pick(cols)); headMesh.setColorAt(i, pick(skins));
    }
    crowdMesh.userData.seats = seats;
    scene.add(crowdMesh, headMesh);
    for (let row = 0; row < 6; row++) {
      const r = radius + 4 + row * 1.25;
      const step = new T.Mesh(new T.CylinderGeometry(r + 0.6, r + 0.6, 0.75, 40, 1, true, Math.PI * 1.08 + Math.PI / 2, Math.PI * 0.84), new T.MeshStandardMaterial({ color: 0x0b1020, roughness: 0.8, side: T.DoubleSide }));
      step.position.y = -0.6 + row * 0.75; scene.add(step);
    }
  }
  // Pontos de luz no fundo (bokeh do estádio)
  for (let i = 0; i < 28; i++) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: Tex3D.spark(), color: pick([rim, rim2, '#ffffff', '#fbbf24']), blending: T.AdditiveBlending, transparent: true, opacity: 0.5, depthWrite: false }));
    const a = Math.PI * (1.05 + Math.random() * 0.9), r = rand(26, 40);
    s.position.set(Math.cos(a) * r, rand(6, 16), Math.sin(a) * r); s.scale.setScalar(rand(1.2, 3)); scene.add(s);
  }
  const dummy = new T.Object3D();
  return {
    stage, spots, crowd: crowdMesh, hype: 0,
    // hype 0..1: a torcida pula mais quando a live está animada
    update(t, dt) {
      this.hype = Math.max(0, this.hype - dt * 0.15);
      for (const s of spots) s.intensity = 220 + Math.sin(t * 2 + s.position.x) * 40 + this.hype * 200;
      if (!crowdMesh) return;
      const amp = 0.06 + this.hype * 0.45;
      crowdMesh.userData.seats.forEach((s, i) => {
        const jump = Math.max(0, Math.sin(t * s.sp + s.ph)) * amp, sway = Math.sin(t * 2 + s.ph) * 0.08 * (1 + this.hype * 2);
        dummy.position.set(s.x, s.y + 0.5 + jump, s.z); dummy.rotation.set(0, 0, sway); dummy.scale.set(1, 1, 1);
        dummy.updateMatrix(); crowdMesh.setMatrixAt(i, dummy.matrix);
        dummy.position.set(s.x - Math.sin(sway) * 0.7, s.y + 1.18 + jump, s.z); dummy.updateMatrix(); headMesh.setMatrixAt(i, dummy.matrix);
      });
      crowdMesh.instanceMatrix.needsUpdate = true; headMesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------- HUD 2D ----------
// Barra de vida com foto, nome, vitórias e barra branca de "dano recente" que desce devagar.
function hudFighter(x, y, w, e, { flip = false, color = '#3b82f6', t = 0, extra = '' } = {}) {
  if (!e) return;
  const h = 92;
  e.hpShow = e.hpShow ?? e.hp; e.hpLag = e.hpLag ?? e.hp;
  e.hpShow += (e.hp - e.hpShow) * 0.35;
  e.hpLag = e.hpLag > e.hpShow ? Math.max(e.hpShow, e.hpLag - Math.max(1, e.max) * 0.008) : e.hpShow;
  ctx.save();
  // Painel com leve brilho
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(18,22,44,.92)'); g.addColorStop(1, 'rgba(8,10,22,.92)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, 22); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
  const ax = flip ? x + w - 48 : x + 48;
  avatar(e.user, ax, y + h / 2, 34, color);
  const tx = flip ? x + w - 96 : x + 96, al = flip ? 'right' : 'left';
  label(trim(e.user?.nick || '?', 14), tx, y + 26, 22, '#fff', al, 900);
  const bw = w - 120, bx = flip ? x + 24 : x + 96, by = y + 46, bh = 18;
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 9); ctx.fill();
  const f = (v) => clamp(v / Math.max(1, e.max), 0, 1);
  const fill = (v, c) => { const ww = bw * f(v); if (ww <= 1) return; ctx.fillStyle = c; ctx.beginPath(); flip ? ctx.roundRect(bx + bw - ww, by, ww, bh, 9) : ctx.roundRect(bx, by, ww, bh, 9); ctx.fill(); };
  fill(e.hpLag, 'rgba(255,255,255,.75)');
  const hc = f(e.hpShow) > 0.4 ? '#22c55e' : f(e.hpShow) > 0.2 ? '#f59e0b' : '#ef4444';
  fill(e.hpShow, hc);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(bx + 6, by + 3, bw - 12, 3);
  label(`${fmtK(Math.max(0, Math.round(e.hp)))} ❤  ·  🏆 ${e.wins || 0}${extra ? '  ·  ' + extra : ''}`, flip ? bx + bw : bx, by + 36, 15, 'rgba(255,255,255,.85)', al, 800);
  ctx.restore();
}
