import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'LoyalLink: rewards you can trust',
        short_name: 'LoyalLink',
        description: 'Loyalty rewards from your neighbourhood shops, secured before you spend.',
        theme_color: '#1F1B16',
        background_color: '#FAF7F2',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { navigateFallbackDenylist: [/^\/api\//], globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8080' } },
  build: { target: 'es2020', sourcemap: true },
});
