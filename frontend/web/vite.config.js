import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const base = process.env.VITE_BASE_PATH?.replace(/\/?$/, '/') || '/'

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
          if (id.includes('@tanstack/')) return 'vendor-query'
          if (id.includes('axios')) return 'vendor-net'
          return 'vendor-misc'
        }
      }
    }
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})