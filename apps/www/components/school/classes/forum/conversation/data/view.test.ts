import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import {
  areConversationViewsEqual,
  isConversationViewAtPost,
} from "@/components/school/classes/forum/conversation/data/view";

const postId = "post_1" as Id<"schoolClassForumPosts">;
const otherPostId = "post_2" as Id<"schoolClassForumPosts">;

describe("conversation/data/view", () => {
  it("compares bottom and post views semantically", () => {
    expect(
      areConversationViewsEqual({ kind: "bottom" }, { kind: "bottom" })
    ).toBe(true);
    expect(
      areConversationViewsEqual(
        { kind: "post", postId },
        { kind: "post", postId }
      )
    ).toBe(true);
    expect(
      areConversationViewsEqual(
        { kind: "post", postId },
        { kind: "post", postId: otherPostId }
      )
    ).toBe(false);
    expect(
      areConversationViewsEqual({ kind: "bottom" }, { kind: "post", postId })
    ).toBe(false);
    expect(areConversationViewsEqual(null, null)).toBe(true);
    expect(areConversationViewsEqual(undefined, { kind: "bottom" })).toBe(
      false
    );
  });

  it("detects whether one semantic view is already at the target post", () => {
    expect(isConversationViewAtPost({ kind: "post", postId }, postId)).toBe(
      true
    );
    expect(isConversationViewAtPost({ kind: "bottom" }, postId)).toBe(false);
    expect(isConversationViewAtPost(null, postId)).toBe(false);
  });
});
