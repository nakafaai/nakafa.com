import { cva, type VariantProps } from "class-variance-authority";

/**
 * The shared response frame around any rendered block collection. The caller
 * applies these classes to the element that holds its blocks.
 */
export const markdownFrameVariants = cva(
  "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  {
    variants: {
      variant: {
        document: "",
        // Nina's answers read as a lesson reads, scaled from the chat's 15px base.
        chat: "prose-chat",
        // A note under an activity row, such as Nina's reasoning, reads at the
        // size of the row it belongs to.
        note: "text-sm/relaxed [&_[data-nakafa^=heading-]]:text-sm/relaxed [&_[data-nakafa^=heading-]]:font-semibold",
      },
    },
    compoundVariants: [
      {
        // Streamed text wraps greedily: pretty wrapping re-breaks earlier
        // lines every time the text grows, so words jump between lines.
        variant: ["chat", "note"],
        class:
          "[&_[data-nakafa^=heading-]]:text-wrap [&_li]:text-wrap [&_p]:text-wrap",
      },
    ],
    defaultVariants: { variant: "document" },
  }
);

export type MarkdownFrameVariant = VariantProps<typeof markdownFrameVariants>;
