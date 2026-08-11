"use client";

import { reactMdxComponents } from "@repo/design-system/components/markdown/react-mdx";
import { parseMarkdownIntoBlocks } from "@repo/design-system/lib/markdown/blocks";
import { preprocessLaTeX } from "@repo/design-system/lib/markdown/math";
import { normalizeText } from "@repo/design-system/lib/markdown/normalize";
import { cn } from "@repo/design-system/lib/utils";
import hardenReactMarkdown from "harden-react-markdown";
import type { ComponentProps } from "react";
import { memo, useMemo } from "react";
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

/** Renders one normalized markdown block. */
function Block({
  children,
  ...props
}: HardenedMarkdownProps & Pick<ResponseProps, "children">) {
  const parsedContent = useMemo(
    () => preprocessLaTeX(children.trim()),
    [children]
  );

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
}

const MemoizedBlock = memo(
  Block,
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

/** Splits a response into stable markdown blocks for streaming updates. */
function Blocks({
  id,
  children,
  ...props
}: HardenedMarkdownProps & Pick<ResponseProps, "children" | "id">) {
  const blocks = useMemo(() => parseMarkdownIntoBlocks(children), [children]);
  const blockOccurrences = new Map<string, number>();

  return blocks.map((block) => {
    const duplicateIndex = blockOccurrences.get(block) ?? 0;
    blockOccurrences.set(block, duplicateIndex + 1);

    return (
      <MemoizedBlock
        key={getMarkdownBlockKey(id, block, duplicateIndex)}
        {...props}
      >
        {block}
      </MemoizedBlock>
    );
  });
}

const MemoizedBlocks = memo(
  Blocks,
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

/** Renders the hardened block collection for one response. */
function ResponseContent({
  className,
  children,
  allowedImagePrefixes = DEFAULT_ALLOWED_PREFIXES,
  allowedLinkPrefixes = DEFAULT_ALLOWED_PREFIXES,
  defaultOrigin = "https://nakafa.com",
  ...props
}: ResponseProps) {
  return (
    <div
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
    >
      <MemoizedBlocks
        allowedImagePrefixes={allowedImagePrefixes}
        allowedLinkPrefixes={allowedLinkPrefixes}
        defaultOrigin={defaultOrigin}
        {...props}
      >
        {children}
      </MemoizedBlocks>
    </div>
  );
}

const MemoizedResponseContent = memo(
  ResponseContent,
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

/** Normalizes and renders one streamed markdown response. */
export function Response({
  id,
  children,
  className,
  allowedImagePrefixes,
  allowedLinkPrefixes,
  defaultOrigin,
}: ResponseProps) {
  const normalizedChildren = useMemo(() => normalizeText(children), [children]);

  return (
    <MemoizedResponseContent
      allowedImagePrefixes={allowedImagePrefixes}
      allowedLinkPrefixes={allowedLinkPrefixes}
      className={className}
      defaultOrigin={defaultOrigin}
      id={id}
    >
      {normalizedChildren}
    </MemoizedResponseContent>
  );
}
