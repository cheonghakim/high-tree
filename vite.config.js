import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: 'high-tree.js',
            name: 'VirtualTree',
            formats: ['es', 'umd', 'iife'],
            fileName: (format) => {
                if (format === 'es') return 'high-tree.esm.js';
                if (format === 'umd') return 'high-tree.umd.js';
                if (format === 'iife') return 'high-tree.iife.js';
            }
        },
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: false,
                drop_debugger: true,
                pure_funcs: ['console.log']
            },
            mangle: {
                keep_classnames: true,
                keep_fnames: false
            },
            format: {
                comments: false
            }
        },
        sourcemap: true,
        rollupOptions: {
            output: {
                exports: 'named',
                globals: {}
            }
        }
    }
});
