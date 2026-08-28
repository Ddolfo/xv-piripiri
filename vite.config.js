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
          'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        },
      },
    },
  },
})
