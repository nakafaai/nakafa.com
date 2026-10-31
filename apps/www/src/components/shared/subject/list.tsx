import { cn } from "cn";
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
        "bg-card text-card-foreground grid divide-y overflow-hidden rounded-xl border shadow-sm",
        className
      )}
    />
  );
}
