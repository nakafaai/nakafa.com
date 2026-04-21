import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it, vi } from "vitest";
import {
  continueBottomPin,
  persistSettledView,
  settleAnchor,
  settleTranscriptFrame,
  syncHighlightVisibility,
} from "@/components/school/classes/forum/conversation/transcript/settlement";
import type {
  BottomPinState,
  PendingAnchor,
} from "@/components/school/classes/forum/conversation/transcript/types";
import * as transcriptUtils from "@/components/school/classes/forum/conversation/utils/transcript";

describe("conversation/transcript/settlement", () => {
  it("persists bottom and post views only from real settled DOM state", () => {
    const handleSettledView = vi.fn();
    const scrollElement = document.createElement("div");

    persistSettledView({
      getMetrics: () => ({
        scrollHeight: 800,
        scrollOffset: 400,
        viewportHeight: 400,
      }),
      handleSettledView,
      scrollElementRef: { current: scrollElement },
    });

    expect(handleSettledView).toHaveBeenCalledWith({ kind: "bottom" });

    vi.spyOn(
      transcriptUtils,
      "captureVisibleConversationDomAnchor"
    ).mockReturnValue({
      postId: "post_anchor" as Id<"schoolClassForumPosts">,
      topWithinScrollRoot: 24,
    });

    persistSettledView({
      getMetrics: () => ({
        scrollHeight: 1200,
        scrollOffset: 100,
        viewportHeight: 400,
      }),
      handleSettledView,
      scrollElementRef: { current: scrollElement },
    });

    expect(handleSettledView).toHaveBeenLastCalledWith({
      kind: "post",
      offset: 24,
      postId: "post_anchor",
    });
    expect(
      persistSettledView({
        getMetrics: () => ({
          scrollHeight: 1200,
          scrollOffset: 100,
          viewportHeight: 400,
        }),
        handleSettledView,
        scrollElementRef: { current: null },
      })
    ).toBe(false);
  });

  it("syncs highlight visibility only after the target row becomes visible", () => {
    const handleHighlightVisiblePost = vi.fn();
    const scrollElement = document.createElement("div");

    vi.spyOn(transcriptUtils, "isConversationPostVisibleInDom")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    syncHighlightVisibility({
      handleHighlightVisiblePost,
      pendingHighlightPostId: "post_target" as Id<"schoolClassForumPosts">,
      scrollElementRef: { current: scrollElement },
    });
    syncHighlightVisibility({
      handleHighlightVisiblePost,
      pendingHighlightPostId: "post_target" as Id<"schoolClassForumPosts">,
      scrollElementRef: { current: scrollElement },
    });
    syncHighlightVisibility({
      handleHighlightVisiblePost,
      pendingHighlightPostId: null,
      scrollElementRef: { current: null },
    });

    expect(handleHighlightVisiblePost).toHaveBeenCalledTimes(1);
    expect(handleHighlightVisiblePost).toHaveBeenCalledWith("post_target");
  });

  it("keeps restore anchors pending until the DOM correction settles or disappears", () => {
    const pendingAnchorRef = {
      current: {
        kind: "post" as const,
        offset: 16,
        postId: "post_anchor" as Id<"schoolClassForumPosts">,
      } as PendingAnchor | null,
    };
    const scrollElement = document.createElement("div");

    vi.spyOn(transcriptUtils, "reconcileConversationDomAnchor")
      .mockReturnValueOnce("pending")
      .mockReturnValueOnce("settled")
      .mockReturnValueOnce("missing");

    expect(
      settleAnchor({
        pendingAnchorRef,
        scrollElementRef: { current: scrollElement },
      })
    ).toBe(true);
    expect(pendingAnchorRef.current).not.toBeNull();

    expect(
      settleAnchor({
        pendingAnchorRef,
        scrollElementRef: { current: scrollElement },
      })
    ).toBe(false);
    expect(pendingAnchorRef.current).toBeNull();

    pendingAnchorRef.current = {
      kind: "post",
      offset: 16,
      postId: "post_anchor" as Id<"schoolClassForumPosts">,
    } satisfies PendingAnchor;

    expect(
      settleAnchor({
        pendingAnchorRef,
        scrollElementRef: { current: scrollElement },
      })
    ).toBe(true);
    expect(pendingAnchorRef.current).not.toBeNull();
  });

  it("continues pinning to bottom until the DOM reaches bottom or retries are exhausted", () => {
    const clearScrollRequest = vi.fn();
    const scrollToBottom = vi.fn();
    const bottomPinRef = {
      current: {
        attempts: 0,
        requestId: 7,
      } as BottomPinState | null,
    };

    expect(
      continueBottomPin({
        bottomPinRef,
        clearScrollRequest,
        getMetrics: () => ({
          scrollHeight: 1200,
          scrollOffset: 400,
          viewportHeight: 400,
        }),
        scrollToBottom,
      })
    ).toBe(true);
    expect(scrollToBottom).toHaveBeenCalledWith("auto");
    expect(bottomPinRef.current?.attempts).toBe(1);

    bottomPinRef.current = {
      attempts: 0,
      requestId: 9,
    };

    expect(
      continueBottomPin({
        bottomPinRef,
        clearScrollRequest,
        getMetrics: () => ({
          scrollHeight: 800,
          scrollOffset: 400,
          viewportHeight: 400,
        }),
        scrollToBottom,
      })
    ).toBe(false);
    expect(clearScrollRequest).toHaveBeenCalledWith(9);
    expect(bottomPinRef.current).toBeNull();

    bottomPinRef.current = {
      attempts: 4,
      requestId: null,
    };

    expect(
      continueBottomPin({
        bottomPinRef,
        clearScrollRequest,
        getMetrics: () => ({
          scrollHeight: 800,
          scrollOffset: 400,
          viewportHeight: 400,
        }),
        scrollToBottom,
      })
    ).toBe(false);

    bottomPinRef.current = {
      attempts: 90,
      requestId: 11,
    };

    expect(
      continueBottomPin({
        bottomPinRef,
        clearScrollRequest,
        getMetrics: () => ({
          scrollHeight: 1600,
          scrollOffset: 200,
          viewportHeight: 400,
        }),
        scrollToBottom,
      })
    ).toBe(false);
    expect(clearScrollRequest).toHaveBeenCalledWith(11);
    expect(bottomPinRef.current).toBeNull();

    bottomPinRef.current = {
      attempts: 90,
      requestId: null,
    };

    expect(
      continueBottomPin({
        bottomPinRef,
        clearScrollRequest,
        getMetrics: () => ({
          scrollHeight: 1600,
          scrollOffset: 200,
          viewportHeight: 400,
        }),
        scrollToBottom,
      })
    ).toBe(false);
    expect(bottomPinRef.current).toBeNull();
  });

  it("runs a full settle pass, then persists and flushes mark-read only after the transcript is honestly settled", () => {
    const handleSettledView = vi.fn();
    const handleBottomStateChange = vi.fn();
    const handleHighlightVisiblePost = vi.fn();
    const scheduleMarkRead = Object.assign(vi.fn(), {
      cancel: vi.fn(),
      flush: vi.fn(),
    });
    const scrollElement = document.createElement("div");

    vi.spyOn(
      transcriptUtils,
      "captureVisibleConversationDomAnchor"
    ).mockReturnValue({
      postId: "post_anchor" as Id<"schoolClassForumPosts">,
      topWithinScrollRoot: 12,
    });
    vi.spyOn(transcriptUtils, "isConversationPostVisibleInDom").mockReturnValue(
      true
    );

    expect(
      settleTranscriptFrame({
        bottomBoundaryPostIdRef: { current: null },
        bottomPinRef: { current: null },
        clearScrollRequest: vi.fn(),
        getMetrics: () => ({
          scrollHeight: 800,
          scrollOffset: 400,
          viewportHeight: 400,
        }),
        handleBottomStateChange,
        handleHighlightVisiblePost,
        handleSettledView,
        hasMoreAfter: false,
        hasMoreBefore: false,
        isAtLatestEdge: true,
        isLoadingNewer: false,
        isLoadingOlder: false,
        lastPostId: "post_anchor" as Id<"schoolClassForumPosts">,
        loadedNewestPostId: "post_anchor" as Id<"schoolClassForumPosts">,
        loadedOldestPostId: "post_anchor" as Id<"schoolClassForumPosts">,
        loadNewerPosts: vi.fn(() => true),
        loadOlderPosts: vi.fn(() => true),
        pendingAnchorRef: { current: null },
        pendingHighlightPostId: "post_anchor" as Id<"schoolClassForumPosts">,
        scheduleMarkRead,
        scrollElementRef: { current: scrollElement },
        scrollToBottom: vi.fn(),
        setShiftBoundaryPostId: vi.fn(),
        topBoundaryPostIdRef: { current: null },
        transcriptVariant: "live",
      })
    ).toBe(false);

    expect(handleBottomStateChange).toHaveBeenCalledWith(true);
    expect(handleHighlightVisiblePost).toHaveBeenCalledWith("post_anchor");
    expect(handleSettledView).toHaveBeenCalledWith({ kind: "bottom" });
    expect(scheduleMarkRead).toHaveBeenCalledWith("post_anchor");
    expect(scheduleMarkRead.flush).toHaveBeenCalled();
  });

  it("keeps the settle loop alive while anchor or bottom pin work is still active", () => {
    vi.spyOn(transcriptUtils, "reconcileConversationDomAnchor").mockReturnValue(
      "pending"
    );

    expect(
      settleTranscriptFrame({
        bottomBoundaryPostIdRef: { current: null },
        bottomPinRef: { current: null },
        clearScrollRequest: vi.fn(),
        getMetrics: () => ({
          scrollHeight: 1200,
          scrollOffset: 100,
          viewportHeight: 400,
        }),
        handleBottomStateChange: vi.fn(),
        handleHighlightVisiblePost: vi.fn(),
        handleSettledView: vi.fn(),
        hasMoreAfter: false,
        hasMoreBefore: false,
        isAtLatestEdge: false,
        isLoadingNewer: false,
        isLoadingOlder: false,
        lastPostId: undefined,
        loadedNewestPostId: null,
        loadedOldestPostId: null,
        loadNewerPosts: vi.fn(() => true),
        loadOlderPosts: vi.fn(() => true),
        pendingAnchorRef: {
          current: {
            kind: "post",
            offset: 20,
            postId: "post_anchor" as Id<"schoolClassForumPosts">,
          },
        },
        pendingHighlightPostId: null,
        scheduleMarkRead: Object.assign(vi.fn(), {
          cancel: vi.fn(),
          flush: vi.fn(),
        }),
        scrollElementRef: { current: document.createElement("div") },
        scrollToBottom: vi.fn(),
        setShiftBoundaryPostId: vi.fn(),
        topBoundaryPostIdRef: { current: null },
        transcriptVariant: "focused",
      })
    ).toBe(true);
  });

  it("cancels delayed mark-read work when the transcript settles away from bottom", () => {
    const scheduleMarkRead = Object.assign(vi.fn(), {
      cancel: vi.fn(),
      flush: vi.fn(),
    });

    expect(
      settleTranscriptFrame({
        bottomBoundaryPostIdRef: { current: null },
        bottomPinRef: { current: null },
        clearScrollRequest: vi.fn(),
        getMetrics: () => ({
          scrollHeight: 1200,
          scrollOffset: 100,
          viewportHeight: 400,
        }),
        handleBottomStateChange: vi.fn(),
        handleHighlightVisiblePost: vi.fn(),
        handleSettledView: vi.fn(),
        hasMoreAfter: false,
        hasMoreBefore: false,
        isAtLatestEdge: false,
        isLoadingNewer: false,
        isLoadingOlder: false,
        lastPostId: "post_far" as Id<"schoolClassForumPosts">,
        loadedNewestPostId: "post_far" as Id<"schoolClassForumPosts">,
        loadedOldestPostId: "post_far" as Id<"schoolClassForumPosts">,
        loadNewerPosts: vi.fn(() => true),
        loadOlderPosts: vi.fn(() => true),
        pendingAnchorRef: { current: null },
        pendingHighlightPostId: null,
        scheduleMarkRead,
        scrollElementRef: { current: document.createElement("div") },
        scrollToBottom: vi.fn(),
        setShiftBoundaryPostId: vi.fn(),
        topBoundaryPostIdRef: { current: null },
        transcriptVariant: "focused",
      })
    ).toBe(false);

    expect(scheduleMarkRead.cancel).toHaveBeenCalled();
    expect(scheduleMarkRead.flush).not.toHaveBeenCalled();
  });
});
