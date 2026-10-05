import process from "node:process";
import { runAction } from "./action";

try {
  runAction();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`issue-dependency-tree: ${message}\n`);
  process.exitCode = 1;
}
