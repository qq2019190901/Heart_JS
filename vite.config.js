import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
    base: './',
    plugins: [react(), tailwindcss()],
    server: {
        host: true,
        port: 5173,
        strictPort: true,
        proxy: {
            '/peerjs': {
                target: 'ws://localhost:9000',
                ws: true,
                changeOrigin: true,
            },
        },
    },
});
