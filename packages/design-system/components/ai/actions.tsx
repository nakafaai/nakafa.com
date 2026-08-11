"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";

export type ActionsProps = ComponentProps<typeof ButtonGroup>;

/** Groups adjacent response actions. */
export function Actions({ className, children, ...props }: ActionsProps) {
  return (
    <ButtonGroup className={cn(className)} {...props}>
      {children}
    </ButtonGroup>
  );
}

export type ActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

/** Renders the button owned by one response action. */
function ActionButton({
  tooltip,
  children,
  label,
  className,
  variant = "outline",
  size = "icon",
  ...props
}: ActionProps) {
  return (
    <Button
      className={cn(className)}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );
}

/** Renders one response action with optional tooltip context. */
export function Action(props: ActionProps) {
  if (!props.tooltip) {
    return <ActionButton {...props} />;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<ActionButton {...props} />} />
      <TooltipContent side="bottom">
        <p>{props.tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
