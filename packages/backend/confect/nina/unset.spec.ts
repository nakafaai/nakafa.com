import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/**
 * The most rows one call may ask for. It is a ceiling, not a size known to
 * work: nobody has run this function on a deployment yet. The operator starts
 * with a small page and raises it while calls succeed. A call that a deployment
 * refuses writes nothing, and the operator repeats it with fewer rows.
 */
export const PAGE_LIMIT = 100;

/** The tables whose rows can hold the retired model key. */
export const UnsetTable = Schema.Literals(["ninaTurns", "creditTransactions"]);

/** Where one call starts, and how many rows it reads at most. */
export const UnsetPage = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  numItems: Schema.Int.check(
    Schema.isBetween({ minimum: 1, maximum: PAGE_LIMIT })
  ),
});

/**
 * Temporary maintenance function of the contract step for the retired model
 * key (`RetiredModelKey`), which learners chose between before October 2026.
 * `nina.turns.start` no longer takes it, but rows written before then still
 * hold it: `modelId` on `ninaTurns`, and the `modelId` entry of the `metadata`
 * on `creditTransactions`, which the credit hold, the refund and the
 * settlement of a turn wrote.
 *
 * One call reads one page of `table` in creation order, after `cursor` (null
 * for the first page), and at most `numItems` rows. It unsets the key on the
 * rows of that page that hold it and writes no other row. Every other field of
 * a row stays as it was, and so does a metadata entry with another name or
 * another value. `scanned` counts the rows it read and `changed` the rows it
 * wrote. It never reads a second page and never schedules itself.
 *
 * The operator runs it with `convex run` on dev and on production, for each
 * table: the first call sends `cursor: null`, each next call sends the
 * `continueCursor` of the call before, and a table is walked once a call
 * returns `isDone`. When a whole second pass over both tables changes nothing,
 * the change that deletes `RetiredModelKey` and the stored field deletes this
 * function with its implementation and its tests.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "modelKey",
    args: () => ({ table: UnsetTable, ...UnsetPage.fields }),
    returns: () =>
      Schema.Struct({
        changed: Schema.Int,
        continueCursor: Schema.String,
        isDone: Schema.Boolean,
        scanned: Schema.Int,
      }),
  })
);
