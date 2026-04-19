import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { VirtualConversationHandle } from "@repo/design-system/types/virtual";
import type { ScrollCommand } from "@/components/school/classes/forum/conversation/utils/scroll-command";

const DEFAULT_PENDING_POST_TARGET_RETRIES = 3;
const PENDING_POST_TARGET_VISIBILITY_TOLERANCE = 24;

export interface PendingPostTarget {
  align: ScrollCommand["align"];
  attemptsRemaining: number;
  offset?: number;
  postId: Id<"schoolClassForumPosts">;
  reason: "in-session-post-command" | "jump-session";
}

export type PendingPostTargetProgress =
  | { kind: "idle" }
  | { kind: "settled" }
  | { kind: "waiting" }
  | {
      align: ScrollCommand["align"];
      index: number;
      kind: "retry";
      nextPendingPostTarget: PendingPostTarget;
      offset?: number;
    };

/** Creates one forum post-target tracker for a new jump or reply preview intent. */
export function createPendingPostTarget({
  align,
  offset,
  postId,
  reason,
}: {
  align: ScrollCommand["align"];
  offset?: number;
  postId: Id<"schoolClassForumPosts">;
  reason: PendingPostTarget["reason"];
}): PendingPostTarget {
  return {
    align,
    attemptsRemaining: DEFAULT_PENDING_POST_TARGET_RETRIES,
    offset,
    postId,
    reason,
  };
}

/** Resolves the current rendered index for one pending forum post target. */
export function resolvePendingPostTargetIndex({
  pendingPostTarget,
  postIdToIndex,
}: {
  pendingPostTarget: PendingPostTarget;
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
}) {
  return postIdToIndex.get(pendingPostTarget.postId) ?? null;
}

/** Returns whether the target post top is already visible inside the viewport. */
export function isPendingPostTargetVisible({
  handle,
  index,
}: {
  handle: Pick<
    VirtualConversationHandle,
    "getItemOffset" | "getScrollOffset" | "getViewportSize"
  >;
  index: number;
}) {
  const scrollOffset = handle.getScrollOffset();
  const viewportSize = handle.getViewportSize();

  if (viewportSize <= 0) {
    return false;
  }

  const itemOffset = handle.getItemOffset(index);
  const minVisibleOffset =
    scrollOffset - PENDING_POST_TARGET_VISIBILITY_TOLERANCE;
  const maxVisibleOffset =
    scrollOffset + viewportSize - PENDING_POST_TARGET_VISIBILITY_TOLERANCE;

  return itemOffset >= minVisibleOffset && itemOffset <= maxVisibleOffset;
}

/** Returns whether one unresolved target still has automatic retry budget left. */
export function shouldRetryPendingPostTarget(
  pendingPostTarget: PendingPostTarget
) {
  return pendingPostTarget.attemptsRemaining > 0;
}

/** Consumes one automatic retry attempt after scheduling another target scroll. */
export function consumePendingPostTargetRetry(
  pendingPostTarget: PendingPostTarget
): PendingPostTarget {
  return {
    ...pendingPostTarget,
    attemptsRemaining: pendingPostTarget.attemptsRemaining - 1,
  };
}

/**
 * Resolves whether one pending forum post target is already visible, should be
 * retried, or still needs to keep the controller in a waiting state.
 */
export function resolvePendingPostTargetProgress({
  handle,
  pendingPostTarget,
  postIdToIndex,
}: {
  handle:
    | Pick<
        VirtualConversationHandle,
        "getItemOffset" | "getScrollOffset" | "getViewportSize"
      >
    | null
    | undefined;
  pendingPostTarget: PendingPostTarget | null;
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
}): PendingPostTargetProgress {
  if (!pendingPostTarget) {
    return { kind: "idle" };
  }

  if (!handle) {
    return { kind: "waiting" };
  }

  const index = resolvePendingPostTargetIndex({
    pendingPostTarget,
    postIdToIndex,
  });

  if (index === null) {
    return { kind: "waiting" };
  }

  if (isPendingPostTargetVisible({ handle, index })) {
    return { kind: "settled" };
  }

  if (!shouldRetryPendingPostTarget(pendingPostTarget)) {
    return { kind: "waiting" };
  }

  return {
    align: pendingPostTarget.align,
    index,
    kind: "retry",
    nextPendingPostTarget: consumePendingPostTargetRetry(pendingPostTarget),
    offset: pendingPostTarget.offset,
  };
}
