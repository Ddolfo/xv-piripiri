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
- Cartão vermelho: suspende na **próxima partida oficial** do clube, na ordem cronológica entre os campeonatos.
- Partidas simultâneas do mesmo clube: bloqueadas; o admin resolve ambiguidade.
- Senha do admin `ddolfo.draft`: variável `DRAFT_ADMIN_PASSWORD`. No `npm run dev`, se faltar, uma senha é gravada em `data/.draft-secret` (fora do git).
- Banco inicial de jogadores: gerado no servidor com overs nas faixas do sorteio. Importação FUT-DB fica para quando houver `FUTDB_TOKEN` no worker.
- Persistência: arquivo `data/draft-state.json` no Vite; Durable Object `DraftRoom` no Cloudflare Worker em produção (`/draft`).
- Mercado da Bola começa **fechado**. Só o admin abre, e só **depois do sorteio oficial**. Antes do sorteio a aba Mercado não aparece para o participante.
- Admin pode **excluir campeonato em andamento** (remove confrontos, desafios e partidas) e **excluir participante** (conta, clube, sessões; elenco volta ao mercado), ambos com justificativa auditada.
