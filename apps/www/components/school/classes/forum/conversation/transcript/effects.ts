import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { RefObject } from "react";
import type {
  BottomPinState,
  PendingAnchor,
} from "@/components/school/classes/forum/conversation/transcript/types";

const BOTTOM_PIN_RETRIES = 90;

/** Clears transient transcript boundary state after one timeline reset. */
export function resetTranscriptViewportState({
  bottomBoundaryPostIdRef,
  bottomPinRef,
  pendingAnchorRef,
  setShiftBoundaryPostId,
  topBoundaryPostIdRef,
}: {
  bottomBoundaryPostIdRef: RefObject<Id<"schoolClassForumPosts"> | null>;
  bottomPinRef: RefObject<BottomPinState | null>;
  pendingAnchorRef: RefObject<PendingAnchor | null>;
  setShiftBoundaryPostId: (postId: Id<"schoolClassForumPosts"> | null) => void;
  topBoundaryPostIdRef: RefObject<Id<"schoolClassForumPosts"> | null>;
}) {
  bottomBoundaryPostIdRef.current = null;
  bottomPinRef.current = null;
  pendingAnchorRef.current = null;
  topBoundaryPostIdRef.current = null;
  setShiftBoundaryPostId(null);
}

/** Executes one pending runtime scroll request against the live Virtua handle. */
export function runScrollRequest({
  bottomPinRef,
  clearScrollRequest,
  itemsLength,
  latestPinIntentRef,
  pendingAnchorRef,
  postIdToIndex,
  scheduleSettleFrame,
  scrollRequest,
  scrollToBottom,
  transcriptVariant,
  virtualizer,
}: {
  bottomPinRef: RefObject<BottomPinState | null>;
  clearScrollRequest: (requestId: number) => void;
  itemsLength: number;
  latestPinIntentRef: RefObject<boolean>;
  pendingAnchorRef: RefObject<PendingAnchor | null>;
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
  scheduleSettleFrame: () => void;
  scrollRequest:
    | {
        id: number;
        kind: "jump";
        postId: Id<"schoolClassForumPosts">;
        smooth: boolean;
      }
    | {
        id: number;
        kind: "latest";
        smooth: boolean;
      }
    | {
        id: number;
        kind: "restore";
        smooth: boolean;
        view: PendingAnchor;
      }
    | null;
  scrollToBottom: (behavior: "auto" | "smooth") => void;
  transcriptVariant: "focused" | "live";
  virtualizer: {
    scrollToIndex: (
      index: number,
      options: { align: "center" | "start"; smooth: boolean }
    ) => void;
  } | null;
}) {
  if (!scrollRequest) {
    return;
  }

  if (scrollRequest.kind === "latest") {
    if (transcriptVariant !== "live" || itemsLength === 0) {
      return;
    }

    latestPinIntentRef.current = true;
    bottomPinRef.current = {
      attempts: 0,
      requestId: scrollRequest.id,
    };
    scrollToBottom(scrollRequest.smooth ? "smooth" : "auto");

    if (!scrollRequest.smooth) {
      scheduleSettleFrame();
    }

    return;
  }

  const index =
    scrollRequest.kind === "jump"
      ? postIdToIndex.get(scrollRequest.postId)
      : postIdToIndex.get(scrollRequest.view.postId);

  latestPinIntentRef.current = false;

  if (index === undefined) {
    clearScrollRequest(scrollRequest.id);
    return;
  }

  pendingAnchorRef.current =
    scrollRequest.kind === "restore" ? scrollRequest.view : null;

  virtualizer?.scrollToIndex(index, {
    align: scrollRequest.kind === "jump" ? "center" : "start",
    smooth: scrollRequest.kind === "jump" && scrollRequest.smooth,
  });
  clearScrollRequest(scrollRequest.id);
  scheduleSettleFrame();
}

/** Keeps the transcript pinned to the true latest bottom after appends. */
export function pinToLatestAfterAppend({
  bottomPinRef,
  latestPinIntentRef,
  isAtBottom,
  isAtLatestEdge,
  lastPostId,
  previousLastPostIdRef,
  scheduleSettleFrame,
  scrollToBottom,
}: {
  bottomPinRef: RefObject<BottomPinState | null>;
  latestPinIntentRef: RefObject<boolean>;
  isAtBottom: boolean;
  isAtLatestEdge: boolean;
  lastPostId: Id<"schoolClassForumPosts"> | undefined;
  previousLastPostIdRef: RefObject<Id<"schoolClassForumPosts"> | undefined>;
  scheduleSettleFrame: () => void;
  scrollToBottom: (behavior: "auto" | "smooth") => void;
}) {
  const previousLastPostId = previousLastPostIdRef.current;

  previousLastPostIdRef.current = lastPostId;

  if (
    !(
      lastPostId &&
      previousLastPostId &&
      lastPostId !== previousLastPostId &&
      isAtLatestEdge &&
      (isAtBottom || latestPinIntentRef.current)
    )
  ) {
    return;
  }

  latestPinIntentRef.current = true;

  if (bottomPinRef.current === null) {
    bottomPinRef.current = {
      attempts: 0,
      requestId: null,
    };
  }

  scrollToBottom("auto");
  scheduleSettleFrame();
}

/** Observes transcript content resize while restore or bottom pin settlement is active. */
export function observeTranscriptResize({
  bottomPinRef,
  latestPinIntentRef,
  shouldPinToLatest,
  pendingAnchorRef,
  scheduleSettleFrame,
  scrollElement,
}: {
  bottomPinRef: RefObject<BottomPinState | null>;
  latestPinIntentRef: RefObject<boolean>;
  shouldPinToLatest: boolean;
  pendingAnchorRef: RefObject<PendingAnchor | null>;
  scheduleSettleFrame: () => void;
  scrollElement: HTMLDivElement | null;
}) {
  if (!(scrollElement && typeof ResizeObserver !== "undefined")) {
    return;
  }

  const contentElement = scrollElement.firstElementChild;

  if (!(contentElement instanceof HTMLElement)) {
    return;
  }

  const resizeObserver = new ResizeObserver(() => {
    if (
      shouldPinToLatest &&
      latestPinIntentRef.current &&
      bottomPinRef.current === null
    ) {
      bottomPinRef.current = {
        attempts: 0,
        requestId: null,
      };
    }

    if (bottomPinRef.current || pendingAnchorRef.current) {
      scheduleSettleFrame();
    }
  });

  resizeObserver.observe(contentElement);

  return () => {
    resizeObserver.disconnect();
  };
}

/** Flushes transcript cleanup work on unmount. */
export function cleanupTranscriptRuntime({
  persistSettledView,
  scheduleMarkRead,
  settleFrameIdRef,
}: {
  persistSettledView: () => void;
  scheduleMarkRead: { cancel: () => void };
  settleFrameIdRef: RefObject<number | null>;
}) {
  if (settleFrameIdRef.current !== null) {
    cancelAnimationFrame(settleFrameIdRef.current);
  }

  scheduleMarkRead.cancel();
  persistSettledView();
}

/** Schedules one bounded RAF settle loop without stacking duplicate frames. */
export function scheduleTranscriptSettleFrame({
  settleFrameIdRef,
  settleTranscript,
}: {
  settleFrameIdRef: RefObject<number | null>;
  settleTranscript: () => boolean;
}) {
  if (settleFrameIdRef.current !== null) {
    return;
  }

  const runFrame = () => {
    settleFrameIdRef.current = null;

    if (settleTranscript()) {
      settleFrameIdRef.current = requestAnimationFrame(runFrame);
    }
  };

  settleFrameIdRef.current = requestAnimationFrame(runFrame);
}

/** Returns whether the bottom reconciliation loop should keep trying. */
export function shouldContinueBottomPin(attempts: number) {
  return attempts < BOTTOM_PIN_RETRIES;
}
