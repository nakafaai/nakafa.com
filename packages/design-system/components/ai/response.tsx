"use client";

import {
  MarkdownBlock,
  type MarkdownContentProps,
  type MarkdownSecurityProps,
} from "@repo/design-system/components/markdown/content";
import { MarkdownFrame } from "@repo/design-system/components/markdown/frame";
import { readMarkdownBlocks } from "@repo/design-system/lib/markdown/blocks";
import { normalizeText } from "@repo/design-system/lib/markdown/normalize";
import { trimIncompleteTail } from "@repo/design-system/lib/markdown/stream";
import { memo, useMemo } from "react";

export type HardenedMarkdownProps = MarkdownSecurityProps;
export type ResponseProps = Omit<MarkdownContentProps, "variant"> & {
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
  isStreaming = false,
}: ResponseProps) {
  const normalizedChildren = useMemo(() => {
    const text = normalizeText(children);
    return isStreaming ? trimIncompleteTail(text) : text;
  }, [children, isStreaming]);

  return (
    <MarkdownFrame className={className} variant="chat">
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
