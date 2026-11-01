import { COACH_CLUBS } from './eaApi.js'

// Envio manual dos dados da EA: quando a EA barra o worker (403), o navegador de quem
// administra o painel busca os mesmos endereços e manda para o worker guardar.

export const SYNC_PATHS = [
  '/api/fc/clubs/info',
  '/api/fc/clubs/overallStats',
  '/api/fc/members/stats',
  '/api/fc/members/career/stats',
  '/api/fc/club/playoffAchievements',
  '/api/fc/clubs/matches',
  '/api/fc/currentSeasonLeaderboard/search',
  '/api/fc/allTimeLeaderboard/search',
]

const MATCH_TYPES = ['leagueMatch', 'playoffMatch', 'friendlyMatch']

// Mesmos parâmetros, na mesma ordem, que o painel usa (eaApi.js): assim a chave
// guardada no worker é idêntica à que o painel pede depois.
export function syncRequests(clubs = COACH_CLUBS) {
  const out = []
  for (const c of clubs) {
    const platform = c.platform || 'common-gen5'
    const id = String(c.clubId)
    out.push({ path: '/api/fc/clubs/info', params: { platform, clubIds: id } })
    out.push({ path: '/api/fc/clubs/overallStats', params: { platform, clubIds: id } })
    out.push({ path: '/api/fc/members/stats', params: { platform, clubId: id } })
    out.push({ path: '/api/fc/members/career/stats', params: { platform, clubId: id } })
    out.push({ path: '/api/fc/club/playoffAchievements', params: { platform, clubId: id } })
    for (const matchType of MATCH_TYPES) {
      out.push({
        path: '/api/fc/clubs/matches',
        params: { platform, clubIds: id, matchType, maxResultCount: '10' },
      })
    }
    out.push({ path: '/api/fc/currentSeasonLeaderboard/search', params: { platform, clubName: c.name } })
    out.push({ path: '/api/fc/allTimeLeaderboard/search', params: { platform, clubName: c.name } })
  }
  return out
}

export function syncKey(path, params) {
  const qs = new URLSearchParams()
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  })
  return `${path}?${qs.toString()}`
}

// Link da EA onde o favorito roda (mesma origem dos dados, sem bloqueio de CORS).
export const EA_START_URL = 'https://proclubs.ea.com/api/fc/clubs/info?platform=common-gen5&clubIds=51895'

// Código do favorito: abre a janela do painel, busca na EA e entrega por postMessage.
export function buildBookmarklet(receiverUrl, requests = syncRequests()) {
  const code = `(async()=>{
const R=${JSON.stringify(receiverUrl)},Q=${JSON.stringify(requests)},O=new URL(R).origin;
const b=document.createElement('div');b.style.cssText='position:fixed;z-index:2147483647;top:16px;right:16px;padding:14px 18px;background:#161617;color:#f5f5f7;font:14px/1.4 system-ui,sans-serif;border-radius:14px;border:1px solid #ffd60a;box-shadow:0 10px 30px rgba(0,0,0,.5);max-width:320px';
(document.body||document.documentElement).appendChild(b);const say=t=>{b.textContent='XV · '+t};
if(!/(^|\\.)ea\\.com$/.test(location.hostname)){say('Abra primeiro o link da EA indicado no painel e clique de novo.');return}
const w=window.open(R,'xv-receber');if(!w){say('O navegador bloqueou a janela do painel. Libere pop-ups e clique de novo.');return}
let ready=false;addEventListener('message',e=>{if(e.origin===O&&e.data==='xv-ready')ready=true});
const items=[];let fail=0;
for(let i=0;i<Q.length;i++){const q=Q[i];say('Buscando na EA '+(i+1)+' de '+Q.length+'…');
try{const r=await fetch('https://proclubs.ea.com'+q.path+'?'+new URLSearchParams(q.params));if(!r.ok)throw r.status;items.push({path:q.path,params:q.params,data:await r.json()})}catch(err){fail++}
await new Promise(r=>setTimeout(r,250))}
if(!items.length){say('A EA não respondeu neste navegador. Recarregue a página da EA e tente de novo.');return}
say('Entregando '+items.length+' respostas ao painel…');
for(let t=0;t<60&&!ready;t++)await new Promise(r=>setTimeout(r,500));
w.postMessage({type:'xv-ea-sync',items:items,fail:fail,at:Date.now()},O);
say('Pronto. Continue na janela do painel.'+(fail?' ('+fail+' de '+Q.length+' falharam)':''));
setTimeout(()=>b.remove(),10000)})()`
  return `javascript:${encodeURIComponent(code.replace(/\n/g, ''))}`
}
