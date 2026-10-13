// Para onde cada notificação leva o participante dentro do Draft.
const ROUTES = {
  proposta: { tab: 'mercado', area: 'propostas', label: 'Ver propostas', icon: 'deal' },
  contraproposta: { tab: 'mercado', area: 'propostas', label: 'Ver propostas', icon: 'deal' },
  proposta_aceita: { tab: 'clube', label: 'Ver elenco', icon: 'ok' },
  proposta_recusada: { tab: 'mercado', area: 'propostas', label: 'Ver propostas', icon: 'no' },
  lance_superado: { tab: 'mercado', area: 'leiloes', label: 'Ver leilões', icon: 'auction' },
  leilao_encerrado: { tab: 'clube', label: 'Ver elenco', icon: 'auction' },
  compra: { tab: 'clube', label: 'Ver elenco', icon: 'ok' },
  venda: { tab: 'clube', label: 'Ver carteira', icon: 'coin' },
  desafio: { tab: 'campeonatos', label: 'Ver convite', icon: 'ball' },
  desafio_recusado: { tab: 'campeonatos', label: 'Ver jogos', icon: 'no' },
  resultado: { tab: 'campeonatos', label: 'Ver súmula', icon: 'ball' },
  sorteio: { tab: 'clube', label: 'Ver elenco', icon: 'star' },
  suspensao: { tab: 'formacao', label: 'Ajustar escalação', icon: 'card' },
  decisao_admin: { tab: 'campeonatos', label: 'Ver jogos', icon: 'info' },
  contestacao: { tab: 'campeonatos', label: 'Ver jogos', icon: 'info' },
}

export function routeForNotification(n) {
  const base = ROUTES[n?.type] || { tab: 'clube', label: '', icon: 'info' }
  return { ...base, matchId: n?.extra?.matchId || null, proposalId: n?.extra?.proposalId || null }
}
