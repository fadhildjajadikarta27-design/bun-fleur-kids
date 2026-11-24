import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Standalone build (replaces the Space runtime's client/build.mjs):
// the SPA lives in client/, the production bundle lands in repo-root dist/.
const proxy = { "/api/actions": { target: "http://127.0.0.1:8787", xfwd: true } };

export default defineConfig({
  server: { proxy },
  preview: { proxy },
  root: "client",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
