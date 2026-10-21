import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_BASE_URL || 'http://localhost:3000';

  return {
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
        },
      },
      watch: {
        ignored: [
          '**/data/**',
          '**/Database/**',
          '**/secrets/**',
          '**/*.db',
          '**/*.sqlite',
        ],
      },
    },
    plugins: [
      tailwindcss(),
      react(),
    ],
  };
});
