import type { Ref } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import type nina from "@repo/backend/confect/_generated/refs/nina";
import {
  MEMORY_QUERY_LIMIT,
  type NinaMemoryView,
} from "@repo/backend/confect/nina/memory.spec";
import {
  Array as Arr,
  HashSet,
  Option,
  Schema,
  String as Str,
  Struct,
} from "effect";

/**
 * How many memories one page of the list holds. The settings route reads the
 * first page with it, and the page asks for each next page with it.
 */
export const MEMORY_PAGE = 30;

/** One page of the list as the server answers it: its memories and whether it is the last. */
export type MemoryPage = Ref.Returns<typeof nina.memory.list>;

/** One memory on the Memory page. */
export type Memory = typeof NinaMemoryView.Type;

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
 * server answers with the stored one.
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
    ...draftArgs(draft),
  };
}

/**
 * Rewrites one memory the way the server does: it takes the draft's title and
 * words, the learner becomes its author, and its confirmation moves to `now`.
 * A draft without a title takes the title off.
 */
export function editedMemory(
  memory: Memory,
  draft: MemoryDraft,
  now: number
): Memory {
  return {
    ...Struct.omit(memory, ["title"]),
    author: "learner",
    confirmedAt: now,
    ...draftArgs(draft),
  };
}

/** Finds a memory by its id. */
export function findMemory(memories: readonly Memory[], id: Memory["id"]) {
  return Arr.findFirst(memories, (memory) => memory.id === id);
}

/** Takes one memory out of a list of memories. */
export function removeMemory(memories: readonly Memory[], id: Memory["id"]) {
  return Arr.filter(memories, (memory) => memory.id !== id);
}

/**
 * Swaps a memory for its rewritten self where it stands, so the answer of a
 * search keeps its order.
 */
export function replaceMemory(memories: readonly Memory[], memory: Memory) {
  return Arr.map(memories, (current) =>
    current.id === memory.id ? memory : current
  );
}

/**
 * Returns one loaded page of the list after `memory` was confirmed just now,
 * the way the server will show it: the page that starts the list holds the
 * memory first, and no other page holds it. A page that has nothing to do with
 * the memory is returned as it is.
 */
export function pageWith(
  page: MemoryPage,
  first: boolean,
  memory: Memory
): MemoryPage {
  if (!first && Option.isNone(findMemory(page.page, memory.id))) {
    return page;
  }

  const others = removeMemory(page.page, memory.id);

  return { ...page, page: first ? Arr.prepend(others, memory) : others };
}

/** Returns one loaded page of the list without a memory, or as it is when it does not hold it. */
export function pageWithout(page: MemoryPage, id: Memory["id"]): MemoryPage {
  if (Option.isNone(findMemory(page.page, id))) {
    return page;
  }

  return { ...page, page: removeMemory(page.page, id) };
}

/** Returns one loaded page of the list after every memory is deleted: empty, and the end of the list. */
export function pageCleared(page: MemoryPage): MemoryPage {
  return { ...page, isDone: true, page: [] };
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
 * Returns the memories the browser holds that match the search, in list order.
 * The search ignores case and looks at the title of each memory and at its
 * words without their formatting.
 */
export function shownMemories(memories: readonly Memory[], query: string) {
  const needle = Str.toLowerCase(Str.trim(query));

  return Arr.filter(
    memories,
    (memory) =>
      Str.isEmpty(needle) ||
      Str.includes(needle)(
        Str.toLowerCase(`${memory.title ?? ""} ${previewText(memory.text)}`)
      )
  );
}

/**
 * Lists what a search finds from two sources. The memories the browser holds
 * that match come first, in list order, because they match any part of a word.
 * The memories the server found follow, in its order, when they are not shown
 * yet: the server reaches the pages the browser has not loaded, and it matches
 * whole words only, so it adds to the browser's matches and never replaces
 * them.
 */
export function listedMemories(
  memories: readonly Memory[],
  query: string,
  found: readonly Memory[]
) {
  const matches = shownMemories(memories, query);
  const listed = HashSet.fromIterable(Arr.map(matches, ({ id }) => id));

  return Arr.appendAll(
    matches,
    Arr.filter(found, ({ id }) => !HashSet.has(listed, id))
  );
}

/**
 * Cuts what the learner typed to what the server's search takes: without the
 * space around it, and at most `MEMORY_QUERY_LIMIT` characters.
 */
export function searchText(text: string) {
  return Str.trim(Str.takeLeft(Str.trim(text), MEMORY_QUERY_LIMIT));
}
