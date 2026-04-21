import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it, vi } from "vitest";
import type { ForumPost } from "@/components/school/classes/forum/conversation/models";
import type {
  Forum,
  VirtualItem,
} from "@/components/school/classes/forum/conversation/types";
import {
  captureVisibleConversationDomAnchor,
  findConversationPostRow,
  getConversationBottomDistance,
  getConversationItemKey,
  getConversationRowTopWithinScrollRoot,
  getConversationScrollMetrics,
  getLoadedPostBoundaries,
  isConversationPostVisibleInDom,
  needsConversationDomAnchorCorrection,
  reconcileConversationDomAnchor,
} from "@/components/school/classes/forum/conversation/utils/transcript";

const forumId = "forum_1" as Id<"schoolClassForums">;
const userId = "user_1" as Id<"users">;

/** Creates one minimal forum shape for transcript semantics tests. */
function createForum(): Forum {
  const createdTime = Date.UTC(2026, 3, 20, 10, 0, 0);

  return {
    _creationTime: createdTime,
    _id: forumId,
    body: "Forum body",
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: userId,
    isPinned: false,
    lastPostAt: createdTime,
    lastPostBy: userId,
    myReactions: [],
    nextPostSequence: 2,
    postCount: 1,
    reactionCounts: [],
    reactionUsers: [],
    schoolId: "school_1" as Id<"schools">,
    status: "open",
    tag: "general",
    title: "Forum title",
    updatedAt: createdTime,
    user: null,
  } satisfies Forum;
}

/** Creates one minimal forum post shape for transcript utility tests. */
function createPost(id: string): ForumPost {
  const createdTime = Date.UTC(2026, 3, 20, 10, 0, 0);

  return {
    _creationTime: createdTime,
    _id: id as Id<"schoolClassForumPosts">,
    attachments: [],
    body: id,
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: userId,
    forumId,
    isUnread: false,
    mentions: [],
    myReactions: [],
    reactionCounts: [],
    reactionUsers: [],
    replyCount: 0,
    replyToBody: undefined,
    replyToUser: null,
    replyToUserId: undefined,
    sequence: 1,
    updatedAt: createdTime,
    user: null,
  } satisfies ForumPost;
}

/** Mocks one element rect with the minimum DOMRect shape our helpers need. */
function createRect({
  bottom,
  height,
  top,
}: {
  bottom: number;
  height: number;
  top: number;
}) {
  return {
    bottom,
    height,
    left: 0,
    right: 320,
    top,
    width: 320,
    x: 0,
    y: top,
    toJSON: () => "",
  };
}

describe("conversation/utils/transcript", () => {
  it("keeps semantic row keys stable for every transcript item type", () => {
    const forumItem = {
      forum: createForum(),
      type: "header",
    } satisfies VirtualItem;
    const dateItem = {
      date: Date.UTC(2026, 3, 20),
      type: "date",
    } satisfies VirtualItem;
    const unreadItem = {
      count: 2,
      postId: "post_unread" as Id<"schoolClassForumPosts">,
      status: "history",
      type: "unread",
    } satisfies VirtualItem;
    const postItem = {
      isFirstInGroup: true,
      isLastInGroup: true,
      post: createPost("post_visible"),
      showContinuationTime: false,
      type: "post",
    } satisfies VirtualItem;

    expect(getConversationItemKey(forumItem)).toBe("header");
    expect(getConversationItemKey(dateItem)).toBe(
      `date:${Date.UTC(2026, 3, 20)}`
    );
    expect(getConversationItemKey(unreadItem)).toBe("unread:post_unread");
    expect(getConversationItemKey(postItem)).toBe("post:post_visible");
  });

  it("returns the current oldest and newest loaded post ids", () => {
    const items = [
      { forum: createForum(), type: "header" },
      {
        isFirstInGroup: true,
        isLastInGroup: false,
        post: createPost("post_oldest"),
        showContinuationTime: false,
        type: "post",
      },
      {
        date: Date.UTC(2026, 3, 20),
        type: "date",
      },
      {
        isFirstInGroup: false,
        isLastInGroup: true,
        post: createPost("post_newest"),
        showContinuationTime: true,
        type: "post",
      },
    ] satisfies VirtualItem[];

    expect(getLoadedPostBoundaries(items)).toEqual({
      newestPostId: "post_newest",
      oldestPostId: "post_oldest",
    });
  });

  it("prefers DOM scroll metrics and falls back to the virtualizer handle", () => {
    const scrollElement = document.createElement("div");
    Object.defineProperties(scrollElement, {
      clientHeight: { configurable: true, value: 360 },
      scrollHeight: { configurable: true, value: 1440 },
      scrollTop: { configurable: true, value: 180 },
    });

    expect(
      getConversationScrollMetrics({
        handle: {
          scrollOffset: 40,
          scrollSize: 420,
          viewportSize: 120,
        },
        scrollElement,
      })
    ).toEqual({
      scrollHeight: 1440,
      scrollOffset: 180,
      viewportHeight: 360,
    });

    expect(
      getConversationScrollMetrics({
        handle: {
          scrollOffset: 40,
          scrollSize: 420,
          viewportSize: 120,
        },
        scrollElement: null,
      })
    ).toEqual({
      scrollHeight: 420,
      scrollOffset: 40,
      viewportHeight: 120,
    });
  });

  it("captures the first visible rendered post as a DOM anchor", () => {
    const scrollElement = document.createElement("div");
    const hiddenPost = document.createElement("div");
    const visiblePost = document.createElement("div");
    const belowViewportPost = document.createElement("div");

    hiddenPost.dataset.postId = "post_hidden";
    visiblePost.dataset.postId = "post_visible";
    belowViewportPost.dataset.postId = "post_below";

    scrollElement.append(hiddenPost, visiblePost, belowViewportPost);

    vi.spyOn(scrollElement, "getBoundingClientRect").mockReturnValue(
      createRect({
        bottom: 400,
        height: 400,
        top: 0,
      })
    );
    vi.spyOn(hiddenPost, "getBoundingClientRect").mockReturnValue(
      createRect({
        bottom: -8,
        height: 72,
        top: -80,
      })
    );
    vi.spyOn(visiblePost, "getBoundingClientRect").mockReturnValue(
      createRect({
        bottom: 180,
        height: 80,
        top: 100,
      })
    );
    vi.spyOn(belowViewportPost, "getBoundingClientRect").mockReturnValue(
      createRect({
        bottom: 520,
        height: 80,
        top: 440,
      })
    );

    expect(
      captureVisibleConversationDomAnchor({
        scrollElement,
      })
    ).toEqual({
      postId: "post_visible",
      topWithinScrollRoot: 100,
    });
  });

  it("returns null when no rendered post is visible inside the scroll root", () => {
    const scrollElement = document.createElement("div");
    const hiddenPost = document.createElement("div");
    const anonymousRow = document.createElement("div");
    const belowViewportPost = document.createElement("div");

    hiddenPost.dataset.postId = "post_hidden";
    anonymousRow.setAttribute("data-post-id", "");
    belowViewportPost.dataset.postId = "post_below";
    scrollElement.append(hiddenPost, anonymousRow, belowViewportPost);

    vi.spyOn(scrollElement, "getBoundingClientRect").mockReturnValue(
      createRect({
        bottom: 400,
        height: 400,
        top: 0,
      })
    );
    vi.spyOn(hiddenPost, "getBoundingClientRect").mockReturnValue(
      createRect({
        bottom: -8,
        height: 72,
        top: -80,
      })
    );
    vi.spyOn(anonymousRow, "getBoundingClientRect").mockReturnValue(
      createRect({
        bottom: 80,
        height: 40,
        top: 40,
      })
    );
    vi.spyOn(belowViewportPost, "getBoundingClientRect").mockReturnValue(
      createRect({
        bottom: 520,
        height: 80,
        top: 440,
      })
    );

    expect(
      captureVisibleConversationDomAnchor({
        scrollElement,
      })
    ).toBeNull();
  });

  it("finds one rendered post row and resolves its top within the scroll root", () => {
    const scrollElement = document.createElement("div");
    const postRow = document.createElement("div");

    postRow.dataset.postId = "post_visible";
    scrollElement.append(postRow);

    vi.spyOn(scrollElement, "getBoundingClientRect").mockReturnValue(
      createRect({
        bottom: 420,
        height: 420,
        top: 20,
      })
    );
    vi.spyOn(postRow, "getBoundingClientRect").mockReturnValue(
      createRect({
        bottom: 200,
        height: 80,
        top: 120,
      })
    );

    expect(
      findConversationPostRow({
        postId: "post_visible" as Id<"schoolClassForumPosts">,
        scrollElement,
      })
    ).toBe(postRow);
    expect(
      getConversationRowTopWithinScrollRoot({
        element: postRow,
        scrollElement,
      })
    ).toBe(100);
  });

  it("returns null when the requested rendered post row does not exist", () => {
    const scrollElement = document.createElement("div");

    expect(
      findConversationPostRow({
        postId: "post_missing" as Id<"schoolClassForumPosts">,
        scrollElement,
      })
    ).toBeNull();
    expect(
      isConversationPostVisibleInDom({
        postId: "post_missing" as Id<"schoolClassForumPosts">,
        scrollElement,
      })
    ).toBe(false);
  });

  it("reconciles one DOM anchor by adjusting scrollTop until it settles", () => {
    const scrollElement = document.createElement("div");
    const postRow = document.createElement("div");

    postRow.dataset.postId = "post_visible";
    scrollElement.append(postRow);
    scrollElement.scrollTop = 120;

    vi.spyOn(scrollElement, "getBoundingClientRect").mockReturnValue(
      createRect({
        bottom: 420,
        height: 420,
        top: 20,
      })
    );
    vi.spyOn(postRow, "getBoundingClientRect")
      .mockReturnValueOnce(
        createRect({
          bottom: 250,
          height: 80,
          top: 150,
        })
      )
      .mockReturnValueOnce(
        createRect({
          bottom: 200,
          height: 80,
          top: 100,
        })
      );

    expect(
      reconcileConversationDomAnchor({
        anchor: {
          postId: "post_visible" as Id<"schoolClassForumPosts">,
          topWithinScrollRoot: 80,
        },
        scrollElement,
      })
    ).toBe("pending");
    expect(scrollElement.scrollTop).toBe(170);
    expect(
      reconcileConversationDomAnchor({
        anchor: {
          postId: "post_visible" as Id<"schoolClassForumPosts">,
          topWithinScrollRoot: 80,
        },
        scrollElement,
      })
    ).toBe("settled");
  });

  it("reports one missing restore anchor when the rendered target row is absent", () => {
    const scrollElement = document.createElement("div");

    expect(
      reconcileConversationDomAnchor({
        anchor: {
          postId: "post_missing" as Id<"schoolClassForumPosts">,
          topWithinScrollRoot: 80,
        },
        scrollElement,
      })
    ).toBe("missing");
  });

  it("checks rendered post visibility and bottom distance without virtual offsets", () => {
    const scrollElement = document.createElement("div");
    const visiblePost = document.createElement("div");
    const hiddenPost = document.createElement("div");

    visiblePost.dataset.postId = "post_visible";
    hiddenPost.dataset.postId = "post_hidden";
    scrollElement.append(visiblePost, hiddenPost);

    vi.spyOn(scrollElement, "getBoundingClientRect").mockReturnValue(
      createRect({
        bottom: 400,
        height: 400,
        top: 0,
      })
    );
    vi.spyOn(visiblePost, "getBoundingClientRect").mockReturnValue(
      createRect({
        bottom: 180,
        height: 80,
        top: 100,
      })
    );
    vi.spyOn(hiddenPost, "getBoundingClientRect").mockReturnValue(
      createRect({
        bottom: 520,
        height: 80,
        top: 440,
      })
    );

    expect(
      isConversationPostVisibleInDom({
        postId: "post_visible" as Id<"schoolClassForumPosts">,
        scrollElement,
      })
    ).toBe(true);
    expect(
      isConversationPostVisibleInDom({
        postId: "post_hidden" as Id<"schoolClassForumPosts">,
        scrollElement,
      })
    ).toBe(false);
    expect(
      getConversationBottomDistance({
        scrollHeight: 1200,
        scrollOffset: 600,
        viewportHeight: 300,
      })
    ).toBe(300);
    expect(
      getConversationScrollMetrics({
        handle: null,
        scrollElement: null,
      })
    ).toEqual({
      scrollHeight: 0,
      scrollOffset: 0,
      viewportHeight: 0,
    });
    expect(needsConversationDomAnchorCorrection(-1)).toBe(false);
    expect(needsConversationDomAnchorCorrection(0.5)).toBe(false);
    expect(needsConversationDomAnchorCorrection(4)).toBe(true);
  });
});
