import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { toContentAnalyticsIoError } from "@repo/backend/convex/contents/analytics/spec";
import { Effect } from "effect";

type DatabaseReader = QueryCtx["db"] | MutationCtx["db"];

/** Reads the singleton reset latch through its exact index. */
export const loadPopularityControl = Effect.fn(
  "contents.reset.loadPopularityControl"
)(function* (db: DatabaseReader) {
  return yield* Effect.tryPromise({
    try: () =>
      db
        .query("learningPopularityControl")
        .withIndex("by_key", (q) => q.eq("key", "popularity"))
        .unique(),
    catch: toContentAnalyticsIoError,
  });
});

/** Returns whether derived popularity writes are durably paused. */
export const isPopularityResetting = Effect.fn(
  "contents.reset.isPopularityResetting"
)(function* (db: DatabaseReader) {
  const control = yield* loadPopularityControl(db);
  return control?.mode === "reset";
});
