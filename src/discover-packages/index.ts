import process from "node:process";
import { runAction } from "./action";

try {
  runAction();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`discover-packages: ${message}\n`);
  process.exitCode = 1;
}
