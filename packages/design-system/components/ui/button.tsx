"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { buttonVariants as buttonVariantsClassName } from "@repo/design-system/lib/button";
import { ButtonGroupVariant } from "@repo/design-system/lib/group";
import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { use } from "react";

/**
 * A button. Inside a `ButtonGroup` it wears the group's variant, whatever `variant` it names, so the page's primary
 * never joins a group and a group never mixes variants.
 */
function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariantsClassName>) {
  const grouped = use(ButtonGroupVariant);

  return (
    <ButtonPrimitive
      className={cn(
        buttonVariantsClassName({
          variant: grouped ?? variant,
          size,
          className,
        })
      )}
      data-slot="button"
      {...props}
    />
  );
}

export { Button };
