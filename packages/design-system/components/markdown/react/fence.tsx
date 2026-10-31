import { TerminalIcon } from "@hugeicons/core-free-icons";
import {
  codeFrameVariants,
  codeHeaderVariants,
  codeLabelVariants,
} from "@repo/design-system/components/code-block/variants";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { blockGapVariants } from "@repo/design-system/lib/prose";
import type { ReactNode } from "react";

interface CodeFenceProps {
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly icon?: ReactNode;
  readonly language: string;
}

/**
 * A response code block's frame: the header with the language and its
 * actions, and the code below, in the anatomy a lesson's code block draws
 * (`code-block/variants.ts`) and with an article's room around it. The block
 * and the placeholder shown while the highlighter loads share it, so both have
 * one size.
 */
export function CodeFence({
  actions,
  children,
  icon,
  language,
}: CodeFenceProps) {
  return (
    <div
      className={codeFrameVariants({ className: blockGapVariants() })}
      data-code-block-container
      data-language={language}
    >
      <div
        className={codeHeaderVariants()}
        data-code-block-header
        data-language={language}
      >
        <div className={codeLabelVariants()}>
          {icon ?? <HugeIcons className="size-4" icon={TerminalIcon} />}
          <span className="truncate font-mono lowercase" title={language}>
            {language || "txt"}
          </span>
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
