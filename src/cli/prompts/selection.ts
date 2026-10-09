import { readdirSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { assertInteractive } from "./index.ts";

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
  assertInteractive();
  if (!choices.length) return undefined;
  // Use Inquirer for short lists, fzf for larger searchable collections.
  if (choices.length >= 8) {
    const probe = spawnSync("fzf", ["--version"], { stdio: "ignore" });
    if (!probe.error && probe.status === 0) {
      const result = spawnSync("fzf", [
        "--prompt", message + "> ",
        "--delimiter=\\t",
        "--with-nth=2..",
        "--exit-0",
      ], {
        input: choices.map((choice,i)=>`${i}\\t${choice.name}`).join("\n")+"\n",
        encoding: "utf8",
        stdio: ["pipe","pipe","inherit"]
      });
      if (result.status === 1 || result.status === 130) return undefined;
      if (result.error || result.status !== 0) throw new Error(`fzf failed: ${result.error?.message ?? result.status}`);
      const line=result.stdout.trim();
      if (!line) return undefined;
      const index=Number(line.split("\t",1)[0]);
      if (!Number.isInteger(index) || index < 0 || index >= choices.length) throw new Error("Invalid fzf selection");
      return choices[index].value;
    }
  }
  const { select } = await import("@inquirer/prompts");
  return select({ message, choices });
}
