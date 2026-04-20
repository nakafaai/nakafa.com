import type { VirtualScrollToIndexOptions } from "@repo/design-system/types/virtual";
import type { VirtualItem } from "@tanstack/react-virtual";

/** Returns one measured virtual item snapshot when TanStack already knows it. */
export function getMeasuredVirtualItem(
  measurements: VirtualItem[],
  index: number
) {
  return measurements[index] ?? null;
}

/** Applies one caller-provided offset on top of TanStack's resolved alignment. */
export function getAlignedScrollOffset({
  align,
  offset,
  totalSize,
  viewportHeight,
  virtualOffset,
}: {
  align: NonNullable<VirtualScrollToIndexOptions["align"]>;
  offset: number;
  totalSize: number;
  viewportHeight: number;
  virtualOffset: number;
}) {
  if (offset === 0 || align === "auto") {
    return virtualOffset;
  }

  const nextOffset =
    align === "start" ? virtualOffset - offset : virtualOffset + offset;
  const maxScrollTop = Math.max(0, totalSize - viewportHeight);

  return Math.min(Math.max(0, nextOffset), maxScrollTop);
}
