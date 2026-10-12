import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { encodeJsonText } from "@repo/utilities/json";
import {
  Array as Arr,
  Data,
  Effect,
  FileSystem,
  Path,
  Record as Rec,
} from "effect";
import {
  decideBuild,
  describeWorkspace,
  type Host,
  readWorkspaceRoots,
  runIgnoreStep,
  settleIgnoreStep,
} from "#scripts/vercel/ignore";

/** A commit that a shallow clone does not hold. */
class MissingCommit extends Data.TaggedError("MissingCommit") {}

/** A machine that the step cannot read. */
class UnreadableMachine extends Data.TaggedError("UnreadableMachine") {}

/** The shape of the monorepo, reduced to the packages that the cases need. */
const manifests = {
  "apps/api": {
    dependencies: { "@repo/backend": "workspace:*" },
    name: "api",
  },
  "apps/cas": {
    devDependencies: { "@vercel/config": "catalog:" },
    name: "cas",
  },
  "apps/www": {
    dependencies: {
      "@repo/backend": "workspace:*",
      "@repo/design-system": "workspace:*",
      react: "19.3.0",
    },
    devDependencies: { "@repo/typescript-config": "workspace:*" },
    name: "www",
  },
  "packages/backend": {
    dependencies: { "@repo/utilities": "workspace:*" },
    name: "@repo/backend",
  },
  "packages/design-system": {
    dependencies: { "@repo/utilities": "workspace:*" },
    name: "@repo/design-system",
  },
  "packages/email": { name: "@repo/email" },
  "packages/typescript-config": { name: "@repo/typescript-config" },
  "packages/utilities": { name: "@repo/utilities" },
};

const workspaces = Arr.map(Rec.toEntries(manifests), ([dir, manifest]) =>
  describeWorkspace(dir, manifest)
);

describe("describeWorkspace", () => {
  it("lists every kind of dependency by name", () => {
    expect(
      describeWorkspace("packages/x", {
        dependencies: { a: "1" },
        devDependencies: { b: "workspace:*" },
        name: "x",
        optionalDependencies: { c: "1" },
        peerDependencies: { d: "1" },
      })
    ).toEqual({
      dependencies: ["a", "b", "c", "d"],
      dir: "packages/x",
      name: "x",
    });
  });

  it("falls back to the directory when the manifest has no name", () => {
    expect(describeWorkspace("packages/x", {})).toEqual({
      dependencies: [],
      dir: "packages/x",
      name: "packages/x",
    });
  });
});

describe("readWorkspaceRoots", () => {
  it("reads the dir/* patterns of the packages list and stops at the next key", () => {
    expect(
      readWorkspaceRoots(
        "packages:\n  - apps/*\n  - packages/*\n\nengineStrict: true\n"
      )
    ).toEqual(["apps", "packages"]);
  });

  it("refuses a pattern it does not understand, so the step builds", () => {
    expect(() => readWorkspaceRoots("packages:\n  - apps/**\n")).toThrow(
      "The workspace pattern apps/** is not dir/*."
    );
  });

  it("refuses a file without a packages list", () => {
    expect(() => readWorkspaceRoots("engineStrict: true\n")).toThrow(
      "pnpm-workspace.yaml lists no packages."
    );
  });
});

describe("decideBuild", () => {
  it.each([
    ["www", "packages/backend/confect/nina/turns.impl.ts", true],
    ["www", "packages/utilities/uuid.ts", true],
    ["www", "packages/typescript-config/base.json", true],
    ["www", "apps/www/lib/auth/proxy.ts", true],
    ["www", "pnpm-lock.yaml", true],
    ["www", "turbo.json", true],
    ["www", "package.json", true],
    ["www", "pnpm-workspace.yaml", true],
    ["www", "docs/adr/0007-delivery.md", false],
    ["www", ".github/workflows/ci.yml", false],
    ["www", "scripts/check/deploy.ts", false],
    ["www", ".changeset/quiet-ants-run.md", false],
    ["www", "AGENTS.md", false],
    ["www", "apps/api/vercel.ts", false],
    ["www", "apps/cas/api/index.py", false],
    ["www", "packages/email/render.ts", false],
    ["www", "packages/backend/README.md", false],
    ["www", "apps/www/lib/auth/proxy.test.ts", false],
    ["www", "packages/backend/confect/nina/turns.impl.test.ts", false],
    ["www", "apps/www/public/skill.md", true],
    ["www", "apps/www/public/guide/intro.test.js", true],
    ["www", "packages/design-system/public/readme.md", true],
    ["api", "packages/utilities/uuid.ts", true],
    ["api", "apps/api/vercel.ts", true],
    ["api", "apps/www/app/page.tsx", false],
    ["api", "packages/design-system/button.tsx", false],
    ["cas", "apps/cas/api/index.py", true],
    ["cas", "turbo.json", true],
    ["cas", "packages/backend/confect/nina/turns.impl.ts", false],
    ["cas", "apps/www/app/page.tsx", false],
  ] as const)("%s builds after %s changed: %s", (project, file, build) => {
    expect(
      decideBuild({ changedFiles: [file], project, workspaces }).build
    ).toBe(build);
  });

  it("names the project itself when its own workspace changed", () => {
    expect(
      decideBuild({
        changedFiles: ["apps/www/lib/auth/proxy.ts"],
        project: "www",
        workspaces,
      }).reason
    ).toBe("apps/www/lib/auth/proxy.ts is an input of www.");
  });

  it("builds when one of several changed files is an input", () => {
    const decision = decideBuild({
      changedFiles: ["docs/adr/0007-delivery.md", "packages/utilities/uuid.ts"],
      project: "www",
      workspaces,
    });

    expect(decision).toEqual({
      build: true,
      reason:
        "packages/utilities/uuid.ts is an input of www through @repo/utilities.",
    });
  });

  it("skips when only documentation, tests, scripts and other apps changed", () => {
    const decision = decideBuild({
      changedFiles: [
        "docs/adr/0007-delivery.md",
        "packages/backend/README.md",
        "apps/www/lib/auth/proxy.test.ts",
        "scripts/vercel/ignore.mjs",
        "apps/cas/api/index.py",
      ],
      project: "www",
      workspaces,
    });

    expect(decision).toEqual({
      build: false,
      reason: "Nothing that www is built from changed, so it is skipped.",
    });
  });

  it("builds when no changed file is listed, as a redeploy of one commit does", () => {
    expect(
      decideBuild({ changedFiles: [], project: "www", workspaces }).build
    ).toBe(true);
  });

  it("builds for a project that is not a workspace", () => {
    expect(
      decideBuild({
        changedFiles: ["docs/a.md"],
        project: "unknown",
        workspaces,
      })
    ).toEqual({
      build: true,
      reason: "unknown is not a workspace, so it builds.",
    });
  });

  it("builds for a lockfile change and says it is an input of every project", () => {
    expect(
      decideBuild({
        changedFiles: ["pnpm-lock.yaml"],
        project: "cas",
        workspaces,
      }).reason
    ).toBe("pnpm-lock.yaml is an input of every project.");
  });
});

/** Stands in for the repository: files by path, directory listings, and what git answers. */
function makeHost({
  changed,
  hasPrevious = true,
  hasWorkspaceList = true,
  strays = [],
}: {
  readonly changed: readonly string[];
  readonly hasPrevious?: boolean;
  readonly hasWorkspaceList?: boolean;
  readonly strays?: readonly string[];
}) {
  const files: Record<string, string> = {
    ...(hasWorkspaceList
      ? { "pnpm-workspace.yaml": "packages:\n  - apps/*\n  - packages/*\n" }
      : {}),
    ...Rec.fromEntries(
      Arr.map(Rec.toEntries(manifests), ([dir, manifest]): [string, string] => [
        `${dir}/package.json`,
        encodeJsonText(manifest),
      ])
    ),
  };
  const git = vi.fn<Host["git"]>((args) => {
    if (args[0] === "cat-file" && !hasPrevious) {
      throw new MissingCommit();
    }
    return args[0] === "diff" ? Arr.join(changed, "\0") : "";
  });
  const host: Host = {
    git,
    list: (dir) =>
      Arr.appendAll(
        Arr.map(
          Arr.filter(Rec.keys(manifests), (path) => path.startsWith(`${dir}/`)),
          (path) => path.slice(dir.length + 1)
        ),
        dir === "apps" ? strays : []
      ),
    read: (file) => files[file],
  };
  return { git, host };
}

describe("runIgnoreStep", () => {
  const argv = ["node", "ignore.mjs", "www"];

  it("skips a build that a documentation change cannot affect", () => {
    const { git, host } = makeHost({ changed: ["docs/adr/0007-delivery.md"] });

    const decision = runIgnoreStep({
      argv,
      env: { VERCEL_GIT_PREVIOUS_SHA: "abc123" },
      host,
    });

    expect(decision.build).toBe(false);
    expect(git).toHaveBeenCalledWith([
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      "abc123",
      "HEAD",
    ]);
  });

  it("names the baseline it compared with, so the build log shows it", () => {
    const skipped = makeHost({ changed: ["docs/adr/0007-delivery.md"] });
    const built = makeHost({ changed: ["apps/www/app/page.tsx"] });
    const env = { VERCEL_GIT_PREVIOUS_SHA: "abc123" };

    expect(runIgnoreStep({ argv, env, host: skipped.host })).toEqual({
      build: false,
      reason:
        "Nothing that www is built from changed, so it is skipped. Compared with abc123.",
    });
    expect(runIgnoreStep({ argv, env, host: built.host })).toEqual({
      build: true,
      reason: "apps/www/app/page.tsx is an input of www. Compared with abc123.",
    });
  });

  it("builds www after a backend change, which its build deploys to Convex", () => {
    const { host } = makeHost({
      changed: ["packages/backend/confect/nina/turns.impl.ts"],
    });

    expect(
      runIgnoreStep({ argv, env: { VERCEL_GIT_PREVIOUS_SHA: "abc123" }, host })
        .build
    ).toBe(true);
  });

  it("diffs against the commit that Vercel builds", () => {
    const { git, host } = makeHost({ changed: ["apps/www/app/page.tsx"] });

    runIgnoreStep({
      argv,
      env: {
        VERCEL_GIT_COMMIT_SHA: "def456",
        VERCEL_GIT_PREVIOUS_SHA: "abc123",
      },
      host,
    });

    expect(git).toHaveBeenCalledWith([
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      "abc123",
      "def456",
    ]);
  });

  it("builds when the last successful deployment is missing from the shallow clone", () => {
    const { git, host } = makeHost({ changed: [], hasPrevious: false });

    const decision = runIgnoreStep({
      argv,
      env: { VERCEL_GIT_PREVIOUS_SHA: "abc123" },
      host,
    });

    expect(decision).toEqual({
      build: true,
      reason: "abc123 is not in this shallow clone, so it builds.",
    });
    expect(git).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, ""])(
    "builds when there is no earlier deployment (%j)",
    (previous) => {
      const { host } = makeHost({ changed: ["docs/a.md"] });

      expect(
        runIgnoreStep({
          argv,
          env: { VERCEL_GIT_PREVIOUS_SHA: previous },
          host,
        })
      ).toEqual({
        build: true,
        reason: "There is no earlier deployment, so it builds.",
      });
    }
  );

  it("leaves a folder without a package manifest out of the workspaces", () => {
    const { host } = makeHost({
      changed: ["docs/adr/0007-delivery.md"],
      strays: [".DS_Store"],
    });

    expect(
      runIgnoreStep({ argv, env: { VERCEL_GIT_PREVIOUS_SHA: "abc123" }, host })
        .build
    ).toBe(false);
  });

  it("refuses a repository that lists no workspaces", () => {
    const { host } = makeHost({
      changed: ["docs/adr/0007-delivery.md"],
      hasWorkspaceList: false,
    });

    expect(() =>
      runIgnoreStep({ argv, env: { VERCEL_GIT_PREVIOUS_SHA: "abc123" }, host })
    ).toThrow("pnpm-workspace.yaml lists no packages.");
  });

  it("builds when no project is named", () => {
    const { host } = makeHost({ changed: ["docs/a.md"] });

    expect(
      runIgnoreStep({
        argv: ["node", "ignore.mjs"],
        env: { VERCEL_GIT_PREVIOUS_SHA: "abc123" },
        host,
      }).build
    ).toBe(true);
  });
});

describe("settleIgnoreStep", () => {
  const argv = ["node", "step.mjs", "www"];
  const env = { VERCEL_GIT_PREVIOUS_SHA: "abc123" };

  it("exits 0, which skips the build, only for a decision to skip", () => {
    const { host } = makeHost({ changed: ["docs/adr/0007-delivery.md"] });

    expect(settleIgnoreStep({ argv, env, makeHost: () => host })).toEqual({
      exitCode: 0,
      output:
        "Nothing that www is built from changed, so it is skipped. Compared with abc123.",
    });
  });

  it("exits 1, which builds, for a decision to build", () => {
    const { host } = makeHost({ changed: ["apps/www/app/page.tsx"] });

    expect(settleIgnoreStep({ argv, env, makeHost: () => host })).toEqual({
      exitCode: 1,
      output: "apps/www/app/page.tsx is an input of www. Compared with abc123.",
    });
  });

  it("builds, and says why, when the repository lists no workspaces", () => {
    const { host } = makeHost({
      changed: ["docs/adr/0007-delivery.md"],
      hasWorkspaceList: false,
    });

    const outcome = settleIgnoreStep({ argv, env, makeHost: () => host });

    expect(outcome.exitCode).toBe(1);
    expect(outcome.output).toContain("pnpm-workspace.yaml lists no packages.");
    expect(outcome.output).toContain("so it builds.");
  });

  it("builds, and says why, when the machine cannot be read", () => {
    const outcome = settleIgnoreStep({
      argv,
      env,
      makeHost: () => {
        throw new UnreadableMachine();
      },
    });

    expect(outcome.exitCode).toBe(1);
    expect(outcome.output).toBe(
      "The decision failed (UnreadableMachine), so it builds."
    );
  });
});

/** The specifiers that one module of the step imports. */
const importedBy = Effect.fn("IgnoreTest.importedBy")(function* (name: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* fileSystem.readFileString(
    path.join(import.meta.dirname, name)
  );
  return Arr.map(
    Arr.fromIterable(text.matchAll(/^import\s[^;]*?\sfrom\s+"([^"]+)";/gmu)),
    ([, specifier]) => specifier
  );
});

describe("the modules of the Ignored Build Step", () => {
  it.effect("import nothing that the install has to provide", () =>
    Effect.gen(function* () {
      expect(yield* importedBy("ignore.mjs")).toEqual([]);
      expect(yield* importedBy("host.mjs")).toEqual([
        "node:child_process",
        "node:fs",
        "node:path",
      ]);
      expect(yield* importedBy("step.mjs")).toEqual([
        "./host.mjs",
        "./ignore.mjs",
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
