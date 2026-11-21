import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import type { Button as ButtonPrimitive } from "@ui-sdk/react/button";
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

/**
 * Renders one response action: an icon button whose label names it on hover and focus and for assistive
 * technology, as every icon button does.
 */
export function Action({
  children,
  label,
  ...props
}: ComponentProps<typeof ButtonPrimitive> & {
  /** The action in words. */
  label: string;
}) {
  return (
    <Button
      size="icon"
      tooltip={label}
      type="button"
      variant="outline"
      {...props}
    >
      {children}
    </Button>
  );
}
