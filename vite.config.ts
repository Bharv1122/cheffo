import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Server routes and the token-authed vet form must never be served
      // from the SPA shell cache.
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'Cheffo Doggo',
        short_name: 'Cheffo',
        description: 'Lightly-cooked, personalized homemade dog-food recipes — vet-reviewed by your own veterinarian.',
        start_url: '/',
        display: 'standalone',
        background_color: '#fffbf5',
        theme_color: '#A35A16',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    // PORT lets the preview harness assign a free port when 3000 is taken
    // by another session's dev server; defaults to 3000 otherwise.
    port: Number(process.env.PORT) || 3000,
    strictPort: true,
    allowedHosts: true,
  },
})
