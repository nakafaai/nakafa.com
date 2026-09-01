"use client";

import {
  MarkdownBlock,
  type MarkdownContentProps,
  MarkdownFrame,
  type MarkdownSecurityProps,
} from "@repo/design-system/components/markdown/content";
import { readMarkdownBlocks } from "@repo/design-system/lib/markdown/blocks";
import { normalizeText } from "@repo/design-system/lib/markdown/normalize";
import { memo, useMemo } from "react";

export type HardenedMarkdownProps = MarkdownSecurityProps;
export type ResponseProps = MarkdownContentProps;

const MemoizedMarkdownBlock = memo(MarkdownBlock);

/** Splits a response into stable markdown blocks for streaming updates. */
function Blocks({
  allowedImagePrefixes,
  allowedLinkPrefixes,
  children,
  defaultOrigin,
  id,
}: MarkdownContentProps) {
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

const MemoizedBlocks = memo(Blocks);

/** Normalizes and renders one streamed markdown response. */
export function Response({
  allowedImagePrefixes,
  allowedLinkPrefixes,
  children,
  className,
  defaultOrigin,
  id,
}: ResponseProps) {
  const normalizedChildren = useMemo(() => normalizeText(children), [children]);

  return (
    <MarkdownFrame className={className}>
      <MemoizedBlocks
        allowedImagePrefixes={allowedImagePrefixes}
        allowedLinkPrefixes={allowedLinkPrefixes}
        defaultOrigin={defaultOrigin}
        id={id}
      >
        {normalizedChildren}
      </MemoizedBlocks>
    </MarkdownFrame>
  );
}
