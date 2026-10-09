import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/home3d',
  publicDir: false,
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    sourcemap: false
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  }
});
