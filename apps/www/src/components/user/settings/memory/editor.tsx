"use client";

import { useMediaQuery } from "@mantine/hooks";
import { Separator } from "@repo/design-system/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { useResizable } from "@repo/design-system/hooks/use-resizable";
import { cn } from "cn";
import { Function as Fn } from "effect";
import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "use-intl";
import { MemoryDocument } from "@/components/user/settings/memory/document";
import {
  MEMORY_ADD_ID,
  memoryRowId,
} from "@/components/user/settings/memory/focus";
import { useFocusAfterClose } from "@/components/user/settings/memory/focus.client";
import {
  createHost,
  useEditorHost,
} from "@/components/user/settings/memory/host.client";
import type { Memory } from "@/components/user/settings/memory/list";
import { useMemoryPage } from "@/components/user/settings/memory/provider";
import { SETTINGS_PANEL_ID } from "@/components/user/settings/panel";

/**
 * From this width on, the editor is a panel beside the page. Below it, a
 * sheet. The window must hold the sidebar (16rem), the smallest panel (24rem)
 * and the room the list keeps (`LIST_ROOM`, 23rem): 63rem. Where scrollbars
 * take room, the page loses a scrollbar's width on one edge, the stable gutter
 * on both edges (`globals.css`) holds the same width on the other, and the
 * media query counts neither. So the breakpoint adds 2rem for them, room for
 * two gutters of 16px: 65rem.
 */
const WIDE = "(min-width: 65rem)";
/** How wide the panel starts and how far a drag of its edge takes it. */
const PANEL_WIDTH = { initialWidth: 496, maxWidth: 768, minWidth: 384 };
/**
 * The room the list keeps beside the panel, in rem: a card of 20rem between the
 * 1.5rem of padding the settings page puts around it. The panel never takes
 * more of the row than what is left of it, whatever width it was dragged to and
 * whatever width the window has, and its resizer says the width it has.
 */
const LIST_ROOM = 23;

/** The place for a panel is part of the layout and never changes. */
function subscribeToPanel() {
  return Fn.constVoid;
}

function readPanel() {
  return document.getElementById(SETTINGS_PANEL_ID);
}

function readNoPanel() {
  return null;
}

/** The row of the settings layout that holds the page and the place for a panel. */
function readRow() {
  return document.getElementById(SETTINGS_PANEL_ID)?.parentElement;
}

/** Tells when the row changes its width. */
function subscribeToRoom(notify: () => void) {
  const row = readRow();

  if (!row) {
    return Fn.constVoid;
  }

  const observer = new ResizeObserver(notify);

  observer.observe(row);

  return () => observer.disconnect();
}

/** The widest the panel can be now: the row less the room the list keeps, in pixels. */
function readRoom() {
  const unit = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize
  );

  return (
    (readRow()?.clientWidth ?? Number.POSITIVE_INFINITY) - LIST_ROOM * unit
  );
}

/** Before the browser can measure the row, the panel has all the room it asks for. */
function readNoRoom() {
  return Number.POSITIVE_INFINITY;
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
    opener: state.opener,
    session: state.session,
  }));
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
  // The server renders no editor, because it has no page to hold one in.
  const [host] = useState(createHost);

  return host ? <HostedMemoryEditor host={host} /> : null;
}

/**
 * The editor once the page has an element to hold it: the document, and the
 * layout that shows it.
 */
function HostedMemoryEditor({ host }: { host: HTMLElement }) {
  const wide = useMediaQuery(WIDE);
  const { memory, open, opener, session } = useMemoryEditor();
  const { place, remember, slot } = useEditorHost(host);

  useFocusAfterClose(open, opener, host);

  return (
    <>
      {open || slot
        ? createPortal(
            <MemoryDocument key={session} memory={memory} open={open} />,
            host
          )
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
  const room = useSyncExternalStore(subscribeToRoom, readRoom, readNoRoom);
  const { width, isResizing, resizerProps } = useResizable({
    ...PANEL_WIDTH,
    // Never narrower than the smallest panel, whatever the room says.
    maxWidth: Math.max(
      PANEL_WIDTH.minWidth,
      Math.min(PANEL_WIDTH.maxWidth, room)
    ),
  });

  useLayoutEffect(() => remember, [remember]);

  if (!(open && panel)) {
    return null;
  }

  return createPortal(
    <aside
      aria-label={memory ? t("edit") : t("new")}
      className="sticky top-0 flex h-dvh w-(--memory-editor-width) max-w-[calc(100%-var(--memory-list-room))] shrink-0 flex-col border-s bg-background starting:opacity-0 transition-opacity ease-out"
      ref={place}
      style={{
        "--memory-editor-width": `${width}px`,
        "--memory-list-room": `${LIST_ROOM}rem`,
      }}
    >
      {/* The edge is a separator that takes the focus, as a window splitter
          does, and it says the width the panel has and the widths it can have. */}
      <Separator
        aria-label={ai("resize")}
        aria-valuemax={resizerProps["aria-valuemax"]}
        aria-valuemin={resizerProps["aria-valuemin"]}
        aria-valuenow={resizerProps["aria-valuenow"]}
        className={cn(
          "absolute inset-y-0 start-0 z-10 cursor-col-resize bg-transparent outline-none transition-colors hover:bg-ring focus-visible:bg-ring data-[orientation=vertical]:w-1",
          !!isResizing && "bg-ring"
        )}
        onKeyDown={resizerProps.onKeyDown}
        onMouseDown={resizerProps.onMouseDown}
        orientation={resizerProps["aria-orientation"]}
        tabIndex={0}
      />
    </aside>,
    panel
  );
}

/** The sheet over the page on a narrow screen, which takes the focus when it opens. */
const SHEET_ID = "user-settings-memory-sheet";

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
  const { opener } = useMemoryEditor();

  useLayoutEffect(() => remember, [remember]);

  // A dialog focuses its first field when it opens, which is the title, and the
  // editor keeps out of a field that has the focus. So the sheet focuses its own
  // element instead, and the editor takes the caret once it exists.
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
        finalFocus={() => {
          // The sheet also goes when the window widens past the panel's width.
          // The editor is still open then, and it moves into the panel with its
          // caret, so the focus stays in it.
          if (open) {
            return false;
          }
          if (opener === null) {
            return document.getElementById(MEMORY_ADD_ID);
          }
          // A deleted memory has no row, and its delete question has placed the
          // focus already, so the sheet leaves it where the question put it.
          return document.getElementById(memoryRowId(opener)) ?? false;
        }}
        id={SHEET_ID}
        initialFocus={() => document.getElementById(SHEET_ID)}
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
