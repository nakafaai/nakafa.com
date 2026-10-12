import { fileURLToPath } from "node:url";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/content/deployment";
import {
  ConvexCli,
  type DevelopmentCliError,
} from "@repo/backend/scripts/development/cli";
import type { JudgmentCallError } from "@repo/backend/scripts/judgment/call";
import { messages } from "@repo/backend/test/judgment/message";
import { notes } from "@repo/backend/test/judgment/note";
import {
  Array as Arr,
  ConfigProvider,
  Duration,
  Effect,
  Fiber,
  FileSystem,
  Record as Rec,
  Result,
  Schema,
  Stream,
} from "effect";
import { ChildProcess } from "effect/process";
import { TestClock } from "effect/testing";

/** What the entry program can fail with: a flag the command refuses, and the failures of the deployment check and of a call. */
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

const originalArgv = process.argv;
const originalExitCode = process.exitCode;

/** What the CLI double logged about one call: the function, the settings that pick the deployment, and the names, size and grouping of the call. */
const Call = Schema.fromJsonString(
  Schema.Struct({
    command: Schema.String,
    env: Schema.Struct({
      CONVEX_DEPLOYMENT: Schema.NullOr(Schema.String),
      CONVEX_DEPLOYMENT_TOKEN: Schema.NullOr(Schema.String),
      CONVEX_DEPLOY_KEY: Schema.NullOr(Schema.String),
    }),
    name: Schema.String,
    names: Schema.Array(Schema.String),
    size: Schema.Int,
    together: Schema.Int,
  })
);

/**
 * A CLI double that logs each call, and then measures every text of the call
 * with a probability of 0.9 for each judgment (`measure`), refuses every text at
 * the gateway (`broken`), or never answers (`hang`), as its second argument
 * says.
 */
const FAKE_CLI = `
import { appendFileSync } from "node:fs";
const [log, mode, command, name, json] = process.argv.slice(2);
const input = JSON.parse(json);
const setting = (key) =>
  Object.hasOwn(process.env, key) ? process.env[key] : null;
appendFileSync(
  log,
  JSON.stringify({
    command,
    env: {
      CONVEX_DEPLOYMENT: setting("CONVEX_DEPLOYMENT"),
      CONVEX_DEPLOYMENT_TOKEN: setting("CONVEX_DEPLOYMENT_TOKEN"),
      CONVEX_DEPLOY_KEY: setting("CONVEX_DEPLOY_KEY"),
    },
    name,
    names: input.names,
    size: input.texts.length,
    together: input.together,
  }) + "\\n"
);
if (mode === "hang") {
  setInterval(() => {}, 1000);
} else {
  process.stdout.write(
    JSON.stringify({
      kind: "measured",
      rows: input.texts.map(() =>
        mode === "broken"
          ? { failure: { reason: "invalid", status: 400 } }
          : {
              probabilities: Object.fromEntries(
                input.names.map((judgment) => [judgment, 0.9])
              ),
            }
      ),
      thresholds: Object.fromEntries(
        input.names.map((judgment) => [judgment, 0.5])
      ),
    })
  );
}
`;

/** A folder with the CLI double in it, the log it writes, and the way to start it. */
const prepare = (mode: "broken" | "hang" | "measure") =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.realPath(
      yield* fs.makeTempDirectoryScoped({ prefix: "judgment-main-test-" })
    );
    const script = `${directory}/cli.mjs`;
    const log = `${directory}/calls.log`;
    yield* fs.writeFileString(script, FAKE_CLI);
    return {
      cli: {
        args: [script, log, mode],
        command: process.execPath,
        cwd: directory,
        deadline: Duration.seconds(30),
        env: {},
      },
      log,
    };
  });

/** The calls that the CLI double logged, in order, none when it was never started. */
const loggedCalls = (log: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    if (!(yield* fs.exists(log))) {
      return [];
    }
    const lines = Arr.filter(
      (yield* fs.readFileString(log)).split("\n"),
      (line) => line !== ""
    );
    return yield* Effect.forEach(lines, (line) =>
      Schema.decodeEffect(Call)(line)
    );
  });

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
        const prepared = yield* prepare("measure");

        const { exitCode, failure, printed } = yield* execute(prepared, DEV);

        expect(failure).toBeUndefined();
        expect(exitCode).toBe(0);
        expect(printed).toContain(
          `${Arr.length(messages)} messages, one to a request, and ${Arr.length(notes)} notes, 1 to a request, measured on the development deployment.`
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
            name: "nina/judgment:measure",
          });
        }
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer)),
    30_000
  );

  it.effect("asks the notes together when the command line names it", () =>
    Effect.gen(function* () {
      const prepared = yield* prepare("measure");

      const { printed } = yield* execute(prepared, DEV, "--together=3");

      expect(printed).toContain("notes, 3 to a request");
      // A message is asked alone, and the notes in threes.
      const calls = yield* loggedCalls(prepared.log);
      expect(calls).not.toEqual([]);
      for (const { names, together } of calls) {
        expect(together).toBe(Arr.contains(names, "lasting") ? 1 : 3);
      }
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "exits with 1 when the deployment could not measure some text",
    () =>
      Effect.gen(function* () {
        const prepared = yield* prepare("broken");

        const { exitCode, failure, printed } = yield* execute(prepared, DEV);

        expect(failure).toBeUndefined();
        expect(exitCode).toBe(1);
        expect(printed).toContain(
          `${Arr.length(messages) + Arr.length(notes)} texts failed: invalid 400`
        );
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("refuses a flag it does not accept, and starts no command", () =>
    Effect.gen(function* () {
      const prepared = yield* prepare("measure");

      const { failure } = yield* execute(prepared, DEV, "--together=4");

      expect(failure).toMatchObject({
        _tag: "JudgmentCallError",
        message: "--together=N takes a whole number from 1 to 3.",
      });
      expect(yield* loggedCalls(prepared.log)).toEqual([]);
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "ends a call that passes its deadline of five minutes, with the error of the command",
    () =>
      Effect.gen(function* () {
        const prepared = yield* prepare("hang");
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
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
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
        const prepared = yield* prepare("measure");

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
        // The child is the real script, started with the runner of the package
        // script, so it proves that every module the script imports loads,
        // which no double can fake. A deploy key in its environment makes the
        // check refuse whatever the `.env.local` of this machine holds, because
        // the check looks at the keys before the deployment, so the child
        // reaches no deployment and starts no command. The logger of Effect
        // writes the refusal to the standard output, and a module that the
        // runner cannot load shows its own error in the output instead.
        const child = yield* ChildProcess.make(
          process.execPath,
          [
            "--import",
            "tsx",
            fileURLToPath(new URL("./main.ts", import.meta.url)),
          ],
          {
            cwd: fileURLToPath(new URL("../..", import.meta.url)),
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
