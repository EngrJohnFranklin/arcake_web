import { defineConfig } from 'vite';
import { resolve } from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        main:      resolve(__dirname, 'index.html'),
        customize: resolve(__dirname, 'pages/customize.html'),
      },
    }
  },
  server: {
    port: 3000,
    open: true
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      workbox: {
        // Cache all built asset types
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2,json}'],

        // MPA: both pages are pre-cached — no navigateFallback needed
        navigateFallback: null,

        // Explicitly precache both HTML entry points
        additionalManifestEntries: [
          { url: 'index.html',           revision: null },
          { url: 'pages/customize.html', revision: null },
        ],

        // Three.js chunk is ~548 KB — raise the limit to 5 MB
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,

        runtimeCaching: [
          {
            // Cache-first for same-origin page navigations
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'CacheFirst',
            options: {
              cacheName: 'arcake-pages',
              expiration: { maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            // Cache-first for all JS/CSS/assets from same origin
            urlPattern: ({ url }) => url.origin === self.location.origin,
            handler: 'CacheFirst',
            options: {
              cacheName: 'arcake-assets',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
        ],
      },

      manifest: {
        name: 'ARCake – 3D Cake Customizer',
        short_name: 'ARCake',
        description: 'Design and preview custom cakes in 3D with AR — works offline',
        theme_color: '#E91E8C',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: './',
        start_url: './',
        categories: ['food', 'lifestyle', 'design'],
        icons: [
          { src: 'pwa-192x192.png',          sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png',          sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'apple-touch-icon.png',     sizes: '180x180', type: 'image/png' },
        ],
      },

      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
});
