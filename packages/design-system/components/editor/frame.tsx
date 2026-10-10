import { cn } from "cn";
import type { ComponentProps } from "react";

/**
 * The box of a text editor, and of the text that stands in for the editor
 * while it loads. Both draw inside it with the same type and spacing, so the
 * swap moves nothing.
 */
export function EditorFrame({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        "[&_.ProseMirror]:min-h-5 [&_.ProseMirror]:outline-none",
        "[&_.is-editor-empty]:before:pointer-events-none [&_.is-editor-empty]:before:float-left [&_.is-editor-empty]:before:h-0 [&_.is-editor-empty]:before:text-muted-foreground [&_.is-editor-empty]:before:content-[attr(data-placeholder)]",
        className
      )}
      data-slot="editor"
      {...props}
    />
  );
}

/**
 * The text an editor will show, read-only, in the place the editor takes. It
 * wraps the way the editor does, which also sets its ligatures aside, so a
 * line breaks in the same place in both.
 */
export function EditorStatic({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "wrap-break-word min-h-5 whitespace-break-spaces [font-variant-ligatures:none]",
        className
      )}
      data-slot="editor-static"
      {...props}
    />
  );
}
