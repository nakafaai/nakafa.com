import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";

interface ExpressionProps {
  value: string;
}

/**
 * Keeps rendered math in the same muted tone as the surrounding evidence. The
 * math never breaks into lines, so a value wider than its column scrolls
 * sideways inside its own scroll area, with a fade at the edge it runs past,
 * and nothing around it scrolls.
 */
export function Expression({ value }: ExpressionProps) {
  return (
    <div className="min-w-0 max-w-full">
      <ScrollArea scrollFade>
        <span className="inline-flex w-max items-center whitespace-nowrap py-1 text-muted-foreground [&_.katex]:text-muted-foreground">
          <InlineMath>{value}</InlineMath>
        </span>
      </ScrollArea>
    </div>
  );
}
