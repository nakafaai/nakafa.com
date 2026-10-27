import { cn } from "cn";
import type * as React from "react";
import TextareaAutosize from "react-textarea-autosize";

/**
 * A multi-line text field that grows with its words, showing what to write in its placeholder.
 */
function Textarea({
  className,
  ...props
}: Omit<React.ComponentProps<typeof TextareaAutosize>, "placeholder"> & {
  /** What the field shows while empty: an example or a short hint of what to write. */
  placeholder: string;
}) {
  return (
    <TextareaAutosize
      className={cn(
        "field-sizing-content flex min-h-16 w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      data-slot="textarea"
      {...props}
    />
  );
}

export { Textarea };
