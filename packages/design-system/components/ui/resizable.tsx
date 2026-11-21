import { DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Separator as Rule } from "@repo/design-system/components/ui/separator";
import type { useResizable } from "@repo/design-system/hooks/resizable";
import {
  Resizable,
  ResizableHandle as ResizableHandlePrimitive,
  ResizablePanel as ResizablePanelPrimitive,
} from "@ui-sdk/react/resizable";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import type * as React from "react";
import { useTranslations } from "use-intl";

/**
 * Panes the reader resizes by dragging the grip on their shared edge, or by its keys, as a window splitter moves. Every
 * resizable edge shows the one grip, never a line that changes colour. A panel's size is a share of the row, or a
 * length such as `"20rem"` that holds as the row narrows; a panel with no size takes the room the others leave.
 */
function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof Resizable>) {
  return <Resizable className={cn("h-full w-full", className)} {...props} />;
}

function ResizablePanel(
  props: React.ComponentProps<typeof ResizablePanelPrimitive>
) {
  return <ResizablePanelPrimitive {...props} />;
}

/** The grip that says an edge resizes, drawn the same on every resizable edge of Nakafa. */
function ResizeGrip() {
  return (
    <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
      <HugeIcons icon={DragDropVerticalIcon} size="2xs" />
    </div>
  );
}

/**
 * The edge between two panes. It reads as the row's 1px line with the grip in its middle, and a pointer or a finger
 * takes it from a band wider than the line. Its name says what it does, for a screen reader and an agent alike.
 */
function ResizableHandle({
  className,
  ...props
}: React.ComponentProps<typeof ResizableHandlePrimitive>) {
  const t = useTranslations("Common");

  return (
    <ResizableHandlePrimitive
      aria-label={t("resize")}
      className={cn(
        "bg-border focus-visible:ring-ring relative z-10 flex w-px items-center justify-center outline-none focus-visible:ring-1 data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full [&[data-orientation=vertical]>div]:rotate-90",
        className
      )}
      {...props}
    >
      <ResizeGrip />
    </ResizableHandlePrimitive>
  );
}

/** Where an edge lies: on the start of a panel at the window's right, or on the end of one at its left. */
const resizeEdgeVariants = cva(
  "focus-visible:ring-ring bg-border absolute inset-y-0 z-10 flex w-px! cursor-col-resize touch-none items-center justify-center outline-none after:absolute after:inset-y-0 after:w-2 focus-visible:ring-1",
  {
    defaultVariants: { anchor: "end" },
    variants: {
      anchor: {
        end: "-start-px after:-start-1",
        start: "-end-px after:-end-1",
      },
    },
  }
);

/**
 * The resizable edge of a panel that stands over or beside the page, such as the page's pane or a sheet: a separator
 * that takes the focus, as a window splitter does, and says the width the panel has and the widths it can have. It
 * lies on the panel's ordinary border, so the line stays 1px, the grip in its middle says that it moves, and it takes
 * no colour of its own on hover, as the panes of a row do. A finger drags it as a pointer does, so it takes no touch
 * gesture of the page's. A row of panes resizes with `ResizableHandle`; this edge moves one panel alone.
 */
function ResizeEdge({
  anchor,
  className,
  resizer,
}: {
  /** The side the panel stands at, which puts the edge on the side facing the page. */
  anchor?: "end" | "start";
  className?: string;
  resizer: ReturnType<typeof useResizable>["resizerProps"];
}) {
  const t = useTranslations("Common");

  return (
    <Rule
      aria-label={t("resize")}
      className={cn(resizeEdgeVariants({ anchor }), className)}
      orientation={resizer["aria-orientation"]}
      tabIndex={0}
      {...resizer}
    >
      <ResizeGrip />
    </Rule>
  );
}

export {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  ResizeEdge,
  ResizeGrip,
};
