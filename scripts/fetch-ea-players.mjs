import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'src', 'draft', 'data', 'ea-fc27-players.json')

function nameOf(p) {
  return String(p.commonName || `${p.firstName || ''} ${p.lastName || ''}`).replace(/\s+/g, ' ').trim()
}

function mapPlayer(p) {
  const stats = p.stats || {}
  const num = (key) => Number(stats[key]?.value ?? 0) || Number(p.overallRating)
  return {
    id: `ea${p.id}`,
    eaId: p.id,
    name: nameOf(p),
    overall: Number(p.overallRating),
    position: p.position?.shortLabel || 'CM',
    nation: p.nationality?.label || null,
    club: p.team?.label || null,
    league: p.leagueName || null,
    image: p.avatarUrl || null,
    shield: p.shieldUrl || null,
    pace: num('pac'),
    shooting: num('sho'),
    passing: num('pas'),
    dribbling: num('dri'),
    defending: num('def'),
    physical: num('phy'),
  }
}

async function fetchPage(page) {
  const url = `https://www.ea.com/games/ea-sports-fc/ratings?page=${page}`
  const r = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      accept: 'text/html',
    },
  })
  if (!r.ok) throw new Error(`EA ratings ${r.status} page ${page}`)
  const html = await r.text()
  const script = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!script) throw new Error(`NEXT_DATA ausente na página ${page}`)
  const details = JSON.parse(script[1]).props.pageProps.ratingDetails
  return details.items.map(mapPlayer)
}

const CAP = {
  91: 20, 90: 24, 89: 24, 88: 24, 87: 28, 86: 28, 85: 28, 84: 24,
  83: 90, 82: 24, 81: 24, 80: 24,
  79: 40, 78: 40, 77: 40, 76: 40, 75: 40, 74: 40,
  73: 24, 72: 24, 71: 24, 70: 24,
  69: 20, 68: 20, 67: 20, 66: 20, 65: 20,
}

const ICONS = [
  { id: 'icon-pele', name: 'Pelé', overall: 95, position: 'CAM', nation: 'Brasil', club: 'Ícones', pace: 93, shooting: 94, passing: 91, dribbling: 94, defending: 58, physical: 74 },
  { id: 'icon-maradona', name: 'Diego Maradona', overall: 95, position: 'CAM', nation: 'Argentina', club: 'Ícones', pace: 90, shooting: 91, passing: 91, dribbling: 96, defending: 40, physical: 77 },
  { id: 'icon-ronaldo', name: 'Ronaldo', overall: 94, position: 'ST', nation: 'Brasil', club: 'Ícones', pace: 94, shooting: 94, passing: 79, dribbling: 94, defending: 43, physical: 75 },
  { id: 'icon-zidane', name: 'Zinedine Zidane', overall: 94, position: 'CAM', nation: 'França', club: 'Ícones', pace: 83, shooting: 90, passing: 94, dribbling: 94, defending: 73, physical: 84 },
  { id: 'icon-cruyff', name: 'Johan Cruyff', overall: 93, position: 'CAM', nation: 'Holanda', club: 'Ícones', pace: 90, shooting: 91, passing: 90, dribbling: 94, defending: 42, physical: 73 },
  { id: 'icon-ronaldinho', name: 'Ronaldinho', overall: 93, position: 'LW', nation: 'Brasil', club: 'Ícones', pace: 91, shooting: 89, passing: 90, dribbling: 95, defending: 38, physical: 80 },
  { id: 'icon-maldini', name: 'Paolo Maldini', overall: 93, position: 'CB', nation: 'Itália', club: 'Ícones', pace: 85, shooting: 55, passing: 75, dribbling: 72, defending: 95, physical: 84 },
  { id: 'icon-garrincha', name: 'Garrincha', overall: 93, position: 'RW', nation: 'Brasil', club: 'Ícones', pace: 90, shooting: 87, passing: 92, dribbling: 95, defending: 40, physical: 66 },
  { id: 'icon-beckenbauer', name: 'Franz Beckenbauer', overall: 93, position: 'CB', nation: 'Alemanha', club: 'Ícones', pace: 82, shooting: 73, passing: 88, dribbling: 84, defending: 93, physical: 83 },
  { id: 'icon-gullit', name: 'Ruud Gullit', overall: 92, position: 'CF', nation: 'Holanda', club: 'Ícones', pace: 86, shooting: 89, passing: 88, dribbling: 89, defending: 82, physical: 86 },
  { id: 'icon-eusebio', name: 'Eusébio', overall: 92, position: 'ST', nation: 'Portugal', club: 'Ícones', pace: 93, shooting: 93, passing: 84, dribbling: 90, defending: 44, physical: 78 },
  { id: 'icon-yashin', name: 'Lev Yashin', overall: 92, position: 'GK', nation: 'Rússia', club: 'Ícones', pace: 54, shooting: 45, passing: 60, dribbling: 58, defending: 45, physical: 86 },
]

const byOvr = new Map()
const seen = new Set()
let page = 1
let lowest = 99
while (page <= 60) {
  const items = await fetchPage(page)
  if (!items.length) break
  for (const p of items) {
    if (!p.name || seen.has(p.eaId)) continue
    seen.add(p.eaId)
    const cap = CAP[p.overall]
    if (!cap) continue
    const list = byOvr.get(p.overall) || []
    if (list.length >= cap) continue
    list.push(p)
    byOvr.set(p.overall, list)
    lowest = Math.min(lowest, p.overall)
  }
  const filled = Object.entries(CAP).every(([ovr, cap]) => (byOvr.get(Number(ovr)) || []).length >= cap)
  console.log(`página ${page} · únicos ${seen.size} · menor over ${items[items.length - 1]?.overall}`)
  if (filled && lowest <= 65) break
  page += 1
  await new Promise((res) => setTimeout(res, 250))
}

const players = [...byOvr.values()].flat().concat(
  ICONS.map((p) => ({
    ...p,
    eaId: p.id,
    league: 'Ícones',
    image: null,
    shield: null,
  })),
)
players.sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name, 'pt'))

await fs.mkdir(path.dirname(OUT), { recursive: true })
await fs.writeFile(OUT, `${JSON.stringify(players, null, 0)}\n`)
const counts = {}
for (const p of players) counts[p.overall] = (counts[p.overall] || 0) + 1
console.log('gravados', players.length, OUT)
console.log(counts)
