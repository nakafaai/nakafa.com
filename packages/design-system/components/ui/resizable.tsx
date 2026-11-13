import { DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Separator as Rule } from "@repo/design-system/components/ui/separator";
import type { useResizable } from "@repo/design-system/hooks/resizable";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import type * as React from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { useTranslations } from "use-intl";

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof Group>) {
  return (
    <Group
      className={cn("flex h-full w-full", className)}
      data-slot="resizable-panel-group"
      {...props}
    />
  );
}

function ResizablePanel({ ...props }: React.ComponentProps<typeof Panel>) {
  return <Panel data-slot="resizable-panel" {...props} />;
}

/** The grip that says an edge resizes, drawn the same on every resizable edge of Nakafa. */
function ResizeGrip() {
  return (
    <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border [&_svg]:size-2.5">
      <HugeIcons icon={DragDropVerticalIcon} />
    </div>
  );
}

function ResizableHandle({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={cn(
        "bg-border focus-visible:ring-ring relative z-999 flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
        className
      )}
      data-slot="resizable-handle"
      {...props}
    >
      <ResizeGrip />
    </Separator>
  );
}

/** Where an edge lies: on the start of a panel at the window's right, or on the end of one at its left. */
const resizeEdgeVariants = cva(
  "focus-visible:ring-ring bg-border absolute inset-y-0 z-10 flex w-px! cursor-col-resize items-center justify-center outline-none after:absolute after:inset-y-0 after:w-2 focus-visible:ring-1",
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
 * no colour of its own on hover, as the panes of a row do.
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
      aria-valuemax={resizer["aria-valuemax"]}
      aria-valuemin={resizer["aria-valuemin"]}
      aria-valuenow={resizer["aria-valuenow"]}
      className={cn(resizeEdgeVariants({ anchor }), className)}
      data-slot="resize-edge"
      onKeyDown={resizer.onKeyDown}
      onMouseDown={resizer.onMouseDown}
      orientation={resizer["aria-orientation"]}
      tabIndex={0}
    >
      <ResizeGrip />
    </Rule>
  );
}

const useResizableDefaultLayout = useDefaultLayout;

export {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  ResizeEdge,
  ResizeGrip,
  useResizableDefaultLayout,
};
