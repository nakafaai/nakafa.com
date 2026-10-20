import { MutableRef, Option } from "effect";
import type { useMemoryActions } from "@/components/user/settings/memory/actions.client";
import {
  draftOf,
  isBlank,
  type Memory,
  type MemoryDraft,
  sameDraft,
} from "@/components/user/settings/memory/list";

/**
 * What the saving does on the Memory page: the page's own changes, `adopt`,
 * which points the open editor at the memory the first save stored, `cleared`,
 * which counts the times the learner deleted every memory so far, `hide` and
 * `unhide`, which take the row of a new memory the learner deleted while its
 * first save was on its way out of the list and put it back, `leave`, which
 * closes the editor of a memory the server no longer has, and `reopen`, which
 * gives the words of a failed save back in the editor when the learner closed
 * it meanwhile.
 */
type Send = Pick<
  ReturnType<typeof useMemoryActions>,
  "add" | "edit" | "remove"
> & {
  adopt: (memory: Memory) => void;
  cleared: () => number;
  hide: (id: Memory["id"]) => void;
  leave: () => void;
  reopen: (draft: MemoryDraft) => void;
  unhide: (id: Memory["id"]) => void;
};

/**
 * The saving of one opening of the editor: with `memory`, or with none for a
 * new memory. The editor starts with the words of `memory`, or with `restored`,
 * the words of a save that failed, which the server does not hold.
 *
 * A write goes out at once, also while an earlier one is on its way: the server
 * takes one learner's writes in the order they were sent, so the last one wins,
 * and closing the editor never waits for an answer. Only the first save of a
 * new memory is alone on its way, because every later write names the memory
 * it stored. Nothing is written for a draft that says nothing, for one the
 * server was already handed, or after the learner deleted the memory. When the
 * editor closes on a memory the learner emptied, nothing is written, so the
 * server keeps the words it was last handed: only a confirmed delete removes a
 * memory. The row of a new memory shows from the moment its first save goes
 * out. A memory the learner deletes while that save is on its way leaves the
 * list at once, and it is deleted when the server has stored it. A write that
 * failed is sent again with the next one. When it
 * was the newest, the words the editor holds now come back in the editor if
 * the learner closed it, though they may be newer than the words that failed,
 * because the server may never have been handed them. After an older write
 * fails, the server still holds a newer draft. A memory the server no longer
 * has closes the editor and stops the saving: the server answered a write with
 * a memory that is gone, or the learner deleted every memory while the first
 * save was on its way.
 */
export function createAutosave(
  memory: Memory | null,
  restored: MemoryDraft | null
) {
  const starting = restored ?? draftOf(memory);
  const state = MutableRef.make({
    /** The memory the editor opened with, or the memory its first save stored. */
    memory,
    /** The id the row of a new memory's first save carries while the save is on its way. */
    pending: Option.none<Memory["id"]>(),
    /**
     * The row of the first save, while the learner has deleted the new memory
     * and the list leaves it out, so the answer lets it go.
     */
    hidden: Option.none<Memory["id"]>(),
    /**
     * What the server was last handed, or nothing after a write that failed.
     * The server holds the words of the memory, but not the restored words of a
     * save that failed, even when the memory shows them.
     */
    sent: restored === null ? Option.some(draftOf(memory)) : Option.none(),
    /** The learner deleted the memory, or the server no longer has it. */
    stopped: false,
    /** What the editor holds. */
    wanted: starting,
  });

  /**
   * The server no longer has the memory, because it was deleted somewhere else
   * or with Delete all. Nothing is written for it again, and the editor closes.
   */
  function gone(send: Send) {
    MutableRef.update(state, (current) => ({ ...current, stopped: true }));
    send.leave();
  }

  /**
   * Ends the wait of the first save of a new memory, because its answer came or
   * it failed. A row the learner hid goes for good: the answer replaces it, or
   * there is no row to show.
   */
  function settleFirst(send: Send) {
    const { hidden } = MutableRef.get(state);

    MutableRef.update(state, (current) => ({
      ...current,
      hidden: Option.none(),
      pending: Option.none(),
    }));

    if (Option.isSome(hidden)) {
      send.unhide(hidden.value);
    }
  }

  /**
   * Takes the failure of the write that handed `draft` over. A memory that is
   * gone closes the editor. Otherwise, when no newer write went out since, the
   * server lacks the words the editor holds: the next write sends them again,
   * and they come back in the editor when the learner can try again.
   */
  function failed(send: Send, draft: MemoryDraft, again: boolean) {
    const { sent, stopped, wanted } = MutableRef.get(state);
    const newest = Option.exists(sent, (handed) => handed === draft);

    settleFirst(send);
    MutableRef.update(state, (current) => ({
      ...current,
      sent: newest ? Option.none() : current.sent,
    }));

    if (stopped) {
      return;
    }
    if (!again) {
      gone(send);
      return;
    }
    if (newest && !isBlank(wanted)) {
      send.reopen(wanted);
    }
  }

  /** Sends what the server was not handed yet. */
  function write(send: Send) {
    const {
      memory: stored,
      pending,
      sent,
      stopped,
      wanted,
    } = MutableRef.get(state);
    const handed = Option.exists(sent, (draft) => sameDraft(wanted, draft));

    if (Option.isSome(pending) || stopped || isBlank(wanted) || handed) {
      return;
    }

    MutableRef.update(state, (current) => ({
      ...current,
      sent: Option.some(wanted),
    }));

    if (stored !== null) {
      send.edit(stored.id, wanted, {
        failed: (again) => failed(send, wanted, again),
      });
      return;
    }

    const cleared = send.cleared();
    const id = send.add(wanted, {
      done: (added) => {
        settleFirst(send);
        MutableRef.update(state, (current) => ({
          ...current,
          memory: added,
        }));

        // The learner deleted every memory while the server was storing it,
        // and the server deleted this one with the others.
        if (send.cleared() !== cleared) {
          gone(send);
          return;
        }

        // The learner deleted the memory while the server was storing it. The
        // server has it now, so it goes as any memory the learner sees goes.
        if (MutableRef.get(state).stopped) {
          discard(send, added);
          return;
        }

        send.adopt(added);
        // What the learner wrote while the server was storing the memory.
        write(send);
      },
      failed: (again) => failed(send, wanted, again),
    });

    MutableRef.update(state, (current) => ({
      ...current,
      pending: Option.some(id),
    }));
  }

  /**
   * Stops the saving and deletes the memory. `shown` is the memory the editor
   * shows, or none while the first save of a new memory is on its way. The
   * learner has confirmed the deletion. The words the editor held
   * come back in the editor only when the server does not delete the memory,
   * or the words of the memory when the editor held none. While the first save
   * is on its way, its row leaves the list now, and `write` deletes the memory
   * once the server has stored it. A new memory that no save has sent has no
   * row, and nothing is deleted for it.
   */
  function discard(send: Send, shown: Memory | null) {
    const { memory: stored, pending, wanted } = MutableRef.get(state);
    const target = shown ?? stored;

    MutableRef.update(state, (current) => ({ ...current, stopped: true }));

    if (target) {
      send.remove(target, isBlank(wanted) ? draftOf(target) : wanted);
      return;
    }

    if (Option.isSome(pending)) {
      send.hide(pending.value);
      MutableRef.update(state, (current) => ({ ...current, hidden: pending }));
    }
  }

  return {
    /** Takes what the editor holds now. The next write sends it. */
    change(draft: MemoryDraft) {
      MutableRef.update(state, (current) => ({ ...current, wanted: draft }));
    },
    /**
     * The editor closes. What the server was not handed goes out as `write`
     * sends it. A draft that says nothing is never written, so a memory the
     * learner emptied keeps the words the server holds: the Delete button is
     * the only way to remove a memory, and it asks first. A new memory that was
     * never given a word, and is not on its way, creates nothing.
     */
    close(send: Send) {
      write(send);
    },
    discard,
    /** The words the editor starts with. */
    starting,
    write,
  };
}
