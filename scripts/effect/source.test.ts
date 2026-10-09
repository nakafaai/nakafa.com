import { NodeServices } from "@effect/platform-node";
import { assert, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, FileSystem, type Path, Schema } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import { makeEffectSourceProgram } from "#scripts/effect/source";
import {
  abbreviatedUpstreamCommit,
  commitFiles,
  type Fixture,
  IDENTITY,
  INSTALLED,
  installNextRelease,
  makeRepositories,
  OUTSIDE_REPOSITORY,
  packageManifest,
  runGit,
  SourceIdentityJson,
  STAGED_TREE,
  sourceIdentity,
  stagedSourceTree,
  UncheckedSourceIdentityJson,
  unwritableFiles,
  writeFiles,
} from "#scripts/effect/test.fixture";

describe("Effect source identity", () => {
  it.effect(
    "updates linearly and remains valid after its subtree history is squashed",
    () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const fixture = yield* makeRepositories();
        const { config, consumer } = fixture;
        const dependencyHead = yield* installNextRelease(fixture);

        yield* makeEffectSourceProgram("update", config);

        const updatedHead = yield* runGit(consumer, ["rev-parse", "HEAD"]);
        const identity = yield* fileSystem.readFileString(
          fixture.identityManifest
        );
        expect(
          yield* runGit(consumer, ["show", "-s", "--format=%P", updatedHead])
        ).toBe(dependencyHead);
        expect(
          yield* runGit(consumer, ["rev-parse", "HEAD:repos/effect"])
        ).toBe(fixture.newTree);
        expect(
          yield* runGit(consumer, ["show", "-s", "--format=%B", updatedHead])
        ).toContain(`git-subtree-split: ${fixture.newCommit}`);
        // Excess keys fail the decode, so toEqual also proves the exact key set.
        expect(
          yield* Schema.decodeEffect(SourceIdentityJson)(identity, {
            onExcessProperty: "error",
          })
        ).toEqual({
          commit: fixture.newCommit,
          tag: "effect@2.0.0",
          tree: fixture.newTree,
        });
        expect(yield* runGit(consumer, ["status", "--porcelain"])).toBe("");

        const finalTree = yield* runGit(consumer, ["rev-parse", "HEAD^{tree}"]);
        const squashedHead = yield* runGit(consumer, [
          "commit-tree",
          finalTree,
          "-m",
          "squashed migration",
        ]);
        const branchRef = yield* runGit(consumer, [
          "symbolic-ref",
          "--quiet",
          "HEAD",
        ]);
        yield* runGit(consumer, [
          "update-ref",
          branchRef,
          squashedHead,
          updatedHead,
        ]);

        expect(
          yield* runGit(consumer, [
            "log",
            "--format=%H",
            "--fixed-strings",
            "--grep=git-subtree-dir:",
          ])
        ).toBe("");
        yield* makeEffectSourceProgram("check", config);
      }).pipe(Effect.provide(NodeServices.layer)),
    30_000
  );

  it.effect("checks the repository's own vendored source by default", () =>
    makeEffectSourceProgram("check").pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("leaves a current source unchanged", () =>
    Effect.gen(function* () {
      const { config, consumer } = yield* makeRepositories();
      const head = yield* runGit(consumer, ["rev-parse", "HEAD"]);
      yield* makeEffectSourceProgram("update", config);
      assert.strictEqual(yield* runGit(consumer, ["rev-parse", "HEAD"]), head);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect.each([
    {
      action: "check",
      change: (fixture: Fixture) =>
        writeFiles(fixture.consumer, { "repos/effect/README.md": "edited\n" }),
      error: "EffectSourceMismatch",
      message: () =>
        "repos/effect or scripts/effect/source.json has local changes.",
      name: "local vendored edits",
    },
    {
      action: "check",
      change: (fixture: Fixture) =>
        commitFiles(fixture.consumer, {
          [IDENTITY]: sourceIdentity(
            fixture.oldCommit,
            "effect@1.0.0",
            fixture.newTree
          ),
        }),
      error: "EffectSourceMismatch",
      message: (fixture: Fixture) =>
        `repos/effect differs from tree ${fixture.newTree}.`,
      name: "a recorded tree drift",
    },
    {
      action: "check",
      change: (fixture: Fixture) =>
        commitFiles(fixture.consumer, {
          [IDENTITY]: sourceIdentity(
            fixture.oldCommit,
            "effect@0.9.0",
            fixture.oldTree
          ),
        }),
      error: "EffectSourceMismatch",
      message: () =>
        "scripts/effect/source.json records effect@0.9.0, but vendored source is effect@1.0.0.",
      name: "a recorded tag drift",
    },
    {
      action: "check",
      change: installNextRelease,
      error: "EffectSourceMismatch",
      message: () =>
        "Installed Effect is 2.0.0, but repos/effect is 1.0.0. Commit dependency changes, then run pnpm effect:source:update.",
      name: "an installed release ahead of the vendored source",
    },
    {
      action: "check",
      change: (fixture) => writeFiles(fixture.consumer, { [INSTALLED]: "{" }),
      error: "EffectSourceFileError",
      message: (fixture: Fixture) =>
        `${fixture.installedManifest} does not contain valid JSON.`,
      name: "an installed manifest without JSON",
    },
    {
      action: "check",
      change: (fixture: Fixture) =>
        writeFiles(fixture.consumer, {
          [INSTALLED]: packageManifest("latest"),
        }),
      error: "EffectSourceFileError",
      message: (fixture: Fixture) =>
        `${fixture.installedManifest} does not contain a valid Effect version.`,
      name: "an installed manifest without a version",
    },
    {
      action: "check",
      change: (fixture: Fixture) =>
        commitFiles(fixture.consumer, {
          [IDENTITY]: `${Schema.encodeSync(UncheckedSourceIdentityJson)({
            commit: "HEAD",
            tag: "effect@1.0.0",
            tree: "HEAD",
          })}\n`,
        }),
      error: "EffectSourceFileError",
      message: (fixture: Fixture) =>
        `${fixture.identityManifest} does not contain a valid Effect source identity.`,
      name: "an identity without immutable Git objects",
    },
    {
      action: "update",
      change: (fixture: Fixture) =>
        writeFiles(fixture.consumer, { "notes.txt": "unrelated\n" }),
      error: "EffectSourceMismatch",
      message: () =>
        "Effect source updates require a clean worktree. Commit dependency changes first.",
      name: "an update from a dirty worktree",
    },
    ...Arr.map([undefined, "sync"], (action) => ({
      action,
      change: () => Effect.void,
      error: "EffectSourceUsageError",
      message: () => "Usage: node scripts/effect/source.ts <check|update>",
      name: `the ${String(action)} action`,
    })),
  ])("rejects $name", ({ action, change, error, message }) =>
    Effect.gen(function* () {
      const fixture = yield* makeRepositories();
      yield* change(fixture);
      const failure = yield* makeEffectSourceProgram(
        action,
        fixture.config
      ).pipe(Effect.flip);
      assert.deepStrictEqual(
        [failure._tag, failure.message],
        [error, message(fixture)]
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("reports missing metadata and Git failures", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const fixture = yield* makeRepositories();
      const missingRoot = `${fixture.root}/missing`;
      const plainRoot = `${fixture.root}/plain`;
      yield* fileSystem.makeDirectory(plainRoot);
      yield* fileSystem.remove(fixture.installedManifest);
      const missing = yield* makeEffectSourceProgram(
        "check",
        fixture.config
      ).pipe(Effect.flip);
      yield* runGit(fixture.consumer, [
        "checkout",
        "--quiet",
        "--detach",
        "HEAD",
      ]);
      const [unavailable, outsideRepository, detached] = [
        yield* makeEffectSourceProgram("check", {
          ...fixture.config,
          repositoryRoot: missingRoot,
        }).pipe(Effect.flip),
        yield* makeEffectSourceProgram("check", {
          ...fixture.config,
          repositoryRoot: plainRoot,
        }).pipe(Effect.flip),
        yield* makeEffectSourceProgram("update", fixture.config).pipe(
          Effect.flip
        ),
      ];

      assert.strictEqual(missing._tag, "EffectSourceFileError");
      assert.include(missing.message, fixture.installedManifest);
      assert.strictEqual(unavailable._tag, "EffectSourceGitError");
      assert.include(unavailable.message, missingRoot);
      assert.strictEqual(outsideRepository._tag, "EffectSourceGitError");
      assert.match(outsideRepository.message, OUTSIDE_REPOSITORY);
      assert.deepStrictEqual(
        [detached._tag, detached.message],
        ["EffectSourceGitError", "git symbolic-ref --quiet HEAD: Git failed."]
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect.each<{
    readonly error: string;
    readonly message: (fixture: Fixture) => string;
    readonly name: string;
    readonly update: (
      fixture: Fixture
    ) => Effect.Effect<
      unknown,
      { readonly _tag: string; readonly message: string },
      | ChildProcessSpawner.ChildProcessSpawner
      | FileSystem.FileSystem
      | Path.Path
    >;
  }>([
    {
      error: "EffectSourceFileError",
      message: (fixture: Fixture) =>
        `PermissionDenied: FileSystem.writeFileString (${fixture.identityManifest})`,
      name: "the identity cannot be written",
      update: (fixture: Fixture) =>
        makeEffectSourceProgram("update", fixture.config).pipe(
          Effect.provide(unwritableFiles)
        ),
    },
    {
      error: "EffectSourceMismatch",
      message: (fixture: Fixture) =>
        `Staged repos/effect is ${STAGED_TREE}, expected ${fixture.newTree}.`,
      name: "the staged tree differs from upstream",
      update: (fixture: Fixture) =>
        makeEffectSourceProgram("update", fixture.config).pipe(
          Effect.provide(stagedSourceTree(STAGED_TREE))
        ),
    },
    {
      error: "EffectSourceFileError",
      message: (fixture: Fixture) =>
        `${fixture.identityManifest} cannot be written as an Effect source identity.`,
      name: "the upstream commit is not a full object id",
      update: (fixture: Fixture) =>
        makeEffectSourceProgram("update", fixture.config).pipe(
          Effect.provide(abbreviatedUpstreamCommit(fixture.newCommit))
        ),
    },
  ])("keeps the branch when $name", ({ error, message, update }) =>
    Effect.gen(function* () {
      const fixture = yield* makeRepositories();
      const head = yield* installNextRelease(fixture);
      const result = yield* Effect.result(update(fixture));
      assert(result._tag === "Failure");
      assert.deepStrictEqual(
        [result.failure._tag, result.failure.message],
        [error, message(fixture)]
      );
      assert.strictEqual(
        yield* runGit(fixture.consumer, ["rev-parse", "HEAD"]),
        head
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
