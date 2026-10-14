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
  pageForRestored,
  pageRestored,
  pageWith,
  pageWithout,
} from "@/components/user/settings/memory/list";

type Store = OptimisticLocalStore.OptimisticLocalStore;

/**
 * Changes the pages of the list that the browser holds, one query for each
 * loaded page. `change` gets a page and whether it starts the list. A page it
 * hands back as it is gets no write, because a write encodes the whole page
 * and wakes everything that reads the list. A page that is still loading has
 * no value to change.
 *
 * Convex applies the change to the queries it has subscribed, so a change made
 * before the live list is subscribed and has answered shows when it answers,
 * not before.
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

/** Every page of the list that the browser holds, with the arguments it was asked with. */
function heldPages(store: Store) {
  return Arr.flatMap(
    store.getAllQueries(nina.memory.list),
    ({ args, value }) =>
      Option.isSome(value) ? [{ args, page: value.value }] : []
  );
}

/** Every memory in the pages that the browser holds. */
function heldMemories(store: Store) {
  return Arr.flatMap(heldPages(store), ({ page }) => page.page);
}

/** Shows a memory the learner just wrote first on the first page. */
export function addToList(store: Store, memory: Memory) {
  changePages(store, (page, first) => pageWith(page, first, memory));
}

/**
 * Shows a rewritten memory the way the server will: it leaves the page it is
 * on and goes first on the first page. A memory on no page the browser holds is
 * left to the server.
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
}

/** Takes a memory out of every page that holds it. */
export function removeFromList(store: Store, id: Memory["id"]) {
  changePages(store, (page) => pageWithout(page, id));
}

/**
 * Shows a memory that comes back where it was, as the server will: in the one
 * page that holds its place, between the memories confirmed before and after
 * it. A memory whose place is beyond the pages the browser holds is left to
 * the server. Only that page is written.
 */
export function restoreInList(store: Store, memory: Memory) {
  const held = heldPages(store);
  const target = Option.flatMap(
    pageForRestored(
      Arr.map(held, ({ page }) => page),
      memory
    ),
    (index) => Arr.get(held, index)
  );

  if (Option.isNone(target)) {
    return;
  }

  store.setQuery(
    nina.memory.list,
    target.value.args,
    Option.some(pageRestored(target.value.page, memory))
  );
}

/**
 * Empties every page and ends the list. The server answers the same from the
 * moment the learner asks, and deletes the memories in batches after that.
 */
export function clearList(store: Store) {
  changePages(store, pageCleared);
}

/** Sets whether memory is paused, when the browser holds the state. */
export function pauseState(store: Store, paused: boolean) {
  const current = store.getQuery(nina.memory.state, {});

  if (Option.isSome(current) && current.value !== null) {
    store.setQuery(nina.memory.state, {}, Option.some({ paused }));
  }
}
