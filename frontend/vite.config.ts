import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [TanStackRouterVite({ routesDirectory: './src/routes' }), react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/runs': 'http://localhost:3000',
      '/config': 'http://localhost:3000',
      '/trigger': 'http://localhost:3000',
      '/webhook': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
});
