import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
      assetsInclude: ['**/*.png', '**/*.jpg', '**/*.svg', '**/*.PNG', '**/*.JPG', '**/*.JPEG', '**/*.jpeg'],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src')
        }
      },
      build: {
        outDir: 'dist',
        emptyOutDir: true,
      }
    };
});
