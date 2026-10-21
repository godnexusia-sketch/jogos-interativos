# Jogos Interativos para TikTok LIVE

**Site:** https://jogos-interativos.onrender.com

Painel completo de jogos para live, no estilo do Livecade: **68 jogos** (54 novos + os 14 clássicos), gatilhos de ação
configuráveis, alertas, efeitos, widgets, DJ Pad, música, voz neural e apresentador com IA. A tela é sempre 9:16
(1080×1920) e roda no navegador, no OBS ou na fonte **Link** do TikTok LIVE Studio. Uso pessoal: não tem cadastro nem plano.

## O que tem no painel

| Seção | O que faz |
| --- | --- |
| 🎮 Jogos | Biblioteca com busca e categorias: Festa, Battle Royale, Corrida, Quiz, Palavras, Luta e Batalha, Arcade, Voz e IA e Clássicos |
| ⚙️ Jogo atual | Regras, **testar ações**, **⚡ gatilhos de ação** (presente específico ou por valor, comentário com palavra, a cada N likes, seguir, compartilhar, entrar → ação do jogo, ×N vezes) e as configurações do jogo, que mudam ao vivo |
| 🧪 Testar | Espectadores de mentira automáticos, comentários, likes, entradas, seguir, compartilhar e qualquer presente do TikTok (1.270 presentes com o preço real) com combo |
| ✨ Efeitos | Chafariz de likes com fotos, balão de seguidor, avião de compartilhamento, fogos de presente e presente na tela |
| 🔔 Alertas | Presente (com variações para presentes grandes), seguidor, compartilhamento, entrada, likes e marcos (ex.: a cada 10.000 likes), com som, imagem/GIF, posição, estilo e leitura em voz alta |
| 🧩 Widgets | Metas (moedas, um presente, likes, seguidores, compartilhamentos), top doadores, top likes, timer (presentes somam tempo), mensagens rolando, imagem/GIF/vídeo, pote de presentes, último seguidor e placar salvo. Arraste na tela para posicionar |
| 🎛️ DJ Pad | 24 sons prontos (buzina, aplausos, rufar…) ou MP3 enviado/link; cada pad pode tocar sozinho com presente, palavra no chat, seguir, compartilhar ou entrada. Teclas 1–9 |
| 🎵 Música | Trilhas geradas na hora (lo-fi, festa, 8-bit, quiz, épico, funk), sem direitos autorais, ou a sua playlist de MP3 |
| 🗣️ Voz e chat | 16 vozes neurais (português BR e PT, espanhol, inglês e personagens), mixer de volume, leitor de comentários, shoutouts, filtro de palavrões e palavras bloqueadas |
| 🏆 Placar | Pontos que cada espectador juntou em cada jogo, com planilha CSV |
| 📊 Histórico | Cada live com duração, likes, moedas, comentários, seguidores, jogos jogados e top doadores (só atividade real) |
| 🖥️ Tela da live | Link para o LIVE Studio/OBS e a janela separada |

Na barra de cima: conectar o @, números da sessão, telas conectadas, silenciar e **🛑 Pânico** (para tudo na hora).
Embaixo do jogo: pausar, reiniciar e trocar. À direita (tela larga): o chat da live com 📣 shoutout e 🎙️ "responder agora"
para o apresentador IA, e o top da sessão.

## Os jogos novos

- **Quiz:** Quiz Relâmpago, Show do Milhão, Verdadeiro ou Falso, Matemática Rápida, Memória Maestro, O Povo Diz, Adivinhe o Número, Adivinhe a Bandeira, Adivinhe o Logo, Onde Fica? (foto da cidade + globo 3D)
- **Palavras:** 5 Letras, Descubra a Palavra, Associação de Palavras, Contexto, Palavras Cruzadas, Roda de Letras, Caça-Palavras
- **Festa:** Prefere Isso ou Aquilo?, Adivinhe o Desenho, Meninos x Meninas, Messi x Ronaldo, Arena de Batalha, Guerra de Territórios, Flappy Batalha, Guerra das Torres (3D), Lutadores de Palito, Arena do Tapa, Pista de Dança, Festa Pixel 3D, Roast da Foto, Seu Futuro, Máquina de Clipes
- **Battle Royale:** Batalha de Bolhas, Serra Elétrica, Monstro Evolutivo
- **Corrida:** Corrida de Cavalos, Corrida de Fórmula
- **Luta e Batalha:** Ponte de Batalha, Sumô de Cabras (3D), Tome a Coroa, Colina dos Zumbis (3D), Guerra de Tanques (3D), Pancada no Boneco (3D), MMA dos Países (3D)
- **Arcade:** Cobrinha, 1000 Degraus, Pato no Tronco, Limpa Vidros, Corta Frutas, Corrida Lunar (3D), Torre Empilhada (3D), Muralha de Blocos (3D), Porquinho Voador 3D
- **Voz e IA:** Apresentador IA (responde o chat em voz alta, agradece presentes, dá boas-vindas)

Os quizzes e jogos de palavras aceitam as suas próprias perguntas e palavras nas configurações.

## Voz e IA

- A voz é gerada no servidor (`/api/tts`, vozes neurais grátis da Microsoft Edge, com o Google Tradutor de reserva) e sai pela
  página: o LIVE Studio e o OBS capturam junto com o jogo. Com uma tela da live aberta, o painel fica mudo para não dar eco.
- A IA (`/api/ai`) usa o **Claude** quando a variável `ANTHROPIC_API_KEY` está configurada no Render (modelo em `AI_MODEL`,
  padrão `claude-opus-5-5`); sem chave, usa um serviço grátis; se tudo falhar, os jogos usam frases prontas.
  Só o "líder" (o painel) chama a IA e manda a resposta para as telas, então não gasta em dobro.

## Rodar localmente

```bash
npm install
npm start
```

Abra `http://localhost:3000`, digite o @ e clique em **Conectar**. O **🧪 Simulador** testa tudo sem live.

## LIVE Studio / OBS

Fonte **Link** (LIVE Studio) ou fonte de navegador (OBS) em 1080×1920:

```
https://jogos-interativos.onrender.com/?clean=1&user=seuusuario
```

O painel conectado no mesmo @ controla essa tela: jogo, configurações, gatilhos, simulador, DJ, música, alertas, efeitos,
widgets e voz. A sala do @ funciona mesmo antes de você entrar ao vivo, então dá para preparar tudo antes.

## Testes

Com `PORT=3123 node server.js` rodando: `node testes/smoke.cjs` (todos os jogos), `node testes/painel.cjs` (painel e
sincronização com a tela da live), `node testes/coins.cjs`, `presence.cjs`, `mirror.cjs`, `fixed.cjs`. Créditos dos dados em
`public/data/CREDITOS.md`.
