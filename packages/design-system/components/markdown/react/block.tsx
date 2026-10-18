"use client";

import {
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
  CodeBlockSource,
} from "@repo/design-system/components/ai/code-block";
import { CodeBlockContent } from "@repo/design-system/components/code-block/content";
import { codeBlockDarkModeVariants } from "@repo/design-system/components/code-block/variants";
import { SimpleIcon } from "@repo/design-system/components/icons/simple";
import { CodeFence } from "@repo/design-system/components/markdown/react/fence";
import {
  codeFenceBodyVariants,
  codeFencePreVariants,
} from "@repo/design-system/components/markdown/react/variants";
import { DEFAULT_CODE_THEMES } from "@repo/design-system/lib/code-block/highlight";
import { languageIconMap } from "@repo/design-system/lib/code-block/icons";
import { cn } from "cn";

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
      <CodeFence
        actions={
          <>
            <CodeBlockDownloadButton />
            <CodeBlockCopyButton />
          </>
        }
        icon={icon && <SimpleIcon className="size-4" icon={icon} />}
        language={language}
      >
        <CodeBlockContent
          className={cn(
            codeBlockDarkModeVariants(),
            codeFenceBodyVariants(),
            className
          )}
          data-code-block
          data-language={language}
          data-nakafa="code-block"
          language={language}
          preClassName={codeFencePreVariants()}
          themes={DEFAULT_CODE_THEMES}
          transparentBackground
        >
          {code}
        </CodeBlockContent>
      </CodeFence>
    </CodeBlockSource>
  );
}
