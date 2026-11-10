import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Read the shared contract straight from source, so shared/ never needs a build step
const sharedSrc = fileURLToPath(new URL("../shared/src/index.ts", import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: { "@scc/shared": sharedSrc },
    // shared/ has no node_modules of its own, so its "zod" import resolves from frontend/
    dedupe: ["zod"],
  },
  server: {
    port: 5173,
    // Real mode only: the browser calls /api and Vite forwards it to the backend (same origin).
    // In mock mode the in-browser mock answers /api, so no proxy is needed.
    proxy:
      mode === "mock" ? undefined : { "/api": { target: "http://localhost:4000", changeOrigin: false } },
  },
  build: {
    target: "es2022",
    sourcemap: "hidden", // maps exist for debugging but are not served publicly
  },
}));
