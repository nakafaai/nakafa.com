import type { VirtualConversationAnchor } from "@repo/design-system/types/virtual";

const INDEX_ANCHOR_SETTLE_EPSILON = 2;

/** Returns whether one initial index anchor can settle to an exact scroll offset. */
export function canSettleIndexAnchor(anchor: VirtualConversationAnchor) {
  return (
    anchor.kind === "index" &&
    (anchor.align === undefined || anchor.align === "start")
  );
}

/** Resolves the expected scroll offset for an exact start-aligned index anchor. */
export function getIndexAnchorOffset({
  anchor,
  itemOffset,
}: {
  anchor: VirtualConversationAnchor;
  itemOffset: number;
}) {
  if (!(anchor.kind === "index" && canSettleIndexAnchor(anchor))) {
    return null;
  }

  return Math.max(0, itemOffset + (anchor.offset ?? 0));
}

/** Returns whether the measured offset is close enough to the expected anchor. */
export function isIndexAnchorSettled({
  actualOffset,
  expectedOffset,
}: {
  actualOffset: number;
  expectedOffset: number;
}) {
  return Math.abs(actualOffset - expectedOffset) <= INDEX_ANCHOR_SETTLE_EPSILON;
}
