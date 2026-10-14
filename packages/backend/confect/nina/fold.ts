import { SUMMARY_FOLD_LIMIT } from "@repo/backend/confect/nina/summaries.spec";
import { Array as Arr, Option, pipe, Schema } from "effect";

/** A turn the summary does not cover, and what it costs as the model receives it. */
const CostedTurn = Schema.Struct({ order: Schema.Int, tokens: Schema.Int });

/**
 * Turns the history holds at most, whatever they cost: four folds' worth. The
 * token budget bounds what a call costs, but each turn also costs documents to
 * read before the call, which no token counts. A chat of very short turns
 * would otherwise grow to thousands of messages before it reached the budget.
 * A message adds only the provider's overhead beyond its content (see
 * `history.ts`), so this cap is about reads, not about the prompt.
 */
export const HISTORY_TURNS = 4 * SUMMARY_FOLD_LIMIT;

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
 *
 * `unread` is the highest order that `turns` leaves out because the read gave
 * up on it, though the turns it did read are no more than the newest one or fit
 * the budget. Those turns are in neither the history nor the summary, so the
 * fold takes them first. Two things end a read early. A long run of replaced
 * askings hid the turns behind them: the fold covers those, one batch at a
 * time. Or the read holds `HISTORY_TURNS` turns already: then the fold covers a
 * whole batch from the oldest turn on, some of the turns it read included, so
 * the next fold waits for a batch of new turns and not for the next one.
 */
export function nextSummaryTarget(
  covered: number | null,
  turns: readonly (typeof CostedTurn.Type)[],
  budget: number,
  unread: Option.Option<number>
) {
  const limit = (covered ?? -1) + SUMMARY_FOLD_LIMIT;
  const hidden = Option.map(unread, (order) =>
    turns.length >= HISTORY_TURNS ? limit : Math.min(order, limit)
  );
  if (Arr.reduce(turns, 0, (total, { tokens }) => total + tokens) <= budget) {
    return hidden;
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
    Option.map(([{ order }]) => Math.min(order, limit)),
    Option.orElse(() => hidden)
  );
}
