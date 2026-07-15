"use client";

import { CodeBlock } from "@repo/design-system/components/code-block";
import {
  CodeBlockBody,
  CodeBlockItem,
} from "@repo/design-system/components/code-block/body";
import { CodeBlockContent } from "@repo/design-system/components/code-block/content";
import { CodeBlockCopyButton } from "@repo/design-system/components/code-block/copy-button";
import {
  CodeBlockFilename,
  CodeBlockFiles,
  CodeBlockHeader,
  CodeBlockSelect,
  CodeBlockSelectContent,
  CodeBlockSelectItem,
  CodeBlockSelectTrigger,
  CodeBlockSelectValue,
} from "@repo/design-system/components/code-block/header";
import type { CodeBlockData } from "@repo/design-system/lib/code-block/context";

/** Composes authored MDX code sources into Nakafa's tabbed code block. */
export function CodeBlockMdx({ data }: { data: CodeBlockData[] }) {
  return (
    <CodeBlock
      className="my-4 content-auto-code"
      data={data}
      defaultValue={data[0].language}
    >
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
            <CodeBlockContent language={item.language}>
              {item.code}
            </CodeBlockContent>
          </CodeBlockItem>
        )}
      </CodeBlockBody>
    </CodeBlock>
  );
}
