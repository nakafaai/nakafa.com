import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import { createViewportStore } from "@/components/school/classes/forum/conversation/store/viewport";

const postId = "post_1" as Id<"schoolClassForumPosts">;

describe("conversation/store/viewport", () => {
  it("captures one semantic back origin", () => {
    const store = createViewportStore();

    store.getState().setBackOrigin({
      kind: "post",
      offset: 24,
      postId,
    });

    expect(store.getState().backOrigin).toEqual({
      kind: "post",
      offset: 24,
      postId,
    });
  });

  it("clears a captured back origin explicitly", () => {
    const store = createViewportStore();

    store.getState().setBackOrigin({ kind: "bottom" });
    store.getState().clearBackOrigin();

    expect(store.getState().backOrigin).toBeNull();
  });

  it("updates only the provided viewport booleans", () => {
    const store = createViewportStore();

    store
      .getState()
      .updateViewport({ hasPendingLatestPosts: true, isAtBottom: false });
    store.getState().updateViewport({ isAtBottom: true });

    expect(store.getState().hasPendingLatestPosts).toBe(true);
    expect(store.getState().isAtBottom).toBe(true);
  });

  it("switches transcript mode explicitly", () => {
    const store = createViewportStore();

    store.getState().setMode("focused");

    expect(store.getState().mode).toBe("focused");
  });
});
