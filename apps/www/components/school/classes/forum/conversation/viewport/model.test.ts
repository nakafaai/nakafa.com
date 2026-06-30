import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import type { ActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import {
  conversationTestFirstPost as firstPost,
  conversationTestRowIndexByPostId as rowIndexByPostId,
  conversationTestRows as rows,
  conversationTestSecondPost as secondPost,
} from "@/components/school/classes/forum/conversation/fixtures/data";
import {
  deriveViewportState,
  getOpeningPlacement,
  getViewportLatestAffinity,
  isViewportDetachedScroll,
  pushViewportBackView,
  type ViewportMeasurement,
} from "@/components/school/classes/forum/conversation/viewport/model";

const activeTranscript = {
  lastPostId: secondPost._id,
  postIds: [firstPost._id, secondPost._id],
  rowIndexByPostId,
  rows,
} satisfies ActiveTranscriptModel;

describe("conversation/viewport/model", () => {
  it("restores a fresh semantic snapshot before unread fallback", () => {
    expect(
      getOpeningPlacement({
        activeTranscript,
        savedSnapshot: {
          lastPostId: secondPost._id,
          offset: 240,
          renderedRowCount: rows.length,
          view: { kind: "post", postId: firstPost._id },
          wasAtBottom: false,
        },
        unreadCue: {
          count: 1,
          postId: secondPost._id,
          status: "new",
        },
      })
    ).toEqual({
      align: "center",
      completion: "settled",
      highlightPostId: null,
      motion: "instant",
      view: { kind: "post", postId: firstPost._id },
    });
  });

  it("falls back to the unread anchor when a snapshot no longer matches", () => {
    expect(
      getOpeningPlacement({
        activeTranscript,
        savedSnapshot: {
          lastPostId: "stale_post" as Id<"schoolClassForumPosts">,
          offset: 240,
          renderedRowCount: rows.length,
          view: { kind: "bottom" },
          wasAtBottom: true,
        },
        unreadCue: {
          count: 1,
          postId: secondPost._id,
          status: "new",
        },
      })
    ).toEqual({
      align: "start",
      completion: "reached",
      highlightPostId: null,
      motion: "instant",
      view: { kind: "post", postId: secondPost._id },
    });
  });

  it("restores a fresh bottom snapshot and falls back to bottom when no anchor exists", () => {
    expect(
      getOpeningPlacement({
        activeTranscript,
        savedSnapshot: {
          lastPostId: secondPost._id,
          offset: 320,
          renderedRowCount: rows.length,
          view: { kind: "bottom" },
          wasAtBottom: true,
        },
        unreadCue: null,
      })
    ).toEqual({
      completion: "reached",
      highlightPostId: null,
      motion: "instant",
      view: { kind: "bottom" },
    });

    expect(
      getOpeningPlacement({
        activeTranscript,
        savedSnapshot: null,
        unreadCue: null,
      })
    ).toEqual({
      completion: "reached",
      highlightPostId: null,
      motion: "instant",
      view: { kind: "bottom" },
    });
  });

  it("ignores a fresh post snapshot when that post is no longer rendered", () => {
    expect(
      getOpeningPlacement({
        activeTranscript,
        savedSnapshot: {
          lastPostId: secondPost._id,
          offset: 320,
          renderedRowCount: rows.length,
          view: {
            kind: "post",
            postId: "missing_post" as Id<"schoolClassForumPosts">,
          },
          wasAtBottom: false,
        },
        unreadCue: null,
      })
    ).toEqual({
      completion: "reached",
      highlightPostId: null,
      motion: "instant",
      view: { kind: "bottom" },
    });
  });

  it("hides the latest button while already at latest or placing latest", () => {
    expect(
      deriveViewportState({
        backStack: [],
        highlightedPostId: null,
        hasOverflow: true,
        isAtLatest: true,
        latestAffinity: "latest",
        lifecycle: "ready",
        pendingPlacement: null,
      }).shouldShowLatestButton
    ).toBe(false);

    expect(
      deriveViewportState({
        backStack: [{ kind: "bottom" }],
        highlightedPostId: null,
        hasOverflow: true,
        isAtLatest: true,
        latestAffinity: "latest",
        lifecycle: "ready",
        pendingPlacement: null,
      }).shouldShowLatestButton
    ).toBe(false);

    expect(
      deriveViewportState({
        backStack: [],
        highlightedPostId: null,
        hasOverflow: true,
        isAtLatest: false,
        latestAffinity: "latest",
        lifecycle: "placing",
        pendingPlacement: {
          completion: "reached",
          highlightPostId: null,
          view: { kind: "bottom" },
        },
      }).shouldShowLatestButton
    ).toBe(false);
  });

  it("shows the latest button only when the viewer is meaningfully detached", () => {
    expect(
      deriveViewportState({
        backStack: [],
        highlightedPostId: null,
        hasOverflow: true,
        isAtLatest: false,
        latestAffinity: "detached",
        lifecycle: "ready",
        pendingPlacement: null,
      }).shouldShowLatestButton
    ).toBe(true);

    expect(
      deriveViewportState({
        backStack: [{ kind: "bottom" }],
        highlightedPostId: null,
        hasOverflow: true,
        isAtLatest: false,
        latestAffinity: "detached",
        lifecycle: "ready",
        pendingPlacement: null,
      }).shouldShowLatestButton
    ).toBe(false);
  });

  it("derives latest affinity from measured latest and user detachment", () => {
    expect(
      getViewportLatestAffinity({
        currentAffinity: "detached",
        hasUserDetachedFromLatest: false,
        isAtLatest: true,
      })
    ).toBe("latest");
    expect(
      getViewportLatestAffinity({
        currentAffinity: "latest",
        hasUserDetachedFromLatest: true,
        isAtLatest: false,
      })
    ).toBe("detached");
    expect(
      getViewportLatestAffinity({
        currentAffinity: "latest",
        hasUserDetachedFromLatest: false,
        isAtLatest: false,
      })
    ).toBe("latest");
  });

  it("detects only meaningful user detachment from latest placement", () => {
    const previousMeasurement = {
      bottomDistance: 4,
      hasOverflow: true,
      isAtLatest: false,
      lastVisiblePostId: firstPost._id,
      offset: 120,
      view: { kind: "post", postId: firstPost._id },
    } satisfies ViewportMeasurement;
    const measurement = {
      ...previousMeasurement,
      bottomDistance: 7,
      offset: 117,
    };

    expect(
      isViewportDetachedScroll({
        measurement,
        pendingPlacement: {
          completion: "reached",
          highlightPostId: null,
          view: { kind: "bottom" },
        },
        previousMeasurement,
      })
    ).toBe(true);
    expect(
      isViewportDetachedScroll({
        measurement: { ...measurement, bottomDistance: 5 },
        pendingPlacement: {
          completion: "reached",
          highlightPostId: null,
          view: { kind: "bottom" },
        },
        previousMeasurement,
      })
    ).toBe(false);
    expect(
      isViewportDetachedScroll({
        measurement,
        pendingPlacement: {
          completion: "reached",
          highlightPostId: null,
          view: { kind: "bottom" },
        },
        previousMeasurement: null,
      })
    ).toBe(false);
    expect(
      isViewportDetachedScroll({
        measurement,
        pendingPlacement: {
          completion: "settled",
          highlightPostId: firstPost._id,
          view: { kind: "post", postId: firstPost._id },
        },
        previousMeasurement: null,
      })
    ).toBe(true);
  });

  it("pushes semantic back views without duplicating the current entry", () => {
    expect(pushViewportBackView([], { kind: "bottom" })).toEqual([
      { kind: "bottom" },
    ]);
    expect(
      pushViewportBackView([{ kind: "bottom" }], { kind: "bottom" })
    ).toEqual([{ kind: "bottom" }]);
  });
});
