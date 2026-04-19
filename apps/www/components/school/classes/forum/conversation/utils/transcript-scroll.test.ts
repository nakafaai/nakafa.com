import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import {
  clampScrollTop,
  findVisiblePostAnchor,
  getDistanceFromBottom,
  getPostOffsetTop,
  getScrollTopForPost,
  isAtTranscriptBottom,
  isNearReadStateBottom,
} from "@/components/school/classes/forum/conversation/utils/transcript-scroll";

function createContainer(scrollTop = 200) {
  const container = document.createElement("div");
  let currentScrollTop = scrollTop;

  Object.defineProperty(container, "clientHeight", {
    configurable: true,
    value: 400,
  });
  Object.defineProperty(container, "scrollHeight", {
    configurable: true,
    value: 1200,
  });
  Object.defineProperty(container, "scrollTop", {
    configurable: true,
    get: () => currentScrollTop,
    set: (value: number) => {
      currentScrollTop = value;
    },
  });
  Object.defineProperty(container, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ bottom: 500, top: 100 }),
  });

  return container;
}

function createPost(top: number, height = 80) {
  const element = document.createElement("div");

  Object.defineProperty(element, "offsetHeight", {
    configurable: true,
    value: height,
  });
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ bottom: 100 + top + height, top: 100 + top }),
  });

  return element;
}

describe("conversation/utils/transcript-scroll", () => {
  it("measures bottom distance and near-bottom state", () => {
    const container = createContainer(798);

    expect(isAtTranscriptBottom(container)).toBe(true);
    expect(getDistanceFromBottom(container)).toBe(2);
    expect(isNearReadStateBottom(container)).toBe(true);
    expect(isNearReadStateBottom(undefined)).toBe(false);
  });

  it("measures absolute post offsets and clamps scroll targets", () => {
    const container = createContainer(200);
    const element = createPost(60);

    expect(getPostOffsetTop({ container, element })).toBe(260);
    expect(clampScrollTop(container, -10)).toBe(0);
    expect(clampScrollTop(container, 1600)).toBe(800);
    expect(
      getScrollTopForPost({
        align: "center",
        container,
        element,
        offset: 10,
      })
    ).toBe(110);
    expect(
      getScrollTopForPost({
        align: "start",
        container,
        element,
        offset: 20,
      })
    ).toBe(240);
  });

  it("finds the first visible post anchor and ignores missing or hidden rows", () => {
    const container = createContainer(200);
    const postAId = "post_a" as Id<"schoolClassForumPosts">;
    const postBId = "post_b" as Id<"schoolClassForumPosts">;
    const orderedPostIds = [postAId, postBId];
    const postElements = new Map([[postBId, createPost(40)]]);

    expect(
      findVisiblePostAnchor({
        container,
        orderedPostIds,
        postElements,
      })
    ).toEqual({
      postId: postBId,
      top: 40,
    });

    postElements.set(postAId, createPost(-200));
    postElements.set(postBId, createPost(420));

    expect(
      findVisiblePostAnchor({
        container,
        orderedPostIds,
        postElements,
      })
    ).toBeNull();
  });
});
