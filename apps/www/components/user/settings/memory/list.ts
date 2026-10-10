import { Id } from "@repo/backend/confect/_generated/id";
import type { NinaMemoryList } from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, Option, Schema, String as Str, Struct } from "effect";

/** What the Memory page lists: every memory, newest first, and whether memory is paused. */
export type MemoryList = typeof NinaMemoryList.Type;

/** One memory on the Memory page. */
export type Memory = MemoryList["memories"][number];

/**
 * What the editor holds of one memory: its title and its words, as the learner
 * typed them. An empty title means the memory has none.
 */
export type MemoryDraft = Required<Pick<Memory, "text" | "title">>;

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

/** The title and the words of a memory, or none of either for a new one. */
export function draftOf(memory: Memory | undefined): MemoryDraft {
  return { text: memory?.text ?? "", title: memory?.title ?? "" };
}

/** Whether nothing is written. A memory needs a title or words. */
export function isBlank(draft: MemoryDraft) {
  return (
    Str.isEmpty(Str.trim(draft.title)) && Str.isEmpty(Str.trim(draft.text))
  );
}

/** Whether two drafts say the same once the space around them is gone. */
export function sameDraft(one: MemoryDraft, other: MemoryDraft) {
  return (
    Str.trim(one.title) === Str.trim(other.title) &&
    Str.trim(one.text) === Str.trim(other.text)
  );
}

/**
 * What the server takes for a draft: the words without the space around them,
 * and a title only when one is written.
 */
export function draftArgs(draft: MemoryDraft) {
  const title = Str.trim(draft.title);

  return {
    text: Str.trim(draft.text),
    ...(Str.isEmpty(title) ? {} : { title }),
  };
}

/**
 * Builds the memory the page shows for what the learner just wrote, until the
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
    ...draftArgs(draft),
  };
}

/** Puts a new memory first, where the newest one belongs. */
export function addMemory(list: MemoryList, memory: Memory): MemoryList {
  return { ...list, memories: Arr.prepend(list.memories, memory) };
}

/**
 * Rewrites one memory the way the server does: it takes the draft's title and
 * words, the learner becomes its author, and its confirmation moves to `now`,
 * which puts it first. A memory the list does not hold leaves it unchanged.
 */
export function editMemory(
  list: MemoryList,
  id: Memory["id"],
  draft: MemoryDraft,
  now: number
): MemoryList {
  const found = Arr.findFirst(list.memories, (memory) => memory.id === id);

  if (Option.isNone(found)) {
    return list;
  }

  const edited: Memory = {
    ...Struct.omit(found.value, ["title"]),
    author: "learner",
    confirmedAt: now,
    ...draftArgs(draft),
  };

  return {
    ...list,
    memories: Arr.prepend(
      Arr.filter(list.memories, (memory) => memory.id !== id),
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
/** A line that only opens or closes a code block, or draws a divider. */
const BLOCK_MARK = /^\s*(?:```.*|-{3,}|\*{3,})\s*$/u;
/** What starts a task, a list item, a heading or a quote at the beginning of a line. */
const LINE_MARK = /^\s*(?:[-*+]\s+\[[ xX]\]|[-*+]|\d+[.)]|#{1,6}|>)\s+/u;
/** A link: its words stay and its address leaves. */
const LINK = /\[([^\]]*)\]\([^)]*\)/gu;
/** The marks around bold, italic, underlined, struck, highlighted and code text. */
const TEXT_MARK =
  /\*\*|~~|\+\+|==|`|(?<![\\\p{L}\p{N}])\*(?=\S)|(?<=\S)(?<!\\)\*(?![\p{L}\p{N}])/gu;
const WHITESPACE = /\s+/gu;

/** Reads one line of Markdown as plain words. */
function plainLine(line: string) {
  if (BLOCK_MARK.test(line)) {
    return "";
  }

  return Str.replaceAll(
    ESCAPE,
    ""
  )(
    Str.replaceAll(
      TEXT_MARK,
      ""
    )(Str.replaceAll(LINK, "$1")(Str.replace(LINE_MARK, "")(line)))
  );
}

/**
 * Reads a memory's Markdown as one line of plain words, for the list and for
 * the search. Formatting marks leave and every line joins the one before it.
 */
export function previewText(markdown: string) {
  return Str.trim(
    Str.replaceAll(
      WHITESPACE,
      " "
    )(Arr.join(Arr.map(Str.split(markdown, "\n"), plainLine), " "))
  );
}

/** What the list calls a memory: its title, or its words when it has none. */
export function memoryName(memory: Memory) {
  return memory.title ?? previewText(memory.text);
}

/**
 * Returns the memories the page shows, in list order. The search ignores case
 * and looks at the title of each memory and at its words without their
 * formatting.
 */
export function shownMemories(list: MemoryList, query: string) {
  const needle = Str.toLowerCase(Str.trim(query));

  return Arr.filter(
    list.memories,
    (memory) =>
      Str.isEmpty(needle) ||
      Str.includes(needle)(
        Str.toLowerCase(`${memory.title ?? ""} ${previewText(memory.text)}`)
      )
  );
}
