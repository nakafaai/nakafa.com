"use client";

import {
  MarkdownBlock,
  MarkdownFrame,
  type MarkdownResponseProps,
  type MarkdownSecurityProps,
} from "@repo/design-system/components/ai/markdown";
import { readMarkdownBlocks } from "@repo/design-system/lib/markdown/blocks";
import { normalizeText } from "@repo/design-system/lib/markdown/normalize";
import { memo, useMemo } from "react";

export type HardenedMarkdownProps = MarkdownSecurityProps;
export type ResponseProps = MarkdownResponseProps;

const MemoizedMarkdownBlock = memo(
  MarkdownBlock,
  (previous, next) => previous.children === next.children
);

/** Splits a response into stable markdown blocks for streaming updates. */
function Blocks({
  allowedImagePrefixes,
  allowedLinkPrefixes,
  children,
  defaultOrigin,
  id,
}: MarkdownResponseProps) {
  const blocks = useMemo(
    () => readMarkdownBlocks(id, children),
    [children, id]
  );

  return blocks.map((block) => (
    <MemoizedMarkdownBlock
      allowedImagePrefixes={allowedImagePrefixes}
      allowedLinkPrefixes={allowedLinkPrefixes}
      defaultOrigin={defaultOrigin}
      key={block.key}
    >
      {block.content}
    </MemoizedMarkdownBlock>
  ));
}

const MemoizedBlocks = memo(
  Blocks,
  (previous, next) => previous.children === next.children
);

/** Renders the hardened block collection for one response. */
function ResponseContent({
  allowedImagePrefixes,
  allowedLinkPrefixes,
  children,
  className,
  defaultOrigin,
  id,
}: ResponseProps) {
  return (
    <MarkdownFrame className={className}>
      <MemoizedBlocks
        allowedImagePrefixes={allowedImagePrefixes}
        allowedLinkPrefixes={allowedLinkPrefixes}
        defaultOrigin={defaultOrigin}
        id={id}
      >
        {children}
      </MemoizedBlocks>
    </MarkdownFrame>
  );
}

const MemoizedResponseContent = memo(
  ResponseContent,
  (previous, next) => previous.children === next.children
);

/** Normalizes and renders one streamed markdown response. */
export function Response({ children, ...props }: ResponseProps) {
  const normalizedChildren = useMemo(() => normalizeText(children), [children]);

  return (
    <MemoizedResponseContent {...props}>
      {normalizedChildren}
    </MemoizedResponseContent>
  );
}
