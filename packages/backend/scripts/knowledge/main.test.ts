import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import { embeddingModels } from "@repo/backend/confect/gateway/model";
import type {
  getCustomerConvexConfig,
  loadCustomerEnvProvider,
} from "@repo/backend/scripts/customers/convex";
import type { rankModel } from "@repo/backend/scripts/knowledge/convex";
import type { KnowledgeCompareError } from "@repo/backend/scripts/knowledge/main";
import { questionsFor } from "@repo/backend/scripts/knowledge/questions";
import { JsonTextSchema } from "@repo/utilities/json";
import {
  Array as Arr,
  ConfigProvider,
  Data,
  Effect,
  Logger,
  Result,
  Schema,
} from "effect";

/** What the entry program can fail with: its own failure, a flag the schemas refuse, and the lookup of the deployment. */
type EntryError =
  | KnowledgeCompareError
  | Schema.SchemaError
  | Effect.Error<ReturnType<typeof loadCustomerEnvProvider>>
  | Effect.Error<ReturnType<typeof getCustomerConvexConfig>>;

/** The failure of a deployment that cannot be reached. */
class DeploymentOffline extends Data.TaggedError("DeploymentOffline")<{
  readonly message: string;
}> {}

const mocks = vi.hoisted(() => {
  let entry: Effect.Effect<void, EntryError> | undefined;
  return {
    config: vi.fn(),
    env: vi.fn(),
    getEntry: () => entry,
    rank: vi.fn(),
    runMain: vi.fn((program: Effect.Effect<void, EntryError>) => {
      entry = program;
    }),
  };
});
vi.mock("@effect/platform-node/NodeRuntime", () => ({
  runMain: mocks.runMain,
}));
vi.mock("@repo/backend/scripts/customers/convex", () => ({
  getCustomerConvexConfig: mocks.config,
  loadCustomerEnvProvider: mocks.env,
}));
vi.mock("@repo/backend/scripts/knowledge/convex", () => ({
  rankModel: mocks.rank,
}));

type Input = Parameters<typeof rankModel>[1];

const deployment = { accessToken: "token", url: "https://dev.convex.cloud" };
const originalArgv = process.argv;

/** The answer of a deployment that ranks the section of every question first. */
const allFirst = (locale: ActiveAppLocaleCode) => ({
  kind: "ranked" as const,
  pool: 4274,
  refused: 0,
  verdicts: Arr.map(questionsFor(locale), ({ heading }) => ({
    milliseconds: 25,
    section: { heading, rank: 1 },
  })),
});

/** Makes the deployment answer each run with `answer`. */
function deploy(
  answer: (input: Input) => Effect.Effect<unknown, DeploymentOffline>
) {
  mocks.env.mockReturnValue(Effect.succeed(ConfigProvider.fromEnvRecord({})));
  mocks.config.mockReturnValue(Effect.succeed(deployment));
  mocks.rank.mockImplementation((_config: unknown, input: Input) =>
    answer(input)
  );
}

/**
 * Runs the entry program of the model test with a command line, and returns
 * what it printed and how it ended.
 */
const execute = Effect.fn("KnowledgeCompareTest.execute")(function* (
  ...flags: readonly string[]
) {
  process.argv = ["node", "main", ...flags];
  const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  yield* Effect.promise(() => import("@repo/backend/scripts/knowledge/main"));
  const entry = yield* Effect.fromNullishOr(mocks.getEntry());
  const ended = yield* Effect.result(
    entry.pipe(Effect.provide(Logger.layer([])))
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
  mocks.config.mockReset();
  mocks.env.mockReset();
  mocks.rank.mockReset();
});

describe("model test entry", () => {
  it.effect("tests every model in every language when no flag narrows it", () =>
    Effect.gen(function* () {
      deploy(({ locale }) => Effect.succeed(allFirst(locale)));
      const { failure, rows } = yield* execute();
      const runs = embeddingModels.length * ACTIVE_APP_LOCALE_CODES.length;
      expect(failure).toBeUndefined();
      expect(mocks.rank).toHaveBeenCalledTimes(runs);
      expect(rows).toHaveLength(runs);
      expect(rows[0]).toMatchObject({
        counted: Arr.length(questionsFor("en")),
        maxMs: 25,
        pool: 4274,
        skipped: [],
        top5Share: 1,
      });
    })
  );

  it.effect(
    "narrows the test to the model and the language that flags name",
    () =>
      Effect.gen(function* () {
        deploy(({ locale }) => Effect.succeed(allFirst(locale)));
        const { rows } = yield* execute(
          "--model=qwen/qwen3-embedding-8b",
          "--locale=de"
        );
        expect(mocks.rank).toHaveBeenCalledExactlyOnceWith(deployment, {
          locale: "de",
          model: "qwen/qwen3-embedding-8b",
          questions: Arr.map(
            questionsFor("de"),
            ({ contentKey, ordinal, question }) => ({
              contentKey,
              ordinal,
              question,
            })
          ),
        });
        expect(rows).toMatchObject([
          { locale: "de", model: "qwen/qwen3-embedding-8b", top5Share: 1 },
        ]);
      })
  );

  it.effect("refuses a model that the gateway does not list", () =>
    Effect.gen(function* () {
      deploy(({ locale }) => Effect.succeed(allFirst(locale)));
      const { failure } = yield* execute("--model=acme/embed-1");
      expect(failure).toMatchObject({ _tag: "SchemaError" });
      expect(mocks.rank).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "reports a run that gets no answer and still counts the others",
    () =>
      Effect.gen(function* () {
        deploy(({ locale }) =>
          locale === "de"
            ? Effect.fail(
                new DeploymentOffline({ message: "deployment offline" })
              )
            : Effect.succeed(allFirst(locale))
        );
        const { failure, rows } = yield* execute(
          "--model=google/gemini-embedding-2"
        );
        expect(rows).toMatchObject([
          { locale: "en", top5Share: 1 },
          { locale: "id", top5Share: 1 },
          {
            error: "deployment offline",
            locale: "de",
            model: "google/gemini-embedding-2",
          },
        ]);
        expect(failure).toMatchObject({
          _tag: "KnowledgeCompareError",
          message: "1 of 3 runs gave no answer.",
        });
      })
  );

  it.effect("tells that the index must be built when it holds no section", () =>
    Effect.gen(function* () {
      deploy(({ locale }) =>
        Effect.succeed(
          locale === "id" ? { kind: "empty" as const } : allFirst(locale)
        )
      );
      const { failure, rows } = yield* execute(
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
    })
  );
});
