import { ResizeGrip } from "@repo/design-system/components/ui/resizable";
import { Separator } from "@repo/design-system/components/ui/separator";
import type { useResizable } from "@repo/design-system/hooks/use-resizable";
import { useTranslations } from "use-intl";

/**
 * The resizable edge of a pane that stands at the screen's right: a separator that takes the focus, as a
 * window splitter does, and says the width the pane has and the widths it can have. It lies on the pane's
 * ordinary border, so the line stays 1px and the grip says that it moves. A finger drags it as a pointer
 * does, so it takes no touch gesture of the page's.
 */
export function PaneEdge({
  resizer,
}: {
  resizer: ReturnType<typeof useResizable>["resizerProps"];
}) {
  const t = useTranslations("Ai");

  return (
    <Separator
      aria-label={t("resize")}
      className="focus-visible:ring-ring bg-border absolute inset-y-0 -start-px z-10 flex w-px! cursor-col-resize touch-none items-center justify-center outline-none after:absolute after:inset-y-0 after:-start-1 after:w-2 focus-visible:ring-1"
      orientation={resizer["aria-orientation"]}
      tabIndex={0}
      {...resizer}
    >
      <ResizeGrip />
    </Separator>
  );
}
