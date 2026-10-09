import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import {
  areConversationViewsEqual,
  isConversationViewAtPost,
} from "@/components/school/classes/forum/conversation/data/view/model";

const postId = Schema.decodeUnknownSync(Id("schoolClassForumPosts"))("post_1");
const otherPostId = Schema.decodeUnknownSync(Id("schoolClassForumPosts"))(
  "post_2"
);

describe("conversation/data/view/model", () => {
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
