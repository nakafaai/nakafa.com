import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import { createViewportStore } from "@/components/school/classes/forum/conversation/store/viewport";

const firstPostId = "post_1" as Id<"schoolClassForumPosts">;
const secondPostId = "post_2" as Id<"schoolClassForumPosts">;

describe("conversation/store/viewport", () => {
  it("pushes and pops semantic back views in order", () => {
    const store = createViewportStore();

    store.getState().pushBackView({ kind: "post", postId: firstPostId });
    store.getState().pushBackView({ kind: "post", postId: secondPostId });

    expect(store.getState().popBackView()).toEqual({
      kind: "post",
      postId: secondPostId,
    });
    expect(store.getState().popBackView()).toEqual({
      kind: "post",
      postId: firstPostId,
    });
    expect(store.getState().popBackView()).toBeNull();
  });

  it("deduplicates repeated back views and clears the stack", () => {
    const store = createViewportStore();

    store.getState().clearBackStack();
    store.getState().pushBackView({ kind: "bottom" });
    store.getState().pushBackView({ kind: "bottom" });

    expect(store.getState().backStack).toEqual([{ kind: "bottom" }]);

    store.getState().clearBackStack();

    expect(store.getState().backStack).toEqual([]);
  });

  it("keeps settled view idempotent", () => {
    const store = createViewportStore();

    store.getState().setSettledView({ kind: "post", postId: firstPostId });
    store.getState().setSettledView({ kind: "post", postId: firstPostId });

    expect(store.getState().settledView).toEqual({
      kind: "post",
      postId: firstPostId,
    });
  });

  it("updates only the provided viewport booleans", () => {
    const store = createViewportStore();

    store.getState().updateViewport({});
    store.getState().updateViewport({ hasOverflow: true });
    store.getState().updateViewport({ isAtBottom: false });
    store.getState().updateViewport({ isAtBottom: true });

    expect(store.getState().hasOverflow).toBe(true);
    expect(store.getState().isAtBottom).toBe(true);
  });

  it("stores one highlighted post id until cleared", () => {
    const store = createViewportStore();

    store.getState().highlightPost(firstPostId);
    store.getState().highlightPost(firstPostId);

    expect(store.getState().highlightedPostId).toBe(firstPostId);

    store.getState().clearHighlightedPost();
    store.getState().clearHighlightedPost();

    expect(store.getState().highlightedPostId).toBeNull();
  });
});
