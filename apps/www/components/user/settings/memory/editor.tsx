"use client";

import { useMediaQuery } from "@mantine/hooks";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { useResizable } from "@repo/design-system/hooks/use-resizable";
import { cn } from "cn";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { MemoryDocument } from "@/components/user/settings/memory/document";
import {
  useMemory,
  useMemoryPage,
} from "@/components/user/settings/memory/provider";
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
 * What the editor is open with: a memory, or none for a new one. A memory
 * that was deleted meanwhile has no editor.
 */
function useMemoryEditor() {
  const { close, session, target, wanted } = useMemoryPage((state) => ({
    close: state.close,
    session: state.session,
    target: state.target,
    wanted: state.open,
  }));
  const memory = useMemory((list) =>
    Option.getOrUndefined(
      Arr.findFirst(list.memories, ({ id }) => id === target)
    )
  );
  const gone = target !== null && memory === undefined;

  return { close, memory, open: wanted && !gone, session };
}

/**
 * The editor of one memory. On a wide screen it is a panel beside the page,
 * whose edge the learner can drag, so the list stays in reach and a press on
 * another memory moves the editor to it. On a small screen it is a sheet over
 * the page.
 */
export function MemoryEditor() {
  const wide = useMediaQuery(WIDE);

  return wide ? <MemoryEditorPanel /> : <MemoryEditorSheet />;
}

/** The editor as a panel in the place the settings layout keeps beside the page. */
function MemoryEditorPanel() {
  const t = useTranslations("Memory");
  const ai = useTranslations("Ai");
  const { memory, open, session } = useMemoryEditor();
  const panel = useSyncExternalStore(subscribeToPanel, readPanel, readNoPanel);
  const { width, isResizing, resizerProps } = useResizable(PANEL_WIDTH);

  if (!(open && panel)) {
    return null;
  }

  return createPortal(
    <aside
      aria-label={memory ? t("edit") : t("new")}
      className="sticky top-0 flex h-dvh w-(--memory-editor-width) shrink-0 flex-col border-s bg-background starting:opacity-0 transition-opacity ease-out"
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
      <MemoryDocument key={session} memory={memory} />
    </aside>,
    panel
  );
}

/** The editor as a sheet over the page, for a screen too narrow for a panel. */
function MemoryEditorSheet() {
  const t = useTranslations("Memory");
  const { close, memory, open, session } = useMemoryEditor();

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
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">
          {memory ? t("edit") : t("new")}
        </SheetTitle>
        <MemoryDocument key={session} memory={memory} />
      </SheetContent>
    </Sheet>
  );
}
