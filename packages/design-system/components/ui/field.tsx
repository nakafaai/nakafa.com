"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import { cn } from "@repo/design-system/lib/utils";
import type React from "react";

/**
 * Groups one labeled form control with Base UI Field semantics.
 *
 * The module owns label, description, invalid, and disabled wiring. It is not a
 * layout-only stack; use regular flex utilities or `Fieldset` for larger form
 * sections.
 */
export function Field({
  className,
  ...props
}: FieldPrimitive.Root.Props): React.ReactElement {
  return (
    <FieldPrimitive.Root
      className={cn("flex flex-col items-start gap-2", className)}
      data-slot="field"
      {...props}
    />
  );
}

/**
 * Renders the accessible label attached to the current COSS field root.
 *
 * The label inherits disabled state from Base UI Field and intentionally keeps
 * layout minimal so callers can compose controls without wrapper-specific
 * assumptions.
 */
export function FieldLabel({
  className,
  ...props
}: FieldPrimitive.Label.Props): React.ReactElement {
  return (
    <FieldPrimitive.Label
      className={cn(
        "inline-flex items-center gap-2 font-medium text-base/4.5 text-foreground data-disabled:opacity-64 sm:text-sm/4",
        className
      )}
      data-slot="field-label"
      {...props}
    />
  );
}

/**
 * Renders an item inside a composite COSS field control.
 *
 * Use this for grouped checkboxes, radios, or inline field content that Base UI
 * should treat as part of the field. It does not replace list or card layout.
 */
export function FieldItem({
  className,
  ...props
}: FieldPrimitive.Item.Props): React.ReactElement {
  return (
    <FieldPrimitive.Item
      className={cn("flex", className)}
      data-slot="field-item"
      {...props}
    />
  );
}

/**
 * Renders supporting help text for the active field.
 *
 * The description is linked through Base UI Field semantics. Callers should
 * keep this non-critical because validation errors belong in `FieldError`.
 */
export function FieldDescription({
  className,
  ...props
}: FieldPrimitive.Description.Props): React.ReactElement {
  return (
    <FieldPrimitive.Description
      className={cn("text-muted-foreground text-xs", className)}
      data-slot="field-description"
      {...props}
    />
  );
}

/**
 * Renders validation feedback for the active field.
 *
 * This primitive expects Base UI Field to determine when the message is shown.
 * It does not aggregate arbitrary error arrays; callers should pass the single
 * message or compose their own list before rendering.
 */
export function FieldError({
  className,
  ...props
}: FieldPrimitive.Error.Props): React.ReactElement {
  return (
    <FieldPrimitive.Error
      className={cn("text-destructive-foreground text-xs", className)}
      data-slot="field-error"
      {...props}
    />
  );
}

export const FieldControl: typeof FieldPrimitive.Control =
  FieldPrimitive.Control;
export const FieldValidity: typeof FieldPrimitive.Validity =
  FieldPrimitive.Validity;
