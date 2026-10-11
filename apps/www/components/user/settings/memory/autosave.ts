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
 * which points the open editor at the memory the first save stored, `leave`,
 * which closes the editor of a memory the server no longer has, and `reopen`,
 * which gives the words of a failed save back in the editor when the learner
 * closed it meanwhile.
 */
type Send = Pick<
  ReturnType<typeof useMemoryActions>,
  "add" | "drop" | "edit" | "remove"
> & {
  adopt: (memory: Memory) => void;
  leave: () => void;
  reopen: (draft: MemoryDraft) => void;
};

/**
 * The saving of one opening of the editor: with `memory`, or with none for a
 * new memory, and with the draft the editor starts with.
 *
 * A write goes out at once, also while an earlier one is on its way: the server
 * takes one learner's writes in the order they were sent, so the last one wins,
 * and closing the editor never waits for an answer. Only the first save of a
 * new memory is alone on its way, because every later write names the memory
 * it stored. Nothing is written for a draft that says nothing, for one the
 * server was already handed, or after the learner deleted the memory. A write
 * that failed is sent again with the next one. When it was the newest, the
 * words the editor holds now come back in the editor if the learner closed it,
 * though they may be newer than the words that failed, because the server may
 * never have been handed them. After an older write fails, the server still
 * holds a newer draft. A write the server answers with a memory that is gone
 * closes the editor.
 */
export function createAutosave(memory: Memory | null, starting: MemoryDraft) {
  const state = MutableRef.make({
    /** The first save of a new memory is on its way. */
    adding: false,
    /** The stored memory, once there is one. */
    id: memory?.id ?? null,
    /** What the server was last handed, or nothing after a write that failed. */
    sent: Option.some(draftOf(memory)),
    /** The learner deleted the memory. */
    stopped: false,
    /** What the editor holds. */
    wanted: starting,
  });

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
      send.leave();
      return;
    }
    if (newest && !isBlank(wanted)) {
      send.reopen(wanted);
    }
  }

  /** Sends what the server was not handed yet. */
  function write(send: Send) {
    const { adding, id, sent, stopped, wanted } = MutableRef.get(state);
    const handed = Option.exists(sent, (draft) => sameDraft(wanted, draft));

    if (adding || stopped || isBlank(wanted) || handed) {
      return;
    }

    MutableRef.update(state, (current) => ({
      ...current,
      adding: id === null,
      sent: Option.some(wanted),
    }));

    if (id !== null) {
      send.edit(id, wanted, {
        failed: (again) => failed(send, wanted, again),
      });
      return;
    }

    send.add(wanted, {
      done: (stored) => {
        MutableRef.update(state, (current) => ({
          ...current,
          adding: false,
          id: stored.id,
        }));

        // The learner deleted the memory while the server was storing it.
        if (MutableRef.get(state).stopped) {
          send.drop(stored.id);
          return;
        }

        send.adopt(stored);
        // What the learner wrote while the server was storing the memory.
        write(send);
      },
      failed: (again) => failed(send, wanted, again),
    });
  }

  return {
    /** Takes what the editor holds now. The next write sends it. */
    change(draft: MemoryDraft) {
      MutableRef.update(state, (current) => ({ ...current, wanted: draft }));
    },
    /**
     * Stops the saving and deletes the memory. `shown` is the memory the
     * editor shows: the learner saw it stored, so its deletion offers an Undo,
     * which brings back the words the editor held, or the words of the memory
     * when the editor held none. A memory stored a moment ago, which they never
     * saw, goes without a word.
     */
    discard(send: Send, shown: Memory | null) {
      const { id, wanted } = MutableRef.get(state);

      MutableRef.update(state, (current) => ({ ...current, stopped: true }));

      if (shown) {
        send.remove(shown, isBlank(wanted) ? draftOf(shown) : wanted);
        return;
      }

      if (id !== null) {
        send.drop(id);
      }
    },
    write,
  };
}
