import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { VirtualConversationHandle } from "@repo/design-system/components/ui/virtual-conversation";
import { type RefObject, useCallback, useRef, useState } from "react";
import {
  type PendingPostTarget,
  resolvePendingPostTargetProgress,
} from "@/components/school/classes/forum/conversation/utils/post-target";

interface UseTargetResult {
  clearPendingPostTarget: () => void;
  hasPendingPostTarget: boolean;
  pendingPostTargetRef: RefObject<PendingPostTarget | null>;
  registerPendingPostTarget: (pendingPostTarget: PendingPostTarget) => void;
  settlePendingPostTarget: () => boolean;
}

/**
 * Owns the pending forum post-target that must visibly land before the
 * conversation can settle.
 */
export function useTarget({
  postIdToIndex,
  scrollRef,
}: {
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
  scrollRef: RefObject<VirtualConversationHandle | null>;
}): UseTargetResult {
  const [hasPendingPostTarget, setHasPendingPostTarget] = useState(false);
  const pendingPostTargetRef = useRef<PendingPostTarget | null>(null);

  /** Registers one target that must land before the transcript is considered ready. */
  const registerPendingPostTarget = useCallback(
    (pendingPostTarget: PendingPostTarget) => {
      pendingPostTargetRef.current = pendingPostTarget;
      setHasPendingPostTarget(true);
    },
    []
  );

  /** Clears the current target once the jump flow no longer needs it. */
  const clearPendingPostTarget = useCallback(() => {
    if (!pendingPostTargetRef.current) {
      return;
    }

    pendingPostTargetRef.current = null;
    setHasPendingPostTarget(false);
  }, []);

  /** Retries the current target until it becomes visibly settled or gives up. */
  const settlePendingPostTarget = useCallback(() => {
    const progress = resolvePendingPostTargetProgress({
      handle: scrollRef.current,
      pendingPostTarget: pendingPostTargetRef.current,
      postIdToIndex,
    });

    if (progress.kind === "idle") {
      return true;
    }

    if (progress.kind === "settled") {
      clearPendingPostTarget();
      return true;
    }

    if (progress.kind === "waiting") {
      return false;
    }

    pendingPostTargetRef.current = progress.nextPendingPostTarget;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToIndex(progress.index, {
        align: progress.align,
        offset: progress.offset,
      });
    });
    return false;
  }, [clearPendingPostTarget, postIdToIndex, scrollRef]);

  return {
    clearPendingPostTarget,
    hasPendingPostTarget,
    pendingPostTargetRef,
    registerPendingPostTarget,
    settlePendingPostTarget,
  };
}
