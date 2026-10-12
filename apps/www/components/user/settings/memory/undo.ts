import { MutableRef, Schema } from "effect";

/** What the server answered about one deletion, or that it has not answered yet. */
const Outcome = Schema.Literals(["pending", "deleted", "kept"]);

/**
 * The Undo of one deletion. The toast offers it while the deletion is still on
 * its way, so a press waits for the server's answer: a memory the server
 * deleted is written back, once, and a memory the server kept is not written a
 * second time.
 *
 * `release` lets go of the words kept for the Undo. It runs when the server
 * deleted the memory and the offer is over, never while the server has not
 * answered: a deletion that fails still gives those words back.
 */
export function createUndo(restore: () => void, release: () => void) {
  const outcome = MutableRef.make<typeof Outcome.Type>("pending");
  const pressed = MutableRef.make(false);
  const offered = MutableRef.make(true);

  /** Lets the kept words go once the deletion stands and no Undo is offered. */
  function letGo() {
    if (MutableRef.get(outcome) === "deleted" && !MutableRef.get(offered)) {
      release();
    }
  }

  /** Writes the memory back when the learner asked and the server deleted it. */
  function settle() {
    if (MutableRef.get(pressed) && MutableRef.get(outcome) === "deleted") {
      MutableRef.set(pressed, false);
      restore();
    }
  }

  return {
    /** The toast left, by itself or because the learner closed or used it. */
    closed() {
      MutableRef.set(offered, false);
      letGo();
    },
    /** The server deleted the memory. */
    deleted() {
      MutableRef.set(outcome, "deleted");
      settle();
      letGo();
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
