import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: {
    alias: {
      "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./src"),
    },
  },
  server: {
    watch: { usePolling: process.env.CHOKIDAR_USEPOLLING === "true" },
    port: 5173,
    strictPort: true,
    proxy: { "/api": process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3001" },
  },
});
