import { useResizable } from "@repo/design-system/hooks/resizable";
import { cva } from "class-variance-authority";
import { type ReactNode, useLayoutEffect, useSyncExternalStore } from "react";
import { PaneEdge } from "@/components/shared/page/panes/edge";

/** How wide a pane starts and how far a drag of its edge takes it, in pixels. */
const PANE_WIDTH = { initialWidth: 420, maxWidth: 768, minWidth: 320 };

/** What a window keeps beside a pane, in pixels: the sidebar's 16rem and 23rem of page. */
const PAGE_ROOM = 624;

/** Tells when the window changes its width. */
function subscribeToWindow(notify: () => void) {
  window.addEventListener("resize", notify);

  return () => window.removeEventListener("resize", notify);
}

/** The widest a pane can be now, in pixels. */
function readRoom() {
  return window.innerWidth - PAGE_ROOM;
}

/** Before the browser can measure the window, the pane has all the room it asks for. */
function readNoRoom() {
  return Number.POSITIVE_INFINITY;
}

/** The pane at the screen's right, which steps aside below the width its page gives it. */
export const paneSideVariants = cva(
  "bg-background fixed inset-y-0 end-0 z-30 flex w-(--pane-width) flex-col border-s",
  {
    variants: {
      from: {
        lg: "max-lg:hidden",
        md: "max-md:hidden",
        xl: "max-xl:hidden",
      },
    },
  }
);

/**
 * The pane of a page: it stands at the screen's right from the window's top to its bottom, as settings memory
 * does, and the page's main element narrows beside it (`SidebarInset`), so the header, the tabs, the body and the
 * footer stay one frame. A pane never stands under a header, which would read as a body wider than its header.
 */
export function PaneSide({
  children,
  from,
  group,
  label,
  row,
}: {
  /** The pane's header, body and footer. */
  children: ReactNode;
  /** From which width the pane stands beside the page: below it the page has the whole row. */
  from: "lg" | "md" | "xl";
  /** Names the layout in this browser, so each page keeps its own width. */
  group: string;
  /** The pane's name for a screen reader. */
  label: string;
  /** Whether a row stands open in it, which Escape closes first. */
  row: boolean;
}) {
  const room = useSyncExternalStore(subscribeToWindow, readRoom, readNoRoom);
  const { width, resizerProps } = useResizable({
    initialWidth: PANE_WIDTH.initialWidth,
    // Never narrower than the smallest pane, whatever the room says.
    maxWidth: Math.max(
      PANE_WIDTH.minWidth,
      Math.min(PANE_WIDTH.maxWidth, room)
    ),
    minWidth: PANE_WIDTH.minWidth,
    storageKey: `nakafa-pane-${group}`,
  });

  // The main element is an ancestor, so the width reaches it from the root.
  useLayoutEffect(() => {
    const root = document.documentElement;

    root.style.setProperty("--pane-width", `${width}px`);

    return () => {
      root.style.removeProperty("--pane-width");
    };
  }, [width]);

  return (
    <aside
      aria-label={label}
      className={paneSideVariants({ from })}
      data-pane-row={row ? "" : undefined}
      data-pane-side={from}
    >
      <PaneEdge resizer={resizerProps} />
      {children}
    </aside>
  );
}
