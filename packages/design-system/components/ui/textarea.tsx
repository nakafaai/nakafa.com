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
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 flex field-sizing-content min-h-16 w-full resize-none rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      data-slot="textarea"
      {...props}
    />
  );
}

export { Textarea };
