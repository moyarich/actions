import { appendFileSync } from "node:fs";
import process from "node:process";
import { discoverPackages } from "./core";

const enabled = (name: string) => process.env[name] === "true";

export function runAction() {
  const packages = discoverPackages({
    packagesDirectory: process.env.PACKAGES_DIRECTORY || "packages",
    useWorkspaces: enabled("USE_WORKSPACES"),
    includeRootPackage: enabled("INCLUDE_ROOT_PACKAGE"),
    includePrivate: enabled("INCLUDE_PRIVATE"),
    requirePublishConfig: enabled("REQUIRE_PUBLISH_CONFIG"),
    requireTestScript: enabled("REQUIRE_TEST_SCRIPT"),
    requireBuildScript: enabled("REQUIRE_BUILD_SCRIPT"),
  });

  const packagesJson = JSON.stringify(packages);
  const matrixJson = JSON.stringify({ include: packages });
  const count = packages.length;
  const output = [
    `packages=${packagesJson}`,
    `matrix=${matrixJson}`,
    `count=${count}`,
    `has-packages=${count > 0}`,
    "",
  ].join("\n");

  if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
  appendFileSync(process.env.GITHUB_OUTPUT, output);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        "# Package discovery",
        "",
        `Found **${count}** package(s).`,
        "",
        "~~~json",
        JSON.stringify(packages, null, 2),
        "~~~",
        "",
      ].join("\n"),
    );
  }
}
