import type { OptimisticUpdate } from "@confect/react";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { Option } from "effect";

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
    if (turn.state.status !== "running" && turn.state.status !== "queued") {
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
