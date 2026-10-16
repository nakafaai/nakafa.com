import type { NinaUncoveredTurn } from "@repo/backend/confect/nina/summaries.spec";
import { Array as Arr } from "effect";

/** A complete turn by its order, and the order of the turn that first asked its question. */
export type Asking = typeof NinaUncoveredTurn.Type;

/** Names the question of a turn by the order of the turn that first asked it. */
export function questionKey({ order, retryOf }: Asking) {
  return retryOf ?? order;
}

/**
 * Keeps the complete turns whose question no later turn asks again. A learner
 * who retries an answer prefers the newest asking, so each question keeps only
 * its newest complete asking, whichever of its askings was retried. `later`
 * holds the turns that come after `turns`, such as the one being answered: a
 * question one of them asks again leaves none of `turns`.
 */
export function newestAskings(
  turns: readonly Asking[],
  later: readonly Asking[]
) {
  const all = Arr.appendAll(turns, later);
  return Arr.filter(
    turns,
    (turn) =>
      !Arr.some(
        all,
        (other) =>
          other.order > turn.order && questionKey(other) === questionKey(turn)
      )
  );
}
