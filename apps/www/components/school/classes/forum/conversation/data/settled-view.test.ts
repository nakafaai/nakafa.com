import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { beforeEach, describe, expect, it } from "vitest";
import {
  captureConversationView,
  getCenteredConversationPostId,
  getFirstVisibleConversationPostId,
  getLastVisibleConversationPostId,
  hasConversationViewReached,
  hasConversationViewSettledPlacement,
  isConversationViewCentered,
  isConversationViewVisible,
} from "@/components/school/classes/forum/conversation/data/settled-view";

const firstPostId = "post_1" as Id<"schoolClassForumPosts">;
const secondPostId = "post_2" as Id<"schoolClassForumPosts">;
const postIds = [firstPostId, secondPostId];

function setRect(
  element: Element,
  { bottom, top }: { bottom: number; top: number }
) {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      bottom,
      height: bottom - top,
      left: 0,
      right: 0,
      top,
      width: 0,
      x: 0,
      y: top,
      toJSON: () => undefined,
    }),
  });
}

function setScrollMetrics(
  element: HTMLElement,
  {
    clientHeight,
    scrollHeight,
    scrollTop,
  }: {
    clientHeight: number;
    scrollHeight: number;
    scrollTop: number;
  }
) {
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    value: scrollTop,
    writable: true,
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("conversation/data/settled-view", () => {
  it("captures bottom when the scroll root is already settled at the latest edge", () => {
    const root = document.createElement("div");

    setRect(root, { top: 0, bottom: 200 });
    setScrollMetrics(root, {
      clientHeight: 200,
      scrollHeight: 200,
      scrollTop: 0,
    });

    expect(captureConversationView({ postIds: [], root })).toEqual({
      kind: "bottom",
    });
  });

  it("captures the post closest to the viewport center when detached from bottom", () => {
    const root = document.createElement("div");
    const firstPost = document.createElement("div");
    const secondPost = document.createElement("div");

    firstPost.dataset.postId = firstPostId;
    secondPost.dataset.postId = secondPostId;
    root.append(firstPost, secondPost);

    setRect(root, { top: 0, bottom: 200 });
    setScrollMetrics(root, {
      clientHeight: 200,
      scrollHeight: 600,
      scrollTop: 120,
    });
    setRect(firstPost, { top: 20, bottom: 80 });
    setRect(secondPost, { top: 90, bottom: 150 });

    expect(captureConversationView({ postIds, root })).toEqual({
      kind: "post",
      postId: secondPostId,
    });
    expect(getCenteredConversationPostId({ postIds, root })).toBe(secondPostId);
    expect(getFirstVisibleConversationPostId({ postIds, root })).toBe(
      firstPostId
    );
    expect(getLastVisibleConversationPostId({ postIds, root })).toBe(
      secondPostId
    );
  });

  it("picks the visible post below the center line when it is the closest target", () => {
    const root = document.createElement("div");
    const firstPost = document.createElement("div");
    const secondPost = document.createElement("div");

    firstPost.dataset.postId = firstPostId;
    secondPost.dataset.postId = secondPostId;
    root.append(firstPost, secondPost);

    setRect(root, { top: 0, bottom: 200 });
    setScrollMetrics(root, {
      clientHeight: 200,
      scrollHeight: 600,
      scrollTop: 120,
    });
    setRect(firstPost, { top: 10, bottom: 30 });
    setRect(secondPost, { top: 120, bottom: 160 });

    expect(getCenteredConversationPostId({ postIds, root })).toBe(secondPostId);
  });

  it("returns the last visible post when multiple rows are inside the viewport", () => {
    const root = document.createElement("div");
    const firstPost = document.createElement("div");
    const secondPost = document.createElement("div");

    firstPost.dataset.postId = firstPostId;
    secondPost.dataset.postId = secondPostId;
    root.append(firstPost, secondPost);

    setRect(root, { top: 0, bottom: 200 });
    setScrollMetrics(root, {
      clientHeight: 200,
      scrollHeight: 600,
      scrollTop: 120,
    });
    setRect(firstPost, { top: 20, bottom: 80 });
    setRect(secondPost, { top: 120, bottom: 180 });

    expect(getLastVisibleConversationPostId({ postIds, root })).toBe(
      secondPostId
    );
  });

  it("treats a back target as reached once it is visible or already above the viewport", () => {
    const root = document.createElement("div");
    const target = document.createElement("div");

    target.dataset.postId = firstPostId;
    root.append(target);

    setRect(root, { top: 100, bottom: 300 });
    setScrollMetrics(root, {
      clientHeight: 200,
      scrollHeight: 600,
      scrollTop: 260,
    });
    setRect(target, { top: 80, bottom: 90 });

    expect(
      hasConversationViewReached({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(true);
  });

  it("returns true immediately when the back target is still visible", () => {
    const root = document.createElement("div");
    const target = document.createElement("div");

    target.dataset.postId = firstPostId;
    root.append(target);

    setRect(root, { top: 100, bottom: 300 });
    setScrollMetrics(root, {
      clientHeight: 200,
      scrollHeight: 600,
      scrollTop: 120,
    });
    setRect(target, { top: 140, bottom: 180 });

    expect(
      hasConversationViewReached({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(true);
  });

  it("treats an edge-clipped post as visible but not centered for go-to-message", () => {
    const root = document.createElement("div");
    const target = document.createElement("div");

    target.dataset.postId = firstPostId;
    root.append(target);

    setRect(root, { top: 100, bottom: 500 });
    setScrollMetrics(root, {
      clientHeight: 400,
      scrollHeight: 1000,
      scrollTop: 120,
    });
    setRect(target, { top: 110, bottom: 220 });

    expect(
      isConversationViewVisible({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(true);
    expect(
      isConversationViewCentered({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(false);
  });

  it("treats a bottom-clipped post as not centered for go-to-message", () => {
    const root = document.createElement("div");
    const target = document.createElement("div");

    target.dataset.postId = firstPostId;
    root.append(target);

    setRect(root, { top: 100, bottom: 500 });
    setScrollMetrics(root, {
      clientHeight: 400,
      scrollHeight: 1000,
      scrollTop: 120,
    });
    setRect(target, { top: 260, bottom: 490 });

    expect(
      isConversationViewCentered({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(false);
    expect(
      hasConversationViewSettledPlacement({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(false);
  });

  it("treats a well-positioned post as centered", () => {
    const root = document.createElement("div");
    const target = document.createElement("div");

    target.dataset.postId = firstPostId;
    root.append(target);

    setRect(root, { top: 100, bottom: 500 });
    setScrollMetrics(root, {
      clientHeight: 400,
      scrollHeight: 1000,
      scrollTop: 120,
    });
    setRect(target, { top: 200, bottom: 320 });

    expect(
      isConversationViewCentered({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(true);
    expect(
      hasConversationViewSettledPlacement({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(true);
  });

  it("does not treat an off-center visible post as centered", () => {
    const root = document.createElement("div");
    const target = document.createElement("div");

    target.dataset.postId = firstPostId;
    root.append(target);

    setRect(root, { top: 100, bottom: 500 });
    setScrollMetrics(root, {
      clientHeight: 400,
      scrollHeight: 1000,
      scrollTop: 120,
    });
    setRect(target, { top: 140, bottom: 260 });

    expect(
      isConversationViewVisible({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(true);
    expect(
      isConversationViewCentered({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(false);
    expect(
      hasConversationViewSettledPlacement({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(false);
  });

  it("treats a top-clamped target as settled even when true centering is impossible", () => {
    const root = document.createElement("div");
    const target = document.createElement("div");

    target.dataset.postId = firstPostId;
    root.append(target);

    setRect(root, { top: 100, bottom: 500 });
    setScrollMetrics(root, {
      clientHeight: 400,
      scrollHeight: 1000,
      scrollTop: 0,
    });
    setRect(target, { top: 120, bottom: 220 });

    expect(
      isConversationViewCentered({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(false);
    expect(
      hasConversationViewSettledPlacement({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(true);
  });

  it("does not treat an offscreen target as settled", () => {
    const root = document.createElement("div");
    const target = document.createElement("div");

    target.dataset.postId = firstPostId;
    root.append(target);

    setRect(root, { top: 100, bottom: 500 });
    setScrollMetrics(root, {
      clientHeight: 400,
      scrollHeight: 1000,
      scrollTop: 0,
    });
    setRect(target, { top: 520, bottom: 620 });

    expect(
      hasConversationViewSettledPlacement({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(false);
  });

  it("treats a bottom-clamped target as settled even when true centering is impossible", () => {
    const root = document.createElement("div");
    const target = document.createElement("div");

    target.dataset.postId = firstPostId;
    root.append(target);

    setRect(root, { top: 100, bottom: 500 });
    setScrollMetrics(root, {
      clientHeight: 400,
      scrollHeight: 1000,
      scrollTop: 600,
    });
    setRect(target, { top: 380, bottom: 480 });

    expect(
      isConversationViewCentered({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(false);
    expect(
      hasConversationViewSettledPlacement({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(true);
  });

  it("treats a settled bottom view as centered", () => {
    const root = document.createElement("div");

    setRect(root, { top: 0, bottom: 200 });
    setScrollMetrics(root, {
      clientHeight: 200,
      scrollHeight: 200,
      scrollTop: 0,
    });

    expect(
      isConversationViewCentered({
        root,
        view: { kind: "bottom" },
      })
    ).toBe(true);
    expect(
      hasConversationViewSettledPlacement({
        root,
        view: { kind: "bottom" },
      })
    ).toBe(true);
  });

  it("returns null or false when no post matches the current semantic lookup", () => {
    const root = document.createElement("div");

    setRect(root, { top: 0, bottom: 200 });
    setScrollMetrics(root, {
      clientHeight: 200,
      scrollHeight: 600,
      scrollTop: 120,
    });

    expect(captureConversationView({ postIds, root })).toBeNull();
    expect(getLastVisibleConversationPostId({ postIds, root })).toBeNull();
    expect(
      isConversationViewVisible({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(false);
    expect(
      isConversationViewCentered({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(false);
    expect(
      hasConversationViewSettledPlacement({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(false);
    expect(
      hasConversationViewReached({
        root,
        view: { kind: "bottom" },
      })
    ).toBe(false);
    expect(
      hasConversationViewReached({
        root,
        view: { kind: "post", postId: firstPostId },
      })
    ).toBe(false);
  });

  it("returns null when a visible DOM row is no longer present in the current post ids", () => {
    const root = document.createElement("div");
    const post = document.createElement("div");

    post.dataset.postId = "missing_post";
    root.append(post);

    setRect(root, { top: 0, bottom: 200 });
    setScrollMetrics(root, {
      clientHeight: 200,
      scrollHeight: 600,
      scrollTop: 120,
    });
    setRect(post, { top: 20, bottom: 80 });

    expect(
      getFirstVisibleConversationPostId({
        postIds,
        root,
      })
    ).toBeNull();
    expect(
      getLastVisibleConversationPostId({
        postIds,
        root,
      })
    ).toBeNull();
  });
});
