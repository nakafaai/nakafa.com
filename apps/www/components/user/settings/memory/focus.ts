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
 * Moves the focus from the Undo button to the search field when the learner
 * presses Undo. The toast of the Undo leaves the page at the press, and while the
 * focus is in the toast, the toast's region gives the focus back to the element it
 * had before the toast as soon as the focus leaves the toast. An editor that a
 * failed Undo opens would lose its focus that way, so the press moves the focus
 * out of the toast first.
 */
export function focusSearchOnUndo() {
  focusFirst([document.getElementById(MEMORY_SEARCH_ID)]);
}
