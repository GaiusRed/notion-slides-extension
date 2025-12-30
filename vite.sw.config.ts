import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';

  return {
    // Only needed so manifest gets copied by the first build.
    publicDir: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      sourcemap: isDev,
      minify: !isDev,
      rollupOptions: {
        input: resolve(__dirname, 'src/background/serviceWorker.ts'),
        output: {
          format: 'iife',
          entryFileNames: 'background/serviceWorker.js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]'
        }
      }
    }
  };
});
