import { cn } from "@repo/design-system/lib/utils";
import type { ParagraphProps } from "@repo/design-system/types/markdown";

export function Paragraph({ children, className, ...props }: ParagraphProps) {
  return (
    <p
      className={cn(
        "my-4 text-pretty text-base leading-relaxed first:mt-0 last:mb-0 [&_em]:text-foreground [&_strong]:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </p>
  );
}
