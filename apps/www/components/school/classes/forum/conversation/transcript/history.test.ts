import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it, vi } from "vitest";
import {
  handleTranscriptScroll,
  syncHistoryWindow,
} from "@/components/school/classes/forum/conversation/transcript/history";

describe("conversation/transcript/history", () => {
  it("freezes history loading while restore or bottom settlement is still pending", () => {
    const loadOlderPosts = vi.fn();
    const loadNewerPosts = vi.fn();

    syncHistoryWindow({
      bottomBoundaryPostIdRef: { current: null },
      bottomPinRef: { current: { attempts: 0, requestId: null } },
      getMetrics: () => ({
        scrollHeight: 1000,
        scrollOffset: 0,
        viewportHeight: 400,
      }),
      hasMoreAfter: true,
      hasMoreBefore: true,
      isLoadingNewer: false,
      isLoadingOlder: false,
      loadedNewestPostId: "post_newest" as Id<"schoolClassForumPosts">,
      loadedOldestPostId: "post_oldest" as Id<"schoolClassForumPosts">,
      loadNewerPosts,
      loadOlderPosts,
      pendingAnchorRef: {
        current: {
          kind: "post",
          offset: 10,
          postId: "post_anchor" as Id<"schoolClassForumPosts">,
        },
      },
      scrollElementRef: { current: null },
      setShiftBoundaryPostId: vi.fn(),
      topBoundaryPostIdRef: { current: null },
      transcriptVariant: "focused",
    });

    expect(loadOlderPosts).not.toHaveBeenCalled();
    expect(loadNewerPosts).not.toHaveBeenCalled();
  });

  it("skips history prefetch when the viewport has not measured yet", () => {
    const loadOlderPosts = vi.fn();
    const loadNewerPosts = vi.fn();

    syncHistoryWindow({
      bottomBoundaryPostIdRef: { current: null },
      bottomPinRef: { current: null },
      getMetrics: () => ({
        scrollHeight: 0,
        scrollOffset: 0,
        viewportHeight: 0,
      }),
      hasMoreAfter: true,
      hasMoreBefore: true,
      isLoadingNewer: false,
      isLoadingOlder: false,
      loadedNewestPostId: "post_newest" as Id<"schoolClassForumPosts">,
      loadedOldestPostId: "post_oldest" as Id<"schoolClassForumPosts">,
      loadNewerPosts,
      loadOlderPosts,
      pendingAnchorRef: { current: null },
      scrollElementRef: { current: null },
      setShiftBoundaryPostId: vi.fn(),
      topBoundaryPostIdRef: { current: null },
      transcriptVariant: "focused",
    });

    expect(loadOlderPosts).not.toHaveBeenCalled();
    expect(loadNewerPosts).not.toHaveBeenCalled();
  });

  it("loads older or newer history only when the viewport reaches the relevant edge", () => {
    const bottomBoundaryPostIdRef = {
      current: "post_stale_bottom" as Id<"schoolClassForumPosts"> | null,
    };
    const pendingAnchorRef = {
      current: null as {
        kind: "post";
        offset: number;
        postId: Id<"schoolClassForumPosts">;
      } | null,
    };
    const topBoundaryPostIdRef = {
      current: "post_stale_top" as Id<"schoolClassForumPosts"> | null,
    };
    const loadOlderPosts = vi.fn(() => true);
    const loadNewerPosts = vi.fn(() => true);
    const scrollElement = document.createElement("div");
    const visiblePost = document.createElement("div");
    const setShiftBoundaryPostId = vi.fn();

    visiblePost.dataset.postId = "post_visible";
    scrollElement.append(visiblePost);

    vi.spyOn(scrollElement, "getBoundingClientRect").mockReturnValue({
      bottom: 400,
      height: 400,
      left: 0,
      right: 320,
      top: 0,
      width: 320,
      x: 0,
      y: 0,
      toJSON: () => "",
    });
    vi.spyOn(visiblePost, "getBoundingClientRect").mockReturnValue({
      bottom: 180,
      height: 80,
      left: 0,
      right: 320,
      top: 100,
      width: 320,
      x: 0,
      y: 100,
      toJSON: () => "",
    });

    syncHistoryWindow({
      bottomBoundaryPostIdRef,
      bottomPinRef: { current: null },
      getMetrics: () => ({
        scrollHeight: 400,
        scrollOffset: 0,
        viewportHeight: 400,
      }),
      hasMoreAfter: true,
      hasMoreBefore: true,
      isLoadingNewer: false,
      isLoadingOlder: false,
      loadedNewestPostId: "post_newest" as Id<"schoolClassForumPosts">,
      loadedOldestPostId: "post_oldest" as Id<"schoolClassForumPosts">,
      loadNewerPosts,
      loadOlderPosts,
      pendingAnchorRef,
      scrollElementRef: { current: scrollElement },
      setShiftBoundaryPostId,
      topBoundaryPostIdRef,
      transcriptVariant: "focused",
    });

    expect(topBoundaryPostIdRef.current).toBe("post_oldest");
    expect(bottomBoundaryPostIdRef.current).toBe("post_newest");
    expect(loadOlderPosts).toHaveBeenCalled();
    expect(loadNewerPosts).toHaveBeenCalled();
    expect(pendingAnchorRef.current).toEqual({
      kind: "post",
      offset: 100,
      postId: "post_visible",
    });
    expect(setShiftBoundaryPostId).toHaveBeenCalledWith("post_oldest");
  });

  it("clears stale edge boundaries when the viewport moves away from both edges", () => {
    const bottomBoundaryPostIdRef = {
      current: "post_bottom" as Id<"schoolClassForumPosts"> | null,
    };
    const topBoundaryPostIdRef = {
      current: "post_top" as Id<"schoolClassForumPosts"> | null,
    };

    syncHistoryWindow({
      bottomBoundaryPostIdRef,
      bottomPinRef: { current: null },
      getMetrics: () => ({
        scrollHeight: 4000,
        scrollOffset: 1200,
        viewportHeight: 400,
      }),
      hasMoreAfter: true,
      hasMoreBefore: true,
      isLoadingNewer: false,
      isLoadingOlder: false,
      loadedNewestPostId: "post_newest" as Id<"schoolClassForumPosts">,
      loadedOldestPostId: "post_oldest" as Id<"schoolClassForumPosts">,
      loadNewerPosts: vi.fn(() => true),
      loadOlderPosts: vi.fn(() => true),
      pendingAnchorRef: { current: null },
      scrollElementRef: { current: null },
      setShiftBoundaryPostId: vi.fn(),
      topBoundaryPostIdRef,
      transcriptVariant: "live",
    });

    expect(topBoundaryPostIdRef.current).toBeNull();
    expect(bottomBoundaryPostIdRef.current).toBeNull();
  });

  it("handles scroll updates by syncing bottom state, read scheduling, highlight visibility, and history loading", () => {
    const scheduleMarkRead = Object.assign(vi.fn(), {
      cancel: vi.fn(),
    });
    const handleBottomStateChange = vi.fn();
    const handleHighlightVisiblePost = vi.fn();
    const loadOlderPosts = vi.fn(() => true);
    const setShiftBoundaryPostId = vi.fn();
    const scrollElement = document.createElement("div");
    const visiblePost = document.createElement("div");

    visiblePost.dataset.postId = "post_visible";
    scrollElement.append(visiblePost);

    vi.spyOn(scrollElement, "getBoundingClientRect").mockReturnValue({
      bottom: 400,
      height: 400,
      left: 0,
      right: 320,
      top: 0,
      width: 320,
      x: 0,
      y: 0,
      toJSON: () => "",
    });
    vi.spyOn(visiblePost, "getBoundingClientRect").mockReturnValue({
      bottom: 180,
      height: 80,
      left: 0,
      right: 320,
      top: 100,
      width: 320,
      x: 0,
      y: 100,
      toJSON: () => "",
    });

    handleTranscriptScroll({
      bottomBoundaryPostIdRef: { current: null },
      bottomPinRef: {
        current: null,
      },
      getMetrics: () => ({
        scrollHeight: 400,
        scrollOffset: 0,
        viewportHeight: 400,
      }),
      handleBottomStateChange,
      handleHighlightVisiblePost,
      hasMoreAfter: false,
      hasMoreBefore: true,
      isAtLatestEdge: true,
      isLoadingNewer: false,
      isLoadingOlder: false,
      lastPostId: "post_visible" as Id<"schoolClassForumPosts">,
      latestPinIntentRef: { current: false },
      loadedNewestPostId: "post_visible" as Id<"schoolClassForumPosts">,
      loadedOldestPostId: "post_visible" as Id<"schoolClassForumPosts">,
      loadNewerPosts: vi.fn(() => true),
      loadOlderPosts,
      pendingAnchorRef: { current: null },
      pendingHighlightPostId: "post_visible" as Id<"schoolClassForumPosts">,
      previousMetricsRef: { current: null },
      scheduleMarkRead,
      scrollElementRef: { current: scrollElement },
      setShiftBoundaryPostId,
      topBoundaryPostIdRef: { current: null },
      transcriptVariant: "live",
    });

    expect(handleBottomStateChange).toHaveBeenCalledWith(true);
    expect(handleHighlightVisiblePost).toHaveBeenCalledWith("post_visible");
    expect(scheduleMarkRead).toHaveBeenCalledWith("post_visible");
    expect(scheduleMarkRead.cancel).not.toHaveBeenCalled();
    expect(loadOlderPosts).toHaveBeenCalled();
    expect(setShiftBoundaryPostId).toHaveBeenCalledWith("post_visible");
  });

  it("cancels pinned-latest and mark-read state honestly when the viewport scrolls away from bottom", () => {
    const scheduleMarkRead = Object.assign(vi.fn(), {
      cancel: vi.fn(),
    });
    const bottomPinRef = {
      current: { attempts: 0, requestId: null },
    };
    const latestPinIntentRef = {
      current: true,
    };

    handleTranscriptScroll({
      bottomBoundaryPostIdRef: { current: null },
      bottomPinRef,
      getMetrics: () => ({
        scrollHeight: 1000,
        scrollOffset: 200,
        viewportHeight: 400,
      }),
      handleBottomStateChange: vi.fn(),
      handleHighlightVisiblePost: vi.fn(),
      hasMoreAfter: false,
      hasMoreBefore: false,
      isAtLatestEdge: false,
      isLoadingNewer: false,
      isLoadingOlder: false,
      lastPostId: "post_last" as Id<"schoolClassForumPosts">,
      latestPinIntentRef,
      loadedNewestPostId: "post_last" as Id<"schoolClassForumPosts">,
      loadedOldestPostId: "post_last" as Id<"schoolClassForumPosts">,
      loadNewerPosts: vi.fn(() => true),
      loadOlderPosts: vi.fn(() => true),
      pendingAnchorRef: { current: null },
      pendingHighlightPostId: null,
      previousMetricsRef: {
        current: {
          scrollHeight: 1000,
          scrollOffset: 600,
          viewportHeight: 400,
        },
      },
      scheduleMarkRead,
      scrollElementRef: { current: document.createElement("div") },
      setShiftBoundaryPostId: vi.fn(),
      topBoundaryPostIdRef: { current: null },
      transcriptVariant: "focused",
    });

    expect(bottomPinRef.current).toBeNull();
    expect(latestPinIntentRef.current).toBe(false);
    expect(scheduleMarkRead.cancel).toHaveBeenCalled();
  });

  it("keeps the latest pin alive when content only grows without a real scroll move", () => {
    const scheduleMarkRead = Object.assign(vi.fn(), {
      cancel: vi.fn(),
    });
    const bottomPinRef = {
      current: { attempts: 0, requestId: null },
    };
    const latestPinIntentRef = {
      current: true,
    };

    handleTranscriptScroll({
      bottomBoundaryPostIdRef: { current: null },
      bottomPinRef,
      getMetrics: () => ({
        scrollHeight: 1100,
        scrollOffset: 600,
        viewportHeight: 400,
      }),
      handleBottomStateChange: vi.fn(),
      handleHighlightVisiblePost: vi.fn(),
      hasMoreAfter: false,
      hasMoreBefore: false,
      isAtLatestEdge: true,
      isLoadingNewer: false,
      isLoadingOlder: false,
      lastPostId: "post_last" as Id<"schoolClassForumPosts">,
      latestPinIntentRef,
      loadedNewestPostId: "post_last" as Id<"schoolClassForumPosts">,
      loadedOldestPostId: "post_last" as Id<"schoolClassForumPosts">,
      loadNewerPosts: vi.fn(() => true),
      loadOlderPosts: vi.fn(() => true),
      pendingAnchorRef: { current: null },
      pendingHighlightPostId: null,
      previousMetricsRef: {
        current: {
          scrollHeight: 1000,
          scrollOffset: 600,
          viewportHeight: 400,
        },
      },
      scheduleMarkRead,
      scrollElementRef: { current: document.createElement("div") },
      setShiftBoundaryPostId: vi.fn(),
      topBoundaryPostIdRef: { current: null },
      transcriptVariant: "live",
    });

    expect(bottomPinRef.current).not.toBeNull();
    expect(latestPinIntentRef.current).toBe(true);
  });
});
