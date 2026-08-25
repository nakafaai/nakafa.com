"use client";

import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
} from "@repo/design-system/components/ai/code-block";
import { cn } from "@repo/design-system/lib/utils";

interface MarkdownCodeBlockProps {
  readonly className?: string;
  readonly code: string;
  readonly language: string;
}

/** Renders one fenced response block with the shared code controls. */
export function MarkdownCodeBlock({
  className,
  code,
  language,
}: MarkdownCodeBlockProps) {
  return (
    <CodeBlock
      className={cn("overflow-x-auto border-t", className)}
      code={code}
      data-language={language}
      data-nakafa="code-block"
      language={language}
      preClassName="overflow-x-auto font-mono text-sm p-4 bg-muted/40"
    >
      <CodeBlockDownloadButton code={code} language={language} />
      <CodeBlockCopyButton />
    </CodeBlock>
  );
}
