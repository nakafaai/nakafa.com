import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";

/** Renders the established bordered list shell used by chooser pages. */
export function SubjectList({
  className,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      {...props}
      className={cn(
        "grid divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm",
        className
      )}
    />
  );
}
