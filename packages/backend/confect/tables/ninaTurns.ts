import { Table } from "@confect/core";
import { NinaTurn } from "@repo/backend/confect/nina/turns.spec";

/**
 * A turn's `phase` is "active" exactly while it is queued or running. The
 * `by_phase` range therefore finds every open turn for the recovery sweep, and
 * `by_userId_and_phase` finds one learner's open turns at admission, to settle
 * the ones they stopped and to count the rest.
 * `by_chatId_and_state_status_and_order` lists the newest complete turns of a
 * chat without reading the ones that failed or were stopped.
 * `by_chatId_and_retryOf_and_state_status_and_order` finds the newest complete
 * turn that asked one question again in one read, however far apart the
 * askings are and however many of them failed or were stopped.
 * `by_chatId_and_phase_and_order` lists the turns of a chat that ended, the
 * newest first. The turn that runs has another phase, so it lies outside the
 * range, and a write to the running turn (its usage after every model
 * response) does not run a query that reads the range again.
 * `by_phase_and_sealedAt_and_sealHold` finds the settled turns whose rows are still
 * plain and that the sweep may still seal, oldest first (ADR 0024). A sealed turn
 * leaves the range, and so does a turn the sweep holds for good.
 */
export default Table.make(() => NinaTurn)
  .index("by_userId_and_requestId", ["userId", "requestId"])
  .index("by_chatId_and_order", ["chatId", "order"])
  .index("by_chatId_and_phase_and_order", ["chatId", "phase", "order"])
  .index("by_phase", ["phase"])
  .index("by_phase_and_sealedAt_and_sealHold", [
    "phase",
    "sealedAt",
    "sealHold",
  ])
  .index("by_userId_and_phase", ["userId", "phase"])
  .index("by_chatId_and_state_status_and_order", [
    "chatId",
    "state.status",
    "order",
  ])
  .index("by_chatId_and_retryOf_and_state_status_and_order", [
    "chatId",
    "retryOf",
    "state.status",
    "order",
  ]);
