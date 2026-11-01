import fs from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In `npm run dev` the page comes from Vite, but /api lives in Fastify. Proxy it to the
// backend's port (Backend/config.json → app.port, else the example's) so dev behaves like
// the single-origin production setup. The build itself never reads this.
function backendPort(): number {
  for (const file of ['../Backend/config.json', '../Backend/config.example.json']) {
    try {
      const json = JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf-8').replace(/^\uFEFF/, ''))
      if (json?.app?.port) return Number(json.app.port)
    } catch {
      // missing or unreadable — try the next one
    }
  }
  return 8080
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // bind 0.0.0.0
    allowedHosts: true, // accept any Host header (e.g. a server domain)
    proxy: {
      '/api': `http://127.0.0.1:${backendPort()}`,
    },
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
  build: {
    // Fastify serves this build from Backend/public/dist (single origin).
    outDir: '../Backend/public/dist',
    emptyOutDir: true,
  },
})
