import { program } from "commander";
import { runDependencyCheck } from "./dependency-check";
import { packageChoices, selectOne } from "../cli/prompts/selection.ts";

program
  .name("workspace-dependency-check")
  .description("Check outdated and mismatched workspace dependencies.")
  .option("--package <selector>", "Package name or directory")
  .option("-a, --all", "Check every workspace package")
  .option("-j, --json", "Output JSON")
  .option("-n, --no-assert", "Report failures without failing")
  .option("--no-interactive", "Never prompt")
  .action(async (options) => {
    let selector=options.package as string|undefined;
    if(!options.all && !options.json && !selector && options.interactive &&
       !process.env.CI && process.stdin.isTTY && process.stderr.isTTY) {
      selector=await selectOne(packageChoices(),"Package to check");
    }
    runDependencyCheck(selector,{...options,fzf:false});
  });

await program.parseAsync();
