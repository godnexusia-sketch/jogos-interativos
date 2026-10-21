'use strict';

// Painel de controle (só na página principal; a tela da live não tem painel).
// Seções no trilho da esquerda; a tela do jogo fica fixa; à direita o chat da live.

if (!isClean) (() => {
  const view = $('view');
  const esc = escHtml;
  const VIEWS = [
    ['jogos', '🎮', 'Jogos'], ['jogo', '⚙️', 'Jogo atual'], ['personagens', '🧍', 'Personagens'], ['testar', '🧪', 'Testar'], ['efeitos', '✨', 'Efeitos'],
    ['alertas', '🔔', 'Alertas'], ['widgets', '🧩', 'Widgets'], ['dj', '🎛️', 'DJ Pad'], ['musica', '🎵', 'Música'],
    ['voz', '🗣️', 'Voz e chat'], ['placar', '🏆', 'Placar'], ['historico', '📊', 'Histórico'], ['tela', '🖥️', 'Tela da live'],
  ];
  let curView = store.get('panelView', 'jogos');
  $('rail').innerHTML = VIEWS.map(([id, ic, nm]) => `<button data-view="${id}" title="${nm}"><span>${ic}</span><small>${nm}</small></button>`).join('');
  $('rail').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) show(b.dataset.view); });
  $('libBtn').addEventListener('click', () => show('jogos'));
  function show(v) {
    curView = v;
    store.set('panelView', v);
    document.querySelectorAll('#rail button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    view.scrollTop = 0;
    (RENDER[v] || RENDER.jogos)();
  }
  const h = (html) => { view.innerHTML = html; return view; };
  const q = (sel, root = view) => root.querySelector(sel);
  const qa = (sel, root = view) => [...root.querySelectorAll(sel)];
  const toastMsg = (msg) => { const t = document.createElement('div'); t.className = 'ptoast'; t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), 2600); };

  // ---------- Mídia: envia para o servidor e guarda o original neste navegador ----------
  const media = {
    db: null,
    open() {
      if (this.db) return this.db;
      this.db = new Promise((res, rej) => { const r = indexedDB.open('jogos-media', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      return this.db;
    },
    async keep(id, blob) { try { const db = await this.open(); db.transaction('f', 'readwrite').objectStore('f').put(blob, id); } catch {} },
    async all() { try { const db = await this.open(); return await new Promise((res) => { const out = []; const c = db.transaction('f').objectStore('f').openCursor(); c.onsuccess = () => { const cur = c.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } else res(out); }; c.onerror = () => res(out); }); } catch { return []; } },
    async upload(file) {
      const r = await fetch('/api/media', { method: 'POST', headers: { 'content-type': file.type }, body: file });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'falha no envio');
      const j = await r.json();
      this.keep(j.id, file);
      return j.url;
    },
    // O disco do Render é temporário: confere se o servidor ainda tem cada arquivo e reenvia o que sumiu.
    async heal() {
      for (const [id, blob] of await this.all()) {
        const r = await fetch('/api/media/' + id, { method: 'HEAD' }).catch(() => null);
        if (r && r.status === 404) await fetch('/api/media', { method: 'POST', headers: { 'content-type': blob.type }, body: blob }).catch(() => {});
      }
    },
  };
  media.heal();
  function pickFile(accept) {
    return new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => res(i.files[0] || null); i.click(); });
  }
  const ACCEPT = { image: 'image/*', gif: 'image/*', video: 'video/mp4,video/webm', audio: 'audio/*', any: 'image/*,video/mp4,video/webm' };
  async function chooseMedia(kind = 'any') {
    const f = await pickFile(ACCEPT[kind] || ACCEPT.any);
    if (!f) return null;
    if (f.size > 60 * 1024 * 1024) { toastMsg('Arquivo grande demais (máx. 60 MB).'); return null; }
    toastMsg('Enviando…');
    try { const url = await media.upload(f); toastMsg('Arquivo enviado ✔'); return { url, name: f.name.replace(/\.[^.]+$/, '') }; } catch (e) { toastMsg('Falhou: ' + e.message); return null; }
  }

  // ---------- Formulário de configurações (a partir do esquema do jogo) ----------
  const COUNTRIES = typeof COUNTRY_LIST !== 'undefined' ? COUNTRY_LIST : [];
  function settingsForm(g, el) {
    const groups = new Map();
    for (const s of g.settings) { const k = s.group || 'Jogo'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
    const vis = (s) => !s.showIf || g.s[s.showIf.key] === s.showIf.value || (Array.isArray(s.showIf.value) && s.showIf.value.includes(g.s[s.showIf.key]));
    const draw = () => {
      el.innerHTML = [...groups].map(([name, list], gi) => `<details class="sgroup" ${gi < 2 || name === 'Jogo' ? 'open' : ''}><summary>${esc(name)}</summary>${list.filter(vis).map((s) => fieldHtml(s, g.s[s.key])).join('')}</details>`).join('')
        + '<div class="row"><button data-reset>Restaurar padrão</button><button data-restart class="primary">Aplicar e reiniciar rodada</button></div>';
      qa('[data-k]', el).forEach((inp) => {
        const s = g.settings.find((x) => x.key === inp.dataset.k);
        const ev = inp.type === 'checkbox' || inp.tagName === 'SELECT' || inp.type === 'color' || inp.type === 'range' ? 'input' : 'change';
        inp.addEventListener(ev, () => {
          let v = inp.type === 'checkbox' ? inp.checked : inp.value;
          if (s.type === 'number' || s.type === 'slider') v = clamp(Number(v), s.min ?? -Infinity, s.max ?? Infinity);
          if (s.type === 'list') v = inp.value;
          if (inp.dataset.clear !== undefined) v = '';
          const out = inp.parentElement.querySelector('output'); if (out) out.textContent = v;
          saveSettings(g, { ...g.s, [s.key]: v });
          if (s.showIf === undefined && g.settings.some((x) => x.showIf?.key === s.key)) draw();
          if (s.restart) resetCurrent();
        });
      });
      qa('[data-media]', el).forEach((b) => b.addEventListener('click', async () => {
        const s = g.settings.find((x) => x.key === b.dataset.media);
        if (b.dataset.act === 'clear') { saveSettings(g, { ...g.s, [s.key]: '' }); return draw(); }
        const m = await chooseMedia(s.accept || 'any');
        if (m) { saveSettings(g, { ...g.s, [s.key]: m.url }); draw(); }
      }));
      qa('[data-mlist]', el).forEach((b) => b.addEventListener('click', async () => {
        const s = g.settings.find((x) => x.key === b.dataset.mlist);
        const list = [...(g.s[s.key] || [])];
        if (b.dataset.act === 'add') { const m = await chooseMedia(s.accept || 'video'); if (m) list.push({ src: m.url, name: m.name }); }
        else list.splice(Number(b.dataset.i), 1);
        saveSettings(g, { ...g.s, [s.key]: list }); draw();
      }));
      qa('[data-voiceprev]', el).forEach((b) => b.addEventListener('click', () => { const sel = b.previousElementSibling; mixer.here ? voice.say('Oi! Essa é a minha voz na sua live.', { voice: sel.value, prio: 'high' }) : busDo({ t: 'say', text: 'Oi! Essa é a minha voz na sua live.', voice: sel.value }); }));
      q('[data-reset]', el).addEventListener('click', () => { if (confirm('Voltar todas as configurações deste jogo ao padrão?')) { saveSettings(g, {}); resetCurrent(); draw(); } });
      q('[data-restart]', el).addEventListener('click', () => resetCurrent());
    };
    draw();
  }
  function fieldHtml(s, v) {
    const lab = `<span>${esc(s.label)}${s.hint ? ` <i class="hint" title="${esc(s.hint)}">?</i>` : ''}</span>`;
    switch (s.type) {
      case 'toggle': return `<label class="f tog"><input type="checkbox" data-k="${s.key}" ${v ? 'checked' : ''}><b></b>${lab}</label>`;
      case 'select': return `<label class="f">${lab}<select data-k="${s.key}">${s.options.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select></label>`;
      case 'number': return `<label class="f">${lab}<input type="number" data-k="${s.key}" value="${esc(v)}" min="${s.min ?? ''}" max="${s.max ?? ''}" step="${s.step ?? 1}"></label>`;
      case 'slider': return `<label class="f">${lab}<div class="sl"><input type="range" data-k="${s.key}" value="${esc(v)}" min="${s.min}" max="${s.max}" step="${s.step ?? 1}"><output>${esc(v)}</output></div></label>`;
      case 'color': return `<label class="f">${lab}<div class="sl"><input type="color" data-k="${s.key}" value="${v || '#000000'}">${v ? '' : '<small>do jogo</small>'}</div></label>`;
      case 'text': return `<label class="f">${lab}<input data-k="${s.key}" value="${esc(v)}" maxlength="${s.max || 80}" placeholder="${esc(s.placeholder || '')}"></label>`;
      case 'textarea': case 'list': return `<label class="f">${lab}<textarea data-k="${s.key}" rows="${s.rows || 4}" placeholder="${esc(s.placeholder || '')}">${esc(v)}</textarea></label>`;
      case 'media': return `<div class="f">${lab}<div class="sl">${v ? (/\.(mp4|webm)/.test(v) ? '<span>🎞️ vídeo</span>' : `<img class="thumb" src="${esc(v)}" alt="">`) : '<small>nenhuma</small>'}<button data-media="${s.key}">Escolher</button>${v ? `<button data-media="${s.key}" data-act="clear">Tirar</button>` : ''}</div></div>`;
      case 'mediaList': return `<div class="f">${lab}<div class="mlist">${(v || []).map((m, i) => `<span>🎞️ ${esc(trim(m.name || 'vídeo', 18))} <button data-mlist="${s.key}" data-i="${i}" data-act="del">✕</button></span>`).join('') || '<small>nenhum</small>'}<button data-mlist="${s.key}" data-act="add">+ Adicionar</button></div></div>`;
      case 'voice': return `<label class="f">${lab}<div class="sl"><select data-k="${s.key}">${VOICES.map((x) => `<option value="${x.id}" ${x.id === v ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><button type="button" data-voiceprev>▶</button></div></label>`;
      case 'country': return `<label class="f">${lab}<select data-k="${s.key}">${COUNTRIES.map((c) => `<option value="${c.code}" ${c.code === v ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>`;
      case 'note': return `<p class="note">${s.label}</p>`;
      default: return '';
    }
  }

  // ---------- Gatilhos ----------
  const giftOptions = () => GIFT_CATALOG.map((x) => `<option value="${esc(x.name)} · ${x.coins} 🪙 · #${x.id}">`).join('');
  function giftLabel(b) { if (!b.giftId) return ''; const gi = giftInfo(b.giftId); return gi ? `${gi.name} · ${gi.coins} 🪙 · #${gi.id}` : '#' + b.giftId; }
  function triggersEditor(g, el) {
    const draw = () => {
      const binds = g.binds;
      el.innerHTML = `<datalist id="giftList">${giftOptions()}</datalist>
        <p class="small">Escolha o que cada interação da live faz no jogo. Presente específico ganha de "qualquer presente"; entre os genéricos vale o de maior valor mínimo alcançado.</p>
        ${binds.map((b, i) => `<div class="bind ${b.on === false ? 'off' : ''}" data-i="${i}">
          <label class="tog mini"><input type="checkbox" data-f="on" ${b.on !== false ? 'checked' : ''}><b></b></label>
          <select data-f="trigger">${Object.entries(TRIGGERS).map(([k, t]) => `<option value="${k}" ${k === b.trigger ? 'selected' : ''}>${t.icon} ${t.name}</option>`).join('')}</select>
          ${b.trigger === 'gift' ? `<input data-f="gift" list="giftList" placeholder="qualquer presente" value="${esc(giftLabel(b))}"><label class="mini-l">mín 🪙<input type="number" data-f="minCoins" min="0" value="${b.minCoins || 0}"></label>` : ''}
          ${b.trigger === 'comment' ? `<input data-f="text" placeholder="qualquer comentário" value="${esc(b.text || '')}" title="Palavras separadas por vírgula">` : ''}
          ${b.trigger === 'like' ? `<label class="mini-l">a cada<input type="number" data-f="likes" min="1" value="${b.likes || 1}">likes</label>` : ''}
          <span class="arrow">→</span>
          <select data-f="action">${g.actions.map((a) => `<option value="${a.id}" ${a.id === b.action ? 'selected' : ''}>${a.icon || ''} ${esc(a.label)}</option>`).join('')}</select>
          <label class="mini-l">×<input type="number" data-f="count" min="1" max="50" value="${b.count || 1}"></label>
          <button data-del title="Remover">✕</button>
        </div>`).join('')}
        <div class="row"><button data-add>+ Adicionar gatilho</button><button data-def>Restaurar padrão</button></div>`;
      qa('.bind', el).forEach((row) => {
        const i = Number(row.dataset.i);
        qa('[data-f]', row).forEach((inp) => inp.addEventListener('change', () => {
          const b = { ...g.binds[i] }, f = inp.dataset.f;
          if (f === 'on') b.on = inp.checked;
          else if (f === 'gift') { const m = inp.value.match(/#(\d+)\s*$/); b.giftId = m ? m[1] : ''; b.giftName = m ? '' : inp.value.trim(); }
          else if (['minCoins', 'likes', 'count'].includes(f)) b[f] = Math.max(f === 'minCoins' ? 0 : 1, Number(inp.value) || 0);
          else b[f] = inp.value;
          const binds = [...g.binds]; binds[i] = b; saveBinds(g, binds);
          if (f === 'trigger') draw();
        }));
        q('[data-del]', row).addEventListener('click', () => { const binds = [...g.binds]; binds.splice(i, 1); saveBinds(g, binds); draw(); });
      });
      q('[data-add]', el).addEventListener('click', () => { saveBinds(g, [...g.binds, { id: g.id + '-u' + Date.now(), on: true, trigger: 'gift', minCoins: 1, action: g.actions[0]?.id, count: 1 }]); draw(); });
      q('[data-def]', el).addEventListener('click', () => { if (confirm('Voltar os gatilhos ao padrão do jogo?')) { saveBinds(g, defaultBinds(g)); draw(); } });
    };
    draw();
  }

  // ---------- Seções ----------
  const RENDER = {};
  let libGenre = store.get('libGenre', 'all'), libSearch = '';
  // Biblioteca: destaque do jogo no ar + cartões com a capa tirada do próprio jogo (assets/capas).
  const WEBGL_OK = (() => { try { return Boolean(document.createElement('canvas').getContext('webgl2')); } catch { return false; } })();
  const genreOf = (g) => GENRES.find((x) => x.id === g.genre);
  const coverOf = (g) => `/assets/capas/${g.id}.webp`;
  const badges = (g) => [g.three ? '<i class="bd b3d">3D</i>' : '', g.ai ? '<i class="bd bai">IA</i>' : '', g.voice ? '<i class="bd bvo">VOZ</i>' : ''].join('');
  const gameCard = (g) => {
    const off = g.three && !WEBGL_OK, cur = g === current;
    return `<button class="gcard ${cur ? 'cur' : ''} ${off ? 'off' : ''}" data-id="${g.id}" style="--c1:${g.color || colorFor(g.id)}" ${off ? 'title="Este aparelho não tem WebGL 2: o jogo 3D não roda aqui"' : ''}>
      <span class="gcover"><span class="gfb">${g.icon}</span><img src="${coverOf(g)}" alt="" loading="lazy" onload="this.classList.add('ok')" onerror="this.remove()"></span>
      <span class="gstat">${cur ? '<i class="bd live">● NO AR</i>' : off ? '<i class="bd boff">INDISPONÍVEL</i>' : ''}${badges(g)}</span>
      <span class="ginfo"><small>${genreOf(g)?.icon || ''} ${esc(genreOf(g)?.name || '')}</small><b>${esc(g.name)}</b><p>${esc(trim(g.desc || '', 96))}</p>
        <span class="gplay">${cur ? '⚙️ Abrir' : off ? 'Sem 3D aqui' : '▶ Iniciar'}</span></span></button>`;
  };
  RENDER.jogos = () => {
    const counts = Object.fromEntries(GENRES.map((x) => [x.id, x.id === 'all' ? GAMES.length : GAMES.filter((g) => g.genre === x.id).length]));
    const g0 = current;
    h(`<div class="vhead"><h2>Biblioteca de jogos</h2><input id="libSearch" type="search" placeholder="🔎 Buscar jogo" value="${esc(libSearch)}"></div>
      <section class="hero" style="--c1:${g0.color || colorFor(g0.id)}">
        <img class="hero-bg" src="${coverOf(g0)}" alt="" onerror="this.remove()">
        <div class="hero-cover"><span class="gfb">${g0.icon}</span><img src="${coverOf(g0)}" alt="" onload="this.classList.add('ok')" onerror="this.remove()"></div>
        <div class="hero-txt"><span class="bd live">● NO AR AGORA</span>${badges(g0)}
          <h3>${esc(g0.name)}</h3><small>${genreOf(g0)?.icon || ''} ${esc(genreOf(g0)?.name || '')}</small>
          <p>${esc(trim(g0.desc || '', 180))}</p>
          <div class="row"><button class="primary" id="heroOpen">⚙️ Configurar e testar</button><button id="heroReset">↺ Reiniciar</button></div></div>
      </section>
      <div class="chips" id="genres">${GENRES.filter((x) => counts[x.id]).map((x) => `<button data-g="${x.id}" class="${x.id === libGenre ? 'on' : ''}">${x.icon} ${x.name} <small>${counts[x.id]}</small></button>`).join('')}</div>
      <div class="gcards" id="cards"></div>`);
    const draw = () => {
      const s = norm(libSearch);
      const list = GAMES.filter((g) => (libGenre === 'all' || g.genre === libGenre) && (!s || norm(g.name + ' ' + (g.desc || '')).includes(s)));
      q('#cards').innerHTML = list.map(gameCard).join('') || '<p class="small">Nenhum jogo encontrado.</p>';
    };
    draw();
    q('#heroOpen').addEventListener('click', () => show('jogo'));
    q('#heroReset').addEventListener('click', () => resetCurrent());
    q('#genres').addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (!b) return; libGenre = b.dataset.g; store.set('libGenre', libGenre); qa('#genres button').forEach((x) => x.classList.toggle('on', x === b)); draw(); });
    q('#libSearch').addEventListener('input', (e) => { libSearch = e.target.value; draw(); });
    q('#cards').addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]'); if (!b || b.classList.contains('off')) return;
      const g = GAMES.find((x) => x.id === b.dataset.id);
      if (g !== current) { selectGame(g); RENDER.jogos(); toastMsg(`▶ ${g.name} no ar`); } else show('jogo');
    });
  };

  RENDER.jogo = () => {
    const g = current;
    h(`<div class="vhead"><h2>${g.icon} ${esc(g.name)}</h2><span class="tag">${esc(GENRES.find((x) => x.id === g.genre)?.name || '')}</span></div>
      <div class="panel"><div id="help" class="help">${g.help || ''}</div>${g.v2 ? '' : '<p class="small">Clássico: as regras de presentes e comentários estão no próprio jogo.</p>'}
        <div class="row"><button id="hEdit" ${g.edit ? '' : 'hidden'}>Editar</button></div></div>
      ${g.v2 ? `<div class="panel"><h3>Testar ações</h3><div class="row wrap" id="testActs"></div>
        <label class="small inl">valor do teste 🪙 <input id="testCoins" type="number" min="1" value="${store.get('testCoins', 10)}" style="width:90px"></label></div>
      <div class="panel"><h3>⚡ Gatilhos de ação</h3><div id="binds"></div></div>
      <div class="panel"><h3>Configurações do jogo <small>(mudam ao vivo)</small></h3><div id="sets"></div></div>`
      : `<div class="panel" id="oldSetsP"><h3>Configurar</h3><div id="settings"></div></div>`}`);
    q('#hEdit').addEventListener('click', () => g.edit?.());
    if (g.v2) {
      q('#testActs').innerHTML = g.actions.map((a) => `<button data-a="${a.id}">${a.icon || '▶'} ${esc(a.label)}</button>`).join('');
      q('#testActs').addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b) busDo({ t: 'action', game: g.id, id: b.dataset.a, coins: Number(q('#testCoins').value) || 1, user: fakeUser() }); });
      q('#testCoins').addEventListener('change', (e) => store.set('testCoins', Number(e.target.value) || 1));
      triggersEditor(g, q('#binds'));
      settingsForm(g, q('#sets'));
    } else if (g.renderSettings) g.renderSettings(q('#settings'), (cfg) => shareConfig(g.configKey, cfg));
    else q('#oldSetsP').hidden = true;
  };

  RENDER.testar = () => {
    h(`<div class="vhead"><h2>🧪 Simulador</h2><span class="tag">sem precisar de live</span></div>
      <div class="panel"><h3>Espectadores de mentira</h3>
        <label class="f tog"><input type="checkbox" id="simAutoT" ${autoTimer ? 'checked' : ''}><b></b><span>Ligar espectadores automáticos (comentam, curtem e mandam presentes)</span></label>
        <input id="simText" placeholder="comentário (vazio = exemplo do jogo)">
        <div class="row wrap"><button id="sChat">💬 Comentar</button><button id="sLike">❤️ 5 likes</button><button id="sLike50">❤️ 50 likes</button><button id="sJoin">👋 Entrar</button><button id="sFollow">⭐ Seguir</button><button id="sShare">🔁 Compartilhar</button></div></div>
      <div class="panel"><h3>Mandar presente</h3>
        <div class="row wrap gifts" id="shop"></div>
        <div class="row"><input id="giftSearch" list="giftList2" placeholder="🔎 qualquer presente do TikTok"><label class="small inl">combo × <input id="simCombo" type="number" min="1" max="999" value="1" style="width:70px"></label><button id="sendGift" class="primary">Enviar</button></div>
        <datalist id="giftList2">${giftOptions()}</datalist>
        <p class="small">O efeito é proporcional ao total de moedas (preço × combo).</p></div>`);
    q('#simAutoT').addEventListener('change', (e) => simAuto(e.target.checked));
    const txt = () => q('#simText').value || current.sample?.() || 'oi';
    q('#sChat').addEventListener('click', () => simChat(txt()));
    q('#simText').addEventListener('keydown', (e) => { if (e.key === 'Enter') simChat(txt()); });
    q('#sLike').addEventListener('click', () => sim({ type: 'like', user: fakeUser(), count: 5 }));
    q('#sLike50').addEventListener('click', () => sim({ type: 'like', user: fakeUser(), count: 50 }));
    q('#sJoin').addEventListener('click', () => sim({ type: 'join', user: fakeUser() }));
    q('#sFollow').addEventListener('click', () => sim({ type: 'social', user: fakeUser(), action: 'follow' }));
    q('#sShare').addEventListener('click', () => sim({ type: 'social', user: fakeUser(), action: 'share' }));
    q('#shop').innerHTML = GIFT_SHOP.map(([e, n, c], i) => `<button data-shop="${i}" title="${n} (${c} moedas)">${e}<small>${fmtK(c)}</small></button>`).join('');
    const combo = () => Math.max(1, Number(q('#simCombo').value) || 1);
    q('#shop').addEventListener('click', (e) => { const b = e.target.closest('[data-shop]'); if (!b) return; const [, n, c, id] = GIFT_SHOP[b.dataset.shop]; simGift([n, c, id], fakeUser(), combo()); });
    q('#sendGift').addEventListener('click', () => {
      const m = q('#giftSearch').value.match(/#(\d+)\s*$/);
      const gi = m && giftInfo(m[1]);
      if (!gi) return toastMsg('Escolha um presente da lista.');
      simGift([gi.name, gi.coins, gi.id], fakeUser(), combo());
    });
  };

  RENDER.efeitos = () => {
    const E = liveCfg.effects;
    const save = () => liveCfg.save('effects', E);
    const card = (k, ttl, desc, fields, test) => `<div class="panel" data-e="${k}"><div class="ph"><h3>${ttl}</h3><label class="tog mini"><input type="checkbox" data-o="on" ${E[k].on ? 'checked' : ''}><b></b></label></div><p class="small">${desc}</p>${fields}<button data-test="${test}">▶ Testar na live</button></div>`;
    const sel = (key, opts, v) => `<select data-o="${key}">${opts.map(([a, b]) => `<option value="${a}" ${String(a) === String(v) ? 'selected' : ''}>${b}</option>`).join('')}</select>`;
    const sizeSel = (v) => `<label class="f"><span>Tamanho</span>${sel('size', [[0.7, 'Pequeno'], [1, 'Médio'], [1.4, 'Grande']], v)}</label>`;
    const tog = (key, lab, v) => `<label class="f tog"><input type="checkbox" data-o="${key}" ${v ? 'checked' : ''}><b></b><span>${lab}</span></label>`;
    h(`<div class="vhead"><h2>✨ Efeitos</h2><span class="tag">por cima de qualquer jogo</span></div>
      ${card('likeFountain', '❤️ Chafariz de likes', 'Corações e fotos de quem curtiu sobem pela tela.', `<label class="f"><span>Quantidade</span>${sel('amount', [['few', 'Poucos'], ['some', 'Alguns'], ['lots', 'Muitos']], E.likeFountain.amount)}</label><label class="f"><span>De onde saem</span>${sel('from', [['anywhere', 'De todo lado'], ['left', 'Esquerda'], ['middle', 'Meio'], ['right', 'Direita']], E.likeFountain.from)}</label>${sizeSel(E.likeFountain.size)}${tog('pics', 'Mostrar a foto de quem curtiu', E.likeFountain.pics)}`, 'like')}
      ${card('followBalloon', '🎈 Balão de seguidor', 'Cada novo seguidor sobe num balão com a foto.', `${sizeSel(E.followBalloon.size)}${tog('sound', 'Som', E.followBalloon.sound)}`, 'follow')}
      ${card('sharePlane', '✈️ Avião de compartilhamento', 'Um aviãozinho de papel atravessa a tela com o nome de quem compartilhou.', `${sizeSel(E.sharePlane.size)}<label class="f"><span>Rastro</span>${sel('trail', [['both', 'Ar e papel'], ['none', 'Nenhum']], E.sharePlane.trail)}</label>${tog('sound', 'Som', E.sharePlane.sound)}`, 'share')}
      ${card('giftFirework', '🎆 Fogos de presente', 'A foto de quem mandou sobe e explode em anéis do presente. 5+ presentes fazem 2 anéis, 20+ fazem 3.', `<label class="f"><span>Presente mínimo (moedas, conta o combo)</span><input type="number" data-o="min" min="1" value="${E.giftFirework.min}"></label>${sizeSel(E.giftFirework.size)}${tog('name', 'Mostrar o nome', E.giftFirework.name)}${tog('sound', 'Som', E.giftFirework.sound)}`, 'firework')}
      ${card('giftFx', '🎁 Presente na tela', 'Animação do presente para os presentes baratos.', `<label class="f"><span>Até quantas moedas</span><input type="number" data-o="max" min="1" value="${E.giftFx.max}"></label>${sizeSel(E.giftFx.size)}${tog('sound', 'Som', E.giftFx.sound)}`, 'giftfx')}`);
    qa('[data-e]').forEach((p) => {
      const k = p.dataset.e;
      qa('[data-o]', p).forEach((inp) => inp.addEventListener('change', () => { E[k][inp.dataset.o] = inp.type === 'checkbox' ? inp.checked : isNaN(Number(inp.value)) || inp.value === '' ? inp.value : Number(inp.value); save(); }));
      q('[data-test]', p).addEventListener('click', (e) => busDo({ t: 'fx', kind: e.target.dataset.test }));
    });
  };

  const soundOptions = (v) => `<option value="">Sem som</option>${Object.entries(SOUNDS).map(([k, [n]]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${n}</option>`).join('')}${(liveCfg.dj?.pads || []).filter((p) => p.src.startsWith('/')).map((p) => `<option value="${esc(p.src)}" ${p.src === v ? 'selected' : ''}>🎵 ${esc(p.name)}</option>`).join('')}`;
  RENDER.alertas = () => {
    const A = liveCfg.alerts;
    const save = () => liveCfg.save('alerts', A);
    const TYPES = [['gift', '🎁 Alerta de presente', 'Quando alguém manda um presente.'], ['follow', '⭐ Alerta de seguidor', 'Quando alguém segue você.'], ['share', '🔁 Alerta de compartilhamento', 'Quando alguém compartilha a live.'], ['join', '👋 Alerta de entrada', 'Quando alguém entra na live.'], ['likes', '❤️ Alerta de likes', 'Quando uma pessoa manda muitos likes.']];
    const look = (o, path) => `
      <label class="f"><span>Texto na tela <i class="hint" title="Use {user}, {gift}, {count}, {coins}">?</i></span><input data-p="${path}.text" value="${esc(o.text || '')}"></label>
      <label class="f"><span>Linha de baixo</span><input data-p="${path}.sub" value="${esc(o.sub || '')}"></label>
      <div class="grid2">
        <label class="f"><span>Som</span><select data-p="${path}.sound">${soundOptions(o.sound)}</select></label>
        <label class="f"><span>Onde</span><select data-p="${path}.pos">${[['top', 'Em cima'], ['middle', 'Meio'], ['bottom', 'Embaixo']].map(([a, b]) => `<option value="${a}" ${a === o.pos ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
        <label class="f"><span>Tamanho</span><select data-p="${path}.size">${[['small', 'Pequeno'], ['medium', 'Médio'], ['large', 'Grande']].map(([a, b]) => `<option value="${a}" ${a === o.size ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
        <label class="f"><span>Estilo</span><select data-p="${path}.style">${[['bubble', 'Balão'], ['burst', 'Explosão'], ['sticker', 'Adesivo']].map(([a, b]) => `<option value="${a}" ${a === o.style ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
        <label class="f"><span>Cor</span><input type="color" data-p="${path}.color" value="${o.color || '#ff2d55'}"></label>
        <label class="f"><span>Segundos</span><input type="number" min="1" max="20" data-p="${path}.secs" value="${o.secs || 4}"></label>
      </div>
      <label class="f tog"><input type="checkbox" data-p="${path}.read" ${o.read ? 'checked' : ''}><b></b><span>Ler em voz alta</span></label>
      <div class="f"><span>Imagem ou GIF</span><div class="sl">${o.media ? mediaPrev(o.media) : '<small>nenhuma</small>'}<button data-pm="${path}">Escolher</button>${o.media ? `<button data-pm="${path}" data-clear>Tirar</button>` : ''}</div></div>`;
    const get = (path) => path.split('.').reduce((o, k) => o[k], A);
    h(`<div class="vhead"><h2>🔔 Alertas</h2><label class="tog"><input type="checkbox" id="alOn" ${A.on ? 'checked' : ''}><b></b><span>Alertas ligados</span></label></div>
      <p class="small">O que aparece e toca quando alguém manda presente, segue, compartilha ou entra.</p>
      ${TYPES.map(([k, ttl, d]) => `<details class="panel" ${k === 'gift' ? 'open' : ''}><summary class="ph"><h3>${ttl}</h3><label class="tog mini"><input type="checkbox" data-p="${k}.on" ${A[k].on ? 'checked' : ''}><b></b></label></summary><p class="small">${d}</p>
        ${k === 'gift' ? `<label class="f"><span>Presente mínimo (moedas)</span><input type="number" min="1" data-p="gift.min" value="${A.gift.min || 1}"></label>` : ''}
        ${k === 'likes' ? `<label class="f"><span>Quantos likes de uma pessoa</span><input type="number" min="5" data-p="likes.min" value="${A.likes.min || 100}"></label>` : ''}
        ${k === 'join' ? `<label class="f tog"><input type="checkbox" data-p="join.once" ${A.join.once ? 'checked' : ''}><b></b><span>Cumprimentar cada pessoa só uma vez</span></label><label class="f"><span>No máximo um a cada (segundos)</span><input type="number" min="0" data-p="join.gap" value="${A.join.gap || 3}"></label>` : ''}
        ${look(A[k], k)}
        ${k === 'gift' ? `<h4>Variações para presentes grandes</h4>${(A.gift.variations || []).map((v, i) => `<div class="var"><div class="ph"><b>Variação ${i + 1}</b><button data-delvar="${i}">Remover</button></div>
          <label class="f"><span>Presente específico (vazio = qualquer um acima do mínimo)</span><input list="giftList3" data-varg="${i}" value="${esc(v.giftId ? giftLabel(v) : '')}"></label>
          <label class="f"><span>Valor mínimo (moedas)</span><input type="number" min="1" data-p="gift.variations.${i}.min" value="${v.min || 100}"></label>${look(v, 'gift.variations.' + i)}</div>`).join('')}
          <datalist id="giftList3">${giftOptions()}</datalist><button data-addvar>+ Adicionar variação</button>` : ''}
        <button data-test="${k}">▶ Testar na live</button></details>`).join('')}
      <div class="panel"><h3>🏁 Marcos</h3><p class="small">Comemora quando a live chega a um total, ex.: a cada 10.000 likes.</p>
        ${(A.milestones || []).map((m, i) => `<div class="var"><div class="grid2"><label class="f"><span>Métrica</span><select data-p="milestones.${i}.metric">${[['likes', 'Likes'], ['coins', 'Moedas'], ['followers', 'Seguidores'], ['shares', 'Compartilhamentos'], ['comments', 'Comentários']].map(([a, b]) => `<option value="${a}" ${a === m.metric ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
          <label class="f"><span>A cada</span><input type="number" min="1" data-p="milestones.${i}.every" value="${m.every}"></label></div>
          <label class="f"><span>Texto ({total} e {metric})</span><input data-p="milestones.${i}.text" value="${esc(m.text || 'Chegamos a {total} {metric}!')}"></label>
          <label class="f"><span>Som</span><select data-p="milestones.${i}.sound">${soundOptions(m.sound || 'fanfare')}</select></label>
          <label class="f tog"><input type="checkbox" data-p="milestones.${i}.read" ${m.read ? 'checked' : ''}><b></b><span>Ler em voz alta</span></label>
          <button data-delmile="${i}">Remover marco</button></div>`).join('')}
        <button data-addmile>+ Adicionar marco</button></div>`);
    q('#alOn').addEventListener('change', (e) => { A.on = e.target.checked; save(); });
    qa('[data-p]').forEach((inp) => inp.addEventListener('change', () => {
      const parts = inp.dataset.p.split('.'), key = parts.pop(), obj = get(parts.join('.'));
      obj[key] = inp.type === 'checkbox' ? inp.checked : inp.type === 'number' ? Number(inp.value) : inp.value;
      save();
    }));
    qa('[data-pm]').forEach((b) => b.addEventListener('click', async (e) => {
      e.preventDefault();
      const obj = get(b.dataset.pm);
      if (b.dataset.clear !== undefined) obj.media = '';
      else { const m = await chooseMedia('any'); if (!m) return; obj.media = m.url; }
      save(); RENDER.alertas();
    }));
    qa('[data-varg]').forEach((inp) => inp.addEventListener('change', () => { const m = inp.value.match(/#(\d+)\s*$/); A.gift.variations[Number(inp.dataset.varg)].giftId = m ? m[1] : ''; save(); }));
    q('[data-addvar]')?.addEventListener('click', () => { A.gift.variations = [...(A.gift.variations || []), { on: true, min: 100, text: '{user} mandou {gift}!!!', sub: '{coins} moedas 🔥', sound: 'fanfare', pos: 'middle', size: 'large', color: '#ffc93c', style: 'burst', secs: 6, read: true }]; save(); RENDER.alertas(); });
    qa('[data-delvar]').forEach((b) => b.addEventListener('click', () => { A.gift.variations.splice(Number(b.dataset.delvar), 1); save(); RENDER.alertas(); }));
    q('[data-addmile]').addEventListener('click', () => { A.milestones = [...(A.milestones || []), { id: 'm' + Date.now(), on: true, metric: 'likes', every: 10000, text: 'Chegamos a {total} {metric}!', sound: 'fanfare', read: true }]; save(); RENDER.alertas(); });
    qa('[data-delmile]').forEach((b) => b.addEventListener('click', () => { A.milestones.splice(Number(b.dataset.delmile), 1); save(); RENDER.alertas(); }));
    qa('[data-test]').forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault();
      const u = fakeUser(), k = b.dataset.test;
      const ev = k === 'gift' ? { type: 'gift', user: u, name: 'Rosquinha', diamonds: 30, count: 3, giftId: '5879' } : k === 'likes' ? { type: 'like', user: u, count: (A.likes.min || 100) } : k === 'join' ? { type: 'join', user: { ...u, id: 'sim_' + Date.now() } } : { type: 'social', user: u, action: k };
      busDo({ t: 'alertTest', ev });
    }));
  };
  const mediaPrev = (src) => (/\.(mp4|webm)/.test(src) ? '<span>🎞️ vídeo</span>' : `<img class="thumb" src="${esc(src)}" alt="">`);

  let moveMode = false;
  RENDER.widgets = () => {
    const list = liveCfg.widgets;
    const save = () => liveCfg.save('widgets', list);
    const extra = (w) => {
      const t = w.type, f = (k, lab, type = 'text', more = '') => `<label class="f"><span>${lab}</span><input data-w="${k}" type="${type}" value="${esc(w[k] ?? '')}" ${more}></label>`;
      let s = '';
      if ('title' in WIDGET_TYPES[t].def) s += f('title', 'Título');
      if ('target' in WIDGET_TYPES[t].def) s += f('target', 'Meta', 'number', 'min="1"');
      if (t === 'giftCountGoal') s += `<label class="f"><span>Presente</span><input data-wg list="giftList4" value="${esc(w.giftId ? giftLabel(w) : '')}"></label>`;
      if ('n' in WIDGET_TYPES[t].def) s += f('n', 'Quantos mostrar', 'number', 'min="1" max="10"');
      if (t === 'timer') s += f('minutes', 'Minutos', 'number', 'min="1"') + f('secsPerCoin', 'Segundos somados por moeda (0 = presentes não somam)', 'number', 'min="0" step="0.1"') + f('max', 'Máximo no relógio (minutos)', 'number', 'min="1"')
        + `<div class="row wrap"><button data-tm="add" data-v="60">+1 min</button><button data-tm="add" data-v="300">+5 min</button><button data-tm="pause">⏯ Pausar</button><button data-tm="reset">↺ Zerar</button></div>`;
      if (t === 'ticker') s += `<label class="f"><span>Mensagens (uma por linha)</span><textarea data-w="text" rows="3">${esc(w.text || '')}</textarea></label>` + f('speed', 'Velocidade', 'number', 'min="10" max="300"') + `<label class="f"><span>Direção</span><select data-w="dir"><option value="left" ${w.dir !== 'up' ? 'selected' : ''}>Para o lado</option><option value="up" ${w.dir === 'up' ? 'selected' : ''}>Para cima</option></select></label>`;
      if (t === 'media') s += `<div class="f"><span>Mídia</span><div class="sl">${w.src ? mediaPrev(w.src) : '<small>nenhuma</small>'}<button data-wm>Escolher</button></div></div>` + f('w', 'Largura', 'number', 'min="40" max="720"');
      return s + f('scale', 'Escala', 'number', 'min="0.3" max="3" step="0.1"');
    };
    h(`<div class="vhead"><h2>🧩 Widgets</h2><label class="tog"><input type="checkbox" id="moveMode" ${moveMode ? 'checked' : ''}><b></b><span>Mover na tela (arraste no jogo)</span></label></div>
      <datalist id="giftList4">${giftOptions()}</datalist>
      <div class="panel"><h3>Adicionar</h3><div class="addw">${Object.entries(WIDGET_TYPES).map(([k, t]) => `<button data-add="${k}" title="${esc(t.desc)}"><span>${t.icon}</span>${esc(t.name)}</button>`).join('')}</div></div>
      ${list.map((w, i) => `<details class="panel" data-i="${i}" open><summary class="ph"><h3>${WIDGET_TYPES[w.type]?.icon} ${esc(WIDGET_TYPES[w.type]?.name)}</h3><span><label class="tog mini"><input type="checkbox" data-on ${w.on !== false ? 'checked' : ''}><b></b></label><button data-rm>✕</button></span></summary>${extra(w)}</details>`).join('')}`);
    q('#moveMode').addEventListener('change', (e) => { moveMode = e.target.checked; ovl.classList.toggle('moving', moveMode); });
    qa('[data-add]').forEach((b) => b.addEventListener('click', () => { const t = b.dataset.add; list.push({ id: 'w' + Date.now(), type: t, on: true, x: 20, y: 160 + (list.length % 6) * 90, scale: 1, ...structuredClone(WIDGET_TYPES[t].def) }); save(); RENDER.widgets(); }));
    qa('details[data-i]').forEach((p) => {
      const w = list[Number(p.dataset.i)];
      q('[data-on]', p).addEventListener('change', (e) => { w.on = e.target.checked; save(); });
      q('[data-rm]', p).addEventListener('click', (e) => { e.preventDefault(); list.splice(Number(p.dataset.i), 1); save(); RENDER.widgets(); });
      qa('[data-w]', p).forEach((inp) => inp.addEventListener('change', () => { w[inp.dataset.w] = inp.type === 'number' ? Number(inp.value) : inp.value; if (w.type === 'timer' && ['minutes'].includes(inp.dataset.w)) widgets.timers[w.id] = w.minutes * 60; save(); }));
      q('[data-wg]', p)?.addEventListener('change', (e) => { const m = e.target.value.match(/#(\d+)\s*$/); w.giftId = m ? m[1] : ''; w.giftName = m ? giftInfo(m[1])?.name : e.target.value; save(); });
      q('[data-wm]', p)?.addEventListener('click', async () => { const m = await chooseMedia('any'); if (m) { w.src = m.url; save(); RENDER.widgets(); } });
      qa('[data-tm]', p).forEach((b) => b.addEventListener('click', () => busDo({ t: 'timer', id: w.id, cmd: b.dataset.tm, v: Number(b.dataset.v) || 0 })));
    });
  };
  // Arrastar widgets direto na tela do jogo
  let drag = null;
  ovl.addEventListener('pointerdown', (e) => {
    if (!moveMode) return;
    const el = e.target.closest('.widget');
    if (!el) return;
    const w = liveCfg.widgets.find((x) => x.id === el.dataset.id);
    const k = W / $('stageBox').clientWidth;
    drag = { w, el, sx: e.clientX, sy: e.clientY, x: w.x ?? 20, y: w.y ?? 200, k };
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  ovl.addEventListener('pointermove', (e) => { if (!drag) return; drag.w.x = Math.round(drag.x + (e.clientX - drag.sx) * drag.k); drag.w.y = Math.round(drag.y + (e.clientY - drag.sy) * drag.k); drag.el.style.left = drag.w.x + 'px'; drag.el.style.top = drag.w.y + 'px'; });
  ovl.addEventListener('pointerup', () => { if (drag) { liveCfg.save('widgets', liveCfg.widgets); drag = null; } });

  let djEdit = false;
  RENDER.dj = () => {
    const cfg = djPad.cfg;
    const save = () => liveCfg.save('dj', cfg);
    h(`<div class="vhead"><h2>🎛️ DJ Pad</h2><label class="tog"><input type="checkbox" id="djEdit" ${djEdit ? 'checked' : ''}><b></b><span>Editar pads</span></label></div>
      <p class="small">Toque um som na live na hora. Cada pad também pode tocar sozinho com um presente, comentário, seguir, compartilhar ou entrada.</p>
      <div class="pads" style="--cols:${cfg.cols || 4}">${cfg.pads.map((p, i) => `<button class="pad ${p.on === false ? 'off' : ''}" data-pad="${i}" style="--pc:${p.color}"><b>${esc(p.name)}</b><small>${p.trigger && p.trigger !== 'manual' ? TRIGGERS[p.trigger]?.icon + (p.keyword ? ' ' + esc(p.keyword) : '') : ''}</small></button>`).join('')}</div>
      ${djEdit ? `<datalist id="giftList5">${giftOptions()}</datalist>${cfg.pads.map((p, i) => `<details class="panel" data-pi="${i}"><summary class="ph"><h3 style="color:${p.color}">${esc(p.name)}</h3><button data-rm>✕</button></summary>
        <label class="f"><span>Nome</span><input data-k="name" value="${esc(p.name)}"></label>
        <div class="grid2"><label class="f"><span>Som pronto</span><select data-k="src">${soundOptions(p.src)}</select></label><label class="f"><span>Cor</span><input type="color" data-k="color" value="${p.color}"></label></div>
        <div class="row"><button data-up>⬆ Enviar MP3</button><input data-url placeholder="ou cole um link de MP3/OGG/WAV"></div>
        <label class="f"><span>Tocar sozinho com</span><select data-k="trigger">${[['manual', 'Só quando eu apertar'], ['gift', '🎁 Presente'], ['comment', '💬 Palavra no chat'], ['follow', '⭐ Seguir'], ['share', '🔁 Compartilhar'], ['join', '👋 Entrada']].map(([a, b]) => `<option value="${a}" ${a === (p.trigger || 'manual') ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
        ${p.trigger === 'gift' ? `<label class="f"><span>Presente (vazio = qualquer um acima do mínimo)</span><input data-g list="giftList5" value="${esc(p.giftId ? giftLabel(p) : '')}"></label><label class="f"><span>Mínimo de moedas</span><input type="number" data-k="min" value="${p.min || 1}"></label>` : ''}
        ${p.trigger === 'comment' ? `<label class="f"><span>Palavra(s) no chat</span><input data-k="keyword" value="${esc(p.keyword || '')}"></label>` : ''}
        <label class="f tog"><input type="checkbox" data-k="on" ${p.on !== false ? 'checked' : ''}><b></b><span>Ativo</span></label></details>`).join('')}
        <div class="row"><button id="addPad">+ Novo pad</button><label class="small inl">Colunas <input id="djCols" type="number" min="2" max="6" value="${cfg.cols || 4}" style="width:60px"></label><button id="djReset">Restaurar padrão</button></div>` : ''}`);
    q('#djEdit').addEventListener('change', (e) => { djEdit = e.target.checked; RENDER.dj(); });
    qa('[data-pad]').forEach((b) => b.addEventListener('click', () => { const p = cfg.pads[Number(b.dataset.pad)]; busDo({ t: 'dj', id: p.id }); b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 200); }));
    if (!djEdit) return;
    qa('[data-pi]').forEach((d) => {
      const p = cfg.pads[Number(d.dataset.pi)];
      qa('[data-k]', d).forEach((inp) => inp.addEventListener('change', () => { p[inp.dataset.k] = inp.type === 'checkbox' ? inp.checked : inp.type === 'number' ? Number(inp.value) : inp.value; if (inp.dataset.k === 'src') p.name = SOUNDS[inp.value]?.[0] || p.name; save(); if (['trigger', 'src', 'name', 'color'].includes(inp.dataset.k)) RENDER.dj(); }));
      q('[data-g]', d)?.addEventListener('change', (e) => { const m = e.target.value.match(/#(\d+)\s*$/); p.giftId = m ? m[1] : ''; save(); });
      q('[data-up]', d).addEventListener('click', async () => { const m = await chooseMedia('audio'); if (m) { p.src = m.url; p.name = trim(m.name, 20); save(); RENDER.dj(); } });
      q('[data-url]', d).addEventListener('change', (e) => { if (/^https?:\/\//.test(e.target.value)) { p.src = e.target.value.trim(); save(); RENDER.dj(); } });
      q('[data-rm]', d).addEventListener('click', (e) => { e.preventDefault(); cfg.pads.splice(Number(d.dataset.pi), 1); save(); RENDER.dj(); });
    });
    q('#addPad').addEventListener('click', () => { cfg.pads.push({ id: 'pad' + Date.now(), name: 'Novo som', src: 'pop', color: pick(COLORS), trigger: 'manual', on: true }); save(); RENDER.dj(); });
    q('#djCols').addEventListener('change', (e) => { cfg.cols = clamp(Number(e.target.value) || 4, 2, 6); save(); RENDER.dj(); });
    q('#djReset').addEventListener('click', () => { if (confirm('Voltar o DJ Pad ao padrão?')) { cfg.pads = structuredClone(DJ_DEFAULT_PADS); save(); RENDER.dj(); } });
  };

  RENDER.musica = () => {
    const c = music.cfg;
    const save = () => liveCfg.save('music', c);
    h(`<div class="vhead"><h2>🎵 Música de fundo</h2><span class="tag">${music.playing ? '▶ tocando: ' + esc(music.now || '') : 'parada'}</span></div>
      <div class="panel"><div class="row"><button id="mPlay" class="primary">${music.playing ? '⏹ Parar' : '▶ Tocar'}</button><button id="mNext">⏭ Próxima</button></div>
        <label class="f"><span>Volume da música</span><input type="range" id="mVol" min="0" max="1" step="0.05" value="${mixer.vol.music}"></label>
        <label class="f"><span>Fonte</span><select id="mMode"><option value="gen" ${c.mode !== 'list' ? 'selected' : ''}>Trilhas geradas (sem direitos autorais)</option><option value="list" ${c.mode === 'list' ? 'selected' : ''}>Minha playlist (MP3)</option></select></label>
        ${c.mode !== 'list' ? `<label class="f"><span>Estilo</span><select id="mStyle">${Object.entries(MUSIC_STYLES).map(([k, s]) => `<option value="${k}" ${k === c.style ? 'selected' : ''}>${s.name}</option>`).join('')}</select></label>`
        : `<div class="tracks">${c.tracks.map((t, i) => `<div class="trk"><span>${i + 1}. ${esc(t.name)}</span><button data-rm="${i}">✕</button></div>`).join('') || '<p class="small">Nenhuma música. Envie MP3 abaixo.</p>'}</div>
          <div class="row"><button id="mUp">+ Enviar MP3</button><label class="f tog"><input type="checkbox" id="mShuf" ${c.shuffle ? 'checked' : ''}><b></b><span>Aleatório</span></label></div>`}
        <p class="small">A música toca em loop na tela da live. Use só músicas que você tem direito de usar.</p></div>`);
    q('#mPlay').addEventListener('click', () => { busDo({ t: 'music', cmd: music.playing ? 'stop' : 'play' }); setTimeout(RENDER.musica, 100); });
    q('#mNext').addEventListener('click', () => busDo({ t: 'music', cmd: 'next' }));
    q('#mVol').addEventListener('input', (e) => setMix('music', Number(e.target.value)));
    q('#mMode').addEventListener('change', (e) => { c.mode = e.target.value; save(); if (music.playing) busDo({ t: 'music', cmd: 'play' }); RENDER.musica(); });
    q('#mStyle')?.addEventListener('change', (e) => { c.style = e.target.value; save(); if (music.playing) busDo({ t: 'music', cmd: 'play' }); });
    q('#mUp')?.addEventListener('click', async () => { const m = await chooseMedia('audio'); if (m) { c.tracks.push({ id: 't' + Date.now(), name: m.name, src: m.url }); save(); RENDER.musica(); } });
    q('#mShuf')?.addEventListener('change', (e) => { c.shuffle = e.target.checked; save(); });
    qa('[data-rm]').forEach((b) => b.addEventListener('click', () => { c.tracks.splice(Number(b.dataset.rm), 1); save(); RENDER.musica(); }));
  };
  // Volume vale para todas as telas: vai junto da configuração de voz.
  function setMix(k, v) { mixer.set(k, v); liveCfg.save('stream', { ...liveCfg.stream, mix: { ...mixer.vol } }); }

  // Personagens 3D: quais entram nos jogos, um fixo para todos, e se o espectador pode escolher pelo chat (!nome).
  RENDER.personagens = () => {
    const cfg = charCfg();
    const kinds = Object.keys(CHARACTERS).filter((k) => !CHARACTERS[k].undead);
    const group = (title, list, note) => `<div class="panel"><h3>${title}</h3>${note ? `<p class="note">${note}</p>` : ''}<div class="chgrid">${list.map((k) => {
      const d = CHARACTERS[k], on = cfg.enabled.includes(k);
      return `<label class="chcard ${on ? 'on' : ''}" style="--c1:${d.accent}"><input type="checkbox" data-ch="${k}" ${on ? 'checked' : ''}>
        <span class="chimg"><img src="/assets/chars/fotos/${k}.webp" alt="" onerror="this.remove()"><i>${esc(d.name[0])}</i></span>
        <b>${esc(d.name)}</b><small>${d.family === 'static' ? 'movimento simples' : 'animações completas'} · <code>!${esc(norm(d.name).replace(/\s+/g, ''))}</code></small></label>`;
    }).join('')}</div></div>`;
    h(`<div class="vhead"><h2>🧍 Personagens 3D</h2><span class="tag">${HERO_KINDS.length} ativos</span></div>
      <div class="panel"><h3>Como escolher</h3>
        <label class="f tog"><input type="checkbox" id="chPick" ${cfg.viewerPick ? 'checked' : ''}><b></b><span>Espectador escolhe o próprio personagem comentando <b>!nome</b> (ex.: <code>!sapo</code>, <code>!astronauta</code>)</span></label>
        <label class="f"><span>Personagem fixo para todos (vazio = cada espectador ganha um dos ativos)</span><select id="chFixed"><option value="">— cada um o seu —</option>${kinds.map((k) => `<option value="${k}" ${cfg.fixed === k ? 'selected' : ''}>${esc(CHARACTERS[k].name)}</option>`).join('')}</select></label>
        <div class="row"><button id="chAll">Ativar todos</button><button id="chPack">Só o pacote novo</button><button id="chKay">Só os clássicos</button></div>
        <p class="note">Vale para os jogos 3D com personagens: Lutadores, Arena de Batalha, Pista de Dança, as escaladas e outros. Quem já está na tela troca quando entrar de novo.</p></div>
      ${group('Pacote novo', PACK_KINDS, 'Os de movimento simples não têm esqueleto: pulam, inclinam, giram e amassam/esticam.')}
      ${group('Clássicos (KayKit)', KAYKIT_HEROES)}`);
    const save = (patch) => { liveCfg.save('chars', { ...charCfg(), ...patch }); RENDER.personagens(); };
    qa('[data-ch]').forEach((cb) => cb.addEventListener('change', () => {
      const en = new Set(charCfg().enabled); cb.checked ? en.add(cb.dataset.ch) : en.delete(cb.dataset.ch);
      if (!en.size) { toastMsg('Deixe pelo menos um personagem ativo'); cb.checked = true; return; }
      save({ enabled: [...en] });
    }));
    q('#chPick').addEventListener('change', (e) => save({ viewerPick: e.target.checked }));
    q('#chFixed').addEventListener('change', (e) => save({ fixed: e.target.value }));
    q('#chAll').addEventListener('click', () => save({ enabled: kinds }));
    q('#chPack').addEventListener('click', () => save({ enabled: [...PACK_KINDS] }));
    q('#chKay').addEventListener('click', () => save({ enabled: [...KAYKIT_HEROES] }));
  };

  RENDER.voz = () => {
    const st = liveCfg.stream;
    const save = () => liveCfg.save('stream', st);
    h(`<div class="vhead"><h2>🗣️ Voz, chat e moderação</h2></div>
      <div class="panel"><h3>Voz</h3>
        <label class="f"><span>Voz padrão (leitor, alertas, shoutouts e jogos)</span><div class="sl"><select id="vVoice">${VOICES.map((v) => `<option value="${v.id}" ${v.id === st.voice ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select><button id="vPrev">▶ Ouvir</button></div></label>
        <div class="mixer">${[['master', 'Geral'], ['game', 'Sons do jogo'], ['voice', 'Voz'], ['music', 'Música'], ['fx', 'Alertas e efeitos'], ['dj', 'DJ Pad']].map(([k, n]) => `<label class="f"><span>${n}</span><input type="range" data-mix="${k}" min="0" max="1" step="0.05" value="${mixer.vol[k]}"></label>`).join('')}</div>
        <label class="f tog"><input type="checkbox" id="vHere" ${st.audioOnPanel ? 'checked' : ''}><b></b><span>Tocar o som também neste painel (com a tela da live aberta o painel fica mudo, para não dar eco)</span></label>
        <p class="small" id="aiStatus">IA: verificando…</p></div>
      <div class="panel"><h3>Leitor de comentários</h3>
        <label class="f tog"><input type="checkbox" data-s="readComments" ${st.readComments ? 'checked' : ''}><b></b><span>Ler os comentários em voz alta</span></label>
        <label class="f"><span>Formato ({user} e {comment})</span><input data-s="readFormat" value="${esc(st.readFormat)}"></label>
        <div class="grid2"><label class="f"><span>Máximo de letras</span><input type="number" data-s="readMax" min="10" max="300" value="${st.readMax}"></label>
        <label class="f"><span>Uma leitura por pessoa a cada (s)</span><input type="number" data-s="readGap" min="0" max="60" value="${st.readGap}"></label></div></div>
      <div class="panel"><h3>Shoutouts</h3>
        <label class="f tog"><input type="checkbox" data-s="readShoutouts" ${st.readShoutouts ? 'checked' : ''}><b></b><span>Ler os shoutouts em voz alta</span></label>
        <label class="f"><span>Mensagem para alguém ({username})</span><input data-s="shoutoutMsg" value="${esc(st.shoutoutMsg)}"></label>
        <label class="f"><span>Mensagem sem pessoa</span><input data-s="shoutoutNoUser" value="${esc(st.shoutoutNoUser)}"></label>
        <p class="small">Clique em 📣 ao lado de um comentário no chat para dar shoutout.</p>
        <div class="row"><button id="shoutAll">📣 Shoutout geral</button></div></div>
      <div class="panel"><h3>Moderação</h3>
        <label class="f tog"><input type="checkbox" data-s="profanity" ${st.profanity !== false ? 'checked' : ''}><b></b><span>Pular palavrões no que é falado</span></label>
        <label class="f"><span>Palavras bloqueadas (separadas por vírgula)</span><input id="vMute" value="${esc((st.muteWords || []).join(', '))}"></label>
        <label class="f tog"><input type="checkbox" data-s="countSim" ${st.countSim !== false ? 'checked' : ''}><b></b><span>Simulador também soma no placar salvo</span></label></div>`);
    q('#vVoice').addEventListener('change', (e) => { st.voice = e.target.value; save(); });
    q('#vPrev').addEventListener('click', () => busDo({ t: 'say', text: 'Olá! Essa é a voz que vai falar na sua live.', voice: q('#vVoice').value }));
    qa('[data-mix]').forEach((r) => r.addEventListener('input', () => setMix(r.dataset.mix, Number(r.value))));
    q('#vHere').addEventListener('change', (e) => { st.audioOnPanel = e.target.checked; save(); updateAudioHere(); });
    qa('[data-s]').forEach((inp) => inp.addEventListener('change', () => { st[inp.dataset.s] = inp.type === 'checkbox' ? inp.checked : inp.type === 'number' ? Number(inp.value) : inp.value; save(); }));
    q('#vMute').addEventListener('change', (e) => { st.muteWords = e.target.value.split(',').map((x) => x.trim()).filter(Boolean); save(); });
    q('#shoutAll').addEventListener('click', () => busDo({ t: 'shout', user: null }));
    fetch('/api/ai-status').then((r) => r.json()).then((j) => { q('#aiStatus') && (q('#aiStatus').innerHTML = j.provider === 'claude' ? `IA: <b>Claude</b> (${esc(j.model)}) ligado pela chave ANTHROPIC_API_KEY do Render.` : 'IA: serviço <b>grátis</b> (sem chave). Para respostas melhores, coloque a chave ANTHROPIC_API_KEY no Render.'); }).catch(() => {});
  };

  RENDER.placar = () => {
    const g = current;
    const rows = scores.top(g.id, 100);
    h(`<div class="vhead"><h2>🏆 Placar salvo</h2><select id="scGame">${GAMES.filter((x) => x.v2).map((x) => `<option value="${x.id}" ${x === g ? 'selected' : ''}>${x.icon} ${esc(x.name)}</option>`).join('')}</select></div>
      <div class="panel"><p class="small">Pontos que os espectadores juntaram em cada jogo, guardados neste navegador.</p>
      <div id="scList"></div><div class="row"><button id="scCsv">⬇ Baixar planilha (CSV)</button><button id="scClear" class="danger">Zerar este jogo</button></div></div>`);
    const draw = (id) => {
      const r = scores.top(id, 100);
      q('#scList').innerHTML = r.length ? `<table class="tbl"><tr><th>#</th><th>Pessoa</th><th>Pontos</th><th>Vitórias</th></tr>${r.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.nick)}</td><td>${fmtNum(x.pts)}</td><td>${x.wins || 0}</td></tr>`).join('')}</table>` : '<p class="small">Ninguém pontuou ainda.</p>';
    };
    draw(g.id);
    q('#scGame').addEventListener('change', (e) => draw(e.target.value));
    q('#scCsv').addEventListener('click', () => {
      const id = q('#scGame').value, r = scores.top(id, 100000);
      const csv = 'posicao,pessoa,pontos,vitorias\n' + r.map((x, i) => `${i + 1},"${String(x.nick).replace(/"/g, '""')}",${x.pts},${x.wins || 0}`).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `placar-${id}.csv`; a.click();
    });
    q('#scClear').addEventListener('click', () => { const id = q('#scGame').value; if (confirm('Apagar o placar deste jogo?')) { scores.clear(id); draw(id); } });
    void rows;
  };

  // ---------- Histórico das lives ----------
  const history = {
    cur: null,
    start() { this.end(); this.cur = { user: wantedUser, start: Date.now(), likes: 0, coins: 0, comments: 0, followers: 0, shares: 0, gifts: 0, games: {}, top: {} }; this.gameT = performance.now(); this.game = current.id; },
    tickGame() { if (!this.cur) return; const now = performance.now(); this.cur.games[this.game] = (this.cur.games[this.game] || 0) + (now - this.gameT) / 1000; this.gameT = now; this.game = current.id; },
    onEvent(ev) {
      const c = this.cur;
      if (!c || ev.user?.id?.startsWith('sim_')) return; // só atividade real conta
      if (ev.type === 'chat') c.comments++;
      else if (ev.type === 'like') c.likes += ev.count || 1;
      else if (ev.type === 'gift') { const v = coins(ev); c.coins += v; c.gifts += ev.count || 1; const k = ev.user?.nick || '?'; c.top[k] = (c.top[k] || 0) + v; }
      else if (ev.type === 'social') ev.action === 'share' ? c.shares++ : c.followers++;
    },
    end() {
      if (!this.cur) return;
      this.tickGame();
      this.cur.end = Date.now();
      if (this.cur.end - this.cur.start > 60000) { const all = store.get('history', []); all.unshift(this.cur); store.set('history', all.slice(0, 200)); }
      this.cur = null;
    },
  };
  addEventListener('pagehide', () => history.end());
  RENDER.historico = () => {
    history.tickGame();
    const all = [...(history.cur ? [{ ...history.cur, live: true }] : []), ...store.get('history', [])];
    const dur = (s) => `${Math.floor(s / 3600) ? Math.floor(s / 3600) + 'h ' : ''}${Math.floor((s % 3600) / 60)}min`;
    const gname = (id) => GAMES.find((x) => x.id === id)?.name || id;
    const tot = all.reduce((a, x) => ({ likes: a.likes + x.likes, coins: a.coins + x.coins, followers: a.followers + x.followers, lives: a.lives + 1 }), { likes: 0, coins: 0, followers: 0, lives: 0 });
    h(`<div class="vhead"><h2>📊 Histórico</h2><span class="tag">só atividade real do TikTok</span></div>
      <div class="kpis"><div><b>${tot.lives}</b><small>lives</small></div><div><b>${fmtK(tot.likes)}</b><small>likes</small></div><div><b>${fmtK(tot.coins)}</b><small>moedas</small></div><div><b>${fmtK(tot.followers)}</b><small>seguidores</small></div></div>
      ${all.map((x) => `<div class="panel hist"><div class="ph"><h3>${x.live ? '🔴 Agora' : new Date(x.start).toLocaleString('pt-BR')} · @${esc(x.user || '')}</h3><span class="tag">${dur(((x.end || Date.now()) - x.start) / 1000)}</span></div>
        <div class="kpis small4"><div><b>${fmtK(x.likes)}</b><small>likes</small></div><div><b>${fmtK(x.coins)}</b><small>moedas</small></div><div><b>${fmtK(x.comments)}</b><small>coment.</small></div><div><b>${x.followers}</b><small>seguidores</small></div><div><b>${x.shares}</b><small>compart.</small></div></div>
        <p class="small">Jogos: ${Object.entries(x.games).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, s]) => `${esc(gname(id))} (${dur(s)})`).join(' · ') || '—'}</p>
        <p class="small">Top: ${Object.entries(x.top).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, v]) => `${esc(n)} ${fmtK(v)}🪙`).join(' · ') || '—'}</p></div>`).join('') || '<p class="small">Nenhuma live registrada ainda. Uma live entra aqui quando termina ou quando você desconecta.</p>'}
      ${all.length ? '<button id="hClear" class="danger">Apagar histórico</button>' : ''}`);
    q('#hClear')?.addEventListener('click', () => { if (confirm('Apagar todo o histórico?')) { store.set('history', []); RENDER.historico(); } });
  };

  RENDER.tela = () => {
    h(`<div class="vhead"><h2>🖥️ Tela da live</h2><span class="tag" id="peerTag"></span></div>
      <div class="panel"><h3>LIVE Studio (fonte Link) ou OBS — melhor opção</h3>
        <p class="small">Conecte o seu @ aqui. No LIVE Studio: <b>Adicionar fonte → Link</b>, cole o endereço e use <b>1080×1920</b>. No OBS: fonte de navegador com o mesmo tamanho e "Controlar áudio pelo OBS".</p>
        <code id="obsUrl">${esc(obsUrl())}</code><div class="row"><button id="copyUrl">📋 Copiar link</button></div>
        <p class="small">Tudo daqui chega lá: troca de jogo, configurações, gatilhos, simulador, DJ, música, alertas, efeitos, widgets e a voz. O som sai pela tela da live; este painel fica mudo para não dar eco.</p></div>
      <div class="panel"><h3>Janela separada (Captura de janela)</h3>
        <button id="mirrorBtn">${mirrorOn() ? '✅ Tela da Live aberta' : '🖥️ Abrir Tela da Live'}</button>
        <label class="f tog"><input id="mirrorLight" type="checkbox"><b></b><span>Modo leve (720p, para PC mais fraco)</span></label>
        <p class="small">No LIVE Studio, adicione <b>Captura de janela</b> e escolha "Tela da Live". Não minimize nem cubra essa janela.</p></div>`);
    q('#copyUrl').addEventListener('click', () => { navigator.clipboard?.writeText(obsUrl()); toastMsg('Link copiado'); });
    q('#mirrorBtn').addEventListener('click', () => openMirror(q('#mirrorLight').checked));
    updPeers();
  };

  // ---------- Chat da live (coluna da direita) ----------
  const FEED_TYPES = [['chat', '💬'], ['gift', '🎁'], ['like', '❤️'], ['social', '⭐'], ['join', '👋']];
  const feedOn = new Set(store.get('feedOn', ['chat', 'gift', 'social']));
  $('feedFilter').innerHTML = FEED_TYPES.map(([k, ic]) => `<button data-ft="${k}" class="${feedOn.has(k) ? 'on' : ''}">${ic}</button>`).join('');
  $('feedFilter').addEventListener('click', (e) => { const b = e.target.closest('[data-ft]'); if (!b) return; feedOn.has(b.dataset.ft) ? feedOn.delete(b.dataset.ft) : feedOn.add(b.dataset.ft); b.classList.toggle('on'); store.set('feedOn', [...feedOn]); });
  const feedUsers = new Map();
  let feedN = 0;
  window.onFeed = (ev) => {
    history.onEvent(ev);
    if (!feedOn.has(ev.type)) return;
    const who = ev.user?.nick || 'anônimo';
    const k = 'u' + (feedN++ % 400);
    feedUsers.set(k, ev);
    const txt = ev.type === 'chat' ? esc(ev.text) : ev.type === 'like' ? `curtiu ×${ev.count}` : ev.type === 'gift' ? `mandou <b>${esc(ev.name)}</b> ×${ev.count} · ${fmtNum(coins(ev))} 🪙` : ev.type === 'social' ? (ev.action === 'share' ? 'compartilhou a live' : 'começou a seguir') : 'entrou na live';
    const li = document.createElement('li');
    li.className = 'fe fe-' + ev.type;
    li.innerHTML = `${avatarHtml(ev.user)}<div><b>${esc(who)}</b> ${txt}</div><span class="fa"><button data-sh="${k}" title="Shoutout">📣</button>${ev.type === 'chat' && current.answersChat ? `<button data-ans="${k}" title="Responder agora">🎙️</button>` : ''}</span>`;
    const feed = $('feed');
    const atTop = feed.scrollTop < 20;
    feed.prepend(li);
    while (feed.children.length > 200) feed.lastChild.remove();
    if (!atTop) feed.scrollTop += li.offsetHeight;
  };
  $('feed').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ev = feedUsers.get(b.dataset.sh || b.dataset.ans);
    if (!ev) return;
    if (b.dataset.sh) busDo({ t: 'shout', user: ev.user });
    else busDo({ t: 'host', cmd: 'answer', ev });
  });
  $('sayForm').addEventListener('submit', (e) => { e.preventDefault(); const t = $('sayText').value.trim(); if (!t) return; busDo({ t: 'say', text: t }); $('sayText').value = ''; });

  // Números da sessão e top doadores, atualizados de tempos em tempos
  setInterval(() => {
    $('stLikes').textContent = '❤️ ' + fmtK(stats.likes);
    $('stCoins').textContent = '🪙 ' + fmtK(stats.coins);
    $('stFollows').textContent = '⭐ ' + fmtK(stats.followers);
    $('stShares').textContent = '🔁 ' + fmtK(stats.shares);
    const top = stats.top(stats.byCoins, 5);
    const html = top.length ? top.map((r, i) => `<div class="tops"><em>${i + 1}</em>${avatarHtml(r.user)}<span>${esc(trim(r.user?.nick || '', 18))}</span><b>${fmtK(r.value)} 🪙</b></div>`).join('') : '<p class="small">Nenhum presente ainda.</p>';
    if ($('topSide').dataset.h !== html) { $('topSide').dataset.h = html; $('topSide').innerHTML = html; }
  }, 700);
  window.onViewers = (n) => { $('viewers').textContent = '👀 ' + fmtK(n); };

  // ---------- Barra de cima e controles da sessão ----------
  function updPeers() {
    const t = mirrorOn() ? '🖥️ janela aberta' : peers.screens ? `🖥️ ${peers.screens} tela${peers.screens > 1 ? 's' : ''} da live` : wantedUser ? '🖥️ nenhuma tela' : '';
    $('peers').textContent = t;
    const pt = document.getElementById('peerTag'); if (pt) pt.textContent = t;
    const ou = document.getElementById('obsUrl'); if (ou) ou.textContent = obsUrl();
  }
  window.onPeers = updPeers;
  window.onMirror = () => { updPeers(); const b = document.getElementById('mirrorBtn'); if (b) b.textContent = mirrorOn() ? '✅ Tela da Live aberta' : '🖥️ Abrir Tela da Live'; };
  window.onConnectChange = () => { updPeers(); };
  let lastState = '';
  window.onStatus = (state) => {
    if (state === 'connected' && lastState !== 'connected') { history.start(); busDo({ t: 'stats' }); }
    if (state !== 'connected' && lastState === 'connected') history.end();
    lastState = state;
  };
  window.onGameChange = (g) => {
    history.tickGame();
    $('curName').textContent = `${g.icon} ${g.name}`;
    if (curView === 'jogo' || curView === 'placar') show(curView);
    else if (curView === 'jogos') RENDER.jogos();
    updPeers();
  };
  window.onPause = (p) => { $('pauseBtn').textContent = p ? '▶ Continuar' : '⏸ Pausar'; $('pauseBtn').classList.toggle('on', p); };
  $('pauseBtn').addEventListener('click', () => busDo({ t: 'pause', on: !paused }));
  $('panicBtn').addEventListener('click', () => { busDo({ t: 'panic' }); simAuto(false); toastMsg('Tudo parado.'); });
  let muted = false;
  $('muteBtn').addEventListener('click', () => { muted = !muted; $('muteBtn').textContent = muted ? '🔇' : '🔊'; setMix('master', muted ? 0 : 1); });
  window.onPanic = () => { if (curView === 'musica') RENDER.musica(); };
  // Atalhos do DJ Pad: teclas 1–9
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) || e.ctrlKey || e.metaKey) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 9 && djPad.cfg.pads[n - 1]) busDo({ t: 'dj', id: djPad.cfg.pads[n - 1].id });
  });

  if (!$('user').value) $('user').value = store.get('lastUser', '');
  $('curName').textContent = `${current.icon} ${current.name}`;
  show(curView);
})();
