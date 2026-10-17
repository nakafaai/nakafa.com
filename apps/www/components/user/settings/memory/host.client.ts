"use client";

import { editorFrame } from "@repo/design-system/components/editor/frame";
import { useCallback, useRef, useState } from "react";

/**
 * The element the open editor lives in, one for the whole life of the page. The
 * server has no page to hold it, so it creates none.
 */
export function createHost() {
  if (typeof document === "undefined") {
    return null;
  }

  const host = document.createElement("div");
  host.className = editorFrame();

  return host;
}

/** Where the caret was in the editor that is about to move, to put it back. */
interface Caret {
  active: HTMLElement;
  anchorNode: Node | null;
  anchorOffset: number;
  focusNode: Node | null;
  focusOffset: number;
}

/** Notes the focus and the selection when they are inside `host`, or nothing. */
function keepCaret(host: HTMLElement): Caret | null {
  const { activeElement } = document;
  if (!(activeElement instanceof HTMLElement && host.contains(activeElement))) {
    return null;
  }

  const selection = document.getSelection();

  return {
    active: activeElement,
    anchorNode: selection?.anchorNode ?? null,
    anchorOffset: selection?.anchorOffset ?? 0,
    focusNode: selection?.focusNode ?? null,
    focusOffset: selection?.focusOffset ?? 0,
  };
}

/** Puts back the selection and the focus that `keepCaret` noted. */
function restoreCaret(caret: Caret) {
  if (caret.anchorNode && caret.focusNode) {
    document
      .getSelection()
      ?.setBaseAndExtent(
        caret.anchorNode,
        caret.anchorOffset,
        caret.focusNode,
        caret.focusOffset
      );
  }
  caret.active.focus({ preventScroll: true });
}

/**
 * Gives the editor one element to live in, whichever layout shows it. The
 * element moves into the place of the layout that is on: the panel or the
 * sheet. React never unmounts the editor when the layout changes, so the words,
 * the title, the undo history and the saving stay, and the caret is put back
 * where it was when the editor had it.
 *
 * `place` is the ref of the element each layout offers. `slot` is that element,
 * or none while no layout holds the editor. A layout runs `remember` when it
 * goes, before any of its elements leaves the page, because the sheet's own
 * code takes its elements out first and the focus is gone by the time its ref
 * lets go.
 */
export function useEditorHost(host: HTMLElement) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const caret = useRef<Caret | null>(null);

  const place = useCallback(
    (element: HTMLElement | null) => {
      if (element === null) {
        setSlot(null);
        return;
      }

      const kept = caret.current;

      caret.current = null;
      setSlot(element);
      element.append(host);
      if (kept && host.contains(kept.active)) {
        restoreCaret(kept);
      }
    },
    [host]
  );

  const remember = useCallback(() => {
    caret.current = keepCaret(host);
  }, [host]);

  return { place, remember, slot };
}
