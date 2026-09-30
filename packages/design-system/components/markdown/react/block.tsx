"use client";

import { TerminalIcon } from "@hugeicons/core-free-icons";
import {
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
  CodeBlockSource,
} from "@repo/design-system/components/ai/code-block";
import { CodeBlockContent } from "@repo/design-system/components/code-block/content";
import { codeBlockDarkModeVariants } from "@repo/design-system/components/code-block/variants";
import { SimpleIcon } from "@repo/design-system/components/icons/simple";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { languageIconMap } from "@repo/design-system/lib/code-block/icons";
import { cn } from "cn";
import type { BundledTheme } from "shiki";

const CODE_THEMES = {
  dark: "github-dark",
  light: "github-light",
} satisfies Record<"dark" | "light", BundledTheme>;

interface MarkdownCodeBlockProps {
  readonly className?: string | undefined;
  readonly code: string;
  readonly language: string;
}

/** Renders one fenced response block, highlighted, with the shared code controls. */
export function MarkdownCodeBlock({
  className,
  code,
  language,
}: MarkdownCodeBlockProps) {
  const icon = languageIconMap[language];

  return (
    <CodeBlockSource code={code} language={language}>
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
            {icon ? (
              <SimpleIcon className="size-4" icon={icon} />
            ) : (
              <HugeIcons className="size-4" icon={TerminalIcon} />
            )}
            <span className="font-mono lowercase">{language || "txt"}</span>
          </div>
          <div className="flex items-center">
            <CodeBlockDownloadButton />
            <CodeBlockCopyButton />
          </div>
        </div>
        <div className="w-full">
          <div className="min-w-full">
            <CodeBlockContent
              className={cn(
                codeBlockDarkModeVariants(),
                "overflow-x-auto border-t",
                className
              )}
              data-code-block
              data-language={language}
              data-nakafa="code-block"
              language={language}
              preClassName="overflow-x-auto font-mono text-sm p-4 bg-muted/40"
              themes={CODE_THEMES}
              transparentBackground
            >
              {code}
            </CodeBlockContent>
          </div>
        </div>
      </div>
    </CodeBlockSource>
  );
}
