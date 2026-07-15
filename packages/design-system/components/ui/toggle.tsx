"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { toggleVariants } from "@repo/design-system/lib/toggle/variants";
import { cn } from "@repo/design-system/lib/utils";
import type { VariantProps } from "class-variance-authority";

function Toggle({
  className,
  variant,
  size,
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      className={cn(toggleVariants({ variant, size, className }))}
      data-slot="toggle"
      {...props}
    />
  );
}

export { Toggle };
