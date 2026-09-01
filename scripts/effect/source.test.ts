import { execFileSync } from "node:child_process";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Schema } from "effect";
import {
  type EffectSourceConfig,
  makeEffectSourceProgram,
} from "#scripts/effect/source";

class GitFixtureError extends Schema.TaggedError<GitFixtureError>()(
  "GitFixtureError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

const packageManifest = (version: string) =>
  `${JSON.stringify({ name: "effect", version }, null, 2)}\n`;

const sourceIdentity = (commit: string, tag: string, tree: string) =>
  `${JSON.stringify({ commit, tag, tree }, null, 2)}\n`;

const runGit = Effect.fn("EffectSourceTest.runGit")(
  (cwd: string, args: readonly string[]) =>
    Effect.try({
      catch: (cause) =>
        new GitFixtureError({
          cause,
          message: `git ${args.join(" ")} failed`,
        }),
      try: () =>
        execFileSync("git", [...args], { cwd, encoding: "utf8" }).trim(),
    })
);

const commitAll = Effect.fn("EffectSourceTest.commitAll")(function* (
  repository: string,
  message: string
) {
  yield* runGit(repository, ["add", "--all"]);
  yield* runGit(repository, ["commit", "-m", message]);
  return yield* runGit(repository, ["rev-parse", "HEAD"]);
});

describe("Effect source identity", () => {
  it.effect(
    "updates linearly and remains valid after its subtree history is squashed",
    () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const root = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "effect-source-test-",
        });
        const upstream = `${root}/upstream`;
        const consumer = `${root}/consumer`;
        const upstreamManifest = `${upstream}/packages/effect/package.json`;
        const consumerManifest = `${consumer}/node_modules/effect/package.json`;
        const vendoredRoot = `${consumer}/repos/effect`;
        const vendoredManifest = `${vendoredRoot}/packages/effect/package.json`;
        const identityManifest = `${consumer}/scripts/effect/source.json`;

        yield* fileSystem.makeDirectory(`${upstream}/packages/effect`, {
          recursive: true,
        });
        yield* runGit(upstream, ["init", "--initial-branch=main"]);
        yield* runGit(upstream, ["config", "user.name", "Effect Fixture"]);
        yield* runGit(upstream, [
          "config",
          "user.email",
          "effect-fixture@example.com",
        ]);
        yield* fileSystem.writeFileString(
          upstreamManifest,
          packageManifest("1.0.0")
        );
        yield* fileSystem.writeFileString(`${upstream}/README.md`, "one\n");
        yield* fileSystem.writeFileString(
          `${upstream}/obsolete.txt`,
          "remove me\n"
        );
        const oldCommit = yield* commitAll(upstream, "release 1.0.0");
        yield* runGit(upstream, ["tag", "effect@1.0.0"]);
        const oldTree = yield* runGit(upstream, [
          "rev-parse",
          `${oldCommit}^{tree}`,
        ]);

        yield* fileSystem.writeFileString(
          upstreamManifest,
          packageManifest("2.0.0")
        );
        yield* fileSystem.writeFileString(`${upstream}/README.md`, "two\n");
        yield* fileSystem.remove(`${upstream}/obsolete.txt`);
        yield* fileSystem.writeFileString(`${upstream}/current.txt`, "keep\n");
        const newCommit = yield* commitAll(upstream, "release 2.0.0");
        yield* runGit(upstream, ["tag", "effect@2.0.0"]);
        const newTree = yield* runGit(upstream, [
          "rev-parse",
          `${newCommit}^{tree}`,
        ]);

        yield* fileSystem.makeDirectory(`${consumer}/node_modules/effect`, {
          recursive: true,
        });
        yield* fileSystem.makeDirectory(`${vendoredRoot}/packages/effect`, {
          recursive: true,
        });
        yield* fileSystem.makeDirectory(`${consumer}/scripts/effect`, {
          recursive: true,
        });
        yield* runGit(consumer, ["init", "--initial-branch=main"]);
        yield* runGit(consumer, ["config", "user.name", "Consumer Fixture"]);
        yield* runGit(consumer, [
          "config",
          "user.email",
          "consumer-fixture@example.com",
        ]);
        yield* fileSystem.writeFileString(
          consumerManifest,
          packageManifest("1.0.0")
        );
        yield* fileSystem.writeFileString(
          vendoredManifest,
          packageManifest("1.0.0")
        );
        yield* fileSystem.writeFileString(`${vendoredRoot}/README.md`, "one\n");
        yield* fileSystem.writeFileString(
          `${vendoredRoot}/obsolete.txt`,
          "remove me\n"
        );
        yield* fileSystem.writeFileString(
          identityManifest,
          sourceIdentity(oldCommit, "effect@1.0.0", oldTree)
        );
        yield* commitAll(consumer, "import source without subtree trailers");
        yield* fileSystem.writeFileString(
          consumerManifest,
          packageManifest("2.0.0")
        );
        const dependencyHead = yield* commitAll(
          consumer,
          "update Effect dependency"
        );

        const config: EffectSourceConfig = {
          identityManifest: "scripts/effect/source.json",
          installedManifest: "node_modules/effect/package.json",
          repository: upstream,
          repositoryRoot: consumer,
          sourcePath: "repos/effect",
          vendoredManifest: "repos/effect/packages/effect/package.json",
        };
        yield* makeEffectSourceProgram("update", config);

        const updatedHead = yield* runGit(consumer, ["rev-parse", "HEAD"]);
        const parents = yield* runGit(consumer, [
          "show",
          "-s",
          "--format=%P",
          updatedHead,
        ]);
        const updatedTree = yield* runGit(consumer, [
          "rev-parse",
          "HEAD:repos/effect",
        ]);
        const commitBody = yield* runGit(consumer, [
          "show",
          "-s",
          "--format=%B",
          updatedHead,
        ]);
        const identity = yield* fileSystem.readFileString(identityManifest);

        expect(parents).toBe(dependencyHead);
        expect(updatedTree).toBe(newTree);
        expect(commitBody).toContain(`git-subtree-split: ${newCommit}`);
        expect(JSON.parse(identity)).toEqual({
          commit: newCommit,
          tag: "effect@2.0.0",
          tree: newTree,
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
});
