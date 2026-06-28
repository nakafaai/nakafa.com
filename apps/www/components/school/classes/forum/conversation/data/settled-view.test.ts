import { describe, expect, it } from "vitest";
import {
  captureConversationView,
  hasConversationViewReached,
  hasConversationViewSettledPlacement,
  isConversationViewCentered,
  isConversationViewVisible,
} from "@/components/school/classes/forum/conversation/data/settled-view";
import {
  createConversationTestRowsHandle as createHandle,
  conversationTestFirstPost as firstPost,
  conversationTestRowIndexByPostId as rowIndexByPostId,
  conversationTestRows as rows,
  conversationTestSecondPost as secondPost,
} from "@/components/school/classes/forum/conversation/helpers/test";

describe("conversation/data/settled-view", () => {
  it("captures bottom when the transcript is already settled at the latest edge", () => {
    expect(
      captureConversationView({
        handle: createHandle({ scrollOffset: 300 }).handle,
        rows,
      })
    ).toEqual({ kind: "bottom" });
  });

  it("captures the visible post closest to the viewport center", () => {
    expect(
      captureConversationView({
        handle: createHandle({
          offsets: [0, 60, 120, 150, 170],
          getItemOffset: (index) =>
            [0, 60, 120, 150, 170][index] ?? index * 100,
          getItemSize: (index) => [60, 60, 30, 20, 120][index] ?? 100,
          scrollOffset: 80,
        }).handle,
        rows,
      })
    ).toEqual({
      kind: "post",
      postId: secondPost._id,
    });
  });

  it("returns null when no visible post row exists in the current range", () => {
    expect(
      captureConversationView({
        handle: createHandle({ scrollOffset: 0, viewportSize: 90 }).handle,
        rows: rows.slice(0, 2),
      })
    ).toBeNull();
  });

  it("treats a post target as reached once it becomes visible or passes above the viewport", () => {
    expect(
      hasConversationViewReached({
        handle: createHandle({ scrollOffset: 90 }).handle,
        rowIndexByPostId,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(true);
    expect(
      hasConversationViewReached({
        handle: createHandle({ scrollOffset: 350 }).handle,
        rowIndexByPostId,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(true);
  });

  it("returns false when the target post is unknown or still below the viewport", () => {
    expect(
      hasConversationViewReached({
        handle: createHandle({ scrollOffset: 0 }).handle,
        rowIndexByPostId: new Map(),
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(false);
    expect(
      hasConversationViewReached({
        handle: createHandle({ scrollOffset: 0 }).handle,
        rowIndexByPostId,
        view: { kind: "post", postId: secondPost._id },
      })
    ).toBe(false);
    expect(
      hasConversationViewReached({
        handle: createHandle({ scrollOffset: 120 }).handle,
        rowIndexByPostId,
        view: { kind: "bottom" },
      })
    ).toBe(false);
  });

  it("treats a clipped post as visible but not centered", () => {
    const handle = createHandle({
      offsets: [0, 100, 120, 220, 320],
      getItemOffset: (index) => [0, 100, 120, 220, 320][index] ?? index * 100,
      getItemSize: (index) => [100, 20, 120, 100, 100][index] ?? 100,
      scrollOffset: 100,
      viewportSize: 300,
    }).handle;

    expect(
      isConversationViewVisible({
        handle,
        rowIndexByPostId,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(true);
    expect(
      isConversationViewCentered({
        handle,
        rowIndexByPostId,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(false);
  });

  it("treats a well-positioned post as centered and settled", () => {
    const handle = createHandle({
      offsets: [0, 100, 180, 300, 360],
      getItemOffset: (index) => [0, 100, 180, 300, 360][index] ?? index * 100,
      getItemSize: (index) => [100, 80, 120, 60, 100][index] ?? 100,
      scrollOffset: 80,
      viewportSize: 320,
    }).handle;

    expect(
      isConversationViewCentered({
        handle,
        rowIndexByPostId,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(true);
    expect(
      hasConversationViewSettledPlacement({
        handle,
        rowIndexByPostId,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(true);
  });

  it("treats top-clamped and bottom-clamped targets as settled when true centering is impossible", () => {
    const topClampedHandle = createHandle({
      offsets: [0, 10, 20, 140, 240],
      getItemOffset: (index) => [0, 10, 20, 140, 240][index] ?? index * 100,
      getItemSize: (index) => [10, 10, 100, 100, 100][index] ?? 100,
      scrollOffset: 0,
      scrollSize: 340,
    }).handle;
    const bottomClampedHandle = createHandle({
      offsets: [0, 100, 200, 300, 390],
      getItemOffset: (index) => [0, 100, 200, 300, 390][index] ?? index * 100,
      getItemSize: (index) => [100, 100, 100, 80, 100][index] ?? 100,
      scrollOffset: 300,
      scrollSize: 490,
    }).handle;

    expect(
      hasConversationViewSettledPlacement({
        handle: topClampedHandle,
        rowIndexByPostId,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(true);
    expect(
      hasConversationViewSettledPlacement({
        handle: bottomClampedHandle,
        rowIndexByPostId,
        view: { kind: "post", postId: secondPost._id },
      })
    ).toBe(true);
  });

  it("returns false for offscreen, unknown, or off-center placements", () => {
    expect(
      hasConversationViewSettledPlacement({
        handle: createHandle({ scrollOffset: 0 }).handle,
        rowIndexByPostId: new Map(),
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(false);
    expect(
      hasConversationViewSettledPlacement({
        handle: createHandle({ scrollOffset: 0, viewportSize: 80 }).handle,
        rowIndexByPostId,
        view: { kind: "post", postId: secondPost._id },
      })
    ).toBe(false);
    expect(
      hasConversationViewSettledPlacement({
        handle: createHandle({
          offsets: [0, 100, 140, 260, 360],
          getItemOffset: (index) =>
            [0, 100, 140, 260, 360][index] ?? index * 100,
          getItemSize: (index) => [100, 40, 60, 80, 100][index] ?? 100,
          scrollOffset: 100,
          viewportSize: 220,
        }).handle,
        rowIndexByPostId,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(false);
  });

  it("resolves bottom views from the latest edge", () => {
    const handle = createHandle({ scrollOffset: 300 }).handle;

    expect(
      isConversationViewVisible({
        handle,
        rowIndexByPostId,
        view: { kind: "bottom" },
      })
    ).toBe(true);
    expect(
      isConversationViewCentered({
        handle,
        rowIndexByPostId,
        view: { kind: "bottom" },
      })
    ).toBe(true);
    expect(
      hasConversationViewSettledPlacement({
        handle,
        rowIndexByPostId,
        view: { kind: "bottom" },
      })
    ).toBe(true);
    expect(
      hasConversationViewSettledPlacement({
        handle: createHandle({ scrollOffset: 120 }).handle,
        rowIndexByPostId,
        view: { kind: "bottom" },
      })
    ).toBe(false);
  });
});
