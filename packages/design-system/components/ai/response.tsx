"use client";

import {
  MarkdownBlock,
  type MarkdownContentProps,
} from "@repo/design-system/components/markdown/content";
import { markdownFrameVariants } from "@repo/design-system/components/markdown/frame";
import { readMarkdownBlocks } from "@repo/design-system/lib/markdown/blocks";
import { normalizeText } from "@repo/design-system/lib/markdown/normalize";
import { trimIncompleteTail } from "@repo/design-system/lib/markdown/stream";
import { cn } from "cn";
import { Array as Arr } from "effect";
import { memo, useMemo } from "react";

type ResponseProps = MarkdownContentProps & {
  /** Withholds a trailing formula or diagram until its source is complete. */
  readonly isStreaming?: boolean;
};

const MemoizedMarkdownBlock = memo(MarkdownBlock);

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
  const blocks = useMemo(
    () => readMarkdownBlocks(id, normalizedChildren),
    [id, normalizedChildren]
  );
  // One value for every block keeps each memoized block from re-rendering when
  // the response grows.
  const security = useMemo(
    () => ({ allowedImagePrefixes, allowedLinkPrefixes, defaultOrigin }),
    [allowedImagePrefixes, allowedLinkPrefixes, defaultOrigin]
  );

  return (
    <div className={cn(markdownFrameVariants({ variant }), className)}>
      {Arr.map(blocks, (block) => (
        <MemoizedMarkdownBlock key={block.key} security={security}>
          {block.content}
        </MemoizedMarkdownBlock>
      ))}
    </div>
  );
}
