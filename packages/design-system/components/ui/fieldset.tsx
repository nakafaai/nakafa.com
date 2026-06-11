"use client";

import { Fieldset as FieldsetPrimitive } from "@base-ui/react/fieldset";
import { cn } from "@repo/design-system/lib/utils";
import type React from "react";

/**
 * Renders a semantic COSS fieldset for related form fields.
 *
 * This primitive owns native grouping semantics only. Spacing and responsive
 * layout are caller-owned so large forms do not depend on hidden wrapper
 * behavior.
 */
export function Fieldset({
  className,
  ...props
}: FieldsetPrimitive.Root.Props): React.ReactElement {
  return (
    <FieldsetPrimitive.Root
      className={className}
      data-slot="fieldset"
      {...props}
    />
  );
}

/**
 * Renders the legend for a COSS fieldset.
 *
 * The legend is the accessible section name. It intentionally does not support
 * app-specific variants; callers should use class names for local spacing.
 */
export function FieldsetLegend({
  className,
  ...props
}: FieldsetPrimitive.Legend.Props): React.ReactElement {
  return (
    <FieldsetPrimitive.Legend
      className={cn("font-semibold text-foreground", className)}
      data-slot="fieldset-legend"
      {...props}
    />
  );
}
