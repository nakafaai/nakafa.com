"use client";

import { cn } from "@repo/design-system/lib/utils";
import { reactMdxComponents } from "@repo/design-system/markdown/react-mdx";
import { marked } from "marked";
import type { HTMLAttributes } from "react";
import { memo, useMemo } from "react";
import ReactMarkdown, { type Options } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}

const MemoizedBlock = memo(
  ({ content, options }: { content: string; options?: Options }) => (
    <ReactMarkdown
      components={reactMdxComponents}
      rehypePlugins={[rehypeKatex]}
      remarkPlugins={[remarkGfm, remarkMath]}
      {...options}
    >
      {content}
    </ReactMarkdown>
  ),
  (prevProps, nextProps) => {
    if (prevProps.content !== nextProps.content) {
      return false;
    }
    return true;
  }
);
MemoizedBlock.displayName = "MemoizedBlock";

export type AIResponseProps = HTMLAttributes<HTMLDivElement> & {
  options?: Options;
  id: string;
  children: Options["children"];
};

export const AIResponse = memo(
  ({ className, options, children, id, ...props }: AIResponseProps) => {
    const blocks = useMemo(
      () => parseMarkdownIntoBlocks(children?.toString() ?? ""),
      [children]
    );

    return (
      <div
        className={cn(
          "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          className
        )}
        {...props}
      >
        {blocks.map((block, index) => (
          <MemoizedBlock
            content={block}
            // biome-ignore lint/suspicious/noArrayIndexKey: "This is a unique key"
            key={`${id}-block-${index}`}
            options={options}
          />
        ))}
      </div>
    );
  }
);
AIResponse.displayName = "AIResponse";
