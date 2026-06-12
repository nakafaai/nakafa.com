import { cn } from "@repo/design-system/lib/utils";
import type * as React from "react";

/**
 * Renders the native COSS keyboard hint element.
 *
 * The Module only owns visual keyboard-key styling. Callers still provide the
 * shortcut text or decorative icon and must keep any keyboard handling in the
 * owning interaction Module.
 */
export function Kbd({
  className,
  ...props
}: React.ComponentProps<"kbd">): React.ReactElement {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center gap-1 rounded-[.25rem] bg-muted px-1 font-medium font-sans text-muted-foreground text-xs [&_svg:not([class*='size-'])]:size-3",
        className
      )}
      data-slot="kbd"
      {...props}
    />
  );
}

/**
 * Groups adjacent COSS keyboard hints without changing key styling.
 *
 * This keeps command footers and button shortcut labels on the documented COSS
 * Kbd Interface instead of each caller restyling its own keycaps.
 */
export function KbdGroup({
  className,
  ...props
}: React.ComponentProps<"kbd">): React.ReactElement {
  return (
    <kbd
      className={cn("inline-flex items-center gap-1", className)}
      data-slot="kbd-group"
      {...props}
    />
  );
}
