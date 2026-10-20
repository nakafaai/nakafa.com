import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "cn";
import type { ComponentProps } from "react";

type ActionsProps = ComponentProps<typeof ButtonGroup>;

/** Groups adjacent response actions. */
export function Actions({ className, children, ...props }: ActionsProps) {
  return (
    <ButtonGroup className={cn(className)} {...props}>
      {children}
    </ButtonGroup>
  );
}

type ActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

/** Renders the button owned by one response action. */
function ActionButton({
  className,
  variant = "outline",
  size = "icon",
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(className)}
      size={size}
      type="button"
      variant={variant}
      {...props}
    />
  );
}

/**
 * Renders one response action with optional tooltip context. The action names
 * itself for assistive technology: its label, or its tooltip when it has none.
 */
export function Action({ children, label, tooltip, ...props }: ActionProps) {
  const button = (
    <ActionButton {...props}>
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </ActionButton>
  );

  if (!tooltip) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="bottom">
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
