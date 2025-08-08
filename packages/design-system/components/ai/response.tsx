"use client";

import { cn } from "@repo/design-system/lib/utils";
import { reactMdxComponents } from "@repo/design-system/markdown/react-mdx";
import hardenReactMarkdown from "harden-react-markdown";
import { marked } from "marked";
import type { ComponentProps, HTMLAttributes } from "react";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

// Create a hardened version of ReactMarkdown
const HardenedMarkdown = hardenReactMarkdown(ReactMarkdown);

const MemoizedBlock = memo(
  ({
    children,
    ...props
  }: { children: string } & ComponentProps<typeof HardenedMarkdown>) => (
    <HardenedMarkdown
      components={reactMdxComponents}
      remarkPlugins={[remarkGfm, remarkMath]}
      {...props}
    >
      {children}
    </HardenedMarkdown>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
MemoizedBlock.displayName = "MemoizedBlock";

export type AIResponseProps = HTMLAttributes<HTMLDivElement> & {
  id: string;
  children: string;
  allowedImagePrefixes?: ComponentProps<
    ReturnType<typeof hardenReactMarkdown>
  >["allowedImagePrefixes"];
  allowedLinkPrefixes?: ComponentProps<
    ReturnType<typeof hardenReactMarkdown>
  >["allowedLinkPrefixes"];
  defaultOrigin?: ComponentProps<
    ReturnType<typeof hardenReactMarkdown>
  >["defaultOrigin"];
};

export const AIResponse = memo(
  ({
    className,
    children,
    id,
    allowedImagePrefixes,
    allowedLinkPrefixes,
    defaultOrigin,
    ...props
  }: AIResponseProps) => {
    const blocks = useMemo(() => {
      return parseMarkdownIntoBlocks(transformMarkdown(children));
    }, [children]);

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
            allowedImagePrefixes={allowedImagePrefixes ?? ["*"]}
            allowedLinkPrefixes={allowedLinkPrefixes ?? ["*"]}
            defaultOrigin={defaultOrigin}
            // biome-ignore lint/suspicious/noArrayIndexKey: "This is a unique key"
            key={`${id}-block_${index}`}
          >
            {block}
          </MemoizedBlock>
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
