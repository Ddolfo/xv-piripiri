export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/ea' || url.pathname.startsWith('/ea/')) {
      const target = new URL(
        `${url.pathname.replace(/^\/ea/, '')}${url.search}`,
        'https://proclubs.ea.com',
      )
      const upstream = await fetch(target, {
        headers: {
          accept: 'application/json',
          'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        },
      })
      const headers = new Headers(upstream.headers)
      headers.set('access-control-allow-origin', '*')
      return new Response(upstream.body, {
        status: upstream.status,
        headers,
      })
    }

    return env.ASSETS.fetch(request)
  },
}
