import type { VirtualizerHandle } from "virtua";
import type { ConversationRow } from "@/components/school/classes/forum/conversation/data/pages";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view";

/** Returns the current bottom distance using Virtua's own measurements. */
export function getConversationBottomDistance(handle: VirtualizerHandle) {
  return Math.max(
    0,
    handle.scrollSize - handle.viewportSize - handle.scrollOffset
  );
}

/** Captures the current semantic transcript view from Virtua row offsets. */
export function captureConversationView({
  handle,
  rows,
}: {
  handle: VirtualizerHandle;
  rows: ConversationRow[];
}): ConversationView | null {
  if (getConversationBottomDistance(handle) <= 1) {
    return { kind: "bottom" };
  }

  const firstVisibleIndex = handle.findItemIndex(handle.scrollOffset);

  for (let index = firstVisibleIndex; index < rows.length; index += 1) {
    const row = rows[index];

    if (row?.type !== "post") {
      continue;
    }

    return {
      kind: "post",
      offset: handle.getItemOffset(index) - handle.scrollOffset,
      postId: row.post._id,
    };
  }

  return null;
}

/** Returns the exact scroll offset needed to restore one semantic post view. */
export function getConversationViewOffset({
  handle,
  index,
  view,
}: {
  handle: VirtualizerHandle;
  index: number;
  view: Extract<ConversationView, { kind: "post" }>;
}) {
  return Math.max(0, handle.getItemOffset(index) - view.offset);
}
