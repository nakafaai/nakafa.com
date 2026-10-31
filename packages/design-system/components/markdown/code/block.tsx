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
import { Array as Arr, Schema, String as Str } from "effect";

/** The line count of a code block's first source, which its height stands in for while the browser skips it. */
const CodeLinesStyleSchema = Schema.Struct({ "--code-lines": Schema.Finite });

type CodeLinesStyle = React.CSSProperties & typeof CodeLinesStyleSchema.Type;

/** Composes authored MDX code sources into Nakafa's tabbed code block. */
export function CodeBlockMdx({ data }: { data: CodeBlockData[] }) {
  const style: CodeLinesStyle = {
    "--code-lines": Arr.length(Str.split(data[0].code, "\n")),
  };
  return (
    <CodeBlock
      className="content-auto-code my-4"
      data={data}
      defaultValue={data[0].language}
      style={style}
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
