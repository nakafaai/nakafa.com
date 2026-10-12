import { NodeServices } from "@effect/platform-node";
import { afterEach, assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect, FileSystem, Path, Stream } from "effect";
import { ChildProcess } from "effect/process";
import { commitFiles, initRepository } from "#scripts/effect/test.fixture";

const originalArgv = process.argv;
const BUILD_LINE = /so it builds\.\n$/u;
const FAILURE_LINE = /^The decision failed \(.*\), so it builds\.\n$/u;

afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = undefined;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("the Ignored Build Step as a module", () => {
  it.effect("sets the exit code of its process from the decision", () =>
    Effect.gen(function* () {
      const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);
      vi.stubEnv("VERCEL_GIT_PREVIOUS_SHA", "");
      process.argv = ["node", "step.mjs", "www"];
      vi.resetModules();

      yield* Effect.promise(() => import("#scripts/vercel/step"));

      assert.strictEqual(process.exitCode, 1);
      assert.match(
        Arr.join(
          Arr.map(write.mock.calls, ([chunk]) => String(chunk)),
          ""
        ),
        BUILD_LINE
      );
    })
  );
});

/** The repository the project lives in: `www` uses the backend and `api` does not. */
const files = {
  "apps/api/package.json": '{"name":"api"}',
  "apps/www/package.json":
    '{"name":"www","dependencies":{"@repo/backend":"workspace:*"}}',
  "docs/readme.md": "one\n",
  "packages/backend/package.json": '{"name":"@repo/backend"}',
  "pnpm-workspace.yaml": "packages:\n  - apps/*\n  - packages/*\n",
};

/**
 * Starts the real step as Vercel does: its own process, in the root directory
 * of a project, with the variables of the deployment. It answers the exit code
 * that Vercel reads and the line for the build log.
 */
const startStep = Effect.fn("StepTest.start")(function* (input: {
  readonly cwd: string;
  readonly previous: string;
  readonly project: string | undefined;
}) {
  const path = yield* Path.Path;
  const step = path.join(import.meta.dirname, "step.mjs");
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make(
        process.execPath,
        input.project === undefined ? [step] : [step, input.project],
        {
          cwd: input.cwd,
          env: {
            VERCEL_GIT_COMMIT_SHA: "",
            VERCEL_GIT_PREVIOUS_SHA: input.previous,
          },
          extendEnv: true,
          stderr: "inherit",
        }
      );
      const [exitCode, output] = yield* Effect.all(
        [handle.exitCode, Stream.mkString(Stream.decodeText(handle.stdout))],
        { concurrency: 2 }
      );
      return { exitCode: Number(exitCode), output };
    })
  );
}, Effect.orDie);

describe("the Ignored Build Step as a process", () => {
  it.effect(
    "exits 0 to skip only when nothing the project is built from changed",
    () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const folder = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "vercel-step-test-",
        });
        const root = `${folder}/repository`;
        const first = yield* initRepository(root, files);
        const www = `${root}/apps/www`;
        const api = `${root}/apps/api`;

        yield* commitFiles(root, { "docs/readme.md": "two\n" });
        assert.deepStrictEqual(
          yield* startStep({ cwd: www, previous: first, project: "www" }),
          {
            exitCode: 0,
            output: `Nothing that www is built from changed, so it is skipped. Compared with ${first}.\n`,
          }
        );

        const second = yield* commitFiles(root, {
          "packages/backend/handler.ts": "export const handler = 1;\n",
        });
        assert.deepStrictEqual(
          yield* startStep({ cwd: www, previous: first, project: "www" }),
          {
            exitCode: 1,
            output: `packages/backend/handler.ts is an input of www through @repo/backend. Compared with ${first}.\n`,
          }
        );
        assert.strictEqual(
          (yield* startStep({ cwd: api, previous: first, project: "api" }))
            .exitCode,
          0
        );
        // A redeploy of the commit that was built changes nothing, which proves
        // no skip.
        assert.deepStrictEqual(
          yield* startStep({ cwd: www, previous: second, project: "www" }),
          {
            exitCode: 1,
            output: `No changed file is listed, so it builds. Compared with ${second}.\n`,
          }
        );
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    30_000
  );

  it.effect(
    "exits 1 to build when anything about the decision is missing",
    () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const folder = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "vercel-step-test-",
        });
        const root = `${folder}/repository`;
        yield* initRepository(root, files);
        const www = `${root}/apps/www`;

        const noProject = yield* startStep({
          cwd: www,
          previous: "0".repeat(40),
          project: undefined,
        });
        const noEarlier = yield* startStep({
          cwd: www,
          previous: "",
          project: "www",
        });
        const farBack = yield* startStep({
          cwd: www,
          previous: "0".repeat(40),
          project: "www",
        });
        const noRepository = yield* startStep({
          cwd: folder,
          previous: "0".repeat(40),
          project: "www",
        });

        assert.deepStrictEqual(noProject, {
          exitCode: 1,
          output: "No project is named, so it builds.\n",
        });
        assert.deepStrictEqual(noEarlier, {
          exitCode: 1,
          output: "There is no earlier deployment, so it builds.\n",
        });
        assert.deepStrictEqual(farBack, {
          exitCode: 1,
          output: `${"0".repeat(40)} is not in this shallow clone, so it builds.\n`,
        });
        assert.strictEqual(noRepository.exitCode, 1);
        assert.match(noRepository.output, FAILURE_LINE);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    30_000
  );
});
