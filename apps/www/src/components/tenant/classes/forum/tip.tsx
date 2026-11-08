import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import type { ReactElement } from "react";

/**
 * The tooltip of one icon-only button of the forum, which names its action in words on hover and on keyboard focus,
 * as every icon-only button of Nakafa does. The button keeps its own accessible name, and a trigger of a menu or a
 * popover keeps its role: the tooltip renders through it.
 */
export function IconTip({
  children,
  label,
}: {
  /** The button, a menu's trigger or a popover's trigger. */
  children: ReactElement;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
