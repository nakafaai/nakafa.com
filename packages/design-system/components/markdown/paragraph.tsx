import type { ParagraphProps } from "@repo/design-system/types/markdown";
import { cva } from "class-variance-authority";
import { cn } from "cn";

/**
 * The classes of a paragraph in a published article. The editor of a question's prompt draws
 * its paragraphs with the same classes, so a question reads the same in both.
 */
export const paragraphVariants = cva(
  "my-4 text-pretty tabular-nums leading-relaxed first:mt-0 last:mb-0"
);

export function Paragraph({ children, className, ...props }: ParagraphProps) {
  return (
    <p className={cn(paragraphVariants(), className)} {...props}>
      {children}
    </p>
  );
}
