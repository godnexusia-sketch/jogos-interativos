# Jogos Interativos para TikTok LIVE

**Site:** https://jogos-interativos.onrender.com

13 jogos que rodam no navegador e reagem à live do TikTok em tempo real. O espectador vê o próprio
@ e a foto na tela; quanto maior o presente, maior o efeito.

| Jogo | Como o público joga |
| --- | --- |
| 🗳️ Votação | Comenta 1–4; presente soma votos por moeda |
| 🏛️ Sim ou Não | Comenta SIM ou NÃO; presente soma votos por moeda |
| 🗳️ Urna | Comenta o número do candidato; a mão digita na urna e aperta CONFIRMA. Foto, número e nome configuráveis |
| ⚽ Chute ao Gol | Comenta “chuta”; presentes chutam mais bolas no goleiro (foto configurável) |
| 🏃 Corrida de Torcidas | Comenta o nome do corredor; presentes dão impulso, banana, superarrancada; meta coletiva de likes |
| 🏁 Corrida Maluca | Comenta carro ou moto e entra na pista; nitro, óleo, míssil, bomba no líder |
| 🐍 Cobra IA | A IA joga; o chat comenta “bomba” para matar |
| 🥊 Combate | Comenta 1 ou 2 para escolher o lado; presente vira golpe (fotos configuráveis) |
| 🪁 Pipa | Cada comentário vira uma pipa; presente corta as outras |
| 🕺 Palco Roblox | Comenta o nick do Roblox e o avatar real dança no palco |
| 🐤 Flappy | Você joga; o público sabota com presentes |
| 🏝️ Ilha | Battle royale: comenta “entrar”; a ilha encolhe até sobrar um |
| 💃 Passarela | Comenta para entrar na fila do desfile; presente fura a fila |

Presentes contam pela faixa de valor: 🌹 até 4 moedas · 🍩 5–99 · 🕶️ 100–499 · 🌌 500+.

## Rodar localmente

```bash
npm install
npm start
```

Abra `http://localhost:3000`, digite o @ de uma conta ao vivo e clique em **Conectar**.
O painel **Simulador** permite testar sem live.

## OBS / TikTok LIVE Studio

Fonte de navegador 720×1280 com:

```
https://jogos-interativos.onrender.com/?clean=1&game=urna&user=seuusuario
```

`game` pode ser `votacao`, `simnao`, `urna`, `chute`, `torcida`, `corrida`, `cobra`, `combate`, `pipa`,
`avatares`, `flappy`, `ilha` ou `desfile`.

As fotos e nomes configurados ficam salvos no navegador onde você configurou. Com a página principal
conectada ao mesmo @, a configuração é repassada à fonte do OBS automaticamente.

## Deploy no Render

O `render.yaml` cria um Web Service Node (`npm install` / `npm start`, health check em `/health`).
Variável opcional: `SIGN_API_KEY` (chave da Euler Stream) para conexões mais estáveis.

A conexão usa a biblioteca não oficial `tiktok-live-connector`; ela pode quebrar quando o TikTok muda algo.
