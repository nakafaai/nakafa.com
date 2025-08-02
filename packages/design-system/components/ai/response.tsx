"use client";

import { cn } from "@repo/design-system/lib/utils";
import { reactMdxComponents } from "@repo/design-system/markdown/react-mdx";
import { marked } from "marked";
import type { HTMLAttributes } from "react";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const MemoizedBlock = memo(
  ({ content }: { content: string }) => (
    <ReactMarkdown
      components={reactMdxComponents}
      remarkPlugins={[remarkGfm, remarkMath]}
    >
      {content}
    </ReactMarkdown>
  ),
  (prevProps, nextProps) => prevProps.content === nextProps.content
);
MemoizedBlock.displayName = "MemoizedBlock";

export type AIResponseProps = HTMLAttributes<HTMLDivElement> & {
  id: string;
  content: string;
};

export const AIResponse = memo(
  ({ className, content, id, ...props }: AIResponseProps) => {
    const blocks = useMemo(() => {
      return parseMarkdownIntoBlocks(transformMarkdown(content));
    }, [content]);

    return (
      <div className={cn("size-full", className)} {...props}>
        {blocks.map((block, index) => (
          <MemoizedBlock
            content={block}
            // biome-ignore lint/suspicious/noArrayIndexKey: "This is a unique key"
            key={`${id}-block_${index}`}
          />
        ))}
      </div>
    );
  }
);
AIResponse.displayName = "AIResponse";

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}

function transformMarkdown(content: string) {
  return content
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$")
    .replace(/\\\[/g, "$$")
    .replace(/\\\]/g, "$$");
}
