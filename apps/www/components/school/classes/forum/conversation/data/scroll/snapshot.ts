import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view/model";
import type { ConversationScrollSnapshot } from "@/components/school/classes/forum/store/session";

/**
 * Builds the persisted scroll snapshot for one settled transcript position.
 *
 * Snapshot restoration is semantic: `view` is the source of truth for where the
 * transcript should reopen, while offset is retained only for diagnostics.
 */
export function createConversationScrollSnapshot({
  isAtBottom,
  lastPostId,
  offset,
  renderedRowCount,
  view,
}: {
  isAtBottom: boolean;
  lastPostId: ConversationScrollSnapshot["lastPostId"];
  offset: ConversationScrollSnapshot["offset"];
  renderedRowCount: ConversationScrollSnapshot["renderedRowCount"];
  view: ConversationView;
}) {
  return {
    lastPostId,
    offset,
    renderedRowCount,
    view,
    wasAtBottom: isAtBottom,
  } satisfies ConversationScrollSnapshot;
}
