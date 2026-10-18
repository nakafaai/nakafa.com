import { paragraphVariants } from "@repo/design-system/lib/paragraph";
import type { ParagraphProps } from "@repo/design-system/types/markdown";
import { cn } from "cn";

export function Paragraph({ children, className, ...props }: ParagraphProps) {
  return (
    <p className={cn(paragraphVariants(), className)} {...props}>
      {children}
    </p>
  );
}
