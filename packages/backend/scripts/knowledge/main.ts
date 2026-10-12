import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
  ActiveAppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { compareFailureValidator } from "@repo/backend/confect/contents/sections/compare.spec";
import {
  EmbeddingModelId,
  embeddingModels,
} from "@repo/backend/confect/gateway/model";
import {
  ConvexCli,
  requireDevelopment,
} from "@repo/backend/scripts/development/cli";
import { rankModel } from "@repo/backend/scripts/knowledge/convex";
import { questionsFor } from "@repo/backend/scripts/knowledge/questions";
import { summarize } from "@repo/backend/scripts/knowledge/report";
import { encodeJsonText, encodePrettyJsonText } from "@repo/utilities/json";
import {
  Array as Arr,
  Duration,
  Effect,
  Option,
  Result,
  Schema,
  String as Str,
} from "effect";

/** Some runs of the model test gave no answer, which the printed report names. */
export class KnowledgeCompareError extends Schema.TaggedError<KnowledgeCompareError>()(
  "KnowledgeCompareError",
  { message: Schema.String }
) {}

/**
 * How long the CLI may take for one run, which is one call of the function. The
 * CLI waits for the answer in one request, and Node's `fetch` gives up on a
 * request that gets no answer after five minutes: a request to a local server
 * that would answer after 330 seconds ended with a `HeadersTimeoutError` after
 * 301 seconds on Node 24.21. A Node action may run for ten minutes, but the CLI
 * cannot wait that long. So a run gets the five minutes its request can wait,
 * and a run that needs more ends with a row that says it did not answer, and
 * not with the error of the CLI.
 */
const RUN_DEADLINE = Duration.minutes(5);

/** A failure of the gateway as JSON text, with the facts it carries as the data of an error. */
const failureText = Schema.encodeSync(
  Schema.fromJsonString(compareFailureValidator)
);

/** The value of a `--name=value` flag, when the command line has one. */
function flag(args: readonly string[], name: string) {
  return Option.map(
    Arr.findFirst(args, Str.startsWith(`${name}=`)),
    Str.slice(name.length + 1)
  );
}

/** The one value that a flag names, or every value when the flag is absent. */
function chosen<A>(
  args: readonly string[],
  name: string,
  schema: Schema.Codec<A, string>,
  every: readonly A[]
) {
  return Option.match(flag(args, name), {
    onNone: () => Effect.succeed(every),
    onSome: (value) => Effect.map(Schema.decodeEffect(schema)(value), Arr.of),
  });
}

/**
 * Puts the questions of one language to the deployment with one model. A run
 * that gets no answer is reported, so that the others still count.
 */
const compareRun = Effect.fn("knowledge.compareRun")(function* (
  model: EmbeddingModelId,
  locale: ActiveAppLocaleCode
) {
  const questions = questionsFor(locale);
  const found = yield* Effect.result(
    rankModel({
      locale,
      model,
      questions: Arr.map(questions, ({ contentKey, ordinal, question }) => ({
        contentKey,
        ordinal,
        question,
      })),
    })
  );
  if (Result.isFailure(found)) {
    return { error: found.failure.message, locale, model };
  }
  if (found.success.kind === "failed") {
    return {
      error: `The run ended with a gateway failure: ${failureText(found.success.failure)}`,
      locale,
      model,
    };
  }
  if (found.success.kind === "empty") {
    return {
      error: "The index holds no section of this language: build it first.",
      locale,
      model,
    };
  }
  return summarize(model, locale, questions, found.success);
});

/**
 * Tests every embedding model of the gateway, in every language, on the
 * questions of `questions/`, against the dev deployment of this checkout, and
 * prints for each pair how many right sections landed in the top five and how
 * long a question took to embed. `--model=<id>` and `--locale=<code>` narrow
 * the test to one model or one language. It runs only when the deployment check
 * allows it, and the CLI then goes to the deployment that the check looked at.
 */
const compare = Effect.gen(function* () {
  const args = yield* Effect.sync(() => Arr.drop(process.argv, 2));
  const models = yield* chosen(
    args,
    "--model",
    EmbeddingModelId,
    embeddingModels
  );
  const locales = yield* chosen(
    args,
    "--locale",
    ActiveAppLocaleCodeSchema,
    ACTIVE_APP_LOCALE_CODES
  );
  const settings = yield* requireDevelopment();
  const cli = yield* ConvexCli;
  // One run after another, so that the gateway embeds for one run at a time,
  // and each result is logged as soon as it is known, because the test takes
  // minutes per run.
  const rows = yield* Effect.forEach(
    Arr.flatMap(models, (model) =>
      Arr.map(locales, (locale) => [model, locale] as const)
    ),
    ([model, locale]) =>
      Effect.tap(compareRun(model, locale), (row) =>
        Effect.logInfo(encodeJsonText(row))
      )
  ).pipe(
    Effect.provideService(ConvexCli, {
      ...cli,
      deadline: RUN_DEADLINE,
      env: { ...cli.env, ...settings },
    })
  );
  yield* Effect.sync(() =>
    process.stdout.write(`${encodePrettyJsonText(rows)}\n`)
  );
  const silent = Arr.length(Arr.filter(rows, (row) => "error" in row));
  if (silent > 0) {
    return yield* new KnowledgeCompareError({
      message: `${silent} of ${rows.length} runs gave no answer.`,
    });
  }
});

runMain(compare.pipe(Effect.provide(nodeServicesLayer)));
