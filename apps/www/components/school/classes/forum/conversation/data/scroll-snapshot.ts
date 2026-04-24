import type { ScrollToIndexOpts } from "virtua";
import type { ConversationUnreadCue } from "@/components/school/classes/forum/conversation/data/unread";
import type { ConversationScrollSnapshot } from "@/components/school/classes/forum/conversation/store/session";

type RestoreAlign = NonNullable<ScrollToIndexOpts["align"]>;

export type ConversationRestoreTarget =
  | { kind: "bottom" }
  | { kind: "offset"; offset: number }
  | {
      align: RestoreAlign;
      kind: "post";
      postId: ConversationUnreadCue["postId"];
    };

/**
 * Chooses the initial transcript restore target for one mounted forum.
 *
 * A fresh scroll snapshot wins over unread fallback because it represents the
 * viewer's last position in this tab session. When no snapshot exists, unread
 * wins over bottom so the first unseen message becomes the initial anchor.
 *
 * References:
 * - virtua scroll restoration story:
 *   https://github.com/inokawa/virtua/blob/main/stories/react/basics/VList.stories.tsx
 * - virtua advanced chat story:
 *   https://github.com/inokawa/virtua/blob/main/stories/react/advanced/Chat.stories.tsx
 */
export function getInitialConversationRestoreTarget({
  savedScrollSnapshot,
  unreadCue,
}: {
  savedScrollSnapshot: ConversationScrollSnapshot | null;
  unreadCue: ConversationUnreadCue | null;
}) {
  if (savedScrollSnapshot?.wasAtBottom) {
    return { kind: "bottom" } satisfies ConversationRestoreTarget;
  }

  if (savedScrollSnapshot) {
    return {
      kind: "offset",
      offset: savedScrollSnapshot.offset,
    } satisfies ConversationRestoreTarget;
  }

  if (unreadCue) {
    return {
      align: "start",
      kind: "post",
      postId: unreadCue.postId,
    } satisfies ConversationRestoreTarget;
  }

  return { kind: "bottom" } satisfies ConversationRestoreTarget;
}

/**
 * Builds the persisted scroll snapshot for one settled transcript position.
 *
 * The caller decides whether the transcript should be treated as "at bottom".
 * This keeps the helper pure and lets runtime code combine real geometry with
 * chat-specific intent such as an in-flight "go to latest" placement.
 */
export function createConversationScrollSnapshot({
  cache,
  isAtBottom,
  lastPostId,
  offset,
  renderedRowCount,
}: {
  cache: ConversationScrollSnapshot["cache"];
  isAtBottom: boolean;
  lastPostId: ConversationScrollSnapshot["lastPostId"];
  offset: ConversationScrollSnapshot["offset"];
  renderedRowCount: ConversationScrollSnapshot["renderedRowCount"];
}) {
  return {
    cache,
    lastPostId,
    offset,
    renderedRowCount,
    wasAtBottom: isAtBottom,
  } satisfies ConversationScrollSnapshot;
}
