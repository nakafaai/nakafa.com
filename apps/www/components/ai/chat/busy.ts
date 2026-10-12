import type { NinaTurnState } from "@repo/backend/confect/nina/contract/turn";

/** Whether a turn is still working: queued behind another turn, or running. */
export function isTurnWorking(
  status: (typeof NinaTurnState.Type)["status"] | undefined
) {
  return status === "queued" || status === "running";
}

/**
 * Whether Nina is working on the chat, so the composer offers to stop instead
 * of send. It reads only facts that stay the same while text streams: a press
 * in flight, the chat still loading after it was just started, and the state
 * of the latest turn. Stopping answers at once, so it ends the work before the
 * server confirms it.
 */
export function isChatBusy({
  cancelling,
  loading,
  opening,
  pending,
  status,
}: {
  cancelling: boolean;
  loading: boolean;
  opening: boolean;
  pending: boolean;
  status: (typeof NinaTurnState.Type)["status"] | undefined;
}) {
  if (cancelling) {
    return false;
  }
  return pending || (opening && loading) || isTurnWorking(status);
}
