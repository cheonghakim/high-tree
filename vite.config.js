import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'high-tree.js'),
            name: 'HighTree',
            formats: ['es', 'umd'],
            fileName: (format) => `high-tree.${format === 'es' ? 'js' : 'umd.cjs'}`
        },
        rollupOptions: {
            output: {
                exports: 'default'
            }
        }
    }
});
