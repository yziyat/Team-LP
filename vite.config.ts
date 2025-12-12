
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
<<<<<<< HEAD
  base: '/Team-LP/', // Nom exact de votre dépôt GitHub
=======
  base: '/Team-LP/', // Repository name for GitHub Pages
>>>>>>> 2018618667891a8668c5577f38d0eee3da78abfa
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    emptyOutDir: true,
  }
});
