import { Option, program } from "commander";
import { publishWorkspacePackage } from "./publish.ts";
import { confirm } from "../cli/prompts/index.ts";
import { packageChoices, selectOne } from "../cli/prompts/selection.ts";

program
  .name("workspace-publish")
  .description("Validate and publish workspace packages.")
  .option("--package <selector>", "Package name or directory")
  .addOption(new Option("-r, --registry <registry>", "Registry").choices(["github","npm","all","both"]).default("npm"))
  .option("-t, --tag <tag>", "npm distribution tag")
  .addOption(new Option("-a, --access <access>", "Package access").choices(["public","restricted"]).default("public"))
  .option("-d, --dry-run", "Validate without publishing")
  .option("-l, --list", "Show plan")
  .option("-j, --json", "Output JSON")
  .option("--artifact-directory <directory>", "Tarball output directory")
  .option("--artifact-file <file>", "Use existing tarball")
  .option("-w, --with-dependencies", "Include workspace dependencies")
  .option("--no-verify-git-tag", "Skip tag verification")
  .option("--no-interactive", "Never prompt")
  .action(async (options) => {
    const canPrompt=options.interactive && !options.json && !process.env.CI &&
      Boolean(process.stdin.isTTY && process.stderr.isTTY);
    let selector=options.package as string|undefined;
    if(!selector && canPrompt) selector=await selectOne(packageChoices(),"Package to publish");
    if(!selector && !options.dryRun && !options.list) throw new Error("Missing --package <selector>.");
    if(canPrompt && !options.dryRun && !options.list && !(await confirm(`Publish ${selector} to ${options.registry}?`,false))) return;
    publishWorkspacePackage(selector,options);
  });

await program.parseAsync();
