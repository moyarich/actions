import { readdirSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { defineConfig } from "vite";

const actionsDirectory = resolve("src/actions");

const entries = Object.fromEntries(
  readdirSync(actionsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extname(entry.name) === ".ts")
    .map((entry) => [
      basename(entry.name, ".ts"),
      resolve(actionsDirectory, entry.name),
    ]),
);

export default defineConfig({
  build: {
    ssr: Object.values(entries),
    target: "node24",
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    rollupOptions: {
      input: entries,
      output: {
        entryFileNames: "actions/[name]/index.mjs",
      },
    },
  },
});
