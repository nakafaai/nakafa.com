import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Schema, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";
import {
  readProductionChanges,
  requiresProductionAcceptance,
} from "./production-acceptance.ts";

const PRODUCTION_ACCEPTANCE_SCRIPT = fileURLToPath(
  new URL("./production-acceptance.ts", import.meta.url)
);

class GitFixtureError extends Schema.TaggedError<GitFixtureError>()(
  "GitFixtureError",
  {
    message: Schema.String,
  }
) {}

const runGit = Effect.fn("ProductionAcceptanceTest.runGit")(function* (
  repository: string,
  args: readonly string[]
) {
  const command = yield* ChildProcess.make("git", args, {
    cwd: repository,
    stderr: "inherit",
    stdout: "ignore",
  }).pipe(
    Effect.mapError(
      () => new GitFixtureError({ message: `git ${args.join(" ")} failed.` })
    )
  );
  const exitCode = yield* command.exitCode.pipe(
    Effect.mapError(
      () => new GitFixtureError({ message: `git ${args.join(" ")} failed.` })
    )
  );
  if (exitCode !== 0) {
    return yield* new GitFixtureError({
      message: `git ${args.join(" ")} exited with ${exitCode}.`,
    });
  }
});

const commitAll = Effect.fn("ProductionAcceptanceTest.commitAll")(function* (
  repository: string,
  message: string
) {
  yield* runGit(repository, ["add", "--all"]);
  yield* runGit(repository, ["commit", "-m", message]);
});

const makeRepository = Effect.fn("ProductionAcceptanceTest.makeRepository")(
  function* (prefix: string) {
    const fileSystem = yield* FileSystem.FileSystem;
    const repository = yield* fileSystem.makeTempDirectoryScoped({ prefix });
    yield* runGit(repository, ["init", "--initial-branch=main"]);
    yield* runGit(repository, ["config", "user.name", "CI Fixture"]);
    yield* runGit(repository, [
      "config",
      "user.email",
      "ci-fixture@example.com",
    ]);
    yield* fileSystem.writeFileString(
      `${repository}/example.ts`,
      "export const example = true;\n"
    );
    yield* fileSystem.writeFileString(
      `${repository}/example.test.ts`,
      "export const testExample = true;\n"
    );
    yield* fileSystem.makeDirectory(`${repository}/apps/www`, {
      recursive: true,
    });
    yield* commitAll(repository, "initial");
    return repository;
  }
);

const readGitRevision = Effect.fn("ProductionAcceptanceTest.readGitRevision")(
  function* (repository: string, revision: string) {
    const command = yield* ChildProcess.make("git", ["rev-parse", revision], {
      cwd: `${repository}/apps/www`,
    }).pipe(
      Effect.mapError(
        () =>
          new GitFixtureError({
            message: `Unable to resolve Git revision ${revision}.`,
          })
      )
    );
    const [exitCode, output] = yield* Effect.all(
      [
        command.exitCode,
        command.stdout.pipe(
          Stream.decodeText(),
          Stream.runFold(
            () => "",
            (text, chunk) => text + chunk
          )
        ),
      ],
      { concurrency: 2 }
    ).pipe(
      Effect.mapError(
        () =>
          new GitFixtureError({
            message: `Unable to read Git revision ${revision}.`,
          })
      )
    );
    if (exitCode !== 0) {
      return yield* new GitFixtureError({
        message: `Git could not resolve revision ${revision}.`,
      });
    }
    return output.trim();
  }
);

const runVercelDecision = Effect.fn(
  "ProductionAcceptanceTest.runVercelDecision"
)(function* (
  repository: string,
  base: string | undefined,
  head: string | undefined
) {
  const runtime = yield* Effect.sync(() => ({
    node: process.execPath,
    path: process.env.PATH,
  }));
  const command = yield* ChildProcess.make(
    runtime.node,
    [PRODUCTION_ACCEPTANCE_SCRIPT, "vercel"],
    {
      cwd: `${repository}/apps/www`,
      env: {
        PATH: runtime.path,
        VERCEL_GIT_COMMIT_SHA: head,
        VERCEL_GIT_PREVIOUS_SHA: base,
      },
      stderr: "ignore",
      stdout: "ignore",
    }
  ).pipe(
    Effect.mapError(
      () =>
        new GitFixtureError({
          message: "Unable to run the Vercel production decision.",
        })
    )
  );
  return yield* command.exitCode.pipe(
    Effect.mapError(
      () =>
        new GitFixtureError({
          message: "Unable to finish the Vercel production decision.",
        })
    )
  );
});

describe("production acceptance scope", () => {
  it.each([
    { changes: [], expected: true },
    {
      changes: [{ path: "apps/www/example.test.ts", status: "M" }],
      expected: false,
    },
    {
      changes: [{ path: "apps/www/example.test.ts", status: "A" }],
      expected: true,
    },
    {
      changes: [{ path: "apps/www/example.test.ts", status: "D" }],
      expected: true,
    },
    {
      changes: [{ path: "apps/www/example.ts", status: "M" }],
      expected: true,
    },
    {
      changes: [{ path: "apps/www/example.test.tsx", status: "M" }],
      expected: true,
    },
  ])("returns $expected for $changes", ({ changes, expected }) => {
    expect(requiresProductionAcceptance(changes)).toBe(expected);
  });

  it.effect(
    "distinguishes an in-place test edit from a source-to-test rename",
    () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const repository = yield* makeRepository("production-acceptance-test-");

        yield* fileSystem.writeFileString(
          `${repository}/example.test.ts`,
          "export const testExample = false;\n"
        );
        yield* commitAll(repository, "modify test");
        const testChanges = yield* readProductionChanges(
          repository,
          "HEAD^",
          "HEAD"
        );
        expect(testChanges).toEqual([{ path: "example.test.ts", status: "M" }]);
        expect(requiresProductionAcceptance(testChanges)).toBe(false);

        yield* runGit(repository, ["mv", "example.ts", "renamed.test.ts"]);
        yield* commitAll(repository, "rename source");
        const renameChanges = yield* readProductionChanges(
          repository,
          "HEAD^",
          "HEAD"
        );
        expect(renameChanges).toEqual([
          { path: "example.ts", status: "D" },
          { path: "renamed.test.ts", status: "A" },
        ]);
        expect(requiresProductionAcceptance(renameChanges)).toBe(true);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("ignores base-only changes after the target branch advances", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const repository = yield* makeRepository(
        "production-acceptance-diverged-test-"
      );

      yield* runGit(repository, ["switch", "--create", "candidate"]);
      yield* fileSystem.writeFileString(
        `${repository}/example.test.ts`,
        "export const testExample = false;\n"
      );
      yield* commitAll(repository, "modify candidate test");

      yield* runGit(repository, ["switch", "main"]);
      yield* fileSystem.writeFileString(
        `${repository}/example.ts`,
        "export const example = false;\n"
      );
      yield* commitAll(repository, "advance target source");

      const changes = yield* readProductionChanges(
        repository,
        "main",
        "candidate"
      );
      expect(changes).toEqual([{ path: "example.test.ts", status: "M" }]);
      expect(requiresProductionAcceptance(changes)).toBe(false);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("skips Vercel only for an exact test-only change", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const repository = yield* makeRepository(
        "production-acceptance-vercel-test-"
      );
      const initial = yield* readGitRevision(repository, "HEAD");

      yield* fileSystem.writeFileString(
        `${repository}/example.test.ts`,
        "export const testExample = false;\n"
      );
      yield* commitAll(repository, "modify test");
      const testHead = yield* readGitRevision(repository, "HEAD");
      expect(yield* runVercelDecision(repository, initial, testHead)).toBe(0);

      yield* fileSystem.writeFileString(
        `${repository}/example.ts`,
        "export const example = false;\n"
      );
      yield* commitAll(repository, "modify source");
      const sourceHead = yield* readGitRevision(repository, "HEAD");
      expect(yield* runVercelDecision(repository, testHead, sourceHead)).toBe(
        1
      );
      expect(yield* runVercelDecision(repository, undefined, undefined)).toBe(
        1
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
