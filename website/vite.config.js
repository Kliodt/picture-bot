import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    server: {
        watch: {
            usePolling: process.env.DEV_POLLING === 'true',
        },
        proxy: {
            '/pictures': process.env.API_PROXY_TARGET || 'http://localhost:8000',
            '/users': process.env.API_PROXY_TARGET || 'http://localhost:8000',
        },
    },
    build: {
        rollupOptions: {
            input: {
                main: fileURLToPath(new URL('./index.html', import.meta.url)),
                v1: fileURLToPath(new URL('./v1/index.html', import.meta.url)),
                board: fileURLToPath(new URL('./v2/index.html', import.meta.url)),
            },
        },
    },
});
