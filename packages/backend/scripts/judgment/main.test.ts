import { fileURLToPath } from "node:url";
import { Ref } from "@confect/core";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/content/deployment";
import {
  ConvexCli,
  type DevelopmentCliError,
} from "@repo/backend/scripts/development/cli";
import type { JudgmentCallError } from "@repo/backend/scripts/judgment/call";
import { loggedCalls, prepare } from "@repo/backend/test/judgment/cli";
import { messages } from "@repo/backend/test/judgment/message";
import { notes } from "@repo/backend/test/judgment/note";
import {
  Array as Arr,
  ConfigProvider,
  Duration,
  Effect,
  Fiber,
  Record as Rec,
  Result,
  Stream,
} from "effect";
import { ChildProcess } from "effect/process";
import { TestClock } from "effect/testing";

/** What the entry program can fail with: an argument the command refuses, and the failures of the deployment check and of a call. */
type EntryError = JudgmentCallError | DevelopmentCliError;

const mocks = vi.hoisted(() => {
  let entry: Effect.Effect<void, EntryError> | undefined;
  return {
    getEntry: () => entry,
    runMain: vi.fn((program: Effect.Effect<void, EntryError>) => {
      entry = program;
    }),
  };
});
vi.mock("@effect/platform-node/NodeRuntime", () => ({
  runMain: mocks.runMain,
}));

/** The environment of a caller whose dev deployment is named. */
const DEV = { CONVEX_DEPLOYMENT: "dev:happy-animal-123" };

/** The folder of this package, where the package script runs. */
const PACKAGE = fileURLToPath(new URL("../..", import.meta.url));

const originalArgv = process.argv;
const originalExitCode = process.exitCode;

/**
 * Runs the entry program of the command with a command line and a caller whose
 * environment holds these settings, and returns what it printed, how it ended
 * and the exit code it set.
 */
const execute = Effect.fn("JudgmentMeasureTest.execute")(function* (
  { cli }: Effect.Success<ReturnType<typeof prepare>>,
  environment: Record<string, string>,
  ...flags: readonly string[]
) {
  process.argv = ["node", "main", ...flags];
  const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  yield* Effect.promise(() => import("@repo/backend/scripts/judgment/main"));
  const entry = yield* Effect.fromNullishOr(mocks.getEntry());
  const ended = yield* Effect.result(
    entry.pipe(
      Effect.provideService(ConvexCli, cli),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnv({ env: environment })
      )
    )
  );
  return {
    exitCode: process.exitCode,
    failure: Result.isFailure(ended) ? ended.failure : undefined,
    printed: Arr.join(
      Arr.map(write.mock.calls, ([text]) => String(text)),
      ""
    ),
  };
});

/** Collects one output stream of a child process as text. */
const collect = <E>(stream: Stream.Stream<Uint8Array, E>) =>
  stream.pipe(Stream.decodeText(), Stream.mkString);

afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

describe("the judgment measuring command", () => {
  it.effect(
    "measures the labelled set on the dev deployment that the check allowed, prints the report, and exits with 0",
    () =>
      Effect.gen(function* () {
        const prepared = yield* prepare();

        const { exitCode, failure, printed } = yield* execute(prepared, DEV);

        expect(failure).toBeUndefined();
        expect(exitCode).toBe(0);
        expect(printed).toContain(
          `${Arr.length(messages)} messages and ${Arr.length(notes)} notes, one text to a request, measured on the development deployment.`
        );
        // Every call starts the CLI with the deployment that the check looked at, and a blank key and token.
        const calls = yield* loggedCalls(prepared.log);
        expect(calls).not.toEqual([]);
        for (const call of calls) {
          expect(call).toMatchObject({
            command: "run",
            env: {
              CONVEX_DEPLOYMENT: "dev:happy-animal-123",
              CONVEX_DEPLOYMENT_TOKEN: "",
              CONVEX_DEPLOY_KEY: "",
            },
            name: Ref.getConvexFunctionName(
              refs.internal.nina.judgment.measure
            ),
          });
        }
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer)),
    30_000
  );

  it.effect(
    "exits with 1 when the deployment could not measure some text",
    () =>
      Effect.gen(function* () {
        const prepared = yield* prepare({ broken: true });

        const { exitCode, failure, printed } = yield* execute(prepared, DEV);

        expect(failure).toBeUndefined();
        expect(exitCode).toBe(1);
        expect(printed).toContain(
          `${Arr.length(messages) + Arr.length(notes)} texts failed: invalid 400`
        );
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer)),
    30_000
  );

  it.effect.each([
    [["--together=3"]],
    [["--together", "3"]],
    [["--prod"]],
    [["extra", "--prod"]],
  ] as const)(
    "refuses the command line %j, which names the argument, and starts no command",
    ([args]) =>
      Effect.gen(function* () {
        const prepared = yield* prepare();

        const { exitCode, failure, printed } = yield* execute(
          prepared,
          DEV,
          ...args
        );

        expect(failure).toMatchObject({
          _tag: "JudgmentCallError",
          message: `Judgment measure takes no argument, and was given "${Arr.join(args, " ")}".`,
        });
        expect(exitCode).toBe(originalExitCode);
        expect(printed).toBe("");
        expect(yield* loggedCalls(prepared.log)).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "ends a call that passes its deadline of five minutes, with the error of the command",
    () =>
      Effect.gen(function* () {
        const prepared = yield* prepare({ hang: true });
        const fiber = yield* Effect.forkChild(execute(prepared, DEV));
        // The first call is the one that hangs. Real time passes until its
        // command has started, because the test clock stands still.
        yield* Effect.repeat(TestClock.withLive(Effect.sleep("20 millis")), {
          until: () =>
            Effect.map(
              loggedCalls(prepared.log),
              (calls) => Arr.length(calls) === 1
            ),
        });

        yield* TestClock.adjust("4 minutes");
        expect(fiber.pollUnsafe()).toBeUndefined();
        yield* TestClock.adjust("1 minute");
        const { failure } = yield* Fiber.join(fiber);

        expect(failure).toMatchObject({
          _tag: "DevelopmentCliError",
          message: `Judgment measure did not answer within ${Duration.format(Duration.minutes(5))}.`,
        });
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer)),
    30_000
  );

  it.effect.each([
    ["no deployment is named", {}],
    [
      "a production deployment is named",
      { CONVEX_DEPLOYMENT: "prod:other-name-1" },
    ],
    [
      "the production deployment of Nakafa is named",
      { CONVEX_DEPLOYMENT: CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT },
    ],
    [
      "the production deployment of Nakafa is named behind the dev type",
      { CONVEX_DEPLOYMENT: `dev:${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}` },
    ],
    [
      "a preview deployment is named",
      { CONVEX_DEPLOYMENT: "preview:other-name-1" },
    ],
    [
      "a deploy key is set beside a dev deployment",
      { ...DEV, CONVEX_DEPLOY_KEY: "dev:happy-animal-123|top-secret" },
    ],
    [
      "a deployment token is set beside a dev deployment",
      { ...DEV, CONVEX_DEPLOYMENT_TOKEN: "dev:happy-animal-123|top-secret" },
    ],
  ] as const)(
    "refuses to run when %s, and starts no command",
    ([, environment]) =>
      Effect.gen(function* () {
        const prepared = yield* prepare();

        const { failure, printed } = yield* execute(prepared, environment);

        expect(failure).toMatchObject({ _tag: "DevelopmentCliError" });
        for (const setting of Rec.values<string, string>(environment)) {
          expect(failure?.message).not.toContain(setting);
        }
        expect(printed).toBe("");
        expect(yield* loggedCalls(prepared.log)).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.live(
    "loads under the script runner and refuses a deploy key before any command",
    () =>
      Effect.gen(function* () {
        // The child is the real script, started as the package script starts
        // it (`bun scripts/judgment/main.ts` in the folder of the package), so
        // it proves that every module the script imports loads, which no
        // double can fake. The check reads the environment before it reads the
        // `.env.local` of the package, and it looks at the keys before it looks
        // at the deployment, so a deploy key in the environment of the child
        // makes it refuse whatever deployment the `.env.local` of this machine
        // names (`development/cli.test.ts` proves that order). The child
        // reaches no deployment and starts no command. The logger of Effect
        // writes the refusal to the output, and a module that the runner
        // cannot load shows its own error there instead.
        const child = yield* ChildProcess.make(
          "bun",
          ["scripts/judgment/main.ts"],
          {
            cwd: PACKAGE,
            env: { CONVEX_DEPLOY_KEY: "dev:happy-animal-123|top-secret" },
            extendEnv: true,
            stdin: "ignore",
          }
        );
        const [stdout, stderr, exitCode] = yield* Effect.all(
          [collect(child.stdout), collect(child.stderr), child.exitCode],
          { concurrency: "unbounded" }
        );

        const output = `${stdout}${stderr}`;
        expect(output).toContain(
          "Refusing to run with a deploy key or a deployment token set"
        );
        expect(output).not.toContain("top-secret");
        expect(exitCode).toBe(1);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer)),
    60_000
  );
});
