"use client";

import { focusIsLost } from "@repo/design-system/lib/focus";
import { useLayoutEffect, useRef } from "react";
import {
  focusFirst,
  MEMORY_ADD_ID,
  MEMORY_LIST_ID,
  MEMORY_SEARCH_ID,
  memoryRowId,
} from "@/components/user/settings/memory/focus";
import type { Memory } from "@/components/user/settings/memory/list";

/**
 * Gives the focus back when the learner closes the editor while the focus is in
 * it. The editor leaves the page with the focus, so it would fall to the body.
 * The focus goes to the row or the button that opened the editor, then to the
 * list, and to the search field when the list has left the page too. A sheet
 * may already have returned the focus itself, which this leaves alone. `opener`
 * is the memory the opening began with, or none for a new memory.
 */
export function useFocusAfterClose(
  open: boolean,
  opener: Memory["id"] | null,
  host: HTMLElement
) {
  const wasOpen = useRef(false);

  useLayoutEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) {
      return;
    }
    wasOpen.current = false;
    if (!focusIsLost(host)) {
      return;
    }
    focusFirst([
      document.getElementById(opener ? memoryRowId(opener) : MEMORY_ADD_ID),
      document.getElementById(MEMORY_LIST_ID),
      document.getElementById(MEMORY_SEARCH_ID),
    ]);
  }, [host, opener, open]);
}
