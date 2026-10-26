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

/** Renders the button owned by one response action, named for assistive technology by its label. */
function ActionButton({
  children,
  className,
  label,
  variant = "outline",
  size = "icon",
  ...props
}: ComponentProps<typeof Button> & { label: string | undefined }) {
  return (
    <Button
      className={cn(className)}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children}
      <span className="sr-only">{label}</span>
    </Button>
  );
}

/**
 * Renders one response action with optional tooltip context. The action names
 * itself for assistive technology: its label, or its tooltip when it has none.
 */
export function Action({ children, label, tooltip, ...props }: ActionProps) {
  if (!tooltip) {
    return (
      <ActionButton label={label} {...props}>
        {children}
      </ActionButton>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ActionButton label={label || tooltip} {...props}>
            {children}
          </ActionButton>
        }
      />
      <TooltipContent side="bottom">
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
