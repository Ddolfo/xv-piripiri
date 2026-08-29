const EA_HEADERS = {
  accept: 'application/json',
  'accept-language': 'en-US,en;q=0.9',
  'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  origin: 'https://proclubs.ea.com',
  referer: 'https://proclubs.ea.com/',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS' && url.pathname.startsWith('/ea')) {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, OPTIONS',
          'access-control-allow-headers': '*',
        },
      })
    }

    if (url.pathname === '/ea' || url.pathname.startsWith('/ea/')) {
      const target = new URL(
        `${url.pathname.replace(/^\/ea/, '')}${url.search}`,
        'https://proclubs.ea.com',
      )
      const upstream = await fetch(target.toString(), {
        method: 'GET',
        headers: EA_HEADERS,
        redirect: 'follow',
      })
      const body = await upstream.arrayBuffer()
      const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8'
      return new Response(body, {
        status: upstream.status,
        headers: {
          'content-type': contentType,
          'access-control-allow-origin': '*',
          'cache-control': 'public, max-age=20',
        },
      })
    }

    return env.ASSETS.fetch(request)
  },
}
