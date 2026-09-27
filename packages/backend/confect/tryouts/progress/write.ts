import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { ensureTryoutProgressWithinReadBudget } from "@repo/backend/confect/tryouts/progress/size";
import { TryoutProgressError } from "@repo/backend/confect/tryouts/progress/spec";
import { readAttemptSetIdentity } from "@repo/backend/confect/tryouts/runtime/lookup";
import {
  getTryoutStatusRank,
  type TryoutStatus,
} from "@repo/backend/confect/tryouts/status";
import { Effect, flow } from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];
interface ProgressIdentity {
  readonly appLocale: NonNullable<TryoutAttempt["appLocale"]>;
  readonly countryKey: TryoutAttempt["countryKey"];
  readonly examKey: TryoutAttempt["examKey"];
  readonly setIdentity: TryoutAttempt["setIdentity"];
  readonly setKey: TryoutAttempt["setKey"];
  readonly trackKey: TryoutAttempt["trackKey"];
}

/** Stores the latest compact attempt state used by set discovery queries. */
export const writeTryoutSetProgress = Effect.fn(
  "tryouts.progress.writeTryoutSetProgress"
)(
  function* (args: {
    attempt: TryoutAttempt;
    publishedScore: number | null;
    status: TryoutStatus;
    updatedAt: number;
  }) {
    const writer = yield* DatabaseWriter;
    yield* validateProgressScore(args.status, args.publishedScore);
    const identity = readProgressIdentity(args.attempt);
    const current = yield* loadProgress(args.attempt, identity);
    if (current) {
      yield* ensureTryoutProgressWithinReadBudget(current);
    }
    if (current && current.latestAttemptId !== args.attempt._id) {
      const latest = yield* (yield* DatabaseReader)
        .table("tryoutAttempts")
        .get(current.latestAttemptId)
        .pipe(Effect.orDie);
      if (
        latest.startedAt > args.attempt.startedAt ||
        (latest.startedAt === args.attempt.startedAt &&
          latest._creationTime > args.attempt._creationTime)
      ) {
        return current._id;
      }
    }
    const values = {
      attemptNumber: args.attempt.attemptNumber,
      countryKey: identity.countryKey,
      examKey: identity.examKey,
      latestAttemptId: args.attempt._id,
      appLocale: identity.appLocale,
      publishedScore: args.publishedScore,
      setIdentity: identity.setIdentity,
      setKey: identity.setKey,
      status: args.status,
      statusRank: getTryoutStatusRank(args.status),
      trackKey: identity.trackKey,
      updatedAt: args.updatedAt,
      userId: args.attempt.userId,
    };
    if (current) {
      yield* ensureTryoutProgressWithinReadBudget({
        ...current,
        ...values,
      });
      yield* writer
        .table("tryoutSetProgress")
        .patch(current._id, values)
        .pipe(Effect.orDie);
      return current._id;
    }
    yield* ensureTryoutProgressWithinReadBudget(values);
    return yield* writer
      .table("tryoutSetProgress")
      .insert(values)
      .pipe(Effect.orDie);
  },
  Effect.catchDefect(flow(toTryoutProgressError, Effect.fail))
);

/** Reads progress identity from the immutable signed attempt snapshot. */
function readProgressIdentity(attempt: TryoutAttempt) {
  const identity = readAttemptSetIdentity(attempt);
  return {
    countryKey: attempt.countryKey,
    examKey: attempt.examKey,
    appLocale: identity.locale,
    setIdentity: attempt.setIdentity,
    setKey: attempt.setKey,
    trackKey: attempt.trackKey,
  } satisfies ProgressIdentity;
}

/** Loads the one compact progress row owned by the attempt identity. */
const loadProgress = Effect.fn("tryouts.progress.loadProgress")(function* (
  attempt: TryoutAttempt,
  identity: ProgressIdentity
) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("tryoutSetProgress")
    .get(
      "by_userId_and_set",
      attempt.userId,
      identity.countryKey,
      identity.examKey,
      identity.trackKey,
      identity.setKey
    )
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/** Enforces that only terminal progress can expose a persisted score. */
const validateProgressScore = Effect.fn(
  "tryouts.progress.validateProgressScore"
)(function* (status: TryoutStatus, publishedScore: number | null) {
  if (status === "in-progress" && publishedScore !== null) {
    return yield* new TryoutProgressError({
      code: "TRYOUT_ACTIVE_PROGRESS_HAS_SCORE",
      message: "Active try-out progress cannot expose a score.",
    });
  }
  if (status !== "in-progress" && publishedScore === null) {
    return yield* new TryoutProgressError({
      code: "TRYOUT_TERMINAL_PROGRESS_SCORE_REQUIRED",
      message: "Terminal try-out progress requires a score.",
    });
  }
});

/** Maps one thrown database failure into the progress error channel. */
function toTryoutProgressError() {
  return new TryoutProgressError({
    code: "TRYOUT_PROGRESS_WRITE_FAILED",
    message: "Unable to update try-out progress.",
  });
}
