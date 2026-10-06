import { defineConfig } from "vite";

const entries: Record<string, string> = {
  "issue-dependency-tree":
    "src/issue-dependency-tree/issue-dependency-tree-cli.ts",
  "discover-packages": "src/discover-packages/discover-packages-cli.ts",
  "workspace-release": "src/release/release-cli.ts",
  "workspace-publish": "src/publish/publish-cli.ts",
  "workspace-dependency-check": "src/dependency-check/dependency-check-cli.ts",
  "workspace-package-lock": "src/package-lock/package-lock-cli.ts",
  "workspace-release-identity": "src/release-identity/release-identity-cli.ts",
};

export default defineConfig(({ mode }) => {
  const entry = entries[mode];

  if (!entry) {
    throw new Error(`Unknown CLI build mode: ${mode}`);
  }

  return {
    ssr: {
      noExternal: true,
    },
    build: {
      ssr: entry,
      target: "node24",
      outDir: "dist/bin",
      emptyOutDir: false,
      minify: false,
      sourcemap: false,
      rollupOptions: {
        output: {
          entryFileNames: `${mode}.mjs`,
          banner: "#!/usr/bin/env node",
        },
      },
    },
  };
});
