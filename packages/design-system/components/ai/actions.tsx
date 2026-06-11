"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Group } from "@repo/design-system/components/ui/group";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { type ComponentProps, memo } from "react";

export type ActionsProps = ComponentProps<typeof Group>;

export const Actions = memo(
  ({ className, children, ...props }: ActionsProps) => (
    <Group className={cn(className)} {...props}>
      {children}
    </Group>
  )
);
Actions.displayName = "Actions";

export type ActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

export const Action = memo(
  ({
    tooltip,
    children,
    label,
    className,
    variant = "outline",
    size = "icon",
    ...props
  }: ActionProps) => {
    const button = (
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

    if (tooltip) {
      return (
        <Tooltip>
          <TooltipTrigger render={button} />
          <TooltipPopup side="bottom">
            <p>{tooltip}</p>
          </TooltipPopup>
        </Tooltip>
      );
    }

    return button;
  }
);
Action.displayName = "Action";
