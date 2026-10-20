import { focusIsLost } from "@repo/design-system/lib/focus";
import { useLayoutEffect, useRef } from "react";
import {
  focusFirst,
  MEMORY_ADD_ID,
  memoryRowId,
} from "@/components/user/settings/memory/focus";
import type { Memory } from "@/components/user/settings/memory/list";

/**
 * Gives the focus back when the learner closes the editor while the focus is in
 * it. The editor leaves the page with the focus, so it would fall to the body.
 * The focus goes to the row that opened the editor, or to the Add memory button
 * for a new memory, and to the Add memory button when that row has left the page.
 * A sheet may already have returned the focus itself, which this leaves alone.
 * `opener` is the memory the opening began with, or none for a new memory.
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
      opener ? document.getElementById(memoryRowId(opener)) : null,
      document.getElementById(MEMORY_ADD_ID),
    ]);
  }, [host, opener, open]);
}
