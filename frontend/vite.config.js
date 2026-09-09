import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite is the build tool that turns your React/JSX files into
// something a browser can run, and gives you a fast dev server
// with instant reload while you're coding.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
