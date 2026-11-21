import { Separator as SeparatorPrimitive } from "@ui-sdk/react/separator";
import { cn } from "cn";
import type * as React from "react";

/**
 * A hairline between parts that a gap alone does not separate.
 */
function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive>) {
  return (
    <SeparatorPrimitive
      className={cn(
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:not-[[class^='h-']]:not-[[class*='_h-']]:self-stretch",
        className
      )}
      orientation={orientation}
      {...props}
    />
  );
}

export { Separator };
