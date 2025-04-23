import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    // @replit/vite-plugin-shadcn-theme-json(), // Commented out for debugging
    // @replit/vite-plugin-cartographer(), // Commented out for debugging
    // @replit/vite-plugin-runtime-error-modal(), // Commented out for debugging
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  publicDir: path.resolve(__dirname, "client", "public"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
    rollupOptions: {
      input: path.resolve(__dirname, 'client', 'src', 'main.tsx'),
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'wouter'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-select',
            '@radix-ui/react-slot',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
          ],
          charts: ['chart.js', 'recharts'],
          forms: ['react-hook-form', 'zod'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
