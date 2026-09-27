import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { createPopularityViewerKey } from "@repo/backend/confect/contents/popularity";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, flow } from "effect";

const SMALL_BATCH_SIZE = 25;
const HISTORY_BATCH_SIZE = 50;

/** Deletes one bounded batch of account preferences and credit history. */
const cleanupAccountHistory = Effect.fn("auth.cleanup.cleanupAccountHistory")(
  function* (userId: Id<"users">) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const onboardingProfiles = yield* database
      .table("onboardingProfiles")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(SMALL_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const profile of onboardingProfiles) {
      yield* writer.table("onboardingProfiles").delete(profile._id);
    }
    if (onboardingProfiles.length > 0) {
      return true;
    }
    const preferences = yield* database
      .table("learningPreferences")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(SMALL_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const preference of preferences) {
      yield* writer.table("learningPreferences").delete(preference._id);
    }
    if (preferences.length > 0) {
      return true;
    }
    const transactions = yield* database
      .table("creditTransactions")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(HISTORY_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const transaction of transactions) {
      yield* writer.table("creditTransactions").delete(transaction._id);
    }
    return transactions.length > 0;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Deletes one bounded batch of learning views and recent-item rows. */
const cleanupLearningHistory = Effect.fn("auth.cleanup.cleanupLearningHistory")(
  function* (userId: Id<"users">) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const views = yield* database
      .table("learningViews")
      .index("by_userId_and_content_id_and_contextKey", (query) =>
        query.eq("userId", userId)
      )
      .take(HISTORY_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const view of views) {
      yield* writer.table("learningViews").delete(view._id);
    }
    if (views.length > 0) {
      return true;
    }
    const recents = yield* database
      .table("userLearningRecents")
      .index("by_userId_and_content_id", (query) => query.eq("userId", userId))
      .take(HISTORY_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const recent of recents) {
      yield* writer.table("userLearningRecents").delete(recent._id);
    }
    return recents.length > 0;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Deletes one bounded batch of per-view popularity queue rows. */
const cleanupPopularityIdentity = Effect.fn(
  "auth.cleanup.cleanupPopularityIdentity"
)(
  function* (userId: Id<"users">) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const viewerKey = createPopularityViewerKey({
      deviceId: "",
      userId,
    });
    const queueRows = yield* database
      .table("learningEngagementQueue")
      .index("by_viewerKey", (query) => query.eq("viewerKey", viewerKey))
      .take(HISTORY_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const row of queueRows) {
      yield* writer.table("learningEngagementQueue").delete(row._id);
    }
    if (queueRows.length > 0) {
      return true;
    }
    const signals = yield* database
      .table("learningPopularityViewerSignals")
      .index("by_viewer_content_day_scope_context", (query) =>
        query.eq("viewerKey", viewerKey)
      )
      .take(HISTORY_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const signal of signals) {
      yield* writer.table("learningPopularityViewerSignals").delete(signal._id);
    }
    return signals.length > 0;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Deletes one bounded batch of personal learning and credit data. */
export const cleanupUserLearningData = Effect.fn(
  "auth.cleanup.cleanupUserLearningData"
)(function* (userId: Id<"users">) {
  if (yield* cleanupAccountHistory(userId)) {
    return true;
  }
  if (yield* cleanupLearningHistory(userId)) {
    return true;
  }
  return yield* cleanupPopularityIdentity(userId);
});
