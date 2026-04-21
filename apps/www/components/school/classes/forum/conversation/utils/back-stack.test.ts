import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import type { ForumConversationView } from "@/components/school/classes/forum/conversation/models";
import {
  type BackStackEntry,
  clearBackStack,
  peekBackView,
  popBackView,
  pushBackView,
} from "@/components/school/classes/forum/conversation/utils/back-stack";

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

/** Creates one transient back-stack entry for one origin view. */
function createEntry(
  originView: ForumConversationView,
  dismissWhen: BackStackEntry["dismissWhen"] = "exact-origin"
): BackStackEntry {
  return {
    dismissWhen,
    originView,
  };
}

describe("forum conversation back stack", () => {
  it("starts empty and peeks null", () => {
    const backStack = clearBackStack();

    expect(backStack).toEqual([]);
    expect(peekBackView(backStack)).toBeNull();
  });

  it("pushes distinct views and dedupes identical consecutive views", () => {
    const entry = createEntry(createView());
    const nextBackStack = pushBackView({
      backStack: clearBackStack(),
      entry,
    });

    expect(nextBackStack).toEqual([entry]);
    expect(
      pushBackView({
        backStack: nextBackStack,
        entry,
      })
    ).toBe(nextBackStack);
  });

  it("keeps only the newest bounded back history", () => {
    const backStack = [
      createEntry(
        createView({ postId: "post_1" as Id<"schoolClassForumPosts"> })
      ),
      createEntry(
        createView({ postId: "post_2" as Id<"schoolClassForumPosts"> })
      ),
      createEntry(
        createView({ postId: "post_3" as Id<"schoolClassForumPosts"> })
      ),
      createEntry(
        createView({ postId: "post_4" as Id<"schoolClassForumPosts"> })
      ),
      createEntry(
        createView({ postId: "post_5" as Id<"schoolClassForumPosts"> })
      ),
    ];

    expect(
      pushBackView({
        backStack,
        entry: createEntry(
          createView({ postId: "post_6" as Id<"schoolClassForumPosts"> })
        ),
      })
    ).toEqual([
      createEntry(
        createView({ postId: "post_2" as Id<"schoolClassForumPosts"> })
      ),
      createEntry(
        createView({ postId: "post_3" as Id<"schoolClassForumPosts"> })
      ),
      createEntry(
        createView({ postId: "post_4" as Id<"schoolClassForumPosts"> })
      ),
      createEntry(
        createView({ postId: "post_5" as Id<"schoolClassForumPosts"> })
      ),
      createEntry(
        createView({ postId: "post_6" as Id<"schoolClassForumPosts"> })
      ),
    ]);
  });

  it("pops the newest view and returns the remaining stack", () => {
    const backStack = [
      createEntry(createView({ kind: "bottom" })),
      createEntry(createView({ postId: postBId })),
    ];

    expect(popBackView(backStack)).toEqual({
      backStack: [createEntry(createView({ kind: "bottom" }))],
      entry: createEntry(createView({ postId: postBId })),
    });

    expect(popBackView(clearBackStack())).toEqual({
      backStack: [],
      entry: null,
    });
  });
});
