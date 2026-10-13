# XV de PiriPiri · Painel Técnico

Painel em React para o **XV de PiriPiri** e o **Barcarena FC** no Pro Clubs do EA FC 27.

No ar: https://ddolfo.github.io/xv-piripiri/

## O que tem

- **Estatísticas**: divisão (com escudo por divisão), campanha, aproveitamento, saldo e habilidade;
  sequência dos últimos 10 resultados; lista das últimas partidas com o cartão da partida escolhida
  e acesso à súmula; números do elenco e ficha de cada jogador.
- **Rivais**: histórico acumulado de confrontos, com o "pato", o "algoz" e a lista de adversários.
- **Draft XV**: campeonato interno com sorteio de elencos, mercado, leilões, propostas, escalação
  e tabela. Em produção ainda aparece o cartaz de "em construção"; em `npm run dev` o app abre.

## Como rodar

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`. Em dev o Vite faz proxy de `/ea` para `https://proclubs.ea.com`
e serve a API do Draft em `/draft`, gravando em `data/draft-state.json` (fora do git).
A senha do admin do Draft (`ddolfo.draft`) fica em `data/.draft-secret`.

Testes do motor do Draft: `npm run test:draft`.

## Dados da EA

O app usa a API pública de Pro Clubs (`/api/fc/...`). No site publicado as chamadas passam pelo
worker da Cloudflare (`worker.js`), que:

- tenta de novo quando a EA devolve 403/429 e, se continuar barrado, serve a última resposta boa
  guardada no cache e no KV;
- puxa os jogos dos clubes a cada 30 minutos e acumula um histórico único em `/shared/history/:clubId`,
  para todo visitante ver os mesmos jogos e rivais.

## Publicar

GitHub Pages (pasta `../gh-pages`, branch `gh-pages`):

```bash
MSYS_NO_PATHCONV=1 VITE_BASE=/xv-piripiri/ npm run build
```

No Git Bash do Windows o `MSYS_NO_PATHCONV=1` é obrigatório; sem ele o caminho base vira
`C:/Program Files/Git/...` e o site abre em branco. Copie `dist/` para `../gh-pages`, faça commit e push.

Worker (conta Cloudflare "Resisted Lycra", definida em `wrangler.toml`):

```bash
npm run build
npx wrangler deploy
```
