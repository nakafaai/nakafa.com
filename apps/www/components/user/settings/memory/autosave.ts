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
 * which points the open editor at a memory the first save stored, and
 * `reopen`, which gives the words of a failed save back in the editor when the
 * learner closed it meanwhile.
 */
type Send = Pick<
  ReturnType<typeof useMemoryActions>,
  "add" | "drop" | "edit" | "remove"
> & {
  adopt: (id: Memory["id"]) => void;
  reopen: (id: Memory["id"] | null, draft: MemoryDraft) => void;
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
 * that failed is sent again with the next one, and gives its words back in the
 * editor when it was the newest: after an older one fails, the server still
 * holds a newer draft.
 */
export function createAutosave(
  memory: Memory | undefined,
  starting: MemoryDraft
) {
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
   * Takes the failure of the write that handed `draft` over. When no newer
   * write went out since, the server lacks these words: the next write sends
   * them again, and they come back in the editor when the learner can try
   * again.
   */
  function failed(send: Send, draft: MemoryDraft, again: boolean) {
    const { id, sent, stopped } = MutableRef.get(state);
    const newest = Option.exists(sent, (handed) => handed === draft);

    MutableRef.update(state, (current) => ({
      ...current,
      adding: false,
      sent: newest ? Option.none() : current.sent,
    }));

    if (newest && again && !stopped) {
      send.reopen(id, draft);
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
          id: stored,
        }));

        // The learner deleted the memory while the server was storing it.
        if (MutableRef.get(state).stopped) {
          send.drop(stored);
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
     * editor shows: the learner saw it stored, so its deletion offers an Undo.
     * A memory stored a moment ago, which they never saw, goes without a word.
     */
    discard(send: Send, shown: Memory | undefined) {
      const { id } = MutableRef.get(state);

      MutableRef.update(state, (current) => ({ ...current, stopped: true }));

      if (shown) {
        send.remove(shown);
        return;
      }

      if (id !== null) {
        send.drop(id);
      }
    },
    write,
  };
}
