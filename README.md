# XV de PiriPiri · Painel Técnico

App local em React para o técnico do **XV de PiriPiri** (EA FC 26 / Pro Clubs).

## O que tem

- Cadastro de elenco: nome, PSN, posição primária, secundária e posições extras
- Persistência no `localStorage` do navegador
- Campo com formações (4231, 433, 352, 541, etc.)
- Drag-and-drop do elenco para as vagas
- Trocar a formação zera a escalação
- Hover no jogador no campo mostra **×** para remover
- Botão para zerar a escalação
- Aba de estatísticas consultando a API pública de Pro Clubs da EA

## Como rodar

```bash
cd xv-piripiri
npm install
npm run dev
```

Abra `http://localhost:5173`.

## API da EA

A Community API oficial do FC 26 (conta Ultimate Team) só é liberada para FUTBIN, FUT.GG e FUTWIZ.

Este app usa a API pública de **Pro Clubs**:

- `GET /api/fc/allTimeLeaderboard/search`
- `GET /api/fc/members/stats`
- `GET /api/fc/members/career/stats`
- `GET /api/fc/clubs/info`

O Vite faz proxy em `/ea` → `https://proclubs.ea.com` para evitar CORS.

Se a EA bloquear o IP, cadastre o elenco manualmente e cole o Club ID quando tiver.
