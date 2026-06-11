import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cn } from "@repo/design-system/lib/utils";
import type React from "react";

/**
 * Renders a COSS separator with semantic orientation and Nakafa border tokens.
 * It is decorative by default; use nearby structure for section semantics.
 */
export function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props): React.ReactElement {
  return (
    <SeparatorPrimitive
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:not-[[class^='h-']]:not-[[class*='_h-']]:self-stretch",
        className
      )}
      data-slot="separator"
      orientation={orientation}
      {...props}
    />
  );
}
