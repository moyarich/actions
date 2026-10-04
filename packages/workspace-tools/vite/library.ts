import type { LibraryOptions, Plugin, UserConfig } from "vite";

export interface LibraryPluginOptions {
  entry: LibraryOptions["entry"];
  name?: string;
  formats?: LibraryOptions["formats"];
  fileName?: LibraryOptions["fileName"];
  outDir?: string;
  target?: string;
  sourcemap?: boolean;
  minify?: boolean | "esbuild" | "terser";
  external?: Array<string | RegExp>;
}

export function library(options: LibraryPluginOptions): Plugin {
  const {
    entry,
    name,
    formats = ["es"],
    fileName,
    outDir = "dist",
    target = "es2022",
    sourcemap = true,
    minify = false,
    external = [],
  } = options;

  return {
    name: "moyarich:library",
    enforce: "pre",

    config(): UserConfig {
      return {
        build: {
          target,
          outDir,
          emptyOutDir: true,
          sourcemap,
          minify,
          lib: {
            entry,
            name,
            formats,
            fileName,
          },
          rollupOptions: {
            external,
          },
        },
      };
    },
  };
}
