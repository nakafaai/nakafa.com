import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ReactNode } from "react";

const markdownFrameVariants = cva(
  "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  {
    variants: {
      variant: {
        document: "",
        // Chat text wraps greedily: pretty wrapping re-breaks earlier lines
        // every time a streamed answer grows, so words jump between lines.
        chat: "text-chat [&_[data-nakafa^=heading-]]:text-wrap [&_[data-nakafa^=heading-]]:font-semibold [&_[data-nakafa^=heading-]]:text-chat [&_li]:text-wrap [&_p]:text-wrap",
      },
    },
    defaultVariants: { variant: "document" },
  }
);

export type MarkdownFrameVariant = VariantProps<typeof markdownFrameVariants>;

type MarkdownFrameProps = {
  readonly children: ReactNode;
  readonly className?: string | undefined;
} & MarkdownFrameVariant;

/** Preserves the shared response frame around any rendered block collection. */
export function MarkdownFrame({
  children,
  className,
  variant,
}: MarkdownFrameProps) {
  return (
    <div className={cn(markdownFrameVariants({ variant }), className)}>
      {children}
    </div>
  );
}
