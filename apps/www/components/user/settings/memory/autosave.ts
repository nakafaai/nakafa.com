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
 * which counts the times the learner deleted every memory so far, `leave`,
 * which closes the editor of a memory the server no longer has, and `reopen`,
 * which gives the words of a failed save back in the editor when the learner
 * closed it meanwhile.
 */
type Send = Pick<
  ReturnType<typeof useMemoryActions>,
  "add" | "edit" | "remove"
> & {
  adopt: (memory: Memory) => void;
  cleared: () => number;
  leave: () => void;
  reopen: (draft: MemoryDraft) => void;
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
 * editor closes on a memory the learner emptied, the memory is deleted as the
 * Delete button deletes it, because the server would otherwise keep the last
 * words the learner no longer sees. The row of a new memory shows from the
 * moment its first save goes out, so a memory the learner deleted or emptied
 * while that save was on its way is deleted when the server has stored it. A
 * write that failed is sent again with the next one. When it
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
    /** The first save of a new memory is on its way. */
    adding: false,
    /** The memory the editor opened with, or the memory its first save stored. */
    memory,
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
   * Takes the failure of the write that handed `draft` over. A memory that is
   * gone closes the editor. Otherwise, when no newer write went out since, the
   * server lacks the words the editor holds: the next write sends them again,
   * and they come back in the editor when the learner can try again.
   */
  function failed(send: Send, draft: MemoryDraft, again: boolean) {
    const { sent, stopped, wanted } = MutableRef.get(state);
    const newest = Option.exists(sent, (handed) => handed === draft);

    MutableRef.update(state, (current) => ({
      ...current,
      adding: false,
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
      adding,
      memory: stored,
      sent,
      stopped,
      wanted,
    } = MutableRef.get(state);
    const handed = Option.exists(sent, (draft) => sameDraft(wanted, draft));

    if (adding || stopped || isBlank(wanted) || handed) {
      return;
    }

    MutableRef.update(state, (current) => ({
      ...current,
      adding: stored === null,
      sent: Option.some(wanted),
    }));

    if (stored !== null) {
      send.edit(stored.id, wanted, {
        failed: (again) => failed(send, wanted, again),
      });
      return;
    }

    const cleared = send.cleared();

    send.add(wanted, {
      done: (added) => {
        MutableRef.update(state, (current) => ({
          ...current,
          adding: false,
          memory: added,
        }));

        // The learner deleted every memory while the server was storing it,
        // and the server deleted this one with the others.
        if (send.cleared() !== cleared) {
          gone(send);
          return;
        }

        // The learner deleted the memory while the server was storing it. Its
        // row showed from the moment the save went out, so it goes as any
        // memory the learner sees goes.
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
  }

  /**
   * Stops the saving and deletes the memory. `shown` is the memory the editor
   * shows, or none while the first save of a new memory is on its way. The
   * learner has confirmed the deletion. The words the editor held
   * come back in the editor only when the server does not delete the memory,
   * or the words of the memory when the editor held none. A new memory that no
   * save has sent has no row, and nothing is deleted for it.
   */
  function discard(send: Send, shown: Memory | null) {
    const { memory: stored, wanted } = MutableRef.get(state);
    const target = shown ?? stored;

    MutableRef.update(state, (current) => ({ ...current, stopped: true }));

    if (target) {
      send.remove(target, isBlank(wanted) ? draftOf(target) : wanted);
    }
  }

  return {
    /** Takes what the editor holds now. The next write sends it. */
    change(draft: MemoryDraft) {
      MutableRef.update(state, (current) => ({ ...current, wanted: draft }));
    },
    /**
     * The editor closes. What the server was not handed goes out as `write`
     * sends it. A memory the learner emptied, title and words, is deleted as
     * the Delete button deletes it: nothing written for it
     * would leave its last words on the server and in the list, though the
     * editor showed none. A new memory that was never given a word, and is not
     * on its way, creates nothing.
     */
    close(send: Send, shown: Memory | null) {
      const { adding, memory: stored, stopped, wanted } = MutableRef.get(state);

      if (isBlank(wanted) && !stopped && (adding || stored !== null)) {
        discard(send, shown);
        return;
      }

      write(send);
    },
    discard,
    /** The words the editor starts with. */
    starting,
    write,
  };
}
