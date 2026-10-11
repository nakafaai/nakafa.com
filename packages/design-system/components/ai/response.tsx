"use client";

import {
  MarkdownBlock,
  type MarkdownContentProps,
} from "@repo/design-system/components/markdown/content";
import { MarkdownFrame } from "@repo/design-system/components/markdown/frame";
import { readMarkdownBlocks } from "@repo/design-system/lib/markdown/blocks";
import { normalizeText } from "@repo/design-system/lib/markdown/normalize";
import { trimIncompleteTail } from "@repo/design-system/lib/markdown/stream";
import { Array as Arr } from "effect";
import { memo, useMemo } from "react";

type ResponseProps = MarkdownContentProps & {
  /** Withholds a trailing formula or diagram until its source is complete. */
  readonly isStreaming?: boolean;
};

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

  return Arr.map(blocks, (block) => (
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

/**
 * Normalizes and renders one streamed markdown response: an answer at the chat
 * size, or with `variant="note"` a note at the size of its activity row.
 */
export function Response({
  allowedImagePrefixes,
  allowedLinkPrefixes,
  children,
  className,
  defaultOrigin,
  id,
  isStreaming = false,
  variant = "chat",
}: ResponseProps) {
  const normalizedChildren = useMemo(() => {
    const text = normalizeText(children);
    return isStreaming ? trimIncompleteTail(text) : text;
  }, [children, isStreaming]);

  return (
    <MarkdownFrame className={className} variant={variant}>
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
