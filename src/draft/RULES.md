# Draft XV — decisões de configuração

Regras que o prompt mestre deixou abertas, com o padrão inicial seguro:

- Mesmo jogador em clubes diferentes: **não**, salvo `allowSharedPlayers` no painel admin.
- Duração do leilão: **1 hora** no relógio do servidor.
- Incremento mínimo de lance: **100 XV-Coins**.
- Sem prorrogação automática no fim do leilão.
- Validade de proposta: **24 horas**.
- Elenco mínimo para escalar: **11** jogadores.
- Elenco máximo: **26**.
- Titulares 11, banco até 7, até 5 substituições.
- Partidas: só o **mandante** convida; quando o visitante **aceita**, a partida é simulada na hora e o resultado entra direto na tabela (sem confirmação de início nem de resultado). Os dois clubes precisam ter escalação salva com 11 titulares, sem suspensos.
- Cartões: vermelho direto ou dois amarelos no jogo suspendem na **próxima partida oficial**; a cada **3 amarelos** no mesmo campeonato (ajustável em `yellowCardLimit`) o jogador também cumpre suspensão. Os dois amarelos de uma expulsão não contam para o acúmulo. O cartão vai para quem cometeu a falta e o expulso sai do jogo.
- Tabela: pontos corridos com faltas, amarelos e vermelhos por clube, e rankings de artilharia, assistências, faltas, amarelos e vermelhos por jogador.
- Partidas simultâneas do mesmo clube: bloqueadas; o admin resolve ambiguidade.
- Senha do admin `ddolfo.draft`: variável `DRAFT_ADMIN_PASSWORD`. No `npm run dev`, se faltar, uma senha é gravada em `data/.draft-secret` (fora do git).
- Banco inicial de jogadores: gerado no servidor com overs nas faixas do sorteio. Importação FUT-DB fica para quando houver `FUTDB_TOKEN` no worker.
- Persistência: arquivo `data/draft-state.json` no Vite; Durable Object `DraftRoom` no Cloudflare Worker em produção (`/draft`).
- Mercado da Bola começa **fechado**. Só o admin abre, e só **depois do sorteio oficial**. Antes do sorteio a aba Mercado não aparece para o participante.
- Admin pode **excluir campeonato em andamento** (remove confrontos, desafios e partidas) e **excluir participante** (conta, clube, sessões; elenco volta ao mercado), ambos com justificativa auditada.
- Cadastro do clube: Nome → **Formação preferida** → **Escudo** → Concluir. A formação é obrigatória e vale qualquer uma das 12 do campinho. As cores do clube são escolhidas dentro do escudo (principal, detalhe e destaque).
- Sorteio: mantém as faixas de over (1 de 89–91, 2 de 85–87, 4 de 83, 10 de 74–79, 5 de 65–73) e garante pelo menos **um jogador para cada uma das 11 posições** da formação preferida. Quem cobre as posições conta na cota da sua faixa; o restante sai aleatório, de qualquer posição. Sem a posição exata no banco, vale uma parecida (LWB→LB/LM, RWB→RB/RM, CF→ST/CAM, LW↔LM, RW↔RM, CDM/CAM→CM). Clube antigo sem formação usa 4-3-3.
