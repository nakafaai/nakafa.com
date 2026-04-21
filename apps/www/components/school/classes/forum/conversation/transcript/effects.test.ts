import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupTranscriptRuntime,
  observeTranscriptResize,
  pinToLatestAfterAppend,
  resetTranscriptViewportState,
  runScrollRequest,
  scheduleTranscriptSettleFrame,
  shouldContinueBottomPin,
} from "@/components/school/classes/forum/conversation/transcript/effects";
import type {
  BottomPinState,
  PendingAnchor,
} from "@/components/school/classes/forum/conversation/transcript/types";

const animationFrames: FrameRequestCallback[] = [];

describe("conversation/transcript/effects", () => {
  beforeEach(() => {
    animationFrames.length = 0;

    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      })
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("resets every transient viewport ref after a timeline session reset", () => {
    const bottomBoundaryPostIdRef = {
      current: "post_bottom" as Id<"schoolClassForumPosts">,
    };
    const bottomPinRef = {
      current: { attempts: 1, requestId: 7 },
    };
    const pendingAnchorRef = {
      current: {
        kind: "post" as const,
        offset: 10,
        postId: "post_anchor" as Id<"schoolClassForumPosts">,
      },
    };
    const topBoundaryPostIdRef = {
      current: "post_top" as Id<"schoolClassForumPosts">,
    };
    const setShiftBoundaryPostId = vi.fn();

    resetTranscriptViewportState({
      bottomBoundaryPostIdRef,
      bottomPinRef,
      pendingAnchorRef,
      setShiftBoundaryPostId,
      topBoundaryPostIdRef,
    });

    expect(bottomBoundaryPostIdRef.current).toBeNull();
    expect(bottomPinRef.current).toBeNull();
    expect(pendingAnchorRef.current).toBeNull();
    expect(topBoundaryPostIdRef.current).toBeNull();
    expect(setShiftBoundaryPostId).toHaveBeenCalledWith(null);
  });

  it("executes latest, jump, and restore scroll requests against the current transcript boundary", () => {
    const bottomPinRef = {
      current: null as BottomPinState | null,
    };
    const clearScrollRequest = vi.fn();
    const pendingAnchorRef = {
      current: null as PendingAnchor | null,
    };
    const scrollToBottom = vi.fn();
    const scheduleSettleFrame = vi.fn();
    const virtualizer = {
      scrollToIndex: vi.fn(),
    };

    runScrollRequest({
      bottomPinRef,
      clearScrollRequest,
      itemsLength: 2,
      latestPinIntentRef: { current: false },
      pendingAnchorRef,
      postIdToIndex: new Map(),
      scheduleSettleFrame,
      scrollRequest: {
        id: 1,
        kind: "latest",
        smooth: true,
      },
      scrollToBottom,
      transcriptVariant: "live",
      virtualizer,
    });

    expect(bottomPinRef.current).toMatchObject({
      attempts: 0,
      requestId: 1,
    });
    expect(scrollToBottom).toHaveBeenCalledWith("smooth");
    expect(scheduleSettleFrame).not.toHaveBeenCalled();

    runScrollRequest({
      bottomPinRef,
      clearScrollRequest,
      itemsLength: 2,
      latestPinIntentRef: { current: true },
      pendingAnchorRef,
      postIdToIndex: new Map(),
      scheduleSettleFrame,
      scrollRequest: {
        id: 10,
        kind: "latest",
        smooth: false,
      },
      scrollToBottom,
      transcriptVariant: "live",
      virtualizer,
    });

    expect(scheduleSettleFrame).toHaveBeenCalledTimes(1);

    runScrollRequest({
      bottomPinRef,
      clearScrollRequest,
      itemsLength: 2,
      latestPinIntentRef: { current: true },
      pendingAnchorRef,
      postIdToIndex: new Map([
        ["post_jump" as Id<"schoolClassForumPosts">, 4],
        ["post_restore" as Id<"schoolClassForumPosts">, 5],
      ]),
      scheduleSettleFrame,
      scrollRequest: {
        id: 2,
        kind: "jump",
        postId: "post_jump" as Id<"schoolClassForumPosts">,
        smooth: false,
      },
      scrollToBottom,
      transcriptVariant: "live",
      virtualizer,
    });

    expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(4, {
      align: "center",
      smooth: false,
    });
    expect(clearScrollRequest).toHaveBeenCalledWith(2);

    runScrollRequest({
      bottomPinRef,
      clearScrollRequest,
      itemsLength: 2,
      latestPinIntentRef: { current: true },
      pendingAnchorRef,
      postIdToIndex: new Map([
        ["post_restore" as Id<"schoolClassForumPosts">, 5],
      ]),
      scheduleSettleFrame,
      scrollRequest: {
        id: 3,
        kind: "restore",
        smooth: false,
        view: {
          kind: "post",
          offset: 20,
          postId: "post_restore" as Id<"schoolClassForumPosts">,
        },
      },
      scrollToBottom,
      transcriptVariant: "focused",
      virtualizer,
    });

    expect(pendingAnchorRef.current).toEqual({
      kind: "post",
      offset: 20,
      postId: "post_restore",
    });
    expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(5, {
      align: "start",
      smooth: false,
    });
  });

  it("ignores latest requests when the live transcript is not ready yet", () => {
    const scrollToBottom = vi.fn();
    const scheduleSettleFrame = vi.fn();

    runScrollRequest({
      bottomPinRef: { current: null },
      clearScrollRequest: vi.fn(),
      itemsLength: 0,
      latestPinIntentRef: { current: false },
      pendingAnchorRef: { current: null },
      postIdToIndex: new Map(),
      scheduleSettleFrame,
      scrollRequest: {
        id: 4,
        kind: "latest",
        smooth: false,
      },
      scrollToBottom,
      transcriptVariant: "focused",
      virtualizer: null,
    });

    expect(scrollToBottom).not.toHaveBeenCalled();
    expect(scheduleSettleFrame).not.toHaveBeenCalled();
  });

  it("clears unresolved non-latest requests when the target index is missing", () => {
    const clearScrollRequest = vi.fn();

    runScrollRequest({
      bottomPinRef: { current: null },
      clearScrollRequest,
      itemsLength: 1,
      latestPinIntentRef: { current: false },
      pendingAnchorRef: { current: null },
      postIdToIndex: new Map(),
      scheduleSettleFrame: vi.fn(),
      scrollRequest: {
        id: 9,
        kind: "jump",
        postId: "post_missing" as Id<"schoolClassForumPosts">,
        smooth: true,
      },
      scrollToBottom: vi.fn(),
      transcriptVariant: "focused",
      virtualizer: null,
    });

    expect(clearScrollRequest).toHaveBeenCalledWith(9);
  });

  it("pins the transcript back to bottom only when a new latest post really appends", () => {
    const bottomPinRef = {
      current: null as BottomPinState | null,
    };
    const latestPinIntentRef = {
      current: false,
    };
    const previousLastPostIdRef = {
      current: "post_1" as Id<"schoolClassForumPosts"> | undefined,
    };
    const scrollToBottom = vi.fn();
    const scheduleSettleFrame = vi.fn();

    pinToLatestAfterAppend({
      bottomPinRef,
      latestPinIntentRef,
      isAtBottom: false,
      isAtLatestEdge: false,
      lastPostId: "post_2" as Id<"schoolClassForumPosts">,
      previousLastPostIdRef,
      scheduleSettleFrame,
      scrollToBottom,
    });

    expect(scrollToBottom).not.toHaveBeenCalled();

    bottomPinRef.current = { attempts: 0, requestId: null };

    pinToLatestAfterAppend({
      bottomPinRef,
      latestPinIntentRef,
      isAtBottom: true,
      isAtLatestEdge: true,
      lastPostId: "post_3" as Id<"schoolClassForumPosts">,
      previousLastPostIdRef,
      scheduleSettleFrame,
      scrollToBottom,
    });

    expect(scrollToBottom).toHaveBeenCalledWith("auto");
    expect(scheduleSettleFrame).toHaveBeenCalled();

    latestPinIntentRef.current = true;
    bottomPinRef.current = null;
    previousLastPostIdRef.current = "post_3" as Id<"schoolClassForumPosts">;

    pinToLatestAfterAppend({
      bottomPinRef,
      latestPinIntentRef,
      isAtBottom: false,
      isAtLatestEdge: true,
      lastPostId: "post_4" as Id<"schoolClassForumPosts">,
      previousLastPostIdRef,
      scheduleSettleFrame,
      scrollToBottom,
    });

    expect(bottomPinRef.current).toEqual({
      attempts: 0,
      requestId: null,
    });
  });

  it("observes content resize only when a mounted content element exists", () => {
    const scheduleSettleFrame = vi.fn();
    const resizeObserverState = {
      callback: null as ResizeObserverCallback | null,
      disconnect: vi.fn(),
      observe: vi.fn(),
    };

    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeObserverState.callback = callback;
        }

        disconnect() {
          resizeObserverState.disconnect();
        }

        observe(target: Element) {
          resizeObserverState.observe(target);
        }
      }
    );

    expect(
      observeTranscriptResize({
        bottomPinRef: { current: null },
        latestPinIntentRef: { current: false },
        shouldPinToLatest: false,
        pendingAnchorRef: { current: null },
        scheduleSettleFrame,
        scrollElement: null,
      })
    ).toBeUndefined();

    const emptyScrollElement = document.createElement("div");

    expect(
      observeTranscriptResize({
        bottomPinRef: { current: null },
        latestPinIntentRef: { current: false },
        shouldPinToLatest: false,
        pendingAnchorRef: { current: null },
        scheduleSettleFrame,
        scrollElement: emptyScrollElement,
      })
    ).toBeUndefined();

    const scrollElement = document.createElement("div");
    const contentElement = document.createElement("div");

    scrollElement.append(contentElement);

    const bottomPinRef = {
      current: { attempts: 0, requestId: null } as BottomPinState | null,
    };
    const pendingAnchorRef = {
      current: null as PendingAnchor | null,
    };
    const cleanup = observeTranscriptResize({
      bottomPinRef,
      latestPinIntentRef: { current: false },
      shouldPinToLatest: false,
      pendingAnchorRef,
      scheduleSettleFrame,
      scrollElement,
    });

    expect(resizeObserverState.observe).toHaveBeenCalledWith(contentElement);

    resizeObserverState.callback?.([], {} as ResizeObserver);
    expect(scheduleSettleFrame).toHaveBeenCalled();

    const settleCount = scheduleSettleFrame.mock.calls.length;

    bottomPinRef.current = null;
    pendingAnchorRef.current = null;
    resizeObserverState.callback?.([], {} as ResizeObserver);
    expect(scheduleSettleFrame.mock.calls.length).toBe(settleCount);

    const pinnedBottomPinRef = {
      current: null as BottomPinState | null,
    };

    observeTranscriptResize({
      bottomPinRef: pinnedBottomPinRef,
      latestPinIntentRef: { current: true },
      shouldPinToLatest: true,
      pendingAnchorRef: { current: null },
      scheduleSettleFrame,
      scrollElement,
    });

    resizeObserverState.callback?.([], {} as ResizeObserver);
    expect(pinnedBottomPinRef.current).toMatchObject({
      attempts: 0,
      requestId: null,
    });

    cleanup?.();
    expect(resizeObserverState.disconnect).toHaveBeenCalled();
  });

  it("keeps the latest pin reconciliation alive for realistic delayed resizes", () => {
    expect(shouldContinueBottomPin(0)).toBe(true);
    expect(shouldContinueBottomPin(89)).toBe(true);
    expect(shouldContinueBottomPin(90)).toBe(false);
  });

  it("cleans up pending settle work and persists the last settled view on unmount", () => {
    const persistSettledView = vi.fn();
    const scheduleMarkRead = {
      cancel: vi.fn(),
    };

    cleanupTranscriptRuntime({
      persistSettledView,
      scheduleMarkRead,
      settleFrameIdRef: { current: 5 },
    });

    expect(cancelAnimationFrame).toHaveBeenCalledWith(5);
    expect(scheduleMarkRead.cancel).toHaveBeenCalled();
    expect(persistSettledView).toHaveBeenCalled();
  });

  it("runs only one settle RAF loop at a time and keeps looping while settlement asks for another pass", () => {
    const settleFrameIdRef = {
      current: null as number | null,
    };
    const settleTranscript = vi
      .fn<() => boolean>()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    scheduleTranscriptSettleFrame({
      settleFrameIdRef,
      settleTranscript,
    });
    scheduleTranscriptSettleFrame({
      settleFrameIdRef,
      settleTranscript,
    });

    expect(animationFrames).toHaveLength(1);

    animationFrames.shift()?.(performance.now());
    expect(animationFrames).toHaveLength(1);

    animationFrames.shift()?.(performance.now());
    expect(settleTranscript).toHaveBeenCalledTimes(2);
    expect(settleFrameIdRef.current).toBeNull();
  });
});
