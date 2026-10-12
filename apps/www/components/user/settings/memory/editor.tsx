"use client";

import { useMediaQuery } from "@mantine/hooks";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { useResizable } from "@repo/design-system/hooks/use-resizable";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { MemoryDocument } from "@/components/user/settings/memory/document";
import type { Memory } from "@/components/user/settings/memory/list";
import { useMemoryPage } from "@/components/user/settings/memory/provider";
import { SETTINGS_PANEL_ID } from "@/components/user/settings/panel";

/** From this width on, the editor is a panel beside the page. Below it, a sheet. */
const WIDE = "(min-width: 64rem)";
/** How wide the panel starts and how far a drag of its edge takes it. */
const PANEL_WIDTH = { initialWidth: 496, maxWidth: 768, minWidth: 384 };

/** The place for a panel is part of the layout and never changes. */
function subscribeToPanel() {
  return () => undefined;
}

function readPanel() {
  return document.getElementById(SETTINGS_PANEL_ID);
}

function readNoPanel() {
  return null;
}

/**
 * What the editor is open with: the memory it opened, or none for a new one.
 * The page's state holds that memory, so changing the search or loading more
 * pages never touches an open editor.
 */
function useMemoryEditor() {
  return useMemoryPage((state) => ({
    memory: state.target,
    open: state.open,
    session: state.session,
  }));
}

/** The element the open editor lives in: one for the whole life of the page. */
function createHost() {
  if (typeof document === "undefined") {
    return null;
  }

  const host = document.createElement("div");
  host.className = "flex min-h-0 flex-1 flex-col";

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
function useEditorHost() {
  const [host] = useState(createHost);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const caret = useRef<Caret | null>(null);

  const place = useCallback(
    (element: HTMLElement | null) => {
      if (host === null) {
        return;
      }

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
    if (host !== null) {
      caret.current = keepCaret(host);
    }
  }, [host]);

  return { host, place, remember, slot };
}

/** The ref each layout puts on the element that holds the editor. */
type Place = ReturnType<typeof useEditorHost>["place"];
/** What each layout runs when it goes. */
type Remember = ReturnType<typeof useEditorHost>["remember"];

/**
 * The editor of one memory. On a wide screen it is a panel beside the page,
 * whose edge the learner can drag, so the list stays in reach and a press on
 * another memory moves the editor to it. On a small screen it is a sheet over
 * the page. It is one editor in both: the document is rendered once, into an
 * element that moves between the two, so crossing the width where the layout
 * changes loses nothing the learner wrote.
 */
export function MemoryEditor() {
  const wide = useMediaQuery(WIDE);
  const { memory, open, session } = useMemoryEditor();
  const { host, place, remember, slot } = useEditorHost();

  return (
    <>
      {host && (open || slot)
        ? createPortal(<MemoryDocument key={session} memory={memory} />, host)
        : null}
      {wide ? (
        <MemoryEditorPanel
          memory={memory}
          open={open}
          place={place}
          remember={remember}
        />
      ) : (
        <MemoryEditorSheet
          memory={memory}
          open={open}
          place={place}
          remember={remember}
        />
      )}
    </>
  );
}

/** The editor as a panel in the place the settings layout keeps beside the page. */
function MemoryEditorPanel({
  memory,
  open,
  place,
  remember,
}: {
  memory: Memory | null;
  open: boolean;
  place: Place;
  remember: Remember;
}) {
  const t = useTranslations("Memory");
  const ai = useTranslations("Ai");
  const panel = useSyncExternalStore(subscribeToPanel, readPanel, readNoPanel);
  const { width, isResizing, resizerProps } = useResizable(PANEL_WIDTH);

  useLayoutEffect(() => remember, [remember]);

  if (!(open && panel)) {
    return null;
  }

  return createPortal(
    <aside
      aria-label={memory ? t("edit") : t("new")}
      className="sticky top-0 flex h-dvh w-(--memory-editor-width) shrink-0 flex-col border-s bg-background starting:opacity-0 transition-opacity ease-out"
      ref={place}
      style={{ "--memory-editor-width": `${width}px` }}
    >
      <button
        aria-label={ai("resize")}
        className={cn(
          "absolute inset-y-0 start-0 z-10 w-1 cursor-col-resize outline-none transition-colors hover:bg-ring focus-visible:bg-ring",
          !!isResizing && "bg-ring"
        )}
        onKeyDown={resizerProps.onKeyDown}
        onMouseDown={resizerProps.onMouseDown}
        type="button"
      />
    </aside>,
    panel
  );
}

/** The editor as a sheet over the page, for a screen too narrow for a panel. */
function MemoryEditorSheet({
  memory,
  open,
  place,
  remember,
}: {
  memory: Memory | null;
  open: boolean;
  place: Place;
  remember: Remember;
}) {
  const t = useTranslations("Memory");
  const close = useMemoryPage((state) => state.close);

  useLayoutEffect(() => remember, [remember]);

  return (
    <Sheet
      onOpenChange={(next) => {
        if (!next) {
          close();
        }
      }}
      open={open}
    >
      <SheetContent
        className="w-full max-w-none gap-0 border-l-0"
        ref={place}
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">
          {memory ? t("edit") : t("new")}
        </SheetTitle>
      </SheetContent>
    </Sheet>
  );
}
