import { FunctionImpl, GroupImpl } from "@confect/server";
import insightInternal from "@repo/backend/confect/_generated/refs/insight.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/insight/retention.spec";
import { Array as Arr, Duration, Effect, Layer } from "effect";

/** Rows of each table one run deletes. */
const DELETE_BATCH = 200;

/** Deletes a page of each table, unless the school restored the period, and runs again while a page came back full. */
const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("insight.retention.run")(function* ({ periodId }) {
    const reader = yield* DatabaseReader;
    const period = yield* reader
      .table("tenantPeriods")
      .get(periodId)
      .pipe(Effect.orDie);
    if (period.status !== "archived") {
      return null;
    }
    const writer = yield* DatabaseWriter;
    const standings = yield* reader
      .table("insightMastery")
      .index("by_periodId", (query) => query.eq("periodId", periodId))
      .take(DELETE_BATCH)
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      standings,
      (row) => writer.table("insightMastery").delete(row._id),
      { discard: true }
    ).pipe(Effect.orDie);
    const narratives = yield* reader
      .table("insightNarratives")
      .index("by_periodId", (query) => query.eq("periodId", periodId))
      .take(DELETE_BATCH)
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      narratives,
      (row) => writer.table("insightNarratives").delete(row._id),
      { discard: true }
    ).pipe(Effect.orDie);
    const drafts = yield* reader
      .table("insightDrafts")
      .index("by_periodId", (query) => query.eq("periodId", periodId))
      .take(DELETE_BATCH)
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      drafts,
      (row) => writer.table("insightDrafts").delete(row._id),
      { discard: true }
    ).pipe(Effect.orDie);
    if (
      Arr.some(
        [standings.length, narratives.length, drafts.length],
        (deleted) => deleted === DELETE_BATCH
      )
    ) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        insightInternal.retention.run,
        { periodId }
      );
    }
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(run),
  GroupImpl.finalize
);
