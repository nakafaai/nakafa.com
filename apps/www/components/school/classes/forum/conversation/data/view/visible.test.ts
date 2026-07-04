import { describe, expect, it } from "vitest";
import type { ForumPost } from "@/components/school/classes/forum/conversation/data/entities";
import type { ConversationRow } from "@/components/school/classes/forum/conversation/data/transcript/pages";
import {
  getCenteredConversationPostId,
  getFirstVisibleConversationPostId,
  getLastVisibleConversationPostId,
} from "@/components/school/classes/forum/conversation/data/view/visible";
import {
  createConversationTestPost,
  createConversationTestRowsHandle as createHandle,
  conversationTestFirstPost as firstPost,
  conversationTestRows as rows,
  conversationTestSecondPost as secondPost,
} from "@/components/school/classes/forum/conversation/fixtures/data";

describe("conversation/data/view/visible", () => {
  it("resolves the first, last, and centered visible post ids", () => {
    const handle = createHandle({
      offsets: [0, 60, 120, 150, 170],
      getItemOffset: (index) => [0, 60, 120, 150, 170][index] ?? index * 100,
      getItemSize: (index) => [60, 60, 30, 20, 120][index] ?? 100,
      scrollOffset: 80,
    }).handle;

    expect(getCenteredConversationPostId({ handle, rows })).toBe(
      secondPost._id
    );
    expect(getFirstVisibleConversationPostId({ handle, rows })).toBe(
      firstPost._id
    );
    expect(getLastVisibleConversationPostId({ handle, rows })).toBe(
      secondPost._id
    );
  });

  it("keeps the closest visible post when a later candidate is farther away", () => {
    expect(
      getCenteredConversationPostId({
        handle: createHandle({
          offsets: [0, 60, 120, 180, 240],
          getItemOffset: (index) =>
            [0, 60, 120, 180, 240][index] ?? index * 100,
          getItemSize: (index) => [60, 60, 80, 40, 60][index] ?? 100,
          scrollOffset: 100,
        }).handle,
        rows,
      })
    ).toBe(firstPost._id);
  });

  it("chooses the visible post below the center line when it is closer", () => {
    expect(
      getCenteredConversationPostId({
        handle: createHandle({
          offsets: [0, 60, 80, 120, 170],
          getItemOffset: (index) => [0, 60, 80, 120, 170][index] ?? index * 100,
          getItemSize: (index) => [60, 20, 40, 40, 40][index] ?? 100,
          scrollOffset: 100,
          viewportSize: 100,
        }).handle,
        rows,
      })
    ).toBe(secondPost._id);
  });

  it("returns null when no visible post row exists in the current range", () => {
    const structuralRows = rows.slice(0, 2);

    expect(
      getFirstVisibleConversationPostId({
        handle: createHandle({ scrollOffset: 0, viewportSize: 90 }).handle,
        rows: structuralRows,
      })
    ).toBeNull();
    expect(
      getLastVisibleConversationPostId({
        handle: createHandle({ scrollOffset: 0, viewportSize: 90 }).handle,
        rows: structuralRows,
      })
    ).toBeNull();
    expect(
      getLastVisibleConversationPostId({
        handle: createHandle({ scrollOffset: 0, viewportSize: 0 }).handle,
        rows,
      })
    ).toBeNull();
    expect(
      getCenteredConversationPostId({
        handle: createHandle({ scrollOffset: 0, viewportSize: 0 }).handle,
        rows,
      })
    ).toBeNull();
    expect(
      getFirstVisibleConversationPostId({
        handle: createHandle({ scrollOffset: 0 }).handle,
        rows: [],
      })
    ).toBeNull();
  });

  it("skips invisible trailing rows when resolving the last visible post", () => {
    expect(
      getLastVisibleConversationPostId({
        handle: createHandle({
          offsets: [0, 100, 200, 260, 350],
          getItemOffset: (index) =>
            [0, 100, 200, 260, 350][index] ?? index * 100,
          getItemSize: (index) => [100, 100, 60, 90, 100][index] ?? 100,
          scrollOffset: 100,
          scrollSize: 450,
          viewportSize: 250,
        }).handle,
        rows,
      })
    ).toBe(firstPost._id);
  });

  it("skips invisible leading rows when resolving the first visible post", () => {
    expect(
      getFirstVisibleConversationPostId({
        handle: createHandle({
          offsets: [0, 100, 200, 260, 350],
          getItemOffset: (index) =>
            [0, 100, 200, 260, 350][index] ?? index * 100,
          getItemSize: (index) => [100, 50, 60, 90, 100][index] ?? 100,
          scrollOffset: 150,
          scrollSize: 450,
          viewportSize: 250,
        }).handle,
        rows,
      })
    ).toBe(firstPost._id);
  });

  it("skips optimistic rows when resolving server-bound visible post ids", () => {
    const optimisticPost = {
      ...createConversationTestPost({
        postId: "optimistic_post",
        sequence: 3,
      }),
      isOptimistic: true,
    } satisfies ForumPost;
    const rowsWithOptimisticPost = [
      ...rows,
      { post: optimisticPost, type: "post" },
    ] satisfies ConversationRow[];
    const handle = createHandle({
      scrollOffset: 350,
      scrollSize: 600,
      viewportSize: 250,
    }).handle;

    expect(
      getLastVisibleConversationPostId({
        handle,
        rows: rowsWithOptimisticPost,
      })
    ).toBe(secondPost._id);
  });
});
