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
          // Fix: `__dirname` is not available in an ES module context. `process.cwd()` is used to resolve the project root.
          // FIX: Replaced `process.cwd()` to avoid a TypeScript type error. `path.resolve('.')` correctly resolves to the project root directory when Vite is run.
          '@': path.resolve('.'),
        }
      }
    };
});