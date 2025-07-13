"use client";

import type {
  BundledLanguage,
  CodeBlockData,
} from "@repo/design-system/components/code-block";
import {
  CodeBlock,
  CodeBlockBody,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockFiles,
  CodeBlockHeader,
  CodeBlockItem,
  CodeBlockSelect,
  CodeBlockSelectContent,
  CodeBlockSelectItem,
  CodeBlockSelectTrigger,
  CodeBlockSelectValue,
} from "@repo/design-system/components/code-block";

export function CodeBlockMdx({ data }: { data: CodeBlockData[] }) {
  return (
    <CodeBlock data={data} defaultValue={data[0].language}>
      <CodeBlockHeader>
        <CodeBlockFiles>
          {(item) => (
            <CodeBlockFilename key={item.language} value={item.language}>
              {item.filename}
            </CodeBlockFilename>
          )}
        </CodeBlockFiles>
        <CodeBlockSelect>
          <CodeBlockSelectTrigger>
            <CodeBlockSelectValue />
          </CodeBlockSelectTrigger>
          <CodeBlockSelectContent align="end">
            {(item) => (
              <CodeBlockSelectItem key={item.language} value={item.language}>
                {item.language}
              </CodeBlockSelectItem>
            )}
          </CodeBlockSelectContent>
        </CodeBlockSelect>
        <CodeBlockCopyButton />
      </CodeBlockHeader>
      <CodeBlockBody>
        {(item) => (
          <CodeBlockItem key={item.language} value={item.language}>
            <CodeBlockContent language={item.language as BundledLanguage}>
              {item.code}
            </CodeBlockContent>
          </CodeBlockItem>
        )}
      </CodeBlockBody>
    </CodeBlock>
  );
}
