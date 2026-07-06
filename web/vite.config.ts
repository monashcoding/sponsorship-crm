import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev proxy sends /api and /health to the Express server on :3000 so the SPA is
// same-origin in dev too (mirrors production where one container serves both).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
  build: { outDir: "dist" },
});
