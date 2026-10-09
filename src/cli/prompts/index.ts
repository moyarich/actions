import { spawnSync } from "node:child_process";
import process from "node:process";

export interface PromptChoice<T extends string = string> {
  name: string;
  value: T;
}

export function assertInteractive(): void {
  if (process.env.CI || !process.stdin.isTTY || !process.stderr.isTTY) {
    throw new Error("Interactive selection requires a TTY and is unavailable in CI. Pass explicit options instead.");
  }
}

function hasFzf(): boolean {
  const probe = spawnSync("fzf", ["--version"], { stdio: "ignore" });
  return !probe.error && probe.status === 0;
}

/** Use fzf for large interactive collections; Inquirer is the portable fallback. */
export async function selectMany<T extends string>(
  choices: PromptChoice<T>[],
  message: string,
): Promise<T[]> {
  assertInteractive();
  if (!choices.length) return [];
  if (hasFzf()) {
    const result = spawnSync(
      "fzf",
      ["--multi", "--delimiter=\t", "--with-nth=2..", "--prompt", message + "> ", "--header", "TAB toggles selection; ENTER confirms"],
      { input: choices.map((choice, i) => `${i}\t${choice.name}`).join("\n") + "\n", encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] },
    );
    if (result.status === 1 || result.status === 130) return [];
    if (result.error || result.status !== 0) throw new Error(`fzf failed: ${result.error?.message ?? result.status}`);
    return result.stdout.trim().split("\n").filter(Boolean).map(line => {
      const index = Number(line.split("\t", 1)[0]);
      if (!Number.isInteger(index) || index < 0 || index >= choices.length) throw new Error("Invalid fzf selection");
      return choices[index].value;
    });
  }
  const { checkbox } = await import("@inquirer/prompts");
  return checkbox({ message, choices });
}

export async function confirm(message: string, defaultValue = false): Promise<boolean> {
  assertInteractive();
  const { confirm: ask } = await import("@inquirer/prompts");
  return ask({ message, default: defaultValue });
}

export async function askText(message: string, defaultValue = ""): Promise<string> {
  assertInteractive();
  const { input } = await import("@inquirer/prompts");
  return input({ message, default: defaultValue });
}
