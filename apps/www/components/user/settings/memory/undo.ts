import { MutableRef, Schema } from "effect";

/**
 * Where one deletion stands: the server has not answered yet (`pending`), it
 * deleted the memory (`deleted`), it kept the memory (`kept`), or the memory
 * was asked back from the server (`restored`), which ends the Undo.
 */
const Stage = Schema.Literals(["pending", "deleted", "kept", "restored"]);

/**
 * The Undo of one deletion. The toast offers it while the deletion is still on
 * its way, so a press waits for the server's answer: a memory the server
 * deleted is put back once, however often the learner presses Undo, and a
 * memory the server kept is not put back, because it never left. Toasts keep
 * the button in the page for a moment after a press, so a second press by
 * keyboard reaches it.
 *
 * `release` lets go of the words kept in case the server did not delete the
 * memory. It runs when the server deleted it, because from then on the server
 * holds the memory for the Undo, and never before the server has answered: a
 * deletion that fails gives those words back.
 */
export function createUndo(restore: () => void, release: () => void) {
  const stage = MutableRef.make<typeof Stage.Type>("pending");
  const pressed = MutableRef.make(false);

  /** Puts the memory back, once, when the learner asked and the server deleted it. */
  function settle() {
    if (MutableRef.get(pressed) && MutableRef.get(stage) === "deleted") {
      MutableRef.set(stage, "restored");
      restore();
    }
  }

  return {
    /** The server deleted the memory. */
    deleted() {
      MutableRef.set(stage, "deleted");
      release();
      settle();
    },
    /** The server kept the memory, so there is nothing to undo. */
    kept() {
      MutableRef.set(stage, "kept");
    },
    /** The learner pressed Undo. */
    press() {
      MutableRef.set(pressed, true);
      settle();
    },
  };
}
