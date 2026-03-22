import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        customize: resolve(__dirname, 'pages/customize.html')
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
