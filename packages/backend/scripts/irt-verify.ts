import {
  formatScriptCause,
  ScriptFailureError,
} from "@repo/backend/scripts/lib/errors";
import {
  callConvex,
  getConvexConfig,
} from "@repo/backend/scripts/sync-content/convex";
import { logError } from "@repo/backend/scripts/sync-content/logging";
import { loadEnvProvider } from "@repo/backend/scripts/sync-content/runtime";
import { Effect, Schema } from "effect";

const IRT_VERIFY_PAGE_SIZE = 500;

const calibrationCacheIntegrityPageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  missingStatsSetCount: Schema.Number,
  oversizedSetCount: Schema.Number,
});

const scaleQualityIntegrityPageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  missingQualityCheckTryoutCount: Schema.Number,
  unstartableTryoutCount: Schema.Number,
});

const calibrationQueueAttemptIntegrityPageSchema = Schema.Struct({
  continueCursor: Schema.String,
  duplicatePendingAttemptCount: Schema.Number,
  isDone: Schema.Boolean,
  missingPendingQueueAttemptCount: Schema.Number,
  staleAttemptQueueSetCount: Schema.Number,
});

const calibrationQueueEntryIntegrityPageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  orphanedQueueEntryCount: Schema.Number,
  staleQueueEntryCount: Schema.Number,
});

type CalibrationCacheIntegrityPage = Schema.Schema.Type<
  typeof calibrationCacheIntegrityPageSchema
>;
type ScaleQualityIntegrityPage = Schema.Schema.Type<
  typeof scaleQualityIntegrityPageSchema
>;
type CalibrationQueueAttemptIntegrityPage = Schema.Schema.Type<
  typeof calibrationQueueAttemptIntegrityPageSchema
>;
type CalibrationQueueEntryIntegrityPage = Schema.Schema.Type<
  typeof calibrationQueueEntryIntegrityPageSchema
>;

/** Aggregate paginated calibration-cache integrity totals for one deployment. */
const getCalibrationCacheIntegrity = Effect.fn(
  "irt.getCalibrationCacheIntegrity"
)(function* (prod: boolean) {
  const config = yield* getConvexConfig({ prod });
  let continueCursor: string | null = null;
  let missingStatsSetCount = 0;
  let oversizedSetCount = 0;

  while (true) {
    const page: CalibrationCacheIntegrityPage = yield* callConvex(
      config,
      "query",
      "irt/integrity/internal:getCalibrationCacheIntegrity",
      {
        paginationOpts: {
          cursor: continueCursor,
          numItems: IRT_VERIFY_PAGE_SIZE,
        },
      },
      calibrationCacheIntegrityPageSchema
    );

    missingStatsSetCount += page.missingStatsSetCount;
    oversizedSetCount += page.oversizedSetCount;

    if (page.isDone) {
      return {
        missingStatsSetCount,
        oversizedSetCount,
      };
    }

    continueCursor = page.continueCursor;
  }
});

/** Aggregate paginated scale-quality integrity totals for one deployment. */
const getScaleQualityIntegrity = Effect.fn("irt.getScaleQualityIntegrity")(
  function* (prod: boolean) {
    const config = yield* getConvexConfig({ prod });
    let continueCursor: string | null = null;
    let missingQualityCheckTryoutCount = 0;
    let unstartableTryoutCount = 0;

    while (true) {
      const page: ScaleQualityIntegrityPage = yield* callConvex(
        config,
        "query",
        "irt/integrity/internal:getScaleQualityIntegrity",
        {
          paginationOpts: {
            cursor: continueCursor,
            numItems: IRT_VERIFY_PAGE_SIZE,
          },
        },
        scaleQualityIntegrityPageSchema
      );

      missingQualityCheckTryoutCount += page.missingQualityCheckTryoutCount;
      unstartableTryoutCount += page.unstartableTryoutCount;

      if (page.isDone) {
        return {
          missingQualityCheckTryoutCount,
          unstartableTryoutCount,
        };
      }

      continueCursor = page.continueCursor;
    }
  }
);

/** Aggregate paginated queue-integrity totals for one deployment. */
const getCalibrationQueueIntegrity = Effect.fn(
  "irt.getCalibrationQueueIntegrity"
)(function* (prod: boolean) {
  const config = yield* getConvexConfig({ prod });
  let attemptCursor: string | null = null;
  let duplicatePendingAttemptCount = 0;
  let entryCursor: string | null = null;
  let missingPendingQueueAttemptCount = 0;
  let orphanedQueueEntryCount = 0;
  let staleAttemptQueueSetCount = 0;
  let staleQueueEntryCount = 0;

  while (true) {
    const page: CalibrationQueueAttemptIntegrityPage = yield* callConvex(
      config,
      "query",
      "irt/integrity/internal:getCalibrationQueueAttemptIntegrity",
      {
        paginationOpts: {
          cursor: attemptCursor,
          numItems: IRT_VERIFY_PAGE_SIZE,
        },
      },
      calibrationQueueAttemptIntegrityPageSchema
    );

    duplicatePendingAttemptCount += page.duplicatePendingAttemptCount;
    missingPendingQueueAttemptCount += page.missingPendingQueueAttemptCount;
    staleAttemptQueueSetCount += page.staleAttemptQueueSetCount;

    if (page.isDone) {
      break;
    }

    attemptCursor = page.continueCursor;
  }

  while (true) {
    const page: CalibrationQueueEntryIntegrityPage = yield* callConvex(
      config,
      "query",
      "irt/integrity/internal:getCalibrationQueueEntryIntegrity",
      {
        paginationOpts: {
          cursor: entryCursor,
          numItems: IRT_VERIFY_PAGE_SIZE,
        },
      },
      calibrationQueueEntryIntegrityPageSchema
    );

    orphanedQueueEntryCount += page.orphanedQueueEntryCount;
    staleQueueEntryCount += page.staleQueueEntryCount;

    if (page.isDone) {
      return {
        duplicatePendingAttemptCount,
        missingPendingQueueAttemptCount,
        orphanedQueueEntryCount,
        staleAttemptQueueSetCount,
        staleQueueEntryCount,
      };
    }

    entryCursor = page.continueCursor;
  }
});

/** Parse CLI flags and print one IRT integrity summary. */
const main = Effect.fn("irt.verify")(function* () {
  const [kind, ...flags] = yield* Effect.sync(() => process.argv.slice(2));
  const prod = flags.includes("--prod");

  if (!(kind === "cache" || kind === "queue" || kind === "scale")) {
    return yield* Effect.fail(
      new ScriptFailureError({
        message:
          "Usage: tsx scripts/irt-verify.ts <cache|queue|scale> [--prod]",
      })
    );
  }

  let result: unknown;

  if (kind === "cache") {
    result = yield* getCalibrationCacheIntegrity(prod);
  } else if (kind === "queue") {
    result = yield* getCalibrationQueueIntegrity(prod);
  } else {
    result = yield* getScaleQualityIntegrity(prod);
  }

  yield* Effect.sync(() => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });
});

Effect.runPromise(
  Effect.gen(function* () {
    const provider = yield* loadEnvProvider();
    yield* main().pipe(Effect.withConfigProvider(provider));
  }).pipe(
    Effect.catchAllCause((cause) =>
      Effect.sync(() => {
        logError(formatScriptCause(cause));
        process.exitCode = 1;
      })
    )
  )
);
