# Jogos Interativos para TikTok LIVE: onde estamos

Este arquivo existe para quem continuar o projeto num chat novo. Leia tudo antes de mexer.
Última atualização: 21/10/2026 (plataforma 3D: personagens GLB, fotos corrigidas, biblioteca com capas).

## Em uma frase
Painel no estilo do **Livecade** (https://app.livecade.io) com 68 jogos (54 novos + 14 clássicos), gatilhos de ação,
alertas, efeitos, widgets, DJ Pad, música, voz neural e apresentador com IA. Sempre 9:16, controlado pela live do TikTok
(comentários, likes, presentes, seguir, compartilhar, entradas). Roda no Render. Uso só do dono: sem cadastro nem planos.

## Links e contas
- **Site no ar:** https://jogos-interativos.onrender.com
- **Repositório:** https://github.com/godnexusia-sketch/jogos-interativos (branch `main`)
- **Render:** serviço `jogos-interativos` (id `srv-dbbd587avr4c73defks0`), plano free, região virginia, auto-deploy a cada push na `main` (~1 min). Arquivo `render.yaml`.
- **Variáveis opcionais no Render:** `ANTHROPIC_API_KEY` (IA pelo Claude; sem ela usa o serviço grátis da Pollinations), `AI_MODEL` (padrão `claude-opus-5-5`), `SIGN_API_KEY` (chave grátis do Euler Stream, se o limite gratuito de assinatura apertar).
- **Conta do TikTok do dono:** `@paidegamers`.
- **O dono quer tudo no Render.** Recusou a Vercel; não usar.

## Como o dono gosta de trabalhar
- Fala português e quer respostas em português simples.
- Quer que eu faça tudo e implemente, para depois ele só aprovar. Não quer muitas perguntas.
- Exigente com visual: design caprichado, 3D quando der, cara de jogo de PC/PS5, **sempre 9:16**, nada esticado.
- Pediu "todas as funções, categorias e jogos do Livecade" e que os jogos de voz respondam as pessoas sozinhos.
- Regras de inspiração: não copiar código nem arte de ninguém (Kyrat, Livecade), não recriar personagens de terceiros (por isso o apresentador IA tem personagens originais e o "Tung Tung" virou "Pancada no Boneco"), não usar marcas da Nintendo. Nomes de jogadores ("Messi x Ronaldo") são só texto editável.

## O que mudou na versão 3D (21/10/2026)
- **Fotos de perfil (corrigido):** o `tiktok-live-connector` 2.x entrega o protobuf cru do TikTok. O servidor lia campos da versão 1 (`uniqueId`, `profilePicture.url`, `comment`, `giftDetails`, `likeCount`), então a foto vinha vazia, o id ficava vazio e o texto, os likes e os presentes vinham errados. Agora `lib/eventos.js` lê `user.id` (id estável), `displayId` (@), `nickname`, `avatarThumb/Medium/Large.urlList` (várias URLs; HEIC por último), `content`, `count/total`, `gift.name/diamondCount/image`. Teste: `node testes/eventos.mjs` (mensagens protobuf reais).
- **Avatar no navegador:** `core.js` tem `picList/userImg/avatar/avatarHtml/loadUserImg`. Toda foto passa por `/api/img` (cache, sem bloqueio de referer, sem canvas contaminado), tenta a próxima URL se uma falhar, tenta de novo depois de 45 s e, sem foto, mostra a inicial numa cor fixa da pessoa (nunca imagem quebrada). O `/api/img` guarda as falhas por 2 min e reconhece imagem pelos bytes. Teste: `node testes/fotos.cjs`.
- **Personagens 3D reais:** `public/lc/char3d.js` — `Assets3D` (carrega GLB sob demanda com `GLTFLoader` + `SkeletonUtils`, servidos em `/vendor/jsm/`), `CHARACTERS` (9 personagens), `Character3D` (animador com estados: idle, fightIdle, walk, run, punch, kick, slash, stab, jumpAttack, spin, block, blockHit, dodge, hit, death, victory, taunt, jump, spawn, cast, powerUp…, transição suave, dano no quadro do golpe via `onImpact`, placa com foto e nome, balão de fala, tinta do time, piscar no dano, reserva procedural se o GLB falhar), `FX3D` (partículas com reserva fixa, anéis, números de dano; respeita movimento reduzido), `CamDirector` (tremida, foco, câmera lenta), `buildArena` (palco, torcida animada pelo "hype" da live, holofotes) e `hudFighter`.
- **Modelos:** `public/assets/chars/` — KayKit Adventurers e Skeletons de Kay Lousberg (CC0, licenças na pasta). Cada personagem só com a malha (~0,3 MB) e `animacoes.glb` (56 animações, 2 MB, ~0,7 MB comprimido). O servidor manda tudo com gzip. Os modelos não têm rosto com expressões (blendshapes): as expressões vêm do corpo (animações), dos balões e dos efeitos.
- **Jogos migrados:** Lutadores 3D (`games/lc/fighters3d.js`, id `stick-fighters`, refeito), Arena de Batalha (`arena3d.js`), Guerra de Territórios (`territory3d.js`), Flappy Batalha (`flappy3d.js`, pássaros 3D procedurais com rosto), Guerra das Torres (`tower3d.js`, construtores, castelo, canhão), Pista de Dança (`dance3d.js`) e a Votação (capas). Os arquivos `*3d.js` mantêm a regra original e trocam a apresentação; sem WebGL, o desenho 2D antigo continua.
- **Biblioteca e identidade visual:** `lc/panel.js` + `lc/panel.css` — destaque do jogo no ar, cartões com capa, selos (NO AR, 3D, IA, VOZ, INDISPONÍVEL sem WebGL 2), botão Iniciar, responsivo. Capas em `public/assets/capas/<id>.webp`, geradas do próprio jogo rodando: `node testes/capas.cjs [ids]`.

## Arquitetura
### Servidor (`server.js`, Node 22, `http` + `ws`)
- Uma conexão com o TikTok por @ (`tiktok-live-connector@2.5.0`, `enableExtendedGiftInfo: false`). A **sala do @ existe enquanto houver alguém conectado, mesmo com a live fora do ar**; a conexão com o TikTok tenta de novo sozinha (30 s offline, 5 s queda).
- Eventos para as telas: `chat`, `like` (com `total`), `gift` (combo contado só no fim; com `giftId` e `img`), `social` (`follow`/`share`), `join`, `viewers`, `status`. O usuário vem com `fol/mod/sub/fan` (para "quem pode jogar").
- Cada cliente diz o papel no `connect` (`role: 'panel' | 'screen'`). O servidor manda `peers` (quantos painéis e telas, e quem é o **líder**: primeiro painel, senão a primeira tela). O líder chama a IA e manda a resposta para os outros.
- Repasse entre as telas do mesmo @: `config` (chaves `set:<jogo>`, `bind:<jogo>`, `live:<alerts|effects|widgets|stream|dj|music>` e as antigas dos clássicos) e `control` (`game`, `reset` com `seed`, `sim`, `press`, `current`, `bus`).
- Rotas: `/api/tts` (voz neural Edge via `msedge-tts`, reserva no Google Tradutor, cache), `/api/voices`, `/api/ai` (Claude com chave ou Pollinations; 30 pedidos/min), `/api/ai-status`, `/api/media` (upload de som/vídeo/imagem para o disco temporário; o painel guarda o original no IndexedDB e reenvia se o Render perder), `/api/wiki` (foto da cidade na Wikipédia, 960 px), `/api/img` (proxy de imagens: TikTok, Roblox, flagcdn, Wikimedia, favicons do Google, mc-heads), `/api/roblox`, `/api/diag`, `/vendor/three.module.min.js`, `/health`.

### Navegador
- `public/index.html` carrega: `core.js`, `ui.js` (base antiga), `data/gifts.js` (1.270 presentes com preço), `lc/engine.js`, `lc/voice.js`, `lc/overlay.js`, `lc/dj.js`, `lc/kit.js`, `three3d.js`, `race3d.js`, os 14 clássicos em `games/*.js`, os novos em `games/lc/*.js`, `app.js` e `lc/panel.js`.
- `app.js`: execução. Conexão, eventos (`handleEvent` → `overlay.onEvent` → jogo), troca de jogo (`selectGame`, com **semente** compartilhada para o painel e a tela sortearem as mesmas perguntas), pacotes `bus` (`busDo` executa aqui e manda; `onBus` recebe: pause, action, fx, alertTest, shout, say, dj, sound, music, timer, panic, stats, host, ptr, ai), simulador (`sim`, `simChat`, `simGift`, `simAuto`, `fakeUser`), encaixe 9:16, laço de desenho, janela Tela da Live (`?mirror=1`, BroadcastChannel).
- `lc/panel.js`: o painel (só fora do `?clean=1`). Seções: jogos, jogo atual (testar ações, gatilhos, configurações), testar, efeitos, alertas, widgets, DJ, música, voz e chat, placar, histórico, tela da live. Chat da live à direita com shoutout e "responder agora".
- `lc/engine.js`: `defineGame` (jogos novos), `GENRES`, `TRIGGERS`, configurações por esquema (`settings` com `type` number/slider/select/toggle/color/text/textarea/media/mediaList/voice/country/note, `group`, `showIf`) salvas em `set:<id>`, **gatilhos** (`bindings` padrão; salvos em `bind:<id>`; `runTriggers`: presente específico > maior mínimo alcançado; likes acumulam por pessoa; comentário por palavra-chave), `testAction`, guia na tela (o que mandar para jogar), `customBackground`, `ai.ask` (só o líder pergunta), `scores` (placar salvo), `Points`, `Queue`, `Phases`, `makeRng`, `answerMatch`, HUD (`hudTitle`, `hudTimer`, `hudBoard`, `hudWinners`).
- `lc/voice.js`: `mixer` (canais master/game/voice/music/fx/dj; `mixer.here` decide se esta página toca som), `VOICES` (16 vozes/personagens), `voice.say` (fila, filtro de palavrões, nível para mexer a boca), leitor de comentários.
- `lc/overlay.js`: `liveCfg` (alerts, effects, widgets, stream, dj, music), `stats` da sessão, `SOUNDS` (24 sons gerados), `playSound`, alertas e widgets em HTML na camada `#ovl` (720×1280 escalada sobre o canvas), efeitos no canvas, `shoutout`.
- `lc/dj.js`: DJ Pad e música (sequenciador com 6 estilos + playlist MP3).
- `lc/kit.js`: visual dos jogos novos (palco, cartão de pergunta, alternativas, confete, vencedor, `Feed`, `narrate`).
- Dados em `public/data/` (quiz, verdadeiro/falso, prefere, o povo diz, associação, contexto, frases, marcas, países, dicionário, desenhos, mapa-múndi). Créditos em `data/CREDITOS.md`.

## Os 68 jogos
- **Clássicos (14, `games/*.js`, `registerGame`, recebem eventos crus no `onEvent`):** votacao (agora com lista configurável de até 16 jogos), simnao, urna, chute, torcida, corrida, kart, cobra, combate, pipa, avatares, flappy, ilha, desfile.
- **Novos (54, `games/lc/*.js`, `defineGame` com ações e gatilhos):**
  - `quiz.js`: trivia-time, million-quiz, true-or-false · `quiz2.js`: would-you-rather, quick-math, memory-maestro, crowd-says, guess-the-number
  - `words.js`: five-letters, find-the-word, word-association, context, word-cross, word-swipe, word-hunt
  - `guess.js`: guess-the-flag, guess-the-logo, guess-the-drawing (modo "eu desenho" com o mouse), guess-the-location (globo 3D)
  - `team.js`: boys-vs-girls, messi-vs-ronaldo, battle-arena, territory-war, horse-race, flappy-battle, bridge-brawl · `team3d.js`: tower-war, goat-sumo
  - `arena.js`: blob-battle, chainsaw-clash, evo-monster, snake · `duel.js`: take-the-crown, stick-fighters, slap-arena · `party.js`: dance-floor, car-race
  - `hero.js`: 1000-stairs, log-rush, window-wipe, fruit-slice · `hero3d.js`: lunar-dash, tower-stack, voxel-craft, flappy-3d
  - `battle3d.js`: zombie-hill, tank-battle, tung-tung-smash ("Pancada no Boneco"), mma-clash
  - `talk.js`: ai-host, roast-your-photo, guess-your-future, clip-machine, dance-party
- Os ids seguem os do Livecade (a API pública `https://app.livecade.io/api/games` lista os 54 com configurações e gatilhos padrão; foi a referência).

## Como colocar na live
1. Conectar o @ no painel (pode ser antes de entrar ao vivo).
2. LIVE Studio → Adicionar fonte → **Link** com `https://jogos-interativos.onrender.com/?clean=1&user=paidegamers` em 1080×1920. Tudo do painel chega lá e o som sai por ela (o painel fica mudo).
3. Se a fonte Link der defeito: botão **Abrir Tela da Live** (seção 🖥️) + Captura de janela, ou OBS com fonte de navegador + Câmera Virtual.

## Testes (`testes/`)
- Usam o Chromium em `/opt/node-tools/node_modules/playwright` e o servidor em `PORT=3123 node server.js`.
- `eventos.mjs` (leitura dos eventos do TikTok com protobuf real), `fotos.cjs` (foto, reserva e inicial), `capas.cjs` (gera as capas).
- `smoke.cjs`: abre os 68 jogos, simula comentários, likes, entradas, seguir, compartilhar, presentes e todas as ações. Última rodada: 68/68 sem erro.
- `painel.cjs`: clica em todas as seções e confere que a tela da live (outra página `?clean=1` no mesmo @) recebe troca de jogo, configuração, gatilho, pausa e alerta, e que o painel fica mudo. Passou.
- `coins.cjs`, `presence.cjs` (Céu de Pipas), `mirror.cjs` (janela Tela da Live), `fixed.cjs` (a tela do jogo não se mexe), `link.cjs` (precisa da conta ao vivo), `ff.cjs`.

## Ideias para depois
- Modelos com rosto expressivo (blendshapes) se aparecer um pacote livre adequado; os jogos de festa 2D restantes (quiz, palavras) ainda usam o visual 2D.
- Arrastar e redimensionar o HUD de cada jogo na prévia (hoje dá para mover os widgets).
- Personagens 3D mais detalhados no Apresentador IA; vozes com IA mais expressivas.
- Mais perguntas nos bancos (hoje: 196 quiz, 80 V/F, 94 prefere, 37 o povo diz, 37 temas de associação, 25 de contexto).
- O dono ainda precisa confirmar ao vivo: voz saindo pela fonte Link, IA respondendo, alertas e efeitos.
