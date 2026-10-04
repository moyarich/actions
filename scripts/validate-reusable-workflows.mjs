#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const workflowsDirectory = path.resolve(".github/workflows");
const entries = await readdir(workflowsDirectory, { withFileTypes: true });

const errors = [];
const reusable = [];

for (const entry of entries) {
  if (entry.isDirectory()) {
    errors.push(
      `Workflow subdirectory is not supported by GitHub Actions: .github/workflows/${entry.name}`,
    );
    continue;
  }

  if (!/^reusable_.*\.ya?ml$/.test(entry.name)) {
    continue;
  }

  const filePath = path.join(workflowsDirectory, entry.name);
  const source = await readFile(filePath, "utf8");
  reusable.push(entry.name);

  if (!/^\s*workflow_call\s*:/m.test(source)) {
    errors.push(`${entry.name}: public reusable workflow is missing workflow_call`);
  }
}

if (!reusable.length) {
  errors.push("No public reusable workflows were found.");
}

if (errors.length) {
  for (const error of errors) {
    process.stderr.write(`ERROR: ${error}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Validated ${reusable.length} reusable workflows:\n${reusable
      .sort()
      .map((name) => `- ${name}`)
      .join("\n")}\n`,
  );
}
