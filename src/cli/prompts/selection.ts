import { readdirSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { selectMany } from "./index.ts";

/** Available root and direct-child workspace packages for interactive CLI selection. */
export function packageChoices(
  root = process.cwd(),
): { name: string; value: string }[] {
  const choices = [{ name: "Root package (.)", value: "." }];
  const manifestPath = resolve(root, "package.json");
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const patterns: string[] = manifest.workspaces ?? [];
    for (const pattern of patterns) {
      if (!pattern.endsWith("/*")) continue;
      const base = pattern.slice(0, -2),
        folder = resolve(root, base);
      if (!existsSync(folder)) continue;
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const path = resolve(folder, entry.name, "package.json");
        if (!entry.isDirectory() || !existsSync(path)) continue;
        const pkg = JSON.parse(readFileSync(path, "utf8"));
        choices.push({
          name: `${pkg.name ?? entry.name} (${base}/${entry.name})`,
          value: `${base}/${entry.name}`,
        });
      }
    }
  }
  return choices;
}

export async function selectOne(
  choices: { name: string; value: string }[],
  message: string,
): Promise<string | undefined> {
  const selected = await selectMany(choices, message);
  return selected[0];
}
