import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Inside the Docker network the backend is reachable at http://api:3000;
// in plain local dev it listens on localhost:3000. The compose file sets
// VITE_API_PROXY_TARGET accordingly (this var is read here at dev-server
// startup since it runs in Node).
const apiTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Proxy API calls to NestJS during local dev / within the compose network
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      // Book cover images are served by the API outside the /api prefix
      '/uploads': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});