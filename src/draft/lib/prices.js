/**
 * Tabela oficial de preços do Draft XV em XV-Coins.
 * Valores literais — não recalcular, arredondar nem interpolar.
 */
export const PRICE_TABLE = Object.freeze({
  99: Object.freeze({ buy: 4000000, auction: 900000, sell: 2000000 }),
  98: Object.freeze({ buy: 3543334, auction: 800125, sell: 1771667 }),
  97: Object.freeze({ buy: 3086667, auction: 700250, sell: 1543334 }),
  96: Object.freeze({ buy: 2630000, auction: 600375, sell: 1315000 }),
  95: Object.freeze({ buy: 2173334, auction: 500500, sell: 1086667 }),
  94: Object.freeze({ buy: 1716667, auction: 400625, sell: 858334 }),
  93: Object.freeze({ buy: 1260000, auction: 300750, sell: 630000 }),
  92: Object.freeze({ buy: 803334, auction: 200875, sell: 401667 }),
  91: Object.freeze({ buy: 346667, auction: 100000, sell: 173334 }),
  90: Object.freeze({ buy: 45000, auction: 50000, sell: 22500 }),
  89: Object.freeze({ buy: 40000, auction: 45000, sell: 20000 }),
  88: Object.freeze({ buy: 35000, auction: 40000, sell: 17500 }),
  87: Object.freeze({ buy: 30000, auction: 35000, sell: 15000 }),
  86: Object.freeze({ buy: 25000, auction: 30000, sell: 12500 }),
  85: Object.freeze({ buy: 20000, auction: 25000, sell: 10000 }),
  84: Object.freeze({ buy: 15000, auction: 20000, sell: 7500 }),
  83: Object.freeze({ buy: 10000, auction: 10000, sell: 5000 }),
  82: Object.freeze({ buy: 5000, auction: 1000, sell: 2500 }),
  81: Object.freeze({ buy: 4000, auction: 1000, sell: 2000 }),
  80: Object.freeze({ buy: 3000, auction: 1000, sell: 1500 }),
  79: Object.freeze({ buy: 2500, auction: 1000, sell: 1250 }),
  78: Object.freeze({ buy: 2500, auction: 1000, sell: 1250 }),
  77: Object.freeze({ buy: 2500, auction: 1000, sell: 1250 }),
  76: Object.freeze({ buy: 1000, auction: 500, sell: 500 }),
  75: Object.freeze({ buy: 1000, auction: 500, sell: 500 }),
  74: Object.freeze({ buy: 1000, auction: 500, sell: 500 }),
  73: Object.freeze({ buy: 1000, auction: 500, sell: 500 }),
  72: Object.freeze({ buy: 1000, auction: 500, sell: 500 }),
  71: Object.freeze({ buy: 1000, auction: 500, sell: 500 }),
  70: Object.freeze({ buy: 750, auction: 500, sell: 375 }),
})

export const PRICE_BELOW_70 = Object.freeze({ buy: 750, auction: 150, sell: 375 })

export function pricesForOverall(overall) {
  const ovr = Number(overall)
  if (!Number.isFinite(ovr)) {
    throw new Error('Over inválido')
  }
  if (ovr < 70) return PRICE_BELOW_70
  const row = PRICE_TABLE[ovr]
  if (!row) {
    throw new Error(`Não há preço oficial para over ${ovr}`)
  }
  return row
}

export function buyPrice(overall) {
  return pricesForOverall(overall).buy
}

export function auctionStartPrice(overall) {
  return pricesForOverall(overall).auction
}

export function sellPrice(overall) {
  return pricesForOverall(overall).sell
}

export function priceTableRows() {
  const rows = Object.keys(PRICE_TABLE)
    .map(Number)
    .sort((a, b) => b - a)
    .map((overall) => ({ overall, ...PRICE_TABLE[overall] }))
  rows.push({ overall: 'Abaixo de 70', ...PRICE_BELOW_70 })
  return rows
}
