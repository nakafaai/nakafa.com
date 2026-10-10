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
 * What the saving does on the Memory page: the page's own changes, and `adopt`,
 * which points the open editor at a memory the first save stored.
 */
type Send = Pick<
  ReturnType<typeof useMemoryActions>,
  "add" | "drop" | "edit" | "remove"
> & { adopt: (id: Memory["id"]) => void };

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
 * that failed is sent again with the next one.
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

  /** Forgets that `draft` was handed over, unless a newer one went out since. */
  function failed(draft: MemoryDraft) {
    MutableRef.update(state, (current) => ({
      ...current,
      adding: false,
      sent: Option.filter(current.sent, (sent) => sent !== draft),
    }));
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
      send.edit(id, wanted, { failed: () => failed(wanted) });
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
      failed: () => failed(wanted),
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
