import { FunctionImpl, GroupImpl } from "@confect/server";
import insightInternal from "@repo/backend/confect/_generated/refs/insight.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { verdictOf } from "@repo/backend/confect/insight/calibration";
import spec from "@repo/backend/confect/insight/calibration.spec";
import {
  Array as Arr,
  DateTime,
  Duration,
  Effect,
  Layer,
  Number as Num,
  String as Str,
} from "effect";

/** Sitting scores one run counts. */
const SCORE_BATCH = 200;

/** A month's name as a calendar writes it, `YYYY-MM`. */
const monthOf = (day: DateTime.Utc) =>
  Str.slice(0, "YYYY-MM".length)(DateTime.formatIsoDateUtc(day));

/** Counts one page of the scores before this month, and writes the month's verdict after the last. */
const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("insight.calibration.run")(function* ({
    count,
    cursor,
    errors,
    reached,
  }) {
    const start = DateTime.startOf(yield* DateTime.now, "month");
    const page = yield* (yield* DatabaseReader)
      .table("insightScores")
      .index("by_at", (query) => query.lt("at", DateTime.toEpochMillis(start)))
      .paginate({ cursor, numItems: SCORE_BATCH })
      .pipe(Effect.orDie);
    const writer = yield* DatabaseWriter;
    yield* Effect.forEach(
      page.page,
      (score) => writer.table("insightScores").delete(score._id),
      { discard: true }
    ).pipe(Effect.orDie);
    const totals = {
      count: count + Num.sumAll(Arr.map(page.page, (score) => score.count)),
      errors: errors + Num.sumAll(Arr.map(page.page, (score) => score.errors)),
      reached:
        reached + Num.sumAll(Arr.map(page.page, (score) => score.reached)),
    };
    if (!page.isDone) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        insightInternal.calibration.run,
        { ...totals, cursor: page.continueCursor }
      );
      return null;
    }
    if (totals.count === 0) {
      return null;
    }
    yield* writer
      .table("insightCalibrations")
      .insert({
        ...verdictOf(totals),
        month: monthOf(DateTime.subtract(start, { days: 1 })),
      })
      .pipe(Effect.orDie);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(run),
  GroupImpl.finalize
);
