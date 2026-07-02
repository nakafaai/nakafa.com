import { describe, expect, it } from "vitest";
import {
  captureConversationView,
  hasConversationViewReached,
  isConversationViewSettled,
  isConversationViewVisible,
} from "@/components/school/classes/forum/conversation/data/view/position";
import {
  createConversationTestRowsHandle as createHandle,
  conversationTestFirstPost as firstPost,
  conversationTestRowIndexByPostId as rowIndexByPostId,
  conversationTestRows as rows,
  conversationTestSecondPost as secondPost,
} from "@/components/school/classes/forum/conversation/fixtures/data";

describe("conversation/data/view/position", () => {
  it("captures bottom when the transcript is already at the latest edge", () => {
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

  it("treats a clipped post as visible", () => {
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
      isConversationViewSettled({
        handle,
        rowIndexByPostId,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(false);
  });

  it("settles a post only when the row reaches the viewport center", () => {
    expect(
      isConversationViewSettled({
        handle: createHandle({ scrollOffset: 150 }).handle,
        rowIndexByPostId,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(true);
    expect(
      isConversationViewSettled({
        handle: createHandle({ scrollOffset: 150 }).handle,
        rowIndexByPostId: new Map(),
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(false);
  });

  it("settles visible post targets that are clamped by transcript edges", () => {
    const topHandle = createHandle({
      getItemOffset: (index) => [0, 10, 20, 90, 150][index] ?? index * 100,
      getItemSize: (index) => [10, 10, 30, 60, 30][index] ?? 100,
      offsets: [0, 10, 20, 90, 150],
      scrollOffset: 0,
      scrollSize: 500,
      viewportSize: 200,
    }).handle;
    const bottomHandle = createHandle({
      getItemOffset: (index) => [0, 40, 70, 120, 170][index] ?? index * 100,
      getItemSize: (index) => [40, 30, 30, 50, 30][index] ?? 100,
      offsets: [0, 40, 70, 120, 170],
      scrollOffset: 20,
      scrollSize: 220,
      viewportSize: 200,
    }).handle;

    expect(
      isConversationViewSettled({
        handle: topHandle,
        rowIndexByPostId,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(true);
    expect(
      isConversationViewSettled({
        handle: topHandle,
        rowIndexByPostId,
        view: { kind: "post", postId: secondPost._id },
      })
    ).toBe(false);
    expect(
      isConversationViewSettled({
        handle: bottomHandle,
        rowIndexByPostId,
        view: { kind: "post", postId: secondPost._id },
      })
    ).toBe(true);
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
      isConversationViewSettled({
        handle,
        rowIndexByPostId,
        view: { kind: "bottom" },
      })
    ).toBe(true);
  });
});
