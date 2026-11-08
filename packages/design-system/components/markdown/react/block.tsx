import {
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
  CodeBlockSource,
} from "@repo/design-system/components/ai/code";
import { CodeBlockContent } from "@repo/design-system/components/code/content";
import { codeBodyVariants } from "@repo/design-system/components/code/variants";
import { SimpleIcon } from "@repo/design-system/components/icons/simple";
import { CodeFence } from "@repo/design-system/components/markdown/react/fence";
import { useFenceSource } from "@repo/design-system/components/markdown/react/source";
import { DEFAULT_CODE_THEMES } from "@repo/design-system/lib/code/highlight";
import { languageIconMap } from "@repo/design-system/lib/code/icons";

/**
 * Renders one fenced response block, highlighted, with the shared code controls.
 * It reads its source from the block that loads it, so it takes no props.
 */
export function MarkdownCodeBlock() {
  const { className, code, language } = useFenceSource();
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
          className={codeBodyVariants({ className })}
          data-code-block
          data-language={language}
          data-nakafa="code-block"
          language={language}
          themes={DEFAULT_CODE_THEMES}
          transparentBackground
        >
          {code}
        </CodeBlockContent>
      </CodeFence>
    </CodeBlockSource>
  );
}
