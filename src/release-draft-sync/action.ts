import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import process from "node:process";
import { reconcileReleaseBody } from "./core";

function input(name: string, required = false): string {
  const suffix = name.toUpperCase();
  const value =
    process.env[`INPUT_${suffix}`] ??
    process.env[`INPUT_${suffix.replaceAll("-", "_")}`] ??
    "";

  if (required && !value) {
    throw new Error(`Missing required input: ${name}`);
  }

  return value;
}

function setOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;

  if (outputFile) {
    appendFileSync(outputFile, `${name}=${value}\n`);
  }
}

export function runAction(): void {
  const existingBodyFile = input("existing-body-file", true);
  const generatedBodyFile = input("generated-body-file", true);
  const outputFile = input("output-file", true);
  const changelogPath = input("changelog-path") || "CHANGELOG.md";
  const version = input("version");
  const targetKey = input("target-key") || "root";
  const seedSha = input("seed-sha");
  const targetPath = input("target-path");

  const result = reconcileReleaseBody({
    existingBody: existsSync(existingBodyFile)
      ? readFileSync(existingBodyFile, "utf8")
      : "",
    generatedBody: existsSync(generatedBodyFile)
      ? readFileSync(generatedBodyFile, "utf8")
      : "",
    changelogPath,
    version,
    targetKey,
    seedSha,
    targetPath,
  });

  writeFileSync(outputFile, `${result.trim()}\n`);
  setOutput("body-file", outputFile);
  setOutput("seed-sha", seedSha);
}
