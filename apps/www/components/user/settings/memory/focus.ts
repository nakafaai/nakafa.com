import type { Memory } from "@/components/user/settings/memory/list";

/**
 * The elements of the Memory page that take the focus when the learner's own
 * action takes away the element that had it. The search field sits above the
 * list and stays on the page whatever the list holds, so it is the last stop.
 */
export const MEMORY_SEARCH_ID = "user-settings-memory-search";
/** The button that opens the editor on a new memory. */
export const MEMORY_ADD_ID = "user-settings-memory-add";
/** The list of memories, while it holds any. */
export const MEMORY_LIST_ID = "user-settings-memory-list";

/** The id of the button that names one memory's row and opens it in the editor. */
export function memoryRowId(id: Memory["id"]) {
  return `user-settings-memory-row-${id}`;
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

/**
 * Whether the focus has gone nowhere the learner chose: to the body, or into
 * `box`, which is leaving the page with it.
 */
export function focusIsLost(box: Element) {
  const active = document.activeElement;
  return active === null || active === document.body || box.contains(active);
}
