import type { OptimisticUpdate } from "@confect/react";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import { Option } from "effect";
import { isTurnWorking } from "@/components/ai/chat/busy";

/**
 * Marks the chat's queued or running turn as cancelled, so the stop press
 * answers at once. The server's own answer replaces it, or Confect drops it
 * and the turn is as it was.
 */
export function optimisticCancel(
  finishedAt: number
): OptimisticUpdate<typeof nina.lifecycle.cancel> {
  return (store, args) => {
    const current = store.getQuery(nina.conversation.get, args);
    if (Option.isNone(current) || !current.value.turn) {
      return;
    }
    const turn = current.value.turn;
    if (!isTurnWorking(turn.state.status)) {
      return;
    }
    store.setQuery(
      nina.conversation.get,
      args,
      Option.some({
        ...current.value,
        turn: { ...turn, state: { status: "cancelled", finishedAt } },
      })
    );
  };
}

/**
 * The failure to show for a stop the server did not take. It belongs to the
 * turn that was running when the learner pressed stop, so it shows only while
 * that turn is still working. A turn that has settled, or a new turn from a
 * send or a retry, starts without it. `order` is the turn the press was for,
 * which is none for a chat that had not loaded its turn yet.
 */
export function readStopFailure<Failure>(
  stop: {
    readonly failure: Failure;
    readonly order: number | undefined;
  } | null,
  turn: Pick<typeof NinaTurnSummary.Type, "order" | "state"> | null
) {
  if (!stop || turn?.order !== stop.order) {
    return null;
  }
  return turn === null || isTurnWorking(turn.state.status)
    ? stop.failure
    : null;
}
