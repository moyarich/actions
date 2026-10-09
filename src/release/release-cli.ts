import { Option, program } from "commander";
import { releaseWorkspacePackage } from "./release.ts";
import { assertInteractive, confirm, askText } from "../cli/prompts/index.ts";
import { packageChoices, selectOne } from "../cli/prompts/selection.ts";

program
  .name("workspace-release")
  .description("Preview or create a workspace package release.")
  .option("--package <selector>", "Package name or directory, including . for root")
  .addOption(new Option("--mode <mode>", "Version mode").choices(["bump","exact","package-json"]))
  .option("--version <version>", "SemVer version or bump type")
  .option("--resolve-only", "Resolve the version without release side effects")
  .option("-d, --dry-run", "Preview without modifying files")
  .option("-j, --json", "Print JSON")
  .option("--no-interactive", "Never prompt for missing values")
  .action(async (options) => {
    const canPrompt=options.interactive !== false && !options.json && !process.env.CI &&
      Boolean(process.stdin.isTTY && process.stderr.isTTY);
    let selector=options.package as string | undefined;
    let mode=options.mode as string | undefined;
    let version=options.version as string | undefined;
    if (!selector && canPrompt) selector=await selectOne(packageChoices(),"Package");
    if (!selector) throw new Error("Missing --package <selector> (required without an interactive terminal).");
    if (!mode && canPrompt) mode=await selectOne([
      {name:"Patch/minor/major bump",value:"bump"},
      {name:"Exact version",value:"exact"},
      {name:"Version from package.json",value:"package-json"}
    ],"Version mode");
    if (!mode) throw new Error("Missing --mode <bump|exact|package-json>.");
    if (mode !== "package-json" && !version && canPrompt) {
      if(mode === "bump") version=await selectOne(["patch","minor","major","prerelease","prepatch","preminor","premajor"].map(x=>({name:x,value:x})),"Version bump");
      else version=await askText("Exact version");
    }
    if (mode !== "package-json" && !version) throw new Error("Missing --version <version>.");
    if (canPrompt && !options.dryRun && !options.resolveOnly) {
      if (!(await confirm(`Release ${selector} (${mode}${version ? ":" + version : ""})?`,false))) return;
    }
    // Keep the internal release engine unchanged; only the public CLI contract changes.
    releaseWorkspacePackage(selector,{
      ...options,mode,version,fzf:false,
    });
  });

await program.parseAsync();
