// Converte os termos da proposta (lado do remetente) para o ponto de vista de quem está negociando.
export function termsFor(proposal, myClubId) {
  const iAmFrom = proposal.fromClubId === myClubId
  return iAmFrom
    ? { take: proposal.requestPlayerIds || [], give: proposal.offerPlayerIds || [], pay: proposal.coinsFrom || 0, receive: proposal.coinsTo || 0 }
    : { take: proposal.offerPlayerIds || [], give: proposal.requestPlayerIds || [], pay: proposal.coinsTo || 0, receive: proposal.coinsFrom || 0 }
}

// E de volta para o formato do motor.
export function payloadFor({ take, give, pay, receive }, iAmFrom) {
  return iAmFrom
    ? { requestPlayerIds: take, offerPlayerIds: give, coinsFrom: pay, coinsTo: receive }
    : { requestPlayerIds: give, offerPlayerIds: take, coinsFrom: receive, coinsTo: pay }
}
