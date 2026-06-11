import { cn } from "@repo/design-system/lib/utils";
import type * as React from "react";

/**
 * Renders the COSS frame container for grouped surfaces.
 *
 * Frames provide the outer muted rail for related panels. They do not own data,
 * heading hierarchy, or navigation; callers compose those with panel children.
 */
export function Frame({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl bg-muted/72 p-1",
        "*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-1",
        className
      )}
      data-slot="frame"
      {...props}
    />
  );
}

/**
 * Renders one framed COSS panel.
 *
 * The panel owns the bordered white surface inside a frame. It is intentionally
 * shallow and does not replace cards when a card header/footer structure is
 * required.
 */
export function FramePanel({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "relative rounded-xl border bg-background bg-clip-padding p-5 shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
        className
      )}
      data-slot="frame-panel"
      {...props}
    />
  );
}

/**
 * Renders header content for a framed panel.
 *
 * The header provides consistent padding only. Callers still own accessible
 * heading levels and any actions placed beside the title.
 */
export function FrameHeader({
  className,
  ...props
}: React.ComponentProps<"header">): React.ReactElement {
  return (
    <header
      className={cn("flex flex-col px-5 py-4", className)}
      data-slot="frame-panel-header"
      {...props}
    />
  );
}

/**
 * Renders a compact title inside a frame header.
 *
 * This is visual text styling, not a semantic heading. Use the `as` or
 * surrounding markup pattern from the caller when document outline matters.
 */
export function FrameTitle({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn("font-semibold text-sm", className)}
      data-slot="frame-panel-title"
      {...props}
    />
  );
}

/**
 * Renders supporting text inside a frame header.
 *
 * The description is intentionally passive copy and does not announce errors or
 * live state changes; use form or alert primitives for those behaviors.
 */
export function FrameDescription({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="frame-panel-description"
      {...props}
    />
  );
}

/**
 * Renders footer content for a framed panel.
 *
 * The footer owns spacing only. Action semantics, button grouping, and disabled
 * behavior remain with the caller's controls.
 */
export function FrameFooter({
  className,
  ...props
}: React.ComponentProps<"footer">): React.ReactElement {
  return (
    <footer
      className={cn("px-5 py-4", className)}
      data-slot="frame-panel-footer"
      {...props}
    />
  );
}
