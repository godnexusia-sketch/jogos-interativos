# Jogos Interativos para TikTok LIVE

**Site:** https://jogos-interativos.onrender.com

Três jogos que rodam no navegador e reagem à live do TikTok em tempo real:

- **Votação**: comente `1`, `2`, `3` ou `4`. Presente dá +5 votos na sua opção.
- **Corrida**: comente `!entrar` para ganhar um carro; comentários, likes e presentes aceleram.
- **Flappy**: comente `pula` ou curta para o passarinho voar; presente dá escudo de 5 s.

## Rodar localmente

```bash
npm install
npm start
```

Abra `http://localhost:3000`, digite o @ de uma conta ao vivo e clique em **Conectar**.
O painel **Simulador** permite testar sem live.

## OBS

Fonte de navegador 720×1280 com:

```
https://jogos-interativos.onrender.com/?clean=1&game=corrida&user=seuusuario
```

`game` pode ser `votacao`, `corrida` ou `flappy`.

## Deploy no Render

O `render.yaml` cria um Web Service Node (`npm install` / `npm start`, health check em `/health`).
Variável opcional: `SIGN_API_KEY` (chave da Euler Stream) para conexões mais estáveis.

A conexão usa a biblioteca não oficial `tiktok-live-connector`; ela pode quebrar quando o TikTok muda algo.
