import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Extension builds are not a webapp: we produce JS bundles + static manifest.
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';

  return {
    publicDir: 'public',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: isDev,
      minify: !isDev,
      rollupOptions: {
        input: {
          serviceWorker: resolve(__dirname, 'src/background/serviceWorker.ts'),
          contentScript: resolve(__dirname, 'src/content/contentScript.ts')
        },
        output: {
          // Content scripts are safest as classic scripts.
          format: 'iife',
          entryFileNames: (chunk) => {
            if (chunk.name === 'serviceWorker') return 'background/serviceWorker.js';
            if (chunk.name === 'contentScript') return 'content/contentScript.js';
            return 'assets/[name].js';
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]'
        }
      }
    }
  };
});
