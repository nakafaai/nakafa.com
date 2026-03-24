"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { buttonVariants as buttonVariantsClassName } from "@repo/design-system/lib/button";
import { cn } from "@repo/design-system/lib/utils";
import type { VariantProps } from "class-variance-authority";

export { buttonVariants } from "@repo/design-system/lib/button";

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariantsClassName>) {
  return (
    <ButtonPrimitive
      className={cn(buttonVariantsClassName({ variant, size, className }))}
      data-slot="button"
      {...props}
    />
  );
}

export { Button };
