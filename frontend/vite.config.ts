import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Khi chay dev, goi /api se duoc chuyen sang backend (tranh loi CORS)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000', changeOrigin: true },
    },
  },
});
