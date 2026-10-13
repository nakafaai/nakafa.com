import type { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import type { PaginationStatus } from "convex/react";
import { Array as Arr, HashMap, Option } from "effect";

type Turn = typeof NinaTurnSummary.Type;

/**
 * Whether the transcript may ask for an older page of messages. The messages and
 * their turns load as one step: a page of messages asked while a page of turns is
 * still loading would come with no turns for it, and the page of turns that goes
 * with it would be skipped, so its messages would show without their state. The
 * turns may run out before the messages do, since one turn holds many messages,
 * so the messages still load then.
 */
export function canLoadOlderMessages(
  messages: PaginationStatus,
  turns: PaginationStatus
) {
  return (
    messages === "CanLoadMore" &&
    turns !== "LoadingFirstPage" &&
    turns !== "LoadingMore"
  );
}

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
