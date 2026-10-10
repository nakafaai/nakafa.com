import { Id } from "@repo/backend/confect/_generated/id";
import type { NinaMemoryList } from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, Option, Schema, String as Str, Struct } from "effect";

/** What the Memory page lists: every memory, newest first, and whether memory is paused. */
export type MemoryList = typeof NinaMemoryList.Type;

/** One memory on the Memory page. */
export type Memory = MemoryList["memories"][number];

/** What the learner writes for one memory. */
export type MemoryDraft = Pick<Memory, "kind" | "text">;

/**
 * Starts the id of a memory the server has not stored yet. A stored id never
 * holds a hyphen, so the two cannot be confused.
 */
const PENDING_PREFIX = "pending-";

/** Returns the id a new memory carries until the server answers with its own. */
export function pendingId(token: string) {
  return Schema.decodeUnknownSync(Id("ninaMemories"))(
    `${PENDING_PREFIX}${token}`
  );
}

/** Whether the server has not stored the memory yet, so it cannot change. */
export function isPending(memory: Memory) {
  return Str.startsWith(PENDING_PREFIX)(memory.id);
}

/**
 * Builds the memory the page shows for text the learner just wrote, until the
 * server answers with the stored one. A memory the learner wrote leads the
 * next prompt, so it is in use.
 */
export function learnerMemory(
  draft: MemoryDraft,
  id: Memory["id"],
  now: number
): Memory {
  return {
    author: "learner",
    confirmedAt: now,
    createdAt: now,
    id,
    inUse: true,
    kind: draft.kind,
    sources: 0,
    text: draft.text,
  };
}

/** Puts a new memory first, where the newest one belongs. */
export function addMemory(list: MemoryList, memory: Memory): MemoryList {
  return { ...list, memories: Arr.prepend(list.memories, memory) };
}

/**
 * Rewrites one memory the way the server does: the learner becomes its author,
 * its confirmation moves to `now`, which puts it first, and only a situation
 * keeps the day it ends. A memory the list does not hold leaves it unchanged.
 */
export function editMemory(
  list: MemoryList,
  edit: MemoryDraft & Pick<Memory, "id">,
  now: number
): MemoryList {
  const found = Arr.findFirst(list.memories, ({ id }) => id === edit.id);

  if (Option.isNone(found)) {
    return list;
  }

  const kept =
    edit.kind === "situation"
      ? found.value
      : Struct.omit(found.value, ["validUntil"]);
  const edited: Memory = {
    ...kept,
    author: "learner",
    confirmedAt: now,
    kind: edit.kind,
    text: edit.text,
  };

  return {
    ...list,
    memories: Arr.prepend(
      Arr.filter(list.memories, ({ id }) => id !== edit.id),
      edited
    ),
  };
}

/** Takes one memory out of the list. */
export function removeMemory(list: MemoryList, id: Memory["id"]): MemoryList {
  return {
    ...list,
    memories: Arr.filter(list.memories, (memory) => memory.id !== id),
  };
}

/** Takes every memory out of the list. Pausing stays as it was. */
export function clearMemories(list: MemoryList): MemoryList {
  return { ...list, memories: [] };
}

/** Sets whether memory is paused. */
export function pauseMemories(list: MemoryList, paused: boolean): MemoryList {
  return { ...list, paused };
}

/** How the learner narrows the list. */
interface MemoryView {
  /** The name the learner reads for a kind of memory. */
  label: (kind: Memory["kind"]) => string;
  /** The words the learner typed to search. */
  query: string;
  /** Memories that wait for an Undo and must not show. */
  removed: readonly Memory["id"][];
}

/**
 * Returns the memories the page shows, in list order. The search ignores case
 * and looks at the text and at the name of the kind. While memory is paused
 * Nina reads none of them, so none shows as in use, which also covers the
 * moment between the press on the switch and the answer of the server.
 */
export function shownMemories(list: MemoryList, view: MemoryView) {
  const needle = Str.toLowerCase(Str.trim(view.query));

  return Arr.map(
    Arr.filter(
      list.memories,
      (memory) =>
        !Arr.contains(view.removed, memory.id) &&
        (Str.isEmpty(needle) ||
          Arr.some([memory.text, view.label(memory.kind)], (words) =>
            Str.includes(needle)(Str.toLowerCase(words))
          ))
    ),
    (memory) => (list.paused ? { ...memory, inUse: false } : memory)
  );
}
