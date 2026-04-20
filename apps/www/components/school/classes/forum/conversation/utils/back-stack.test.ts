import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import {
  clearBackStack,
  peekBackView,
  popBackView,
  pushBackView,
} from "@/components/school/classes/forum/conversation/utils/back-stack";
import type { ForumConversationView } from "@/lib/store/forum";

const postAId = "post_a" as Id<"schoolClassForumPosts">;
const postBId = "post_b" as Id<"schoolClassForumPosts">;

/** Creates one forum conversation view for back-stack tests. */
function createView(overrides?: {
  kind?: ForumConversationView["kind"];
  postId?: Id<"schoolClassForumPosts">;
}): ForumConversationView {
  if (overrides?.kind === "bottom") {
    return { kind: "bottom" };
  }

  return {
    kind: overrides?.kind ?? "post",
    postId: overrides?.postId ?? postAId,
  } as ForumConversationView;
}

describe("forum conversation back stack", () => {
  it("starts empty and peeks null", () => {
    const backStack = clearBackStack();

    expect(backStack).toEqual([]);
    expect(peekBackView(backStack)).toBeNull();
  });

  it("pushes distinct views and dedupes identical consecutive views", () => {
    const view = createView();
    const nextBackStack = pushBackView({
      backStack: clearBackStack(),
      view,
    });

    expect(nextBackStack).toEqual([view]);
    expect(
      pushBackView({
        backStack: nextBackStack,
        view,
      })
    ).toBe(nextBackStack);
  });

  it("keeps only the newest bounded back history", () => {
    const backStack = [
      createView({ postId: "post_1" as Id<"schoolClassForumPosts"> }),
      createView({ postId: "post_2" as Id<"schoolClassForumPosts"> }),
      createView({ postId: "post_3" as Id<"schoolClassForumPosts"> }),
      createView({ postId: "post_4" as Id<"schoolClassForumPosts"> }),
      createView({ postId: "post_5" as Id<"schoolClassForumPosts"> }),
    ];

    expect(
      pushBackView({
        backStack,
        view: createView({ postId: "post_6" as Id<"schoolClassForumPosts"> }),
      })
    ).toEqual([
      createView({ postId: "post_2" as Id<"schoolClassForumPosts"> }),
      createView({ postId: "post_3" as Id<"schoolClassForumPosts"> }),
      createView({ postId: "post_4" as Id<"schoolClassForumPosts"> }),
      createView({ postId: "post_5" as Id<"schoolClassForumPosts"> }),
      createView({ postId: "post_6" as Id<"schoolClassForumPosts"> }),
    ]);
  });

  it("pops the newest view and returns the remaining stack", () => {
    const backStack = [
      createView({ kind: "bottom" }),
      createView({ postId: postBId }),
    ];

    expect(popBackView(backStack)).toEqual({
      backStack: [createView({ kind: "bottom" })],
      view: createView({ postId: postBId }),
    });

    expect(popBackView(clearBackStack())).toEqual({
      backStack: [],
      view: null,
    });
  });
});
