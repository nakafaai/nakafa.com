"use client";

import { reactMdxComponents } from "@repo/design-system/components/markdown/react-mdx";
import { parseMarkdownIntoBlocks } from "@repo/design-system/lib/markdown/blocks";
import { preprocessLaTeX } from "@repo/design-system/lib/markdown/math";
import { normalizeText } from "@repo/design-system/lib/markdown/normalize";
import { cn } from "@repo/design-system/lib/utils";
import hardenReactMarkdown from "harden-react-markdown";
import type { ComponentProps } from "react";
import { memo, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const DEFAULT_ALLOWED_PREFIXES = ["*"];
const HASH_MODULO = 1_000_000_007;
const HASH_MULTIPLIER = 31;
const REMARK_PLUGINS = [
  remarkGfm,
  [remarkMath, { singleDollarTextMath: false }],
] satisfies ComponentProps<typeof ReactMarkdown>["remarkPlugins"];

export interface HardenedMarkdownProps {
  allowedImagePrefixes?: ComponentProps<
    ReturnType<typeof hardenReactMarkdown>
  >["allowedImagePrefixes"];
  allowedLinkPrefixes?: ComponentProps<
    ReturnType<typeof hardenReactMarkdown>
  >["allowedLinkPrefixes"];
  defaultOrigin?: ComponentProps<
    ReturnType<typeof hardenReactMarkdown>
  >["defaultOrigin"];
}

export type ResponseProps = {
  id: string;
  children: string;
  className?: string;
} & HardenedMarkdownProps;

const MemoizedHardenedMarkdown = memo(
  hardenReactMarkdown(ReactMarkdown),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
MemoizedHardenedMarkdown.displayName = "MemoizedHardenedMarkdown";

/**
 * Builds a compact, content-based key for a rendered markdown block.
 */
function getMarkdownBlockKey(
  responseId: string,
  block: string,
  duplicateIndex: number
) {
  return `${responseId}-block-${hashString(block)}-${duplicateIndex}`;
}

/**
 * Creates a deterministic non-cryptographic hash for React keys.
 */
function hashString(value: string) {
  let hash = 0;

  for (const char of value) {
    hash = (hash * HASH_MULTIPLIER + char.charCodeAt(0)) % HASH_MODULO;
  }

  return hash.toString(36);
}

const Block = memo(
  ({
    children,
    ...props
  }: HardenedMarkdownProps & Pick<ResponseProps, "children">) => {
    const parsedContent = useMemo(
      () => preprocessLaTeX(children.trim()),
      [children]
    );

    // Return null if content is empty after trimming whitespace
    if (!parsedContent.trim()) {
      return null;
    }

    return (
      <MemoizedHardenedMarkdown
        components={reactMdxComponents}
        remarkPlugins={REMARK_PLUGINS}
        skipHtml
        {...props}
      >
        {parsedContent}
      </MemoizedHardenedMarkdown>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
Block.displayName = "Block";

const Blocks = memo(
  ({
    id,
    children,
    ...props
  }: HardenedMarkdownProps & Pick<ResponseProps, "children" | "id">) => {
    const blocks = useMemo(() => parseMarkdownIntoBlocks(children), [children]);
    const blockOccurrences = new Map<string, number>();

    return blocks.map((block) => {
      const duplicateIndex = blockOccurrences.get(block) ?? 0;
      blockOccurrences.set(block, duplicateIndex + 1);

      return (
        <Block key={getMarkdownBlockKey(id, block, duplicateIndex)} {...props}>
          {block}
        </Block>
      );
    });
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
Blocks.displayName = "Blocks";

const ResponseContent = memo(
  ({
    className,
    children,
    allowedImagePrefixes = DEFAULT_ALLOWED_PREFIXES,
    allowedLinkPrefixes = DEFAULT_ALLOWED_PREFIXES,
    defaultOrigin = "https://nakafa.com",
    ...props
  }: ResponseProps) => (
    <div
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
    >
      <Blocks
        allowedImagePrefixes={allowedImagePrefixes}
        allowedLinkPrefixes={allowedLinkPrefixes}
        defaultOrigin={defaultOrigin}
        {...props}
      >
        {children}
      </Blocks>
    </div>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
ResponseContent.displayName = "ResponseContent";

export const Response = memo(
  ({
    id,
    children,
    className,
    allowedImagePrefixes,
    allowedLinkPrefixes,
    defaultOrigin,
  }: ResponseProps) => {
    const wrap = useCallback(
      (v: string) => {
        const normalizedChildren = normalizeText(v);
        return (
          <ResponseContent
            allowedImagePrefixes={allowedImagePrefixes}
            allowedLinkPrefixes={allowedLinkPrefixes}
            className={className}
            defaultOrigin={defaultOrigin}
            id={id}
          >
            {normalizedChildren}
          </ResponseContent>
        );
      },
      [id, className, allowedImagePrefixes, allowedLinkPrefixes, defaultOrigin]
    );

    return wrap(children);
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
Response.displayName = "Response";
