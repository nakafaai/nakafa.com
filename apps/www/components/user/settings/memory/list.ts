import type { Ref } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import type nina from "@repo/backend/confect/_generated/refs/nina";
import {
  MEMORY_PAGE_LIMIT,
  type NinaMemoryView,
} from "@repo/backend/confect/nina/memory.spec";
import { plainText } from "@repo/design-system/components/editor/plain";
import { Array as Arr, Option, Schema, String as Str, Struct } from "effect";

/**
 * How many memories one page of the list holds. The settings route reads the
 * first page with it, and the page asks for each next page with it.
 */
export const MEMORY_PAGE = 30;

/**
 * How many memories the page asks for at a time while the learner searches.
 * The server caps a page at `MEMORY_PAGE_LIMIT`, so this is the most that one
 * request brings. A search waits until every memory is loaded, so the fewer the
 * requests, the sooner it is complete.
 */
export const MEMORY_FILL = MEMORY_PAGE_LIMIT;

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
export function draftOf(memory: Memory | null): MemoryDraft {
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
 * Takes out the memories whose ids are in `hidden`: the memories the learner
 * deleted before the server stored them. Every other memory stays, in order.
 */
export function withoutHidden(
  memories: readonly Memory[],
  hidden: readonly Memory["id"][]
) {
  return Arr.filter(memories, (memory) => !Arr.contains(hidden, memory.id));
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

/**
 * Returns one loaded page of the list after every memory is deleted: empty, and
 * the end of the list. The server answers the same once the learner asked to
 * delete everything, so the pages keep what the learner sees.
 */
export function pageCleared(page: MemoryPage): MemoryPage {
  if (page.isDone && Arr.isReadonlyArrayEmpty(page.page)) {
    return page;
  }

  return { ...page, isDone: true, page: [] };
}

/**
 * What each memory's words say as the editor shows them, read once for each
 * memory object the page holds. Reading them lexes the Markdown, a row asks for
 * them each time it renders, and the search asks for every memory on every
 * key. A changed memory is a new object.
 */
const WORDS = new WeakMap<Memory, string>();

function wordsOf(memory: Memory) {
  const known = WORDS.get(memory);

  if (known !== undefined) {
    return known;
  }

  const words = plainText(memory.text);

  WORDS.set(memory, words);

  return words;
}

/**
 * What the list calls a memory: its title, or its words as the editor shows
 * them when it has no title. It is empty for words that show nothing, such as
 * a divider alone, and the row says Untitled then.
 */
export function memoryName(memory: Memory) {
  return memory.title ?? wordsOf(memory);
}

/**
 * What the search reads of each memory: its title and its words as the editor
 * shows them, in lower case. It is done once for each memory object the page
 * holds, because joining and lowering thousands of words on every key would
 * take longer than the key, and a changed memory is a new object.
 */
const HAYSTACKS = new WeakMap<Memory, string>();

function haystackOf(memory: Memory) {
  const known = HAYSTACKS.get(memory);

  if (known !== undefined) {
    return known;
  }

  const haystack = Str.toLowerCase(`${memory.title ?? ""} ${wordsOf(memory)}`);

  HAYSTACKS.set(memory, haystack);

  return haystack;
}

/** Whether the learner typed something to search for, and not only space. */
export function isSearching(query: string) {
  return !Str.isEmpty(Str.trim(query));
}

/**
 * Returns the memories the browser holds that match the search, in list order.
 * The search ignores case and looks at the title of each memory and at its
 * words without their formatting, in any part of a word. A blank search matches
 * every memory.
 */
export function shownMemories(memories: readonly Memory[], query: string) {
  if (!isSearching(query)) {
    return memories;
  }

  const needle = Str.toLowerCase(Str.trim(query));

  return Arr.filter(memories, (memory) =>
    Str.includes(needle)(haystackOf(memory))
  );
}
