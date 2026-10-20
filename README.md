# Jogos Interativos para TikTok LIVE

**Site:** https://jogos-interativos.onrender.com

14 jogos que rodam no navegador (a maioria em 3D) e reagem à live do TikTok em tempo real. A tela é
sempre 9:16 (1080×1920). O espectador vê o próprio @ e a foto; quanto maior o presente, maior o efeito.

| Jogo | Como o público joga |
| --- | --- |
| 🗳️ Escolha o Jogo | Lista todos os jogos; a live vota pelo número e o vencedor abre sozinho |
| 🏛️ Sim ou Não | Plenário 3D com telão; comenta SIM ou NÃO e a mão aperta o botão no tablet |
| 🗳️ Urna | Duas urnas 3D na mesa; comenta o número do candidato (foto, número e nome configuráveis) |
| ⚽ Bola no Ursinho | Cozinha 3D; presentes lançam bolas no ursinho que o personagem segura (foto configurável) |
| 🏃 Corrida de Torcidas | Atletismo olímpico 3D; torce pelo corredor (rosto configurável) e presentes viram efeitos |
| 🏁 Corrida na Cidade | Racha 3D noturno; comenta carro e corre com a foto em cima do carro |
| 🏎️ Kart 3D | Circuito 3D com minimapa; comenta kart; nitro, pedra, míssil e raio |
| 🐍 Arena de Cobras | Estilo Snake Rivals: cada espectador vira uma cobra 3D |
| 🥊 Combate 3D | Lutadores 3D com o rosto configurado; comenta 1 ou 2 e presentes viram golpes |
| 🪁 Céu de Pipas | Estilo Pipa Combate: cada comentário vira uma pipa 3D; presente corta as outras |
| 🕺 Palco Roblox | Comenta o nick do Roblox e o avatar real dança num palco de show 3D |
| 🐤 Flappy | Você joga; o público sabota com presentes |
| 🏝️ Ilha | Battle royale 3D com bonecos estilo Roblox; a ilha encolhe até sobrar um |
| 💃 Passarela | Desfile 3D com o avatar do Roblox; presente fura a fila |

Presentes contam pela faixa de valor: 🌹 até 4 moedas · 🍩 5–99 · 🕶️ 100–499 · 🌌 500+.

## Rodar localmente

```bash
npm install
npm start
```

Abra `http://localhost:3000`, digite o @ de uma conta ao vivo e clique em **Conectar**.
O painel **Simulador** permite testar sem live.

## OBS / TikTok LIVE Studio

Fonte de navegador 1080×1920 com:

```
https://jogos-interativos.onrender.com/?clean=1&game=urna&user=seuusuario
```

`game` pode ser `votacao`, `simnao`, `urna`, `chute`, `torcida`, `corrida`, `kart`, `cobra`, `combate`, `pipa`,
`avatares`, `flappy`, `ilha` ou `desfile`.

As fotos e nomes configurados ficam salvos no navegador onde você configurou. Com a página principal
conectada ao mesmo @, a configuração é repassada à fonte do OBS automaticamente.

## Deploy no Render

O `render.yaml` cria um Web Service Node (`npm install` / `npm start`, health check em `/health`).
Variável opcional: `SIGN_API_KEY` (chave da Euler Stream) para conexões mais estáveis.

A conexão usa a biblioteca não oficial `tiktok-live-connector`; ela pode quebrar quando o TikTok muda algo.
