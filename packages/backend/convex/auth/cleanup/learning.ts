import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import { createPopularityViewerKey } from "@repo/backend/convex/contents/popularity";
import { Effect } from "effect";

const SMALL_BATCH_SIZE = 25;
const HISTORY_BATCH_SIZE = 50;

/** Deletes one bounded batch of account preferences and credit history. */
const cleanupAccountHistory = Effect.fn("auth.cleanup.cleanupAccountHistory")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const preferences = yield* tryUserCleanup(() =>
      ctx.db
        .query("learningPreferences")
        .withIndex("by_userId", (query) => query.eq("userId", userId))
        .take(SMALL_BATCH_SIZE)
    );

    for (const preference of preferences) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("learningPreferences", preference._id)
      );
    }

    if (preferences.length > 0) {
      return true;
    }

    const transactions = yield* tryUserCleanup(() =>
      ctx.db
        .query("creditTransactions")
        .withIndex("by_userId", (query) => query.eq("userId", userId))
        .take(HISTORY_BATCH_SIZE)
    );

    for (const transaction of transactions) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("creditTransactions", transaction._id)
      );
    }

    return transactions.length > 0;
  }
);

/** Deletes one bounded batch of learning views and recent-item rows. */
const cleanupLearningHistory = Effect.fn("auth.cleanup.cleanupLearningHistory")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const views = yield* tryUserCleanup(() =>
      ctx.db
        .query("learningViews")
        .withIndex("by_userId_and_content_id_and_contextKey", (query) =>
          query.eq("userId", userId)
        )
        .take(HISTORY_BATCH_SIZE)
    );

    for (const view of views) {
      yield* tryUserCleanup(() => ctx.db.delete("learningViews", view._id));
    }

    if (views.length > 0) {
      return true;
    }

    const recents = yield* tryUserCleanup(() =>
      ctx.db
        .query("userLearningRecents")
        .withIndex("by_userId_and_content_id", (query) =>
          query.eq("userId", userId)
        )
        .take(HISTORY_BATCH_SIZE)
    );

    for (const recent of recents) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("userLearningRecents", recent._id)
      );
    }

    return recents.length > 0;
  }
);

/** Deletes one bounded batch of per-view popularity queue rows. */
const cleanupPopularityIdentity = Effect.fn(
  "auth.cleanup.cleanupPopularityIdentity"
)(function* (ctx: MutationCtx, userId: Id<"users">) {
  const viewerKey = createPopularityViewerKey({ deviceId: "", userId });
  const queueRows = yield* tryUserCleanup(() =>
    ctx.db
      .query("learningEngagementQueue")
      .withIndex("by_viewerKey", (query) => query.eq("viewerKey", viewerKey))
      .take(HISTORY_BATCH_SIZE)
  );

  for (const row of queueRows) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("learningEngagementQueue", row._id)
    );
  }

  if (queueRows.length > 0) {
    return true;
  }

  const signals = yield* tryUserCleanup(() =>
    ctx.db
      .query("learningPopularityViewerSignals")
      .withIndex("by_viewer_content_day_scope_context", (query) =>
        query.eq("viewerKey", viewerKey)
      )
      .take(HISTORY_BATCH_SIZE)
  );

  for (const signal of signals) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("learningPopularityViewerSignals", signal._id)
    );
  }

  return signals.length > 0;
});

/** Deletes one bounded batch of generated learning-plan data. */
const cleanupLearningPlans = Effect.fn("auth.cleanup.cleanupLearningPlans")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const items = yield* tryUserCleanup(() =>
      ctx.db
        .query("learningPlanItems")
        .withIndex("by_userId", (query) => query.eq("userId", userId))
        .take(HISTORY_BATCH_SIZE)
    );

    for (const item of items) {
      yield* tryUserCleanup(() => ctx.db.delete("learningPlanItems", item._id));
    }

    if (items.length > 0) {
      return true;
    }

    const plans = yield* tryUserCleanup(() =>
      ctx.db
        .query("learningPlans")
        .withIndex("by_userId_and_status", (query) =>
          query.eq("userId", userId)
        )
        .take(SMALL_BATCH_SIZE)
    );

    for (const plan of plans) {
      yield* tryUserCleanup(() => ctx.db.delete("learningPlans", plan._id));
    }

    if (plans.length > 0) {
      return true;
    }

    const profiles = yield* tryUserCleanup(() =>
      ctx.db
        .query("learningProfiles")
        .withIndex("by_userId", (query) => query.eq("userId", userId))
        .take(SMALL_BATCH_SIZE)
    );

    for (const profile of profiles) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("learningProfiles", profile._id)
      );
    }

    return profiles.length > 0;
  }
);

/** Deletes one bounded batch of personal learning and credit data. */
export const cleanupUserLearningData = Effect.fn(
  "auth.cleanup.cleanupUserLearningData"
)(function* (ctx: MutationCtx, userId: Id<"users">) {
  if (yield* cleanupAccountHistory(ctx, userId)) {
    return true;
  }

  if (yield* cleanupLearningHistory(ctx, userId)) {
    return true;
  }

  if (yield* cleanupPopularityIdentity(ctx, userId)) {
    return true;
  }

  return yield* cleanupLearningPlans(ctx, userId);
});
