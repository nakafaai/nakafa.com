import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Schema, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";

const SCRIPT = fileURLToPath(new URL("./scope.sh", import.meta.url));

class ScopeFixtureError extends Schema.TaggedError<ScopeFixtureError>()(
  "ScopeFixtureError",
  { message: Schema.String }
) {}

const runGit = Effect.fn("VercelScopeTest.runGit")(function* (
  repository: string,
  args: readonly string[]
) {
  const command = yield* ChildProcess.make("git", args, {
    cwd: repository,
    stderr: "inherit",
    stdout: "ignore",
  }).pipe(
    Effect.mapError(
      () => new ScopeFixtureError({ message: `git ${args.join(" ")} failed.` })
    )
  );
  const exitCode = yield* command.exitCode.pipe(
    Effect.mapError(
      () => new ScopeFixtureError({ message: `git ${args.join(" ")} failed.` })
    )
  );
  if (exitCode !== 0) {
    return yield* new ScopeFixtureError({
      message: `git ${args.join(" ")} exited with ${exitCode}.`,
    });
  }
});

const commitAll = Effect.fn("VercelScopeTest.commitAll")(function* (
  repository: string,
  message: string
) {
  yield* runGit(repository, ["add", "--all"]);
  yield* runGit(repository, ["commit", "-m", message]);
});

const readRevision = Effect.fn("VercelScopeTest.readRevision")(function* (
  repository: string
) {
  const command = yield* ChildProcess.make("git", ["rev-parse", "HEAD"], {
    cwd: repository,
  }).pipe(
    Effect.mapError(
      () => new ScopeFixtureError({ message: "Unable to start git rev-parse." })
    )
  );
  const [exitCode, stdout] = yield* Effect.all(
    [command.exitCode, Stream.mkString(Stream.decodeText(command.stdout))],
    { concurrency: 2 }
  ).pipe(
    Effect.mapError(
      () => new ScopeFixtureError({ message: "Unable to read Git revision." })
    )
  );
  if (exitCode !== 0) {
    return yield* new ScopeFixtureError({
      message: `git rev-parse exited with ${exitCode}.`,
    });
  }
  return stdout.trim();
});

const makeRepository = Effect.fn("VercelScopeTest.makeRepository")(
  function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const repository = yield* fileSystem.makeTempDirectoryScoped({
      prefix: "vercel-scope-test-",
    });
    yield* runGit(repository, ["init", "--initial-branch=main"]);
    yield* runGit(repository, ["config", "user.name", "CI Fixture"]);
    yield* runGit(repository, [
      "config",
      "user.email",
      "ci-fixture@example.com",
    ]);
    yield* fileSystem.makeDirectory(`${repository}/apps/www`, {
      recursive: true,
    });
    yield* fileSystem.makeDirectory(`${repository}/bin`);
    yield* fileSystem.makeDirectory(`${repository}/packages/shared`, {
      recursive: true,
    });
    yield* fileSystem.writeFileString(
      `${repository}/packages/shared/example.test.ts`,
      "export const testExample = true;\n"
    );
    yield* fileSystem.writeFileString(
      `${repository}/packages/shared/example.ts`,
      "export const example = true;\n"
    );
    yield* fileSystem.writeFileString(
      `${repository}/bin/turbo`,
      `#!/bin/sh
case "$3" in
  --base=*) ;;
  *) exit 2 ;;
esac
if [ "$1" != "query" ] || [ "$2" != "affected" ] || \
  [ "$4" != "--packages" ] || [ "$5" != "www" ] || \
  [ "$6" != "--exit-code" ]; then
  exit 2
fi
exit "$TURBO_STUB_EXIT"
`
    );
    yield* fileSystem.chmod(`${repository}/bin/turbo`, 0o700);
    yield* commitAll(repository, "initial");
    return repository;
  }
);

const runScope = Effect.fn("VercelScopeTest.runScope")(function* (
  repository: string,
  options: {
    readonly base?: string;
    readonly environment?: string;
    readonly head?: string;
    readonly packageName?: string;
    readonly turboExit: number;
  }
) {
  const runtimePath = yield* Effect.sync(() => process.env.PATH ?? "");
  const command = yield* ChildProcess.make(
    "sh",
    [SCRIPT, options.packageName ?? "www"],
    {
      cwd: `${repository}/apps/www`,
      env: {
        PATH: `${repository}/bin:${runtimePath}`,
        TURBO_STUB_EXIT: String(options.turboExit),
        VERCEL_ENV: options.environment ?? "production",
        VERCEL_GIT_COMMIT_SHA: options.head,
        VERCEL_GIT_PREVIOUS_SHA: options.base,
      },
      stderr: "ignore",
      stdout: "ignore",
    }
  ).pipe(
    Effect.mapError(
      () => new ScopeFixtureError({ message: "Unable to start scope script." })
    )
  );
  return yield* command.exitCode.pipe(
    Effect.mapError(
      () => new ScopeFixtureError({ message: "Unable to finish scope script." })
    )
  );
});

describe("Vercel production scope", () => {
  it.effect("skips only verified non-production or test-only work", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const repository = yield* makeRepository();
      const decide = (
        base: string | undefined,
        head: string | undefined,
        turboExit: number,
        environment?: string
      ) => runScope(repository, { base, environment, head, turboExit });

      const initial = yield* readRevision(repository);
      expect(yield* decide(initial, initial, 0)).toBe(1);
      expect(yield* decide(undefined, undefined, 1, "preview")).toBe(0);
      expect(yield* decide(undefined, undefined, 0)).toBe(1);
      expect(
        yield* runScope(repository, {
          base: initial,
          head: initial,
          packageName: "unknown",
          turboExit: 0,
        })
      ).toBe(1);

      yield* fileSystem.writeFileString(
        `${repository}/packages/shared/example.test.ts`,
        "export const testExample = false;\n"
      );
      yield* commitAll(repository, "modify test outside app");
      const testHead = yield* readRevision(repository);
      expect(yield* decide(initial, testHead, 1)).toBe(0);

      yield* fileSystem.writeFileString(
        `${repository}/packages/shared/example.ts`,
        "export const example = false;\n"
      );
      yield* commitAll(repository, "modify source outside app");
      const sourceHead = yield* readRevision(repository);
      expect(yield* decide(testHead, sourceHead, 1)).toBe(1);
      expect(yield* decide(testHead, sourceHead, 0)).toBe(0);
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
