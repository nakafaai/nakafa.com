import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { verifyRetainedTryoutInventory } from "@repo/backend/convex/contentRelease/cutover/retained";
import { requireCutoverPhase } from "@repo/backend/convex/contentRelease/cutover/state";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import { v } from "convex/values";
import { Effect } from "effect";

const retirementReceiptValidator = v.object({
  attempts: v.number(),
  localeRemoved: v.number(),
  placements: v.number(),
  progress: v.number(),
  titleRemoved: v.number(),
});

/** Removes the bounded legacy try-out fields after the terminal proof. */
export const retireLegacyTryoutFields = Effect.fn(
  "contentRelease.cutover.retireLegacyTryoutFields"
)(function* (ctx: MutationCtx) {
  yield* requireCutoverPhase(ctx, ["proved"]);

  const [attempts, placements, progress] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("tryoutAttempts")
        .take(retainedTryoutHistoryPlan.attemptCount + 1)
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutAttemptPlacements")
        .take(retainedTryoutHistoryPlan.frozenPlacementCount + 1)
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutSetProgress")
        .take(retainedTryoutHistoryPlan.progressCount + 1)
    ),
  ]);
  yield* verifyRetainedTryoutInventory(attempts, placements, progress);

  const localeRows = [...attempts, ...progress];
  const legacyLocaleRows = localeRows.filter((row) => row.locale !== undefined);
  const legacyTitleRows = placements.filter((row) => row.title !== undefined);
  if (
    legacyLocaleRows.some(
      (row) => row.locale !== undefined && row.locale !== row.appLocale
    )
  ) {
    return yield* localeRetirementFailure(
      "A retained row differs from its proved locale."
    );
  }
  if (
    legacyLocaleRows.length > 0 &&
    legacyLocaleRows.length !== localeRows.length
  ) {
    return yield* localeRetirementFailure(
      "Legacy try-out locale fields are only partially present."
    );
  }
  if (
    legacyTitleRows.length > 0 &&
    legacyTitleRows.length !== placements.length
  ) {
    return yield* localeRetirementFailure(
      "Legacy try-out placement titles are only partially present."
    );
  }

  if (legacyLocaleRows.length > 0) {
    for (const attempt of attempts) {
      yield* Effect.promise(() =>
        ctx.db.patch("tryoutAttempts", attempt._id, { locale: undefined })
      );
    }
    for (const row of progress) {
      yield* Effect.promise(() =>
        ctx.db.patch("tryoutSetProgress", row._id, { locale: undefined })
      );
    }
  }
  if (legacyTitleRows.length > 0) {
    for (const placement of placements) {
      yield* Effect.promise(() =>
        ctx.db.patch("tryoutAttemptPlacements", placement._id, {
          title: undefined,
        })
      );
    }
  }
  return fieldRetirementReceipt(
    legacyLocaleRows.length,
    legacyTitleRows.length
  );
});

/** Executes the one exact production locale retirement. */
export const retire = internalMutation({
  args: {},
  returns: retirementReceiptValidator,
  handler: (ctx) => runConvexProgram(retireLegacyTryoutFields(ctx)),
});

function fieldRetirementReceipt(localeRemoved: number, titleRemoved: number) {
  return {
    attempts: retainedTryoutHistoryPlan.attemptCount,
    localeRemoved,
    placements: retainedTryoutHistoryPlan.frozenPlacementCount,
    progress: retainedTryoutHistoryPlan.progressCount,
    titleRemoved,
  };
}

function localeRetirementFailure(message: string) {
  return releaseFail("CONTENT_RELEASE_INTEGRITY", message);
}
