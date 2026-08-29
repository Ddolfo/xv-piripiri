import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/ea': {
        target: 'https://proclubs.ea.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/ea/, ''),
        headers: {
          accept: 'application/json',
          'accept-language': 'en-US,en;q=0.9',
          'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
          'sec-fetch-site': 'same-origin',
          origin: 'https://proclubs.ea.com',
          referer: 'https://proclubs.ea.com/',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        },
      },
    },
  },
})
