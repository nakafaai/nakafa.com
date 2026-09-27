import { DatabaseReader, DatabaseWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { toContentAnalyticsIoError } from "@repo/backend/confect/contents/analytics/spec";
import type { PopularityCounterDelta } from "@repo/backend/confect/contents/metrics/batch";
import { learningPopularityRankings } from "@repo/backend/confect/contents/rankings";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect, flow, Struct } from "effect";

/** Projects counter payload from the newest queued signal day. */
function projectCounter(delta: PopularityCounterDelta) {
  return {
    ...delta.ref,
    ...delta.context,
    ...(delta.description === undefined
      ? {}
      : {
          description: delta.description,
        }),
    latestDay: delta.latestDay,
    locale: delta.locale,
    ...(delta.materialDomain === undefined
      ? {}
      : {
          materialDomain: delta.materialDomain,
        }),
    route: delta.route,
    section: delta.section,
    scopeMode: delta.scopeMode,
    sourcePath: delta.sourcePath,
    title: delta.title,
    windowKey: delta.windowKey,
  };
}

/** Applies one ranked popularity counter delta. */
export const applyPopularityCounter = Effect.fn(
  "contents.metrics.applyPopularityCounter"
)(
  function* (
    ctx: MutationCtx,
    delta: PopularityCounterDelta & {
      readonly updatedAt: number;
    }
  ) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const currentRow = yield* database
      .table("learningPopularityCounters")
      .get(
        "by_windowKey_and_scopeMode_and_content_id_and_contextKey",
        delta.windowKey,
        delta.scopeMode,
        delta.ref.content_id,
        delta.context.contextKey
      )
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!currentRow) {
      const counterId = yield* writer
        .table("learningPopularityCounters")
        .insert({
          ...projectCounter(delta),
          score: delta.viewCount,
          updatedAt: delta.updatedAt,
        })
        .pipe(Effect.orDie);
      const counter = yield* database
        .table("learningPopularityCounters")
        .get(counterId)
        .pipe(Effect.orDie);
      yield* Effect.tryPromise({
        try: () => learningPopularityRankings.insert(ctx, counter),
        catch: toContentAnalyticsIoError,
      });
      return;
    }
    const projection =
      delta.latestDay >= currentRow.latestDay
        ? projectCounter(delta)
        : Struct.omit(currentRow, ["_id", "_creationTime"]);
    const updated = {
      ...projection,
      score: currentRow.score + delta.viewCount,
      updatedAt: delta.updatedAt,
    };

    // Replacement clears absent optional projection fields without an extra read.
    yield* writer
      .table("learningPopularityCounters")
      .replace(currentRow._id, updated)
      .pipe(Effect.orDie);
    yield* Effect.tryPromise({
      try: () =>
        learningPopularityRankings.replace(ctx, currentRow, {
          ...updated,
          _id: currentRow._id,
          _creationTime: currentRow._creationTime,
        }),
      catch: toContentAnalyticsIoError,
    });
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);
