import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@core': path.resolve(__dirname, 'src/core'),
          '@/core': path.resolve(__dirname, 'src/core'),
          '@/services': path.resolve(__dirname, 'services'),
          '@/repositories': path.resolve(__dirname, 'repositories'),
          '@/types': path.resolve(__dirname, 'types.ts'),
        }
      }
    };
});
