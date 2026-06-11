import { cn } from "@repo/design-system/lib/utils";
import type React from "react";

/**
 * Renders the COSS loading placeholder using Nakafa's muted token.
 *
 * This primitive is decorative and state-free; callers choose dimensions and
 * placement through class names while the design system owns the shimmer
 * animation and color invariant.
 */
export function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "animate-skeleton rounded-sm [--skeleton-highlight:--alpha(var(--color-white)/64%)] [background:linear-gradient(120deg,transparent_40%,var(--skeleton-highlight),transparent_60%)_var(--color-muted)_0_0/200%_100%_fixed] dark:[--skeleton-highlight:--alpha(var(--color-white)/4%)]",
        className
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}
