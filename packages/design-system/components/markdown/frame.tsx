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
        chat: [
          "text-chat",
          // Nina's headings step down from level one so the order of her
          // thinking shows, with more room above a heading than below it.
          // Levels four to six read at the size of the answer. The content
          // under a heading starts at the heading's own bottom margin.
          "[&_[data-nakafa=heading-1]:not(:first-child)]:mt-9 [&_[data-nakafa=heading-1]:not(:last-child)]:mb-2.5 [&_[data-nakafa=heading-1]]:text-chat-h1",
          "[&_[data-nakafa=heading-2]:not(:first-child)]:mt-7 [&_[data-nakafa=heading-2]:not(:last-child)]:mb-2 [&_[data-nakafa=heading-2]]:text-chat-h2",
          "[&_[data-nakafa=heading-3]:not(:first-child)]:mt-5.5 [&_[data-nakafa=heading-3]:not(:last-child)]:mb-1.5 [&_[data-nakafa=heading-3]]:text-chat-h3",
          "[&_:is([data-nakafa=heading-4],[data-nakafa=heading-5],[data-nakafa=heading-6]):not(:first-child)]:mt-4.5 [&_:is([data-nakafa=heading-4],[data-nakafa=heading-5],[data-nakafa=heading-6]):not(:last-child)]:mb-1 [&_:is([data-nakafa=heading-4],[data-nakafa=heading-5],[data-nakafa=heading-6])]:text-chat-h4",
          "[&_[data-nakafa^=heading-]+:not([data-nakafa^=heading-])]:mt-0",
        ],
        // A note under an activity row, such as Nina's reasoning, reads at the
        // size of the row it belongs to.
        note: "text-sm/relaxed [&_[data-nakafa^=heading-]]:font-semibold [&_[data-nakafa^=heading-]]:text-sm/relaxed",
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
