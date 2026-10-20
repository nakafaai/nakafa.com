import type { OptimisticUpdate } from "@confect/react";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import { Option } from "effect";
import { isTurnWorking } from "@/components/ai/chat/busy";
import { loadedForChat } from "@/components/ai/chat/state";

/**
 * Marks the chat's queued or running turn as cancelled, so the stop press
 * answers at once. The server's own answer replaces it, or Confect drops it
 * and the turn is as it was. The owner who opened the chat through its own
 * share link holds the conversation under other arguments than the stop sends,
 * and is marked too.
 */
export function optimisticCancel(
  finishedAt: number
): OptimisticUpdate<typeof nina.lifecycle.cancel> {
  return (store, args) => {
    for (const { args: loadedArgs, value: current } of loadedForChat(
      store.getAllQueries(nina.conversation.get),
      args.chatId
    )) {
      const turn = current.turn;
      if (!(turn && isTurnWorking(turn.state.status))) {
        continue;
      }
      store.setQuery(
        nina.conversation.get,
        loadedArgs,
        Option.some({
          ...current,
          turn: { ...turn, state: { status: "cancelled", finishedAt } },
        })
      );
    }
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
