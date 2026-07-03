import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    // PORT lets the preview harness assign a free port when 3000 is taken
    // by another session's dev server; defaults to 3000 otherwise.
    port: Number(process.env.PORT) || 3000,
    strictPort: true,
    allowedHosts: true,
  },
})
