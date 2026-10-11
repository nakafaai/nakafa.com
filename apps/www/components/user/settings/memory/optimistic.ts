import type * as OptimisticLocalStore from "@confect/react/OptimisticLocalStore";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { Array as Arr, Option } from "effect";
import {
  editedMemory,
  findMemory,
  type Memory,
  type MemoryDraft,
  type MemoryPage,
  pageCleared,
  pageWith,
  pageWithout,
  removeMemory,
  replaceMemory,
} from "@/components/user/settings/memory/list";

type Store = OptimisticLocalStore.OptimisticLocalStore;

/**
 * Changes the pages of the list that the browser holds, one query for each
 * loaded page. `change` gets a page and whether it starts the list. A page it
 * hands back as it is gets no write, because a write encodes the whole page
 * and wakes everything that reads the list.
 */
function changePages(
  store: Store,
  change: (page: MemoryPage, first: boolean) => MemoryPage
) {
  for (const { args, value } of store.getAllQueries(nina.memory.list)) {
    if (Option.isNone(value)) {
      continue;
    }
    const next = change(value.value, args.paginationOpts.cursor === null);
    if (next !== value.value) {
      store.setQuery(nina.memory.list, args, Option.some(next));
    }
  }
}

/** Changes every answer of the search that the browser holds. */
function changeAnswers(
  store: Store,
  change: (answer: readonly Memory[]) => Memory[]
) {
  for (const { args, value } of store.getAllQueries(nina.memory.search)) {
    if (Option.isSome(value)) {
      store.setQuery(
        nina.memory.search,
        args,
        Option.some(change(value.value))
      );
    }
  }
}

/** Every memory in the pages and in the search answers that the browser holds, the pages first. */
function heldMemories(store: Store) {
  return Arr.appendAll(
    Arr.flatMap(store.getAllQueries(nina.memory.list), ({ value }) =>
      Option.isSome(value) ? value.value.page : []
    ),
    Arr.flatMap(store.getAllQueries(nina.memory.search), ({ value }) =>
      Option.isSome(value) ? value.value : []
    )
  );
}

/** Shows a memory the learner just wrote first on the first page. */
export function addToList(store: Store, memory: Memory) {
  changePages(store, (page, first) => pageWith(page, first, memory));
}

/**
 * Shows a rewritten memory the way the server will: it leaves the page it is
 * on and goes first on the first page, and a search answer that holds it gets
 * the new title and words where it stands. A memory the browser does not hold
 * is left to the server.
 */
export function editInList(
  store: Store,
  id: Memory["id"],
  draft: MemoryDraft,
  now: number
) {
  const found = findMemory(heldMemories(store), id);

  if (Option.isNone(found)) {
    return;
  }

  const edited = editedMemory(found.value, draft, now);

  changePages(store, (page, first) => pageWith(page, first, edited));
  changeAnswers(store, (answer) => replaceMemory(answer, edited));
}

/** Takes a memory out of every page and every search answer that holds it. */
export function removeFromList(store: Store, id: Memory["id"]) {
  changePages(store, (page) => pageWithout(page, id));
  changeAnswers(store, (answer) => removeMemory(answer, id));
}

/** Empties every page and every search answer. The server deletes in batches and the live pages follow. */
export function clearList(store: Store) {
  changePages(store, pageCleared);
  changeAnswers(store, () => []);
}

/** Sets whether memory is paused, when the browser holds the state. */
export function pauseState(store: Store, paused: boolean) {
  const current = store.getQuery(nina.memory.state, {});

  if (Option.isSome(current) && current.value !== null) {
    store.setQuery(nina.memory.state, {}, Option.some({ paused }));
  }
}
