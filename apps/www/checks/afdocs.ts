import { type CheckResult, getChecksSorted, runChecks } from "afdocs";
import { loadConfig } from "afdocs/helpers";
import { Effect, Schema } from "effect";

/** Expected failure while running the external AFDocs site contract. */
export class AfdocsError extends Schema.TaggedError<AfdocsError>()(
  "AfdocsError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Runs every configured AFDocs check against an already-started site. */
export const runAfdocs = Effect.fn("www.checks.runAfdocs")(function* () {
  const config = yield* Effect.tryPromise({
    try: () => loadConfig(),
    catch: (cause) =>
      new AfdocsError({ cause, message: "Unable to load AFDocs config." }),
  });
  const inferredSamplingStrategy =
    config.pages?.length && !config.options?.samplingStrategy
      ? "curated"
      : undefined;
  const report = yield* Effect.tryPromise({
    try: () =>
      runChecks(config.url, {
        checkIds: config.checks,
        skipCheckIds: config.skipChecks,
        ...config.options,
        ...(inferredSamplingStrategy && {
          samplingStrategy: inferredSamplingStrategy,
        }),
        curatedPages: config.pages,
      }),
    catch: (cause) =>
      new AfdocsError({ cause, message: "AFDocs site checks failed to run." }),
  });
  const results = new Map<string, CheckResult>(
    report.results.map((result) => [result.id, result])
  );

  return getChecksSorted().map((check) => ({
    check,
    result: results.get(check.id),
  }));
});
