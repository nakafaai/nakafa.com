"use client";

import {
  Input,
  type InputProps,
} from "@repo/design-system/components/ui/input";
import {
  Textarea,
  type TextareaProps,
} from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text select-none items-center justify-center gap-2 leading-none [&>kbd]:rounded-[calc(var(--radius)-5px)] in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4.5 sm:in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4 [&_svg]:-mx-0.5 not-has-[button]:**:[svg:not([class*='opacity-'])]:opacity-80",
  {
    defaultVariants: {
      align: "inline-start",
    },
    variants: {
      align: {
        "block-end":
          "order-last w-full justify-start px-[calc(--spacing(3)-1px)] pb-[calc(--spacing(3)-1px)] [.border-t]:pt-[calc(--spacing(3)-1px)] [[data-size=sm]+&]:px-[calc(--spacing(2.5)-1px)]",
        "block-start":
          "order-first w-full justify-start px-[calc(--spacing(3)-1px)] pt-[calc(--spacing(3)-1px)] [.border-b]:pb-[calc(--spacing(3)-1px)] [[data-size=sm]+&]:px-[calc(--spacing(2.5)-1px)]",
        "inline-end":
          "order-last pe-[calc(--spacing(3)-1px)] has-[>:last-child[data-slot=badge]]:-me-1.5 has-[>button]:-me-2 has-[>kbd:last-child]:me-[-0.35rem] [[data-size=sm]+&]:pe-[calc(--spacing(2.5)-1px)]",
        "inline-start":
          "order-first ps-[calc(--spacing(3)-1px)] has-[>:last-child[data-slot=badge]]:-ms-1.5 has-[>button]:-ms-2 has-[>kbd:last-child]:ms-[-0.35rem] [[data-size=sm]+&]:ps-[calc(--spacing(2.5)-1px)]",
      },
    },
  }
);

/**
 * Focuses the grouped control when non-interactive addon chrome is pressed.
 *
 * Addons may contain buttons, links, inputs, and select triggers; those
 * interactive descendants keep their own pointer behavior. The helper is local
 * to the input-group module because the DOM query is an implementation detail
 * of the COSS composition.
 */
function focusInputGroupControlFromAddon(
  event: React.MouseEvent<HTMLDivElement>
): void {
  const target = event.target as HTMLElement;
  const isInteractive = target.closest(
    "button, a, input, select, textarea, [role='button'], [role='combobox'], [role='listbox'], [data-slot='select-trigger']"
  );

  if (isInteractive) {
    return;
  }

  event.preventDefault();

  const parent = event.currentTarget.parentElement;
  const input = parent?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    "input, textarea"
  );

  if (!input || parent?.querySelector("input:focus, textarea:focus")) {
    return;
  }

  input.focus();
}

/**
 * Renders the COSS input group shell for one input-like control plus addons.
 *
 * The shell owns focus, invalid, disabled, and inline/block addon styling. It
 * does not expose a button subcomponent; callers place `Button` inside
 * `InputGroupAddon` so actions keep the design-system button contract.
 */
export function InputGroup({
  className,
  ...props
}: React.ComponentProps<"fieldset">): React.ReactElement {
  return (
    <fieldset
      className={cn(
        "relative inline-flex w-full min-w-0 items-center rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-has-[input:disabled,textarea:disabled]:not-has-[input:focus-visible,textarea:focus-visible]:not-has-[input[aria-invalid],textarea[aria-invalid]]:before:shadow-[0_1px_--theme(--color-black/4%)] has-[input:focus-visible,textarea:focus-visible]:has-[input[aria-invalid],textarea[aria-invalid]]:border-destructive/64 has-[input:focus-visible,textarea:focus-visible]:has-[input[aria-invalid],textarea[aria-invalid]]:ring-destructive/16 has-[textarea]:h-auto has-data-[align=block-end]:h-auto has-data-[align=block-start]:h-auto has-data-[align=block-end]:flex-col has-data-[align=block-start]:flex-col has-[input:focus-visible,textarea:focus-visible]:border-ring has-[input[aria-invalid],textarea[aria-invalid]]:border-destructive/36 has-autofill:bg-foreground/4 has-[input:disabled,textarea:disabled]:opacity-64 has-[input:disabled,textarea:disabled,input:focus-visible,textarea:focus-visible,input[aria-invalid],textarea[aria-invalid]]:shadow-none has-[input:focus-visible,textarea:focus-visible]:ring-[3px] sm:text-sm dark:bg-input/32 dark:has-autofill:bg-foreground/8 dark:has-[input[aria-invalid],textarea[aria-invalid]]:ring-destructive/24 dark:not-has-[input:disabled,textarea:disabled]:not-has-[input:focus-visible,textarea:focus-visible]:not-has-[input[aria-invalid],textarea[aria-invalid]]:before:shadow-[0_-1px_--theme(--color-white/6%)] has-data-[align=inline-start]:**:[[data-size=sm]_input]:ps-1.5 has-data-[align=inline-end]:**:[[data-size=sm]_input]:pe-1.5 *:[[data-slot=input-control],[data-slot=textarea-control]]:contents *:[[data-slot=input-control],[data-slot=textarea-control]]:before:hidden has-[[data-align=block-start],[data-align=block-end]]:**:[input]:h-auto has-data-[align=inline-start]:**:[input]:ps-2 has-data-[align=inline-end]:**:[input]:pe-2 has-data-[align=block-end]:**:[input]:pt-1.5 has-data-[align=block-start]:**:[input]:pb-1.5 **:[textarea]:min-h-20.5 **:[textarea]:resize-none **:[textarea]:py-[calc(--spacing(3)-1px)] **:[textarea]:max-sm:min-h-23.5 **:[textarea_button]:rounded-[calc(var(--radius-md)-1px)]",
        className
      )}
      data-slot="input-group"
      {...props}
    />
  );
}

/**
 * Renders positional chrome around an input group control.
 *
 * Addons are allowed to contain icons, text, badges, or real controls. The
 * click-to-focus behavior only runs for non-interactive descendants and is not
 * a replacement for labeling the input.
 */
export function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof inputGroupAddonVariants>): React.ReactElement {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: passive addon chrome forwards focus to the grouped input while nested controls keep their own behavior.
    <div
      className={cn(inputGroupAddonVariants({ align }), className)}
      data-align={align}
      data-slot="input-group-addon"
      onMouseDown={focusInputGroupControlFromAddon}
      role="presentation"
      {...props}
    />
  );
}

/**
 * Renders passive text inside an input group addon.
 *
 * This keeps text and icons visually aligned with grouped controls. It does not
 * add labeling semantics, so callers still provide an accessible label or
 * `aria-label` on the control.
 */
export function InputGroupText({
  className,
  ...props
}: React.ComponentProps<"span">): React.ReactElement {
  return (
    <span
      className={cn(
        "line-clamp-1 flex items-center gap-2 whitespace-nowrap text-muted-foreground leading-none in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4.5 sm:in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5",
        className
      )}
      {...props}
    />
  );
}

/**
 * Renders the input control inside an input group.
 *
 * The control reuses the design-system `Input` implementation with grouped
 * chrome disabled. Use it only as the primary input-like child of one
 * `InputGroup`.
 */
export function InputGroupInput({
  className,
  ...props
}: InputProps): React.ReactElement {
  return <Input className={className} unstyled {...props} />;
}

/**
 * Renders the textarea control inside an input group.
 *
 * The control uses CSS field sizing from `Textarea`; legacy autosize props are
 * intentionally unsupported so input groups stay dependency-free.
 */
export function InputGroupTextarea({
  className,
  ...props
}: TextareaProps): React.ReactElement {
  return <Textarea className={className} unstyled {...props} />;
}
