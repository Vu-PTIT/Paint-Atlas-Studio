import { defineConfig } from 'vite';

export default defineConfig({
  root: 'studio',
  base: '/studio-ui/',
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/reference': 'http://127.0.0.1:8000',
    },
  },
  build: { outDir: '../dist', emptyOutDir: true },
});
