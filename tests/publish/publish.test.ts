import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

const { execFileSync } = vi.hoisted(() => ({
  execFileSync: vi.fn(),
}));

vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:child_process")>()),
  execFileSync,
}));

import {
  packageGitTagState,
  packageRegistryState,
  parsePackResult,
  registryNpmEnvironment,
  registryPublishArgs,
  serializePublishPlan,
  suggestedDistributionTag,
} from "../../src/publish/publish.ts";

beforeEach(() => {
  vi.clearAllMocks();
});

test("suggestedDistributionTag recommends latest without selecting it", () => {
  assert.equal(suggestedDistributionTag("1.2.3"), "latest");
});

test("suggestedDistributionTag uses the prerelease identifier", () => {
  assert.equal(suggestedDistributionTag("1.2.3-beta.4"), "beta");
});

test("serializePublishPlan returns stable machine-readable package metadata", () => {
  const plan = [
    {
      pkg: {
        directory: "packages/workspace-tools",
        manifest: {
          name: "@moyarich/workspace-tools",
          version: "0.1.2",
        },
      },
      registries: {
        github: "missing",
      },
    },
  ];

  assert.deepEqual(
    serializePublishPlan(plan, {
      registry: "github",
      tag: "latest",
      access: "public",
    }),
    {
      registry: "github",
      tag: "latest",
      suggestedTag: "latest",
      access: "public",
      packages: [
        {
          name: "@moyarich/workspace-tools",
          version: "0.1.2",
          directory: "packages/workspace-tools",
          releaseIdentity: {
            packageName: "@moyarich/workspace-tools",
            packageDirectory: "packages/workspace-tools",
            version: "0.1.2",
            tagName: "packages/workspace-tools@0.1.2",
            tagPrefix: "packages/workspace-tools@",
            releaseName: "@moyarich/workspace-tools v0.1.2",
          },
          suggestedTag: "latest",
          registries: {
            github: "missing",
          },
          publishable: true,
        },
      ],
    },
  );
});

test("serializePublishPlan marks fully published packages as not publishable", () => {
  const [pkg] = serializePublishPlan(
    [
      {
        pkg: {
          directory: "packages/workspace-tools",
          manifest: {
            name: "@moyarich/workspace-tools",
            version: "0.1.2",
          },
        },
        registries: {
          github: "published",
          npm: "published",
        },
      },
    ],
    {
      registry: "all",
      tag: "latest",
      access: "public",
    },
  ).packages;

  assert.equal(pkg.publishable, false);
});

test("serializePublishPlan preserves mixed registry readiness for dry-run reporting", () => {
  const result = serializePublishPlan(
    [
      {
        pkg: {
          directory: "packages/demo-tools",
          manifest: { name: "@moyarich/demo-tools", version: "0.1.0" },
        },
        registries: { github: "missing", npm: "published" },
      },
    ],
    { registry: "all", tag: "latest", access: "public" },
  );

  assert.equal(result.packages[0].publishable, true);
  assert.deepEqual(result.packages[0].registries, {
    github: "missing",
    npm: "published",
  });
});

test("packageRegistryState isolates npmjs from inherited GitHub Packages scope config", () => {
  const previousNodeToken = process.env.NODE_AUTH_TOKEN;
  const previousNpmToken = process.env._NPM_TOKEN;

  process.env.NODE_AUTH_TOKEN = "github-token";
  delete process.env._NPM_TOKEN;
  execFileSync.mockImplementation(() => {
    const error = new Error("npm view failed") as Error & {
      stderr?: string;
    };
    error.stderr = "npm error code E404\n404 Not Found";
    throw error;
  });

  try {
    assert.equal(
      packageRegistryState(
        {
          directory: ".",
          file: "/repo/package.json",
          manifest: {
            name: "@moyarich/workspace-tools",
            version: "0.1.1",
          },
        },
        "npm",
      ),
      "missing",
    );

    const [, args, options] = execFileSync.mock.calls[0];
    assert.deepEqual(args, [
      "view",
      "@moyarich/workspace-tools@0.1.1",
      "version",
      "--registry",
      "https://registry.npmjs.org",
      "--json",
    ]);
    assert.equal(options.env.NODE_AUTH_TOKEN, undefined);
    assert.match(
      options.env.npm_config_userconfig,
      /workspace-publish-registry-/,
    );
  } finally {
    if (previousNodeToken === undefined) {
      delete process.env.NODE_AUTH_TOKEN;
    } else {
      process.env.NODE_AUTH_TOKEN = previousNodeToken;
    }

    if (previousNpmToken === undefined) {
      delete process.env._NPM_TOKEN;
    } else {
      process.env._NPM_TOKEN = previousNpmToken;
    }
  }
});

test("packageRegistryState uses the GitHub token only for GitHub Packages", () => {
  const previousGithubToken = process.env._GITHUB_TOKEN;
  process.env._GITHUB_TOKEN = "github-token";
  execFileSync.mockReturnValueOnce(Buffer.from('"0.1.1"'));

  try {
    assert.equal(
      packageRegistryState(
        {
          directory: ".",
          file: "/repo/package.json",
          manifest: {
            name: "@moyarich/workspace-tools",
            version: "0.1.1",
          },
        },
        "github",
      ),
      "published",
    );

    const [, , options] = execFileSync.mock.calls[0];
    assert.equal(options.env.NODE_AUTH_TOKEN, "github-token");
    assert.match(
      options.env.npm_config_userconfig,
      /workspace-publish-registry-/,
    );
  } finally {
    if (previousGithubToken === undefined) {
      delete process.env._GITHUB_TOKEN;
    } else {
      process.env._GITHUB_TOKEN = previousGithubToken;
    }
  }
});

test("packageGitTagState reports a missing package-scoped tag without invoking real Git", () => {
  execFileSync.mockImplementation(() => {
    throw new Error("unknown revision");
  });

  const state = packageGitTagState("/repo", {
    directory: "packages/workspace-tools",
    manifest: {
      name: "@moyarich/workspace-tools",
      version: "999.999.999",
    },
  });

  assert.deepEqual(state, {
    name: "packages/workspace-tools@999.999.999",
    exists: false,
    atHead: false,
    commit: null,
  });
  assert.equal(execFileSync.mock.calls.length, 1);
  assert.deepEqual(execFileSync.mock.calls[0].slice(0, 2), [
    "git",
    ["rev-list", "-n", "1", "packages/workspace-tools@999.999.999"],
  ]);
});

test("packageGitTagState compares an existing tag with HEAD using mocked Git", () => {
  execFileSync.mockReturnValueOnce("abc123\n").mockReturnValueOnce("abc123\n");

  const state = packageGitTagState("/repo", {
    directory: "packages/workspace-tools",
    manifest: {
      name: "@moyarich/workspace-tools",
      version: "1.2.3",
    },
  });

  assert.deepEqual(state, {
    name: "packages/workspace-tools@1.2.3",
    exists: true,
    atHead: true,
    commit: "abc123",
  });
  assert.equal(execFileSync.mock.calls.length, 2);
});

test("parsePackResult validates and exposes the packed artifact metadata", () => {
  const artifact = parsePackResult(
    JSON.stringify([
      {
        id: "@moyarich/workspace-tools@0.1.2",
        name: "@moyarich/workspace-tools",
        version: "0.1.2",
        size: 1234,
        integrity: "sha512-example",
        shasum: "abc123",
        filename: "moyarich-workspace-tools-0.1.2.tgz",
      },
    ]),
    {
      directory: "packages/workspace-tools",
      manifest: {
        name: "@moyarich/workspace-tools",
        version: "0.1.2",
      },
    },
    "/tmp/artifacts",
  );

  assert.deepEqual(artifact, {
    path: "/tmp/artifacts/moyarich-workspace-tools-0.1.2.tgz",
    filename: "moyarich-workspace-tools-0.1.2.tgz",
    name: "@moyarich/workspace-tools",
    version: "0.1.2",
    size: 1234,
    integrity: "sha512-example",
    shasum: "abc123",
  });
});

test("parsePackResult rejects a tarball for a different package version", () => {
  assert.throws(
    () =>
      parsePackResult(
        JSON.stringify([
          {
            name: "@moyarich/workspace-tools",
            version: "9.9.9",
            filename: "moyarich-workspace-tools-9.9.9.tgz",
          },
        ]),
        {
          directory: "packages/workspace-tools",
          manifest: {
            name: "@moyarich/workspace-tools",
            version: "0.1.2",
          },
        },
        "/tmp/artifacts",
      ),
    /Packed artifact identity mismatch/,
  );
});

test("registryPublishArgs promotes the same tarball to GitHub Packages", () => {
  assert.deepEqual(
    registryPublishArgs(
      "github",
      "/tmp/artifacts/workspace-tools-0.1.2.tgz",
      "latest",
      "public",
    ),
    [
      "publish",
      "/tmp/artifacts/workspace-tools-0.1.2.tgz",
      "--access",
      "public",
      "--tag",
      "latest",
      "--registry",
      "https://npm.pkg.github.com",
    ],
  );
});

test("registryPublishArgs promotes the same tarball through npm staged publishing", () => {
  assert.deepEqual(
    registryPublishArgs(
      "npm",
      "/tmp/artifacts/workspace-tools-0.1.2.tgz",
      "next",
      "public",
    ),
    [
      "stage",
      "publish",
      "/tmp/artifacts/workspace-tools-0.1.2.tgz",
      "--access",
      "public",
      "--tag",
      "next",
      "--registry",
      "https://registry.npmjs.org",
    ],
  );
});

test("registry npm environment overrides inherited setup-node userconfig", () => {
  const previousUpperUserconfig = process.env.NPM_CONFIG_USERCONFIG;
  const previousLowerUserconfig = process.env.npm_config_userconfig;
  const previousNodeToken = process.env.NODE_AUTH_TOKEN;

  process.env.NPM_CONFIG_USERCONFIG = "/tmp/setup-node-npmrc";
  process.env.npm_config_userconfig = "/tmp/setup-node-lower-npmrc";
  process.env.NODE_AUTH_TOKEN = "inherited-token";

  try {
    const env = registryNpmEnvironment(
      {
        url: "https://registry.npmjs.org",
        host: "registry.npmjs.org",
        token: "npm-token",
      },
      "/tmp/workspace-publish/npmrc",
    );

    assert.equal(env.NPM_CONFIG_USERCONFIG, "/tmp/workspace-publish/npmrc");
    assert.equal(env.npm_config_userconfig, "/tmp/workspace-publish/npmrc");
    assert.equal(env.NODE_AUTH_TOKEN, "npm-token");
  } finally {
    if (previousUpperUserconfig === undefined)
      delete process.env.NPM_CONFIG_USERCONFIG;
    else process.env.NPM_CONFIG_USERCONFIG = previousUpperUserconfig;

    if (previousLowerUserconfig === undefined)
      delete process.env.npm_config_userconfig;
    else process.env.npm_config_userconfig = previousLowerUserconfig;

    if (previousNodeToken === undefined) delete process.env.NODE_AUTH_TOKEN;
    else process.env.NODE_AUTH_TOKEN = previousNodeToken;
  }
});

test("parsePackResult requires dist output when the package publishes dist", () => {
  assert.throws(
    () =>
      parsePackResult(
        JSON.stringify([
          {
            name: "@moyarich/workspace-tools",
            version: "0.1.2",
            filename: "moyarich-workspace-tools-0.1.2.tgz",
            files: [{ path: "package.json" }, { path: "README.md" }],
          },
        ]),
        {
          directory: "packages/workspace-tools",
          manifest: {
            name: "@moyarich/workspace-tools",
            version: "0.1.2",
            files: ["dist", "README.md"],
          },
        },
        "/tmp/artifacts",
      ),
    /does not contain dist output/,
  );
});

test("parsePackResult accepts packed dist output", () => {
  const artifact = parsePackResult(
    JSON.stringify([
      {
        name: "@moyarich/workspace-tools",
        version: "0.1.2",
        filename: "moyarich-workspace-tools-0.1.2.tgz",
        files: [
          { path: "dist/bin/workspace-publish.mjs" },
          { path: "package.json" },
        ],
      },
    ]),
    {
      directory: "packages/workspace-tools",
      manifest: {
        name: "@moyarich/workspace-tools",
        version: "0.1.2",
        files: ["dist"],
      },
    },
    "/tmp/artifacts",
  );

  assert.equal(
    artifact.path,
    "/tmp/artifacts/moyarich-workspace-tools-0.1.2.tgz",
  );
});
