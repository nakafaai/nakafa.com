"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { buttonVariants as buttonVariantsClassName } from "@repo/design-system/lib/button";
import { AgentConfirmSentence } from "@repo/design-system/lib/confirm";
import { ButtonGroupVariant } from "@repo/design-system/lib/group";
import { Button as ButtonPrimitive } from "@ui-sdk/react/button";
import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type * as React from "react";
import { use } from "react";

/**
 * A button. An icon size draws an icon alone, so it requires the `tooltip` that names its action in words: the
 * button shows it on hover and focus, and it is the button's accessible name from the first HTML, unless the button
 * names itself more fully in `aria-label`, when the tooltip describes it. Any other button may carry one too, such as
 * a menu trigger that shows an icon and its caret, and it names that button the same way, since neither shows a
 * word. A button that says its action in words needs no tooltip. Inside a `ButtonGroup` it wears the
 * group's variant, whatever `variant` it names, so the page's primary never joins a group and a group never mixes
 * variants. A destructive button in a dialog that asks first carries the dialog's sentence for agents
 * (`AgentConfirmSentence`), so only a person commits it.
 */
function Button({
  className,
  variant = "default",
  size = "default",
  tooltip,
  ...props
}: React.ComponentProps<typeof ButtonPrimitive> &
  Omit<VariantProps<typeof buttonVariantsClassName>, "size"> &
  (
    | {
        size: Extract<
          NonNullable<VariantProps<typeof buttonVariantsClassName>["size"]>,
          `icon${string}`
        >;
        /**
         * The action of the icon in words, shown on hover and focus and read as the button's name, unless the button
         * gives a fuller name of its own in `aria-label`, such as the row the action is for.
         */
        tooltip: string;
      }
    | {
        size?: Exclude<
          NonNullable<VariantProps<typeof buttonVariantsClassName>["size"]>,
          `icon${string}`
        >;
        /** The action in words, for a button that shows no word, such as an icon with a caret. */
        tooltip?: string;
      }
  )) {
  const grouped = use(ButtonGroupVariant);
  const confirm = use(AgentConfirmSentence);
  const worn = grouped ?? variant;
  const classes = cn(
    buttonVariantsClassName({
      variant: worn,
      size,
      className,
    })
  );
  const marked =
    worn === "destructive" && confirm !== undefined
      ? { "data-agent-confirm": confirm, ...props }
      : props;

  if (tooltip === undefined) {
    return <ButtonPrimitive className={classes} {...marked} />;
  }

  return (
    <Tooltip type={props["aria-label"] === undefined ? "label" : "description"}>
      <TooltipTrigger
        render={<ButtonPrimitive {...marked} className={classes} />}
      />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export { Button };
