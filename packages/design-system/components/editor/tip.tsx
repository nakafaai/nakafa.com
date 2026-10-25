import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import type { ReactElement } from "react";

/**
 * Names a control of the toolbar in a tooltip under it, so a writer reads what an icon does before
 * pressing it. The control it wraps is the tooltip's trigger, a menu or popover trigger included.
 */
export function ToolHint({
  children,
  label,
}: {
  children: ReactElement;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
