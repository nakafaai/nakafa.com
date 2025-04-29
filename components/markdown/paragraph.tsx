import { cn } from "@/lib/utils";
import type { ParagraphProps } from "@/types/markdown";

export function Paragraph({ children, className, ...props }: ParagraphProps) {
  return (
    <p
      className={cn(
        "my-4 text-pretty text-base text-foreground/80 leading-relaxed first:mt-0 last:mb-0",
        className
      )}
      {...props}
    >
      {children}
    </p>
  );
}
