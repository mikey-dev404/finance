import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
    root: resolve('src/renderer'),
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@renderer': resolve('src/renderer/src'),
            '@shared': resolve('src/shared')
        }
    },
    define: {
        'import.meta.env.VITE_FINANCE_PHONE': JSON.stringify('1')
    },
    build: {
        outDir: resolve('mobile/www'),
        emptyOutDir: true
    }
});
