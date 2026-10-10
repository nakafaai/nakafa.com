import { Id } from "@repo/backend/confect/_generated/id";
import {
  MEMORY_TEXT_LIMIT,
  type NinaMemoryList,
} from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, Option, Schema, String as Str } from "effect";

/** What the Memory page lists: every memory, newest first, and whether memory is paused. */
export type MemoryList = typeof NinaMemoryList.Type;

/** One memory on the Memory page. */
export type Memory = MemoryList["memories"][number];

/** What the learner writes for one memory. */
export type MemoryDraft = Pick<Memory, "text">;

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
    sources: 0,
    text: draft.text,
  };
}

/** Puts a new memory first, where the newest one belongs. */
export function addMemory(list: MemoryList, memory: Memory): MemoryList {
  return { ...list, memories: Arr.prepend(list.memories, memory) };
}

/**
 * Rewrites one memory the way the server does: the learner becomes its author
 * and its confirmation moves to `now`, which puts it first. A memory the list
 * does not hold leaves it unchanged.
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

  const edited: Memory = {
    ...found.value,
    author: "learner",
    confirmedAt: now,
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

/** A backslash that the Markdown writer put before a character it would otherwise read as formatting. */
const ESCAPE = /\\(?=[!-/:-@[-`{-~])/gu;
/** What starts a list item, a heading or a quote at the beginning of a line. */
const LINE_MARK = /^\s*(?:[-*+]|\d+[.)]|#{1,6}|>)\s+/u;
/** The marks around bold, italic, struck and code text. */
const TEXT_MARK =
  /\*\*|~~|`|(?<![\\\p{L}\p{N}])\*(?=\S)|(?<=\S)(?<!\\)\*(?![\p{L}\p{N}])/gu;
const WHITESPACE = /\s+/gu;

/**
 * Reads a memory's Markdown as one line of plain words, for the list and for
 * the search. Formatting marks leave and every line joins the one before it.
 */
export function previewText(markdown: string) {
  return Str.trim(
    Str.replaceAll(
      WHITESPACE,
      " "
    )(
      Arr.join(
        Arr.map(Str.split(markdown, "\n"), (line) =>
          Str.replaceAll(
            ESCAPE,
            ""
          )(Str.replaceAll(TEXT_MARK, "")(Str.replace(LINE_MARK, "")(line)))
        ),
        " "
      )
    )
  );
}

/** Whether words are fit to keep: something is written, and it fits. */
export function canSave(text: string) {
  const words = Str.trim(text);
  return Str.isNonEmpty(words) && Str.length(words) <= MEMORY_TEXT_LIMIT;
}

/**
 * Returns the memories the page shows, in list order. The search ignores case
 * and looks at the words of each memory without their formatting.
 */
export function shownMemories(list: MemoryList, query: string) {
  const needle = Str.toLowerCase(Str.trim(query));

  return Arr.filter(
    list.memories,
    (memory) =>
      Str.isEmpty(needle) ||
      Str.includes(needle)(Str.toLowerCase(previewText(memory.text)))
  );
}
