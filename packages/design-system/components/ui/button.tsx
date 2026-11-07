"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { buttonVariants as buttonVariantsClassName } from "@repo/design-system/lib/button";
import { ButtonGroupVariant } from "@repo/design-system/lib/group";
import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { use } from "react";

/**
 * A button. An icon size draws an icon alone, so it requires the `tooltip` that names its action in words: the
 * button shows it on hover and focus, and reads it as its accessible name. Any other button may carry one too, such
 * as a menu trigger that shows an icon and its caret. Inside a `ButtonGroup` it wears the
 * group's variant, whatever `variant` it names, so the page's primary never joins a group and a group never mixes
 * variants.
 */
function Button({
  className,
  variant = "default",
  size = "default",
  tooltip,
  ...props
}: ButtonPrimitive.Props &
  Omit<VariantProps<typeof buttonVariantsClassName>, "size"> &
  (
    | {
        size: Extract<
          NonNullable<VariantProps<typeof buttonVariantsClassName>["size"]>,
          `icon${string}`
        >;
        /** The action of the icon in words, shown on hover and focus and read as the button's name. */
        tooltip: string;
      }
    | {
        size?: Exclude<
          NonNullable<VariantProps<typeof buttonVariantsClassName>["size"]>,
          `icon${string}`
        >;
        /** The action in words, for a button whose words do not say it all, such as an icon with a caret. */
        tooltip?: string;
      }
  )) {
  const grouped = use(ButtonGroupVariant);
  const classes = cn(
    buttonVariantsClassName({
      variant: grouped ?? variant,
      size,
      className,
    })
  );

  if (tooltip === undefined) {
    return (
      <ButtonPrimitive className={classes} data-slot="button" {...props} />
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ButtonPrimitive
            {...props}
            aria-label={tooltip}
            className={classes}
            data-slot="button"
          />
        }
      />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export { Button };
