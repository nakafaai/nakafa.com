import { NodeServices } from "@effect/platform-node";
import { assert, describe, expect, it } from "@effect/vitest";
import {
  Array as Arr,
  ConfigProvider,
  Effect,
  FileSystem,
  Layer,
  PlatformError,
  Ref,
  Schema,
  Sink,
  Stdio,
  Stream,
} from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { capture, makeCapture } from "#scripts/capture";
import {
  readProductionChanges,
  requiresProductionAcceptance,
  writeProductionAcceptanceDecision,
} from "#scripts/production/acceptance";

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
      () =>
        new GitFixtureError({ message: `git ${Arr.join(args, " ")} failed.` })
    )
  );
  const exitCode = yield* command.exitCode.pipe(
    Effect.mapError(
      () =>
        new GitFixtureError({ message: `git ${Arr.join(args, " ")} failed.` })
    )
  );
  if (exitCode !== 0) {
    return yield* new GitFixtureError({
      message: `git ${Arr.join(args, " ")} exited with ${exitCode}.`,
    });
  }
});

const readRevision = Effect.fn("ProductionAcceptanceTest.readRevision")(
  function* (repository: string, revision: string) {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const output = yield* spawner
      .string(
        ChildProcess.make("git", ["rev-parse", revision], { cwd: repository })
      )
      .pipe(
        Effect.mapError(
          () =>
            new GitFixtureError({
              message: `git rev-parse ${revision} failed.`,
            })
        )
      );
    return output.trim();
  }
);

const UNKNOWN_REVISION = /unknown-revision/u;
const encoder = new TextEncoder();
const closedPipe = PlatformError.systemError({
  _tag: "BadResource",
  method: "read",
  module: "ChildProcess",
});

/** Answers every Git call with one scripted result. */
function scriptedGit(result: {
  readonly exitCode: number;
  readonly stderr?: string;
  readonly stdout: Stream.Stream<Uint8Array, PlatformError.PlatformError>;
}) {
  return Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() =>
      Effect.succeed(
        ChildProcessSpawner.makeHandle({
          all: Stream.empty,
          exitCode: Effect.succeed(
            ChildProcessSpawner.ExitCode(result.exitCode)
          ),
          getInputFd: () => Sink.drain,
          getOutputFd: () => Stream.empty,
          isRunning: Effect.succeed(false),
          kill: () => Effect.void,
          pid: ChildProcessSpawner.ProcessId(1),
          stderr: Stream.make(encoder.encode(result.stderr ?? "")),
          stdin: Sink.drain,
          stdout: result.stdout,
          unref: Effect.succeed(Effect.void),
        })
      )
    )
  );
}

/** Writes the decision with one CI environment and captured job output. */
const writeDecision = Effect.fn("ProductionAcceptanceTest.writeDecision")(
  function* (repository: string, environment: Record<string, string>) {
    const stdout = yield* makeCapture;
    const result = yield* writeProductionAcceptanceDecision(repository).pipe(
      Effect.provide(
        Stdio.layerTest({
          stdout: capture(stdout),
        })
      ),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnvRecord(environment)
      ),
      Effect.result
    );
    return { result, stdout: yield* Ref.get(stdout) };
  }
);

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
    { changes: [{ path: "README.md", status: "M" }], expected: false },
    {
      changes: [{ path: "apps/www/CHANGELOG.md", status: "A" }],
      expected: false,
    },
    {
      changes: [{ path: "docs/adr/0017-state.md", status: "M" }],
      expected: false,
    },
    {
      changes: [{ path: ".changeset/fetch.md", status: "A" }],
      expected: false,
    },
    {
      changes: [{ path: "docs/adr/diagram.svg", status: "A" }],
      expected: false,
    },
    {
      changes: [{ path: ".changeset/config.json", status: "M" }],
      expected: false,
    },
    { changes: [{ path: "osv.toml", status: "M" }], expected: false },
    {
      changes: [{ path: "packages/cli/README.md", status: "M" }],
      expected: true,
    },
    {
      changes: [{ path: "apps/www/public/notes.md", status: "A" }],
      expected: true,
    },
    {
      changes: [
        { path: "docs/adr/0017-state.md", status: "M" },
        { path: "apps/www/example.ts", status: "M" },
      ],
      expected: true,
    },
    {
      changes: [
        { path: "README.md", status: "M" },
        { path: "apps/www/example.test.ts", status: "M" },
      ],
      expected: false,
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

  it.effect("reports Git failures and malformed change records", () =>
    Effect.gen(function* () {
      const repository = yield* makeRepository("production-acceptance-git-");
      const unavailable = yield* readProductionChanges(
        `${repository}/missing`,
        "HEAD",
        "HEAD"
      ).pipe(Effect.flip);
      const badRevision = yield* readProductionChanges(
        repository,
        "HEAD",
        "unknown-revision"
      ).pipe(Effect.flip);
      const scripted = [
        { exitCode: 0, stdout: Stream.fail(closedPipe) },
        { exitCode: 128, stdout: Stream.make(encoder.encode("usage\n")) },
        { exitCode: 128, stdout: Stream.empty },
        { exitCode: 0, stdout: Stream.make(encoder.encode("M\0a.ts\0D\0")) },
        { exitCode: 0, stdout: Stream.make(encoder.encode("M\0\0")) },
      ];
      const failures = yield* Effect.forEach(scripted, (result) =>
        readProductionChanges(repository, "HEAD", "HEAD").pipe(
          Effect.provide(scriptedGit(result)),
          Effect.flip
        )
      );

      assert.strictEqual(
        unavailable.message,
        "Unable to inspect the pull request changes."
      );
      assert.match(badRevision.message, UNKNOWN_REVISION);
      assert.deepStrictEqual(
        Arr.map(failures, ({ message }) => message),
        [
          "Unable to finish inspecting the pull request changes.",
          "usage",
          "Git could not inspect the pull request changes.",
          "Git returned an invalid changed-path record.",
          "Git returned an incomplete changed-path record.",
        ]
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("accepts change records without a trailing separator", () =>
    Effect.gen(function* () {
      const changes = yield* readProductionChanges(
        "/repository",
        "HEAD",
        "HEAD"
      ).pipe(
        Effect.provide(
          scriptedGit({
            exitCode: 0,
            stdout: Stream.make(encoder.encode("M\0example.test.ts")),
          })
        )
      );
      expect(changes).toEqual([{ path: "example.test.ts", status: "M" }]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("appends the decision for the exact pull request range", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const repository = yield* makeRepository("production-acceptance-range-");
      const outputRoot = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "production-acceptance-output-",
      });
      const output = `${outputRoot}/github-output`;
      yield* fileSystem.writeFileString(output, "trusted=true\n");
      yield* fileSystem.writeFileString(
        `${repository}/example.test.ts`,
        "export const testExample = false;\n"
      );
      yield* commitAll(repository, "modify test");
      const testRange = {
        BASE_SHA: yield* readRevision(repository, "HEAD^"),
        GITHUB_OUTPUT: output,
        HEAD_SHA: yield* readRevision(repository, "HEAD"),
      };
      yield* fileSystem.writeFileString(
        `${repository}/example.ts`,
        "export const example = false;\n"
      );
      yield* commitAll(repository, "modify source");
      const sourceRange = {
        ...testRange,
        HEAD_SHA: yield* readRevision(repository, "HEAD"),
      };

      const skipped = yield* writeDecision(repository, testRange);
      const required = yield* writeDecision(repository, sourceRange);

      expect([skipped.result._tag, required.result._tag]).toEqual([
        "Success",
        "Success",
      ]);
      expect([...skipped.stdout, ...required.stdout]).toEqual([
        "Production acceptance skipped: every changed path is documentation or a modified test.\n",
        "Production acceptance required for 2 changed paths.\n",
      ]);
      expect(yield* fileSystem.readFileString(output)).toBe(
        "trusted=true\nrequired=false\nrequired=true\n"
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("rejects incomplete configuration and unwritable output", () =>
    Effect.gen(function* () {
      const repository = yield* makeRepository("production-acceptance-config-");
      const head = yield* readRevision(repository, "HEAD");
      const environments: readonly Record<string, string>[] = [
        { BASE_SHA: head, HEAD_SHA: head },
        { GITHUB_OUTPUT: `${repository}/output`, HEAD_SHA: head },
        {
          BASE_SHA: "HEAD",
          GITHUB_OUTPUT: `${repository}/output`,
          HEAD_SHA: head,
        },
        { BASE_SHA: head, GITHUB_OUTPUT: `${repository}/apps`, HEAD_SHA: head },
      ];
      const failures = yield* Effect.forEach(
        environments,
        Effect.fnUntraced(function* (environment) {
          const { result, stdout } = yield* writeDecision(
            repository,
            environment
          );
          assert.deepStrictEqual(stdout, []);
          return result._tag === "Failure" ? result.failure.message : "";
        })
      );

      assert.deepStrictEqual(failures, [
        "Production acceptance configuration is incomplete.",
        "Production acceptance configuration is incomplete.",
        "Production acceptance requires exact Git revisions.",
        "Unable to write the production acceptance decision.",
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
