/**
 * Escudo do Draft XV (versão 2): composto por escolhas guiadas em vez de peças soltas.
 * Este arquivo é compartilhado entre o motor (validação) e a interface (opções).
 */

export const CREST_VERSION = 2

export const CREST_SHAPES = [
  { id: 'classico', label: 'Clássico' },
  { id: 'moderno', label: 'Moderno' },
  { id: 'redondo', label: 'Redondo' },
  { id: 'italiano', label: 'Italiano' },
  { id: 'frances', label: 'Francês' },
  { id: 'hexagono', label: 'Hexágono' },
]

export const CREST_PATTERNS = [
  { id: 'liso', label: 'Liso' },
  { id: 'listras', label: 'Listras' },
  { id: 'faixas', label: 'Faixas' },
  { id: 'diagonal', label: 'Diagonal' },
  { id: 'faixa', label: 'Faixa central' },
  { id: 'meio', label: 'Meio a meio' },
  { id: 'quartos', label: 'Quartos' },
  { id: 'chevron', label: 'Chevron' },
]

export const CREST_SYMBOLS = [
  { id: 'nenhum', label: 'Nenhum' },
  { id: 'bola', label: 'Bola' },
  { id: 'estrela', label: 'Estrela' },
  { id: 'coroa', label: 'Coroa' },
  { id: 'raio', label: 'Raio' },
  { id: 'chama', label: 'Chama' },
  { id: 'controle', label: 'Controle' },
  { id: 'torre', label: 'Torre' },
]

// Combinações prontas: principal (campo), detalhe (padrão) e destaque (símbolo, texto e borda).
export const CREST_PALETTES = [
  { id: 'xv', label: 'Preto e ouro', primary: '#111111', secondary: '#ffd60a', accent: '#ffffff' },
  { id: 'ouro', label: 'Ouro e preto', primary: '#ffd60a', secondary: '#111111', accent: '#111111' },
  { id: 'verde', label: 'Verde e branco', primary: '#0f6b3a', secondary: '#ffffff', accent: '#ffffff' },
  { id: 'alvinegro', label: 'Alvinegro', primary: '#ffffff', secondary: '#111111', accent: '#111111' },
  { id: 'rubro', label: 'Rubro-negro', primary: '#c8102e', secondary: '#111111', accent: '#ffffff' },
  { id: 'celeste', label: 'Celeste', primary: '#6cace4', secondary: '#ffffff', accent: '#0b2a4a' },
  { id: 'marinho', label: 'Azul e vermelho', primary: '#0b2a4a', secondary: '#c8102e', accent: '#ffffff' },
  { id: 'grena', label: 'Grená e azul', primary: '#7a1f3d', secondary: '#1f3f8a', accent: '#ffd60a' },
  { id: 'tricolor', label: 'Tricolor', primary: '#ffffff', secondary: '#c8102e', accent: '#111111' },
  { id: 'laranja', label: 'Laranja', primary: '#ff6b00', secondary: '#111111', accent: '#ffffff' },
  { id: 'roxo', label: 'Roxo e prata', primary: '#4b1f7a', secondary: '#c7c9cc', accent: '#ffffff' },
  { id: 'esmeralda', label: 'Verde e ouro', primary: '#0b5d3b', secondary: '#ffd60a', accent: '#ffd60a' },
]

export const MONOGRAM_MAX = 4
export const STARS_MAX = 3

const HEX = /^#[0-9a-f]{6}$/i
const has = (list, id) => list.some((x) => x.id === id)

// Mantém só os campos conhecidos, com valores dentro das listas permitidas.
export function cleanCrest(input = {}) {
  return {
    version: CREST_VERSION,
    shape: has(CREST_SHAPES, input.shape) ? input.shape : 'classico',
    pattern: has(CREST_PATTERNS, input.pattern) ? input.pattern : 'liso',
    symbol: has(CREST_SYMBOLS, input.symbol) ? input.symbol : 'nenhum',
    primary: HEX.test(input.primary || '') ? input.primary.toLowerCase() : '#111111',
    secondary: HEX.test(input.secondary || '') ? input.secondary.toLowerCase() : '#2a2a2a',
    accent: HEX.test(input.accent || '') ? input.accent.toLowerCase() : '#ffd60a',
    monogram: String(input.monogram || '')
      .toUpperCase()
      .replace(/[^A-Z0-9À-Ý]/g, '')
      .slice(0, MONOGRAM_MAX),
    ribbon: input.ribbon ? String(input.ribbon).trim().toUpperCase().slice(0, 24) : '',
    stars: Math.max(0, Math.min(STARS_MAX, Math.round(Number(input.stars) || 0))),
    layers: [],
  }
}

export function validateCrest(input) {
  if (!input || input.version !== CREST_VERSION) return 'Monte o escudo antes de concluir.'
  for (const key of ['primary', 'secondary', 'accent']) {
    if (!HEX.test(input[key] || '')) return 'Escolha as cores do escudo.'
  }
  if (!has(CREST_SHAPES, input.shape)) return 'Escolha a forma do escudo.'
  if (!has(CREST_PATTERNS, input.pattern)) return 'Escolha o padrão do escudo.'
  if (!has(CREST_SYMBOLS, input.symbol)) return 'Escolha o símbolo do escudo.'
  if (input.symbol === 'nenhum' && !String(input.monogram || '').trim()) {
    return 'O escudo precisa de um símbolo ou de uma sigla.'
  }
  return null
}

export function randomCrest(name = '', rand = Math.random) {
  const pick = (list) => list[Math.floor(rand() * list.length)]
  const palette = pick(CREST_PALETTES)
  const symbol = pick(CREST_SYMBOLS.filter((s) => s.id !== 'nenhum'))
  return cleanCrest({
    shape: pick(CREST_SHAPES).id,
    pattern: pick(CREST_PATTERNS).id,
    symbol: symbol.id,
    primary: palette.primary,
    secondary: palette.secondary,
    accent: palette.accent,
    monogram: monogramFrom(name),
    ribbon: rand() < 0.5 ? name : '',
    stars: Math.floor(rand() * 2),
  })
}

export function monogramFrom(name) {
  const words = String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9À-Ý ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !['DE', 'DA', 'DO', 'DOS', 'DAS', 'E', 'FC', 'EC', 'SC'].includes(w))
  if (!words.length) return 'XV'
  if (words.length === 1) return words[0].slice(0, 3)
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
}
