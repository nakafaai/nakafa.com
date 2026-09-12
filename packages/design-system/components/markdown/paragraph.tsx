import type { ParagraphProps } from "@repo/design-system/types/markdown";
import { cn } from "cn";

export function Paragraph({ children, className, ...props }: ParagraphProps) {
  return (
    <p
      className={cn(
        "my-4 text-pretty tabular-nums leading-relaxed first:mt-0 last:mb-0",
        className
      )}
      {...props}
    >
      {children}
    </p>
  );
}
