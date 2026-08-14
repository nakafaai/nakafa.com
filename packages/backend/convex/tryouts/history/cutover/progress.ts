import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  RETAINED_TRYOUT_ATTEMPT_COUNT,
  RETAINED_TRYOUT_PROGRESS_COUNT,
  RETAINED_TRYOUT_SNAPSHOT_ID,
} from "@repo/backend/convex/tryouts/history/cutover/constants";
import { TryoutRuntimeError } from "@repo/backend/convex/tryouts/runtime/error";
import { v } from "convex/values";
import { Effect } from "effect";

const progressCutoverResultValidator = v.object({
  changed: v.number(),
  complete: v.boolean(),
  progress: v.number(),
});

/** Migrates the exact 10 compact progress rows through their audited attempts. */
export const migrate = internalMutation({
  args: {},
  returns: progressCutoverResultValidator,
  handler: (ctx) => runConvexProgram(migrateProgress(ctx)),
});

/** Removes progress locale after all 10 appLocale values are proven. */
export const removeLegacyLocale = internalMutation({
  args: {},
  returns: progressCutoverResultValidator,
  handler: (ctx) => runConvexProgram(removeProgressLocales(ctx)),
});

/** Populates appLocale without exposing the legacy field to normal readers. */
const migrateProgress = Effect.fn("tryouts.history.cutover.migrateProgress")(
  function* (ctx: MutationCtx) {
    const { attemptsById, progress } = yield* loadAuditedProgress(ctx);
    let changed = 0;
    for (const row of progress) {
      const attempt = attemptsById.get(row.latestAttemptId);
      if (!attempt) {
        return yield* cutoverIntegrity(
          "Try-out progress references an unaudited attempt."
        );
      }
      const appLocale = yield* resolveProgressLocale(row, attempt);
      if (row.appLocale === undefined) {
        yield* cutoverPromise("Unable to migrate progress appLocale.", () =>
          ctx.db.patch("tryoutSetProgress", row._id, { appLocale })
        );
        changed += 1;
      }
    }
    return {
      changed,
      complete: true,
      progress: progress.length,
    };
  }
);

/** Removes the bounded legacy field after exact appLocale agreement proof. */
const removeProgressLocales = Effect.fn(
  "tryouts.history.cutover.removeProgressLocales"
)(function* (ctx: MutationCtx) {
  const { attemptsById, progress } = yield* loadAuditedProgress(ctx);
  let changed = 0;
  for (const row of progress) {
    const attempt = attemptsById.get(row.latestAttemptId);
    if (!attempt) {
      return yield* cutoverIntegrity(
        "Try-out progress references an unaudited attempt."
      );
    }
    yield* resolveProgressLocale(row, attempt);
    if (row.locale === undefined) {
      continue;
    }
    yield* cutoverPromise("Unable to remove progress locale.", () =>
      ctx.db.patch("tryoutSetProgress", row._id, { locale: undefined })
    );
    changed += 1;
  }
  return {
    changed,
    complete: true,
    progress: progress.length,
  };
});

/** Loads the exact aggregate-audited attempt and progress inventories. */
const loadAuditedProgress = Effect.fn(
  "tryouts.history.cutover.loadAuditedProgress"
)(function* (ctx: MutationCtx) {
  const [attempts, progress] = yield* Effect.all([
    cutoverPromise("Unable to read retained try-out attempts.", () =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_tryoutSnapshotId", (index) =>
          index.eq("tryoutSnapshotId", RETAINED_TRYOUT_SNAPSHOT_ID)
        )
        .take(RETAINED_TRYOUT_ATTEMPT_COUNT + 1)
    ),
    cutoverPromise("Unable to read compact try-out progress.", () =>
      ctx.db.query("tryoutSetProgress").take(RETAINED_TRYOUT_PROGRESS_COUNT + 1)
    ),
  ]);
  if (
    attempts.length !== RETAINED_TRYOUT_ATTEMPT_COUNT ||
    progress.length !== RETAINED_TRYOUT_PROGRESS_COUNT
  ) {
    return yield* cutoverIntegrity(
      "Try-out attempt or progress count differs from the production audit."
    );
  }
  return {
    attemptsById: new Map(attempts.map((attempt) => [attempt._id, attempt])),
    progress,
  };
});

/** Resolves and proves one progress locale through its immutable latest attempt. */
function resolveProgressLocale(
  progress: Doc<"tryoutSetProgress">,
  attempt: Doc<"tryoutAttempts">
) {
  const attemptAppLocale = attempt.appLocale;
  const appLocale = progress.appLocale;
  const legacyLocale = progress.locale;
  if (!attemptAppLocale) {
    return Effect.fail(
      cutoverIntegrity("Latest try-out attempt has no migrated appLocale.")
    );
  }
  if (
    progress.userId !== attempt.userId ||
    progress.setIdentity !== attempt.setIdentity ||
    progress.latestAttemptId !== attempt._id
  ) {
    return Effect.fail(
      cutoverIntegrity("Try-out progress differs from its latest attempt.")
    );
  }
  if (appLocale && legacyLocale && appLocale !== legacyLocale) {
    return Effect.fail(
      cutoverIntegrity("Try-out progress locale fields disagree.")
    );
  }
  const resolved = appLocale ?? legacyLocale;
  if (resolved !== attemptAppLocale) {
    return Effect.fail(
      cutoverIntegrity(
        "Try-out progress locale differs from its latest attempt."
      )
    );
  }
  return Effect.succeed(resolved);
}

/** Creates one stable fail-closed cutover integrity error. */
function cutoverIntegrity(message: string, cause?: unknown) {
  return new TryoutRuntimeError({
    cause,
    code: "TRYOUT_HISTORY_CUTOVER_INTEGRITY",
    message,
  });
}

/** Lifts one bounded database operation into the cutover error channel. */
function cutoverPromise<A>(message: string, operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: (cause) => cutoverIntegrity(message, cause),
    try: operation,
  });
}
