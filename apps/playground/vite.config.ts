import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  base: process.env.VITE_BASE_PATH || process.env.PAGES_BASE_PATH || "/",
  plugins: [react()],
  server: {
    fs: {
      allow: [repositoryRoot],
    },
  },
});
