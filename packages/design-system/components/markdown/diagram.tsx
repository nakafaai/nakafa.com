import { FlowchartIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "cn";
import type { ReactNode } from "react";

interface DiagramFrameProps {
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly title: string;
}

/**
 * A diagram card's frame: the header with the title and its actions, and a
 * stage whose height never depends on the diagram. The card and the
 * placeholder shown while its code loads share it, so both have one size.
 */
export function DiagramFrame({
  actions,
  children,
  className,
  title,
}: DiagramFrameProps) {
  return (
    <div
      className={cn(
        "my-4 w-full divide-y overflow-hidden rounded-xl border shadow-sm",
        className
      )}
      data-nakafa="mermaid-card"
    >
      <div className="flex items-center justify-between gap-2 bg-muted/80 p-1 text-muted-foreground text-sm">
        <div className="flex min-w-0 items-center gap-2 px-4 py-1.5">
          <HugeIcons className="size-4" icon={FlowchartIcon} />
          <span className="ml-1 truncate text-foreground">{title}</span>
        </div>
        {/* Reserves the three icon buttons' space before the actions load, so
            neither the header nor the title changes size when they arrive. */}
        <div className="flex min-h-9 min-w-27 items-center">{actions}</div>
      </div>
      <div className="flex h-80 bg-muted/40 p-4 text-base sm:h-96">
        {children}
      </div>
    </div>
  );
}
