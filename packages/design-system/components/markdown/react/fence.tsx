import { TerminalIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { ReactNode } from "react";

interface CodeFenceProps {
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly icon?: ReactNode;
  readonly language: string;
}

/**
 * A response code block's frame: the header with the language and its
 * actions, and the code below. The block and the placeholder shown while the
 * highlighter loads share it, so both have one size.
 */
export function CodeFence({
  actions,
  children,
  icon,
  language,
}: CodeFenceProps) {
  return (
    <div
      className="my-4 w-full overflow-hidden rounded-xl border"
      data-code-block-container
      data-language={language}
    >
      <div
        className="flex items-center justify-between bg-muted/80 p-1 text-muted-foreground text-sm"
        data-code-block-header
        data-language={language}
      >
        <div className="flex items-center gap-2 px-4 py-1.5">
          {icon ?? <HugeIcons className="size-4" icon={TerminalIcon} />}
          <span className="font-mono lowercase">{language || "txt"}</span>
        </div>
        {/* Reserves the two icon buttons' space before the actions load, so
            the header keeps its size when they arrive. */}
        <div className="flex min-h-9 min-w-18 items-center">{actions}</div>
      </div>
      <div className="w-full">
        <div className="min-w-full">{children}</div>
      </div>
    </div>
  );
}
