import { resolve } from 'node:path'
import { defineConfig } from 'vite'

/** Headless Node server bundle (no Electron). */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared')
    }
  },
  build: {
    outDir: 'out/server',
    emptyOutDir: true,
    target: 'node22',
    ssr: true,
    rollupOptions: {
      input: resolve('src/main/headless.ts'),
      output: {
        entryFileNames: 'headless.js',
        format: 'cjs',
        exports: 'auto'
      },
      external: ['better-sqlite3', 'electron', /^node:/]
    },
    minify: false,
    sourcemap: true
  }
})
