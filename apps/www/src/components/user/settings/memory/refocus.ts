import { elementById } from "@repo/design-system/lib/element";
import { focusIsLost } from "@repo/design-system/lib/focus";
import { Option } from "effect";
import { useLayoutEffect, useRef } from "react";
import {
  focusFirst,
  MEMORY_ADD_ID,
  memoryRowId,
  NO_NEIGHBOUR,
} from "@/components/user/settings/memory/focus";
import type { Memory } from "@/components/user/settings/memory/list";

/**
 * Gives the focus back when the learner closes the editor while the focus is in
 * it. The editor leaves the page with the focus, so it would fall to the body.
 * The focus goes to the row that opened the editor, or to the Add memory button
 * for a new memory, and to the Add memory button when that row has left the page.
 * A delete from the editor closes it with its question, which leaves with the
 * focus too, so the editor hands the focus to the memory that took the deleted
 * one's place: the returned function names it before the delete.
 * A sheet may already have returned the focus itself, which this leaves alone.
 * `opener` is the memory the opening began with, or none for a new memory.
 */
export function useFocusAfterClose(
  open: boolean,
  opener: Memory["id"] | null,
  host: HTMLElement
) {
  const wasOpen = useRef(false);
  const neighbour = useRef(NO_NEIGHBOUR);

  useLayoutEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) {
      return;
    }
    wasOpen.current = false;
    const deleted = neighbour.current;
    neighbour.current = NO_NEIGHBOUR;
    if (!focusIsLost(host)) {
      return;
    }
    focusFirst([
      Option.getOrNull(
        Option.map(deleted, (id) => elementById(memoryRowId(id)))
      ),
      opener ? elementById(memoryRowId(opener)) : null,
      elementById(MEMORY_ADD_ID),
    ]);
  }, [host, opener, open]);

  return (next: Option.Option<Memory["id"]>) => {
    neighbour.current = next;
  };
}
