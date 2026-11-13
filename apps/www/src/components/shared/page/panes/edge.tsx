import { ResizeGrip } from "@repo/design-system/components/ui/resizable";
import { Separator } from "@repo/design-system/components/ui/separator";
import { useTranslations } from "use-intl";

/**
 * The resizable edge of a pane that stands at the screen's right: a separator that takes the focus, as a
 * window splitter does, and says the width the pane has and the widths it can have. It lies on the pane's
 * ordinary border, so the line stays 1px and the grip says that it moves.
 */
export function PaneEdge({
  resizer,
}: {
  resizer: {
    readonly "aria-orientation": "horizontal" | "vertical";
    readonly "aria-valuemax": number;
    readonly "aria-valuemin": number;
    readonly "aria-valuenow": number;
    readonly onKeyDown: (event: React.KeyboardEvent) => void;
    readonly onMouseDown: (event: React.MouseEvent) => void;
  };
}) {
  const t = useTranslations("Ai");

  return (
    <Separator
      aria-label={t("resize")}
      aria-valuemax={resizer["aria-valuemax"]}
      aria-valuemin={resizer["aria-valuemin"]}
      aria-valuenow={resizer["aria-valuenow"]}
      className="focus-visible:ring-ring bg-border absolute inset-y-0 -start-px z-10 flex w-px! cursor-col-resize items-center justify-center outline-none after:absolute after:inset-y-0 after:-start-1 after:w-2 focus-visible:ring-1"
      onKeyDown={resizer.onKeyDown}
      onMouseDown={resizer.onMouseDown}
      orientation={resizer["aria-orientation"]}
      tabIndex={0}
    >
      <ResizeGrip />
    </Separator>
  );
}
