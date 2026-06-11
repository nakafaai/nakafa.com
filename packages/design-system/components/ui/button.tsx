"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { buttonVariants as buttonVariantsClassName } from "@repo/design-system/lib/button";
import { cn } from "@repo/design-system/lib/utils";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

export interface ButtonProps extends useRender.ComponentProps<"button"> {
  loading?: boolean;
  size?: VariantProps<typeof buttonVariantsClassName>["size"];
  variant?: VariantProps<typeof buttonVariantsClassName>["variant"];
}

/**
 * Renders the native COSS button contract with optional loading state.
 * The variant map lives in `lib/button` so server-rendered anchors can share it
 * without importing this client component.
 */
export function Button({
  className,
  variant,
  size,
  render,
  children,
  loading = false,
  disabled: disabledProp,
  ...props
}: ButtonProps): React.ReactElement {
  const isDisabled: boolean = Boolean(loading || disabledProp);
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>["type"] =
    render ? undefined : "button";

  const defaultProps = {
    children: (
      <>
        {children}
        {loading && (
          <Spinner
            className="pointer-events-none absolute"
            data-slot="button-loading-indicator"
          />
        )}
      </>
    ),
    className: cn(buttonVariantsClassName({ className, size, variant })),
    "aria-disabled": loading || undefined,
    "data-loading": loading ? "" : undefined,
    "data-slot": "button",
    disabled: isDisabled,
    type: typeValue,
  };

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(defaultProps, props),
    render,
  });
}

export { buttonVariants } from "@repo/design-system/lib/button";
