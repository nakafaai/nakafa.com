"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { type ComponentProps, memo } from "react";

export type ActionsProps = ComponentProps<"div">;

export const Actions = memo(
  ({ className, children, ...props }: ActionsProps) => {
    return (
      <div className={cn("flex items-center gap-1", className)} {...props}>
        {children}
      </div>
    );
  }
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
    variant = "ghost",
    size = "icon-sm",
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
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return button;
  }
);
Action.displayName = "Action";
