import { Textarea as TextareaPrimitive } from "@ui-sdk/react/textarea";
import { cn } from "cn";
import type * as React from "react";

/**
 * A multi-line text field that grows with its words, showing what to write in its placeholder. Its `min-height` and
 * `max-height` bound it; past the maximum its words scroll inside it. Its text reads from `onValueChange`, which an
 * agent's writes reach as a reader's typing does.
 */
function Textarea({
  autoResize = true,
  className,
  ...props
}: Omit<React.ComponentProps<typeof TextareaPrimitive>, "placeholder"> & {
  /** What the field shows while empty: an example or a short hint of what to write. */
  placeholder: string;
}) {
  return (
    <TextareaPrimitive
      autoResize={autoResize}
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 flex field-sizing-content min-h-16 w-full resize-none rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 md:pointer-fine:text-sm",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
