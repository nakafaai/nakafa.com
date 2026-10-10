import { Table } from "@confect/core";
import { NinaTurn } from "@repo/backend/confect/nina/turns.spec";

/**
 * A turn's `phase` is "active" exactly while it is queued or running. The
 * `by_phase` range therefore finds every open turn for the recovery sweep, and
 * `by_userId_and_phase` counts one learner's open turns at admission.
 */
export default Table.make(() => NinaTurn)
  .index("by_userId_and_requestId", ["userId", "requestId"])
  .index("by_chatId_and_order", ["chatId", "order"])
  .index("by_phase", ["phase"])
  .index("by_userId_and_phase", ["userId", "phase"]);
