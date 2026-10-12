import { SUMMARY_FOLD_LIMIT } from "@repo/backend/confect/nina/summaries.spec";
import { Array as Arr, Option, pipe, Schema } from "effect";

/** A turn the summary does not cover, and what it costs as the model receives it. */
const CostedTurn = Schema.Struct({ order: Schema.Int, tokens: Schema.Int });

/**
 * Returns the order a fold should summarize through, or none while the turns
 * the summary does not cover fit in the history `budget`. `turns` lists them
 * oldest first with what each costs as the model receives it. Past the budget,
 * the fold covers the oldest turns, as many as it takes for the rest to cost
 * at most half the budget, so the next fold waits for about half a budget of
 * new turns and the cached prefix holds in between. The newest turn is never
 * folded, whatever it costs. A fold covers at most `SUMMARY_FOLD_LIMIT` turns
 * after `covered`, so a longer backlog advances one bounded batch per call.
 *
 * `turns` may leave out the oldest turns of a backlog, once at least two of the
 * newest already cost more than the budget: the answer does not depend on them.
 */
export function nextSummaryTarget(
  covered: number | null,
  turns: readonly (typeof CostedTurn.Type)[],
  budget: number
) {
  if (Arr.reduce(turns, 0, (total, { tokens }) => total + tokens) <= budget) {
    return Option.none();
  }
  const newestFirst = Arr.reverse(turns);
  // What the turns cost from the newest back to each one, the newest included.
  const [, costs] = Arr.mapAccum(newestFirst, 0, (sum, { tokens }) => [
    sum + tokens,
    sum + tokens,
  ]);
  return pipe(
    Arr.zip(newestFirst, costs),
    Arr.drop(1),
    Arr.findFirst(([, cost]) => cost > budget / 2),
    Option.map(([{ order }]) =>
      Math.min(order, (covered ?? -1) + SUMMARY_FOLD_LIMIT)
    )
  );
}
