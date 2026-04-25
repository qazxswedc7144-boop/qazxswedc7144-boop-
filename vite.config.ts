import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // We no longer inject GEMINI_API_KEY into the client to maintain security.
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      assetsInclude: ['**/*.png', '**/*.jpg', '**/*.svg', '**/*.PNG', '**/*.JPG', '**/*.JPEG', '**/*.jpeg'],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src')
        }
      }
    };
});
