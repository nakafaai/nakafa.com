import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import { embeddingModels } from "@repo/backend/confect/gateway/model";
import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/content/deployment";
import {
  ConvexCli,
  type DevelopmentCliError,
} from "@repo/backend/scripts/development/cli";
import type { KnowledgeCompareError } from "@repo/backend/scripts/knowledge/main";
import { questionsFor } from "@repo/backend/scripts/knowledge/questions";
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import {
  Array as Arr,
  ConfigProvider,
  Duration,
  Effect,
  Fiber,
  FileSystem,
  Logger,
  Record as Rec,
  Result,
  Schema,
} from "effect";
import { TestClock } from "effect/testing";

/** What the entry program can fail with: its own failure, a flag the schemas refuse, and the refusal of the deployment check. */
type EntryError =
  | KnowledgeCompareError
  | Schema.SchemaError
  | DevelopmentCliError;

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

/** What the CLI prints when the function throws, as its `run` command words it. */
const FAILED_CALL = `✖ Failed to run function "contents/sections/compare:rank":
ConvexError: Server Error`;

const originalArgv = process.argv;

/** The answer of a deployment that ranks the section of every question first. */
const allFirst = (locale: ActiveAppLocaleCode) => ({
  answer: {
    kind: "ranked" as const,
    pool: 4274,
    refused: 0,
    verdicts: Arr.map(questionsFor(locale), ({ heading }) => ({
      milliseconds: 25,
      section: { heading, rank: 1 },
    })),
  },
});

/** A deployment that ranks the section of every question first, in every language. */
const everywhere = {
  de: allFirst("de"),
  en: allFirst("en"),
  id: allFirst("id"),
};

/** What the CLI double logged about one call: the function, its arguments in short, and the settings that pick the deployment. */
const Call = Schema.fromJsonString(
  Schema.Struct({
    command: Schema.String,
    env: Schema.Struct({
      CONVEX_DEPLOYMENT: Schema.NullOr(Schema.String),
      CONVEX_DEPLOYMENT_TOKEN: Schema.NullOr(Schema.String),
      CONVEX_DEPLOY_KEY: Schema.NullOr(Schema.String),
    }),
    locale: Schema.String,
    model: Schema.String,
    name: Schema.String,
    questions: Schema.Finite,
  })
);

/** What the CLI double does for the questions of one language: answer, fail with an error text, or never end. */
const Behavior = Schema.Struct({
  answer: Schema.optionalKey(Schema.Unknown),
  fail: Schema.optionalKey(Schema.String),
  hang: Schema.optionalKey(Schema.Boolean),
});

/** A CLI double that logs each call and then does what it is told for the language of the call. */
const fakeCli = (
  behaviors: Record<ActiveAppLocaleCode, typeof Behavior.Type>
) => `
import { appendFileSync } from "node:fs";
const [log, ...args] = process.argv.slice(2);
const [command, name, text] = args;
const input = JSON.parse(text);
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
    locale: input.locale,
    model: input.model,
    name,
    questions: input.questions.length,
  }) + "\\n"
);
const behavior = ${encodeJsonText(behaviors)}[input.locale];
if (behavior.hang) {
  setInterval(() => {}, 1000);
} else if (behavior.fail !== undefined) {
  process.stderr.write(behavior.fail);
  process.exit(1);
} else {
  process.stdout.write(JSON.stringify(behavior.answer, null, 2) + "\\n");
}
`;

/** A folder with the CLI double in it, the log it writes, and the way to start it. */
const prepare = (behaviors: Parameters<typeof fakeCli>[0]) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.realPath(
      yield* fs.makeTempDirectoryScoped({ prefix: "knowledge-compare-test-" })
    );
    const script = `${directory}/cli.mjs`;
    const log = `${directory}/calls.log`;
    yield* fs.writeFileString(script, fakeCli(behaviors));
    return {
      cli: {
        args: [script, log],
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
 * Runs the entry program of the model test with a command line and a caller
 * whose environment holds these settings, and returns what it printed and how
 * it ended.
 */
const execute = Effect.fn("KnowledgeCompareTest.execute")(function* (
  { cli }: Effect.Success<ReturnType<typeof prepare>>,
  environment: Record<string, string>,
  ...flags: readonly string[]
) {
  process.argv = ["node", "main", ...flags];
  const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  yield* Effect.promise(() => import("@repo/backend/scripts/knowledge/main"));
  const entry = yield* Effect.fromNullishOr(mocks.getEntry());
  const ended = yield* Effect.result(
    entry.pipe(
      Effect.provide(Logger.layer([])),
      Effect.provideService(ConvexCli, cli),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnv({ env: environment })
      )
    )
  );
  const printed = Arr.join(
    Arr.map(write.mock.calls, ([text]) => String(text)),
    ""
  );
  const rows =
    printed === "" ? [] : yield* Schema.decodeEffect(JsonTextSchema)(printed);
  return {
    failure: Result.isFailure(ended) ? ended.failure : undefined,
    rows: Arr.isArray(rows) ? rows : [],
  };
});

afterEach(() => {
  process.argv = originalArgv;
  vi.restoreAllMocks();
});

describe("model test entry", () => {
  it.effect(
    "tests every model in every language when no flag narrows it",
    () =>
      Effect.gen(function* () {
        const prepared = yield* prepare(everywhere);

        const { failure, rows } = yield* execute(prepared, DEV);

        const runs = embeddingModels.length * ACTIVE_APP_LOCALE_CODES.length;
        expect(failure).toBeUndefined();
        expect(yield* loggedCalls(prepared.log)).toHaveLength(runs);
        expect(rows).toHaveLength(runs);
        expect(rows[0]).toMatchObject({
          counted: Arr.length(questionsFor("en")),
          maxMs: 25,
          pool: 4274,
          skipped: [],
          top5Share: 1,
        });
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer)),
    30_000
  );

  it.effect(
    "narrows the test to the model and the language that flags name, and starts the CLI with the deployment it checked",
    () =>
      Effect.gen(function* () {
        const prepared = yield* prepare(everywhere);

        const { rows } = yield* execute(
          prepared,
          DEV,
          "--model=qwen/qwen3-embedding-8b",
          "--locale=de"
        );

        expect(yield* loggedCalls(prepared.log)).toEqual([
          {
            command: "run",
            env: {
              CONVEX_DEPLOYMENT: "dev:happy-animal-123",
              CONVEX_DEPLOYMENT_TOKEN: "",
              CONVEX_DEPLOY_KEY: "",
            },
            locale: "de",
            model: "qwen/qwen3-embedding-8b",
            name: "contents/sections/compare:rank",
            questions: Arr.length(questionsFor("de")),
          },
        ]);
        expect(rows).toMatchObject([
          { locale: "de", model: "qwen/qwen3-embedding-8b", top5Share: 1 },
        ]);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("refuses a model that the gateway does not list", () =>
    Effect.gen(function* () {
      const prepared = yield* prepare(everywhere);

      const { failure } = yield* execute(prepared, DEV, "--model=acme/embed-1");

      expect(failure).toMatchObject({ _tag: "SchemaError" });
      expect(yield* loggedCalls(prepared.log)).toEqual([]);
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "reports a run that gets no answer and still counts the others",
    () =>
      Effect.gen(function* () {
        const prepared = yield* prepare({
          ...everywhere,
          de: { fail: FAILED_CALL },
        });

        const { failure, rows } = yield* execute(
          prepared,
          DEV,
          "--model=google/gemini-embedding-2"
        );

        expect(rows).toMatchObject([
          { locale: "en", top5Share: 1 },
          { locale: "id", top5Share: 1 },
          {
            error: `Model test failed: ${Arr.join(FAILED_CALL.split("\n"), " ")}`,
            locale: "de",
            model: "google/gemini-embedding-2",
          },
        ]);
        expect(failure).toMatchObject({
          _tag: "KnowledgeCompareError",
          message: "1 of 3 runs gave no answer.",
        });
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("tells that the index must be built when it holds no section", () =>
    Effect.gen(function* () {
      const prepared = yield* prepare({
        ...everywhere,
        id: { answer: { kind: "empty" } },
      });

      const { failure, rows } = yield* execute(
        prepared,
        DEV,
        "--model=google/gemini-embedding-2"
      );

      expect(rows).toMatchObject([
        { locale: "en", top5Share: 1 },
        {
          error: "The index holds no section of this language: build it first.",
          locale: "id",
        },
        { locale: "de", top5Share: 1 },
      ]);
      expect(failure).toMatchObject({ _tag: "KnowledgeCompareError" });
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "ends a run that passes its deadline of ten minutes, with a row that says so",
    () =>
      Effect.gen(function* () {
        const prepared = yield* prepare({ ...everywhere, de: { hang: true } });
        const fiber = yield* Effect.forkChild(
          execute(prepared, DEV, "--model=google/gemini-embedding-2")
        );
        // The run of the last language is the one that hangs. Real time passes
        // until its command has started, because the test clock stands still.
        yield* Effect.repeat(TestClock.withLive(Effect.sleep("20 millis")), {
          until: () =>
            Effect.map(
              loggedCalls(prepared.log),
              (calls) => Arr.length(calls) === 3
            ),
        });

        yield* TestClock.adjust("9 minutes");
        expect(fiber.pollUnsafe()).toBeUndefined();
        yield* TestClock.adjust("1 minute");
        const { failure, rows } = yield* Fiber.join(fiber);

        expect(rows).toMatchObject([
          { locale: "en", top5Share: 1 },
          { locale: "id", top5Share: 1 },
          {
            error: `Model test did not answer within ${Duration.format(Duration.minutes(10))}.`,
            locale: "de",
            model: "google/gemini-embedding-2",
          },
        ]);
        expect(failure).toMatchObject({
          _tag: "KnowledgeCompareError",
          message: "1 of 3 runs gave no answer.",
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
        const prepared = yield* prepare(everywhere);

        const { failure, rows } = yield* execute(prepared, environment);

        expect(failure).toMatchObject({ _tag: "DevelopmentCliError" });
        for (const setting of Rec.values<string, string>(environment)) {
          expect(failure?.message).not.toContain(setting);
        }
        expect(rows).toEqual([]);
        expect(yield* loggedCalls(prepared.log)).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});
