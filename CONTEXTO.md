# Jogos Interativos para TikTok LIVE: onde estamos

Este arquivo existe para quem continuar o projeto num chat novo. Leia tudo antes de mexer.
Última atualização: 21/10/2026.

## Em uma frase
Site com 14 jogos interativos em 3D, sempre em 9:16, controlados pela live do TikTok: comentários, likes, presentes, seguir, compartilhar e entradas. Roda no Render.

## Links e contas
- **Site no ar:** https://jogos-interativos.onrender.com
- **Repositório:** https://github.com/godnexusia-sketch/jogos-interativos (branch `main`)
- **Render:** serviço `jogos-interativos` (id `srv-dbbd587avr4c73defks0`), plano free, região virginia, auto-deploy a cada push na `main` (leva ~1 min). Arquivo `render.yaml`.
- **Conta do TikTok do dono:** `@paidegamers`. A conexão foi testada e funcionou com ele ao vivo.
- **O dono quer tudo no Render.** Recusou a Vercel; não usar.

## Como o dono gosta de trabalhar
- Fala português e quer respostas em português simples.
- Quer que eu faça tudo e implemente, para depois ele só aprovar. Não quer muitas perguntas.
- Exigente com visual. Quer design caprichado, que prenda a atenção, em 3D, com cara de jogo de PC/PS5, **sempre proporcional 9:16**, sem nada esticado ou repuxado.
- Referências dele:
  - Combate: Street Fighter.
  - Corrida: Mario Kart (gostou) e GTA (cidade).
  - Cobra: Snake Rivals.
  - Pipa: Pipa Combate.
  - Palco e Passarela: boneco igual ao Roblox, com o nick e o ícone de quem mandou presente em cima da cabeça.
  - Corrida de Torcidas: atletismo das Olimpíadas.
  - Urna: foto e número dos candidatos.
- Inspiração original: o site Kyrat Games. **Regra: não copiar código nem arte deles, não recriar boneca de criança real, não usar marcas da Nintendo.**

## Arquitetura
- `server.js`: Node 22 com `http` e `ws`.
  - Mantém uma conexão com o TikTok por @, compartilhada por todas as telas, usando `tiktok-live-connector@2.5.0`.
  - Eventos que manda para as telas: `chat`, `like`, `gift` (combo contado só no fim da sequência), `social` (`action: 'follow' | 'share'`), `join`, `viewers`, `status`.
  - Repassa entre as telas do mesmo @:
    - `config`: fotos, nomes e regras de cada jogo.
    - `control`: ações `game`, `reset`, `sim`, `press` e `current`. O painel controla a tela aberta no LIVE Studio/OBS; a tela avisa o painel quando troca de jogo sozinha. O servidor guarda `room.game`.
  - Rotas:
    - `/api/roblox`: avatar 720×720 com cache.
    - `/api/img`: proxy de imagem.
    - `/vendor/three.module.min.js`.
    - `/api/diag?u=@`: diagnóstico do Room ID.
    - `/health`.
  - **Importante:** `enableExtendedGiftInfo: false`. A lista estendida de presentes exige plano Business pago no Euler Stream e quebrava a conexão. O evento de presente já traz o nome e `diamondCount`, que é o preço em moedas.
  - Conta fora do ar: estado `offline`, e o cliente tenta de novo a cada 30s.
  - Existe a variável opcional `SIGN_API_KEY` (chave grátis do Euler Stream). Hoje não está configurada.
- `public/index.html`, `style.css`, `app.js`: o painel.
  - Barra do topo e abas dos jogos.
  - Tela do jogo **fixa à esquerda**: a página não rola e a roda do mouse não mexe nela.
  - À direita, três colunas com rolagem própria: Jogo (ajuda e configurar), Testar/Tela da Live (simulador, OBS, Link) e Eventos da live.
  - Simulador:
    - Comentar, Likes, Entrar e Auto.
    - Seguir, Compartilhar e campo de combo.
    - Loja real: Rosa 1, Bola 5, Coração 10, Rosquinha 30, Chapéu 99, Mãos em coração 100, Festa dos Doces 3.999, Estrelas do TikTok 39.999.
- Modos de URL:
  - `?game=id`: abre direto num jogo.
  - `?clean=1`: só o jogo, para OBS ou a fonte Link do LIVE Studio.
  - `&user=nick`: a tela conecta sozinha.
  - `&mirror=1`: janela "Tela da Live" aberta pelo botão do painel. Recebe tudo do painel por BroadcastChannel, e o painel para de desenhar.
  - `&leve=1`: canvas em 720×1280 em vez de 1080×1920.
- `public/core.js`: base comum.
  - Coordenadas lógicas 720×1280; canvas 1080×1920 (SCALE 1,5).
  - Fontes Barlow e Barlow Condensed.
  - Partículas, anunciador, `store` (localStorage), `robloxLookup`, `withConfig`, sons.
  - **Escala de valor:**
    - `coins(ev)` = preço × combo.
    - `giftTier` define a faixa: 1 = 1–9, 2 = 10–99, 3 = 100–999, 4 = 1.000+.
    - `giftPower` = 1 + log2(moedas): força para duração e tamanho.
    - `giftQty` = √moedas: quantidades.
    - `SOCIAL_COINS`: seguir ≈ 5 moedas, compartilhar ≈ 10. Likes: 25 ≈ 1 moeda.
    - `TIER_HELP` é o texto de ajuda das faixas.
  - `giftMeter` mostra quem mandou, o valor e a força. A posição muda por jogo com `meterY`.
- `public/ui.js`: componentes 2D (painéis, toasts, mão, etc.).
- `public/three3d.js`: motor 3D comum (`G3`), com qualidade adaptativa.
  - Bonecos: `makeHuman`/`poseHuman` (rosto com foto), `makeBlocky3D`/`danceBlocky`/`walkBlocky` (estilo Roblox).
  - Ajudas: textos e etiquetas, céu, brilho.
- `public/race3d.js`: motor das corridas (`makeRace3D`). Os poderes crescem com as moedas.

## Os 14 jogos (`public/games/`)
| id | Nome | Resumo |
|---|---|---|
| votacao | Escolha o Jogo | Lista todos os jogos. Ao fim do tempo, abre o mais votado; **se ninguém votar, abre o Céu de Pipas**. Presente vale +10 votos/moeda. |
| simnao | Sim ou Não | Plenário 3D, telão, mão votando. A pergunta é configurável. |
| urna | Urna | Urnas 3D com foto, número e nome dos candidatos (configurável). |
| chute | Bola no Ursinho | Cozinha 3D, personagem com ursinho, bolas proporcionais às moedas. |
| torcida | Corrida de Torcidas | Atletismo olímpico 3D. A meta coletiva de likes dá uma arrancada a quem está atrás. |
| corrida | Corrida na Cidade | Racha noturno estilo GTA (race3d). |
| kart | Kart 3D | Estilo kart (race3d): nitro, pedras, mísseis, raio. |
| cobra | Arena de Cobras | Estilo Snake Rivals: robôs com IA, turbo, crescimento, escudo, mega cobra. |
| combate | Combate 3D | Estilo Street Fighter, rosto com foto (configurável). Dano = 3×√moedas, especial da torcida. |
| pipa | Céu de Pipas | Quem **entra na live** ganha uma pipa com nome e foto. A pipa cai quando a pessoa sai: por inatividade (minutos configuráveis) ou quando os espectadores diminuem. Corte, escudo, linha de ouro. O admin configura tudo. |
| avatares | Palco Roblox | Avatar real do Roblox pelo nick comentado, ícone do presenteador na cabeça, furacão, chuva de avatares. |
| flappy | Flappy | O admin joga; os presentes sabotam e os likes ajudam. |
| ilha | Ilha | A ilha encolhe; escudos, gelo, tsunami. |
| desfile | Passarela | Avatar Roblox na passarela; quem manda mais moedas desfila maior e passa na frente na fila. |

O TikTok não manda o evento "saiu da live". A saída é estimada por inatividade e pela queda do número de espectadores.

## Como colocar na live sem travar
1. Conectar o @ no painel com a live já aberta.
2. **Melhor opção:** LIVE Studio → Adicionar fonte → **Link**, com `https://jogos-interativos.onrender.com/?clean=1&game=pipa&user=paidegamers` em 1080×1920. O painel continua controlando: troca de jogo, reiniciar, simulador e configurações.
3. Se a fonte Link der defeito (aparecer em branco ou com tamanho 0×0):
   - **Opção A:** botão **🖥️ Abrir Tela da Live** (pode marcar Modo leve) + **Captura de janela** "Tela da Live". Não minimizar nem cobrir a janela, ou abrir o Chrome com `--disable-backgrounding-occluded-windows --disable-renderer-backgrounding`.
   - **Opção B:** OBS com fonte de navegador + Câmera Virtual, e essa câmera no LIVE Studio.

## Testes
- Scripts Playwright em `testes/`. Usam o Chromium em `/opt/node-tools/node_modules/playwright` e o servidor local em `PORT=3123 node server.js`.
  - `smoke.cjs`: abre os 14 jogos e procura erros. `BASE=` aponta para outro endereço.
  - `ff.cjs <jogo> <prefixo> <segundos…>`: avança a lógica do jogo e tira prints.
  - `coins.cjs`: todos os presentes da loja, seguir e compartilhar em todos os jogos.
  - `presence.cjs`: entradas, queda das pipas e fallback da votação.
  - `mirror.cjs`: a janela Tela da Live.
  - `link.cjs`: o controle da tela aberta no Link pelo servidor. Precisa da conta ao vivo.
  - `fixed.cjs`: a tela do jogo não se mexe com a roda do mouse ou com avisos longos.
- Os scripts gravam prints na pasta passada como argumento. Use uma pasta temporária.
- A última rodada passou sem erros nos 14 jogos, local e no Render.

## Últimas entregas (mais recente primeiro)
1. O painel controla a tela aberta na fonte Link do LIVE Studio/OBS, via servidor.
2. Janela "Tela da Live" e Modo leve 720p.
3. Tela do jogo fixa à esquerda; controles em três colunas.
4. Correção do erro "This endpoint requires a Business plan" (Euler Stream).
5. Interações proporcionais às moedas em todos os jogos, likes, seguir e compartilhar, medidor de presentes, loja real no simulador.
6. Céu de Pipas por presença na live; votação sem votos abre o Céu de Pipas.

## Ideias que podem vir a seguir
- Confirmar com o dono se a fonte Link funcionou no LIVE Studio dele.
- Se houver limite do serviço gratuito de assinatura, criar a chave grátis do Euler Stream e pôr em `SIGN_API_KEY` no Render.
- Os jogos só rodam no navegador de quem abre a página. Não existe estado de jogo no servidor: o painel e a tela da live rodam cada um a sua cópia e se sincronizam por comandos.
