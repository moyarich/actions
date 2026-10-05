import { defineConfig } from "vite";

const entries: Record<string, string> = {
  "issue-dependency-tree": "src/issue-dependency-tree/cli.ts",
  "discover-packages": "src/discover-packages/cli.ts",
  "workspace-release": "src/workspace-tools/cli/workspace-release.ts",
  "workspace-publish": "src/workspace-tools/cli/workspace-publish.ts",
  "workspace-dependency-check":
    "src/workspace-tools/cli/workspace-dependency-check.ts",
  "workspace-package-lock": "src/workspace-tools/cli/workspace-package-lock.ts",
  "workspace-release-identity":
    "src/workspace-tools/cli/workspace-release-identity.ts",
};

export default defineConfig(({ mode }) => {
  const entry = entries[mode];

  if (!entry) {
    throw new Error(`Unknown CLI build mode: ${mode}`);
  }

  return {
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
