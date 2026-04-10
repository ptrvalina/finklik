import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages: set VITE_BASE_PATH=/repo-name/ in CI (e.g. /finklik/)
const base = process.env.VITE_BASE_PATH?.replace(/\/?$/, '/') || '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
