import { MutableRef, Schema } from "effect";

/** What the server answered about one deletion, or that it has not answered yet. */
const Outcome = Schema.Literals(["pending", "deleted", "kept"]);

/**
 * The Undo of one deletion. The toast offers it while the deletion is still on
 * its way, so a press waits for the server's answer: a memory the server
 * deleted is written back, once, and a memory the server kept is not written a
 * second time.
 */
export function createUndo(restore: () => void) {
  const outcome = MutableRef.make<typeof Outcome.Type>("pending");
  const pressed = MutableRef.make(false);

  /** Writes the memory back when the learner asked and the server deleted it. */
  function settle() {
    if (MutableRef.get(pressed) && MutableRef.get(outcome) === "deleted") {
      MutableRef.set(pressed, false);
      restore();
    }
  }

  return {
    /** The server deleted the memory. */
    deleted() {
      MutableRef.set(outcome, "deleted");
      settle();
    },
    /** The server kept the memory, so there is nothing to undo. */
    kept() {
      MutableRef.set(outcome, "kept");
    },
    /** The learner pressed Undo. */
    press() {
      MutableRef.set(pressed, true);
      settle();
    },
  };
}
