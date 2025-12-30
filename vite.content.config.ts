import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';

  return {
    publicDir: 'public',
    build: {
      outDir: 'dist',
      // In watch/dev mode, do NOT wipe dist/ or we delete the service worker build.
      emptyOutDir: !isDev,
      sourcemap: isDev,
      minify: !isDev,
      rollupOptions: {
        input: resolve(__dirname, 'src/content/contentScript.ts'),
        output: {
          // Content scripts are safest as classic scripts.
          format: 'iife',
          entryFileNames: 'content/contentScript.js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]'
        }
      }
    }
  };
});
