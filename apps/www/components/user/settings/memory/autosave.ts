import { MutableRef } from "effect";
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
 * One write is on its way at a time, so a new memory is stored once and every
 * later write rewrites it. Nothing is written for a draft that says nothing,
 * for one the server already took, or after the learner deleted the memory. A
 * write that failed is tried again with the next one.
 */
export function createAutosave(
  memory: Memory | undefined,
  starting: MemoryDraft
) {
  const state = MutableRef.make({
    /** A write is on its way. */
    busy: false,
    /** The stored memory, once there is one. */
    id: memory?.id ?? null,
    /** What the server last took. */
    saved: draftOf(memory),
    /** The learner deleted the memory. */
    stopped: false,
    /** What the editor holds. */
    wanted: starting,
  });

  /** Marks the write as over, so the next one can go out. */
  function failed() {
    MutableRef.update(state, (current) => ({ ...current, busy: false }));
  }

  /** Sends what the server does not have yet, and again until it has it all. */
  function write(send: Send) {
    const { busy, id, saved, stopped, wanted } = MutableRef.get(state);

    if (busy || stopped || isBlank(wanted) || sameDraft(wanted, saved)) {
      return;
    }

    MutableRef.update(state, (current) => ({ ...current, busy: true }));

    if (id !== null) {
      send.edit(id, wanted, {
        done: () => {
          MutableRef.update(state, (current) => ({
            ...current,
            busy: false,
            saved: wanted,
          }));
          write(send);
        },
        failed,
      });
      return;
    }

    send.add(wanted, {
      done: (stored) => {
        MutableRef.update(state, (current) => ({
          ...current,
          busy: false,
          id: stored,
          saved: wanted,
        }));

        // The learner deleted the memory while the server was storing it.
        if (MutableRef.get(state).stopped) {
          send.drop(stored);
          return;
        }

        send.adopt(stored);
        write(send);
      },
      failed,
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
