import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/**
 * The most turns one call settles. A turn row is small, and one call reads
 * this many rows through `by_phase` and replaces each, far inside what one
 * mutation may read and write.
 */
export const PAGE_LIMIT = 100;

/**
 * Temporary maintenance function for the turns that are stored in the phase
 * `unanswered`. A migration before the turn lifecycle wrote that phase for a
 * saved prompt without an answer, and no code writes it today. On 12 October
 * 2026 production refused a schema without the phase because it holds such
 * rows.
 *
 * One call reads at most `numItems` turns of that phase through the `by_phase`
 * index and ends each the way the recovery sweep ends a run that was lost: the
 * turn becomes settled and failed with the reason `interrupted`, at the time of
 * the call. Every other field of a turn stays as it was. A turn of that phase
 * holds no credits, so there is nothing to give back. `settled` counts the
 * turns the call ended, and a call that ends none found none. It never
 * schedules itself.
 *
 * The operator runs it with `convex run` on dev and on production until a call
 * returns 0. The change that deletes the phase from the stored schema deletes
 * this function with its implementation and its tests.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "settle",
    args: () => ({
      numItems: Schema.Int.check(
        Schema.isBetween({ minimum: 1, maximum: PAGE_LIMIT })
      ),
    }),
    returns: () => Schema.Struct({ settled: Schema.Int }),
  })
);
