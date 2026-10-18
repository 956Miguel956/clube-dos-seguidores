# ⚽ Clube dos Seguidores — publicar na Cloudflare (grátis)

O jogo roda num **Worker da Cloudflare**, que entrega o site e o servidor. Os jogadores ficam guardados no banco **D1**.

O banco `clube-dos-seguidores` é criado sozinho no primeiro deploy. Você não precisa criar nada no painel.

## 1. Publicar a partir do GitHub
1. Na Cloudflare, vá em **Workers & Pages → Create → Import a repository**.
2. Escolha o repositório **clube-dos-seguidores**.
3. Nas configurações:
   - **Production branch:** `main`
   - **Build command:** deixe vazio
   - **Deploy command:** `npx wrangler deploy`
4. Clique em **Deploy**.

O site fica em `https://clube-dos-seguidores.SEU-USUARIO.workers.dev`.

Toda vez que o código mudar no GitHub, a Cloudflare publica sozinha.

## 2. Token do Instagram
No Worker, vá em **Settings → Variables and Secrets → Add**, escolha o tipo **Secret** e crie:

| Nome | Valor |
|---|---|
| `IG_TOKEN` | o mesmo token do Instagram do Tenha Sua Empresa |

As variáveis valem na hora, sem publicar de novo.

**Opcionais:**

| Nome | Para quê |
|---|---|
| `ADMIN_KEY` | senha do painel. Sem ela, você cria a senha no primeiro acesso ao painel. |
| `SITE_URL` | link que aparece nas respostas automáticas. Sem ela, o jogo usa o endereço do site. |
| `IG_POSTS` | quantos vídeos do jogo ler (padrão 3) |
| `IG_VERIFY_TOKEN` | token do webhook (padrão `clube-dos-seguidores`) |
| `IG_APP_SECRET` | chave do app da Meta, para validar o webhook |

## 3. Painel do criador
Abra o site e toque no ⚙️ no canto de baixo (ou abra `/#painel`). No primeiro acesso você cria a senha.

No painel dá para:
- ver se o Instagram está conectado e ler os comentários na hora;
- testar um comentário;
- tirar um @ do jogo (o 1º da fila entra no lugar);
- sortear os titulares de todos os times antes dos jogos;
- baixar e restaurar backup, ou zerar o mapa.

## 4. Os vídeos do jogo
**Só contam os vídeos com `#clubedosseguidores` na legenda.** Dá para trocar a hashtag no painel.

O Tenha Sua Empresa continua lendo só os vídeos com `#tenhasuaempresa`, então os dois jogos podem rodar ao mesmo tempo na mesma conta sem um responder no vídeo do outro.

## Como conferir
Abra `https://SEU-SITE.workers.dev/api/status`. Ali aparece:
- a última leitura do Instagram;
- quantos jogadores e quantas pessoas na fila;
- quantas respostas foram enviadas;
- o erro, se houver algum.

A leitura automática roda a cada 1 minuto.

## Regras do jogo
- A pessoa comenta o time (vale apelido: "galo", "mengão", "timão"…) e vira jogador com uma **posição sorteada**.
- Cada time tem 4 elencos de 22 (**Principal, Sub-23, Sub-20 e Sub-17**), 88 vagas. Quando lota, a pessoa entra na fila.
- Cada @ joga em **um time só**.
- **Respostas automáticas (1 por pessoa):** confirma o time e a posição, avisa quando lotou, pergunta qual time quando fica em dúvida ("atlético") e explica como entrar quando não acha o time.
- Os titulares (4-3-3) saem do elenco Principal.

## Limites do plano grátis
- O servidor aguenta 100 mil acessos por dia. Se o vídeo viralizar e passar disso, o plano pago custa US$ 5/mês.
- O mapa é guardado em cache por 10 segundos, então muita gente olhando ao mesmo tempo quase não gasta o banco.

## Arquivos
- `public/index.html` — o mapa 3D
- `public/times.js` — os 280 times. Para corrigir cor, estádio ou apelido, edite a linha do time.
- `public/core.js` — as regras (usadas pelo site e pelo servidor)
- `worker/index.mjs` — o servidor (Instagram, banco, painel)
