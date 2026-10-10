import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ReactNode } from "react";

const markdownFrameVariants = cva(
  "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  {
    variants: {
      variant: {
        document: "",
        chat: "text-chat [&_[data-nakafa^=heading-]]:text-chat",
        // A note under an activity row, such as Nina's reasoning, reads at the
        // size of the row it belongs to.
        note: "text-sm/relaxed [&_[data-nakafa^=heading-]]:text-sm/relaxed",
      },
    },
    compoundVariants: [
      {
        // Streamed text wraps greedily: pretty wrapping re-breaks earlier
        // lines every time the text grows, so words jump between lines.
        variant: ["chat", "note"],
        class:
          "[&_[data-nakafa^=heading-]]:text-wrap [&_[data-nakafa^=heading-]]:font-semibold [&_li]:text-wrap [&_p]:text-wrap",
      },
    ],
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
