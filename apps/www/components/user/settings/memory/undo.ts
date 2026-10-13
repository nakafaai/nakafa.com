import { MutableRef, Schema } from "effect";

/** What the server answered about one deletion, or that it has not answered yet. */
const Outcome = Schema.Literals(["pending", "deleted", "kept"]);

/**
 * The Undo of one deletion. The toast offers it while the deletion is still on
 * its way, so a press waits for the server's answer: a memory the server
 * deleted is put back, once, and a memory the server kept is not put back,
 * because it never left.
 *
 * `release` lets go of the words kept in case the server did not delete the
 * memory. It runs when the server deleted it, because from then on the server
 * holds the memory for the Undo, and never before the server has answered: a
 * deletion that fails gives those words back.
 */
export function createUndo(restore: () => void, release: () => void) {
  const outcome = MutableRef.make<typeof Outcome.Type>("pending");
  const pressed = MutableRef.make(false);

  /** Puts the memory back when the learner asked and the server deleted it. */
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
      release();
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
