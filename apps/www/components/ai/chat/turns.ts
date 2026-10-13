import type { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import { Array as Arr, HashMap, Option } from "effect";

type Turn = typeof NinaTurnSummary.Type;

/** The turns that ended, by the order of the prompt each one answers. */
export function turnsByOrder(turns: readonly Turn[]) {
  return HashMap.fromIterable(
    Arr.map(turns, (turn): readonly [number, Turn] => [turn.order, turn])
  );
}

/**
 * The facts of the turn that answers the prompt at `order`. The chat's latest
 * turn comes from the conversation, which is live while the turn runs and
 * shows it cancelled the moment the learner stops it. Every earlier turn
 * comes from the turns that ended, and a prompt without a turn yet, such as
 * the one the learner just sent, has none.
 */
export function turnOf(
  latest: Turn | null,
  ended: HashMap.HashMap<number, Turn>,
  order: number
) {
  return latest?.order === order
    ? latest
    : Option.getOrUndefined(HashMap.get(ended, order));
}
