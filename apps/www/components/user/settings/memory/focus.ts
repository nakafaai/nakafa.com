import { Array as Arr, Option } from "effect";
import type { Memory } from "@/components/user/settings/memory/list";

/**
 * Where the focus goes when the learner's own action takes away the element that
 * had it. After a confirmed delete it goes to the row of the memory that took the
 * deleted one's place, the next memory on the page or else the one before it, and
 * to the Add memory button when no memory is left. Closing the editor without a
 * delete gives it back to the row that opened the editor, or to the Add memory
 * button for a new memory.
 */

/** The search field above the list, which stays on the page whatever the list holds. */
export const MEMORY_SEARCH_ID = "user-settings-memory-search";
/** The button that opens the editor on a new memory. */
export const MEMORY_ADD_ID = "user-settings-memory-add";
/** The list of memories, while it holds any. */
export const MEMORY_LIST_ID = "user-settings-memory-list";

/** The id of the button that names one memory's row and opens it in the editor. */
export function memoryRowId(id: Memory["id"]) {
  return `user-settings-memory-row-${id}`;
}

/** The neighbour of a memory when the list holds no other memory to name. */
export const NO_NEIGHBOUR: Option.Option<Memory["id"]> = Option.none();

/** The id of the memory at `index` in the list, or none when the list has no memory there. */
function idAt(memories: readonly Memory[], index: number) {
  return Option.map(Arr.get(memories, index), (memory) => memory.id);
}

/**
 * The memory that comes after `id` in the list, or the one before it when `id` is
 * the last. None when no other memory is left, or when `id` is not in the list.
 */
export function memoryNeighbour(
  memories: readonly Memory[],
  id: Memory["id"]
): Option.Option<Memory["id"]> {
  return Option.flatMap(
    Arr.findFirstIndex(memories, (memory) => memory.id === id),
    (index) =>
      Option.orElse(idAt(memories, index + 1), () => idAt(memories, index - 1))
  );
}

/**
 * The element that takes the focus after a confirmed delete: the row of the
 * neighbour when it is on the page, else the Add memory button.
 */
export function focusAfterDelete(neighbour: Option.Option<Memory["id"]>) {
  return Option.getOrElse(
    Option.flatMap(neighbour, (id) =>
      Option.fromNullishOr(document.getElementById(memoryRowId(id)))
    ),
    () => document.getElementById(MEMORY_ADD_ID)
  );
}

/**
 * Gives the focus to the first candidate that can take it. A candidate that is
 * missing from the page or disabled is skipped, so the focus lands on the next.
 */
export function focusFirst(candidates: readonly (HTMLElement | null)[]) {
  for (const candidate of candidates) {
    candidate?.focus({ preventScroll: true });
    if (candidate && document.activeElement === candidate) {
      return;
    }
  }
}
