import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // served from https://micoder-dev.github.io/Canvas-Lab/ in production
  base: command === 'build' ? '/Canvas-Lab/' : '/',
  plugins: [react()],
  server: { host: true, port: 5173 }, // host:true binds 0.0.0.0 → reachable on LAN
}))
