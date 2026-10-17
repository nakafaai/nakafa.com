import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { createReplying } from "@/components/comments/replying";
import type { CommentRow } from "@/components/comments/state";

const commentId = Schema.decodeUnknownSync(Id("comments"));

/** A top-level comment of the lesson, as the list holds it. */
const root = {
  _creationTime: 1,
  _id: commentId("root"),
  downvoteCount: 0,
  likeCount: 0,
  liked: false,
  replyCount: 0,
  replyToUser: null,
  slug: "lesson",
  text: "Root",
  upvoteCount: 0,
  user: null,
  userId: Schema.decodeUnknownSync(Id("users"))("author"),
  viewerVote: null,
} satisfies CommentRow;

const other = { ...root, _id: commentId("other"), text: "Other" };

describe("the reply composer state", () => {
  it("opens one reply composer under a comment, and replaces it when another opens", () => {
    const replying = createReplying();

    replying.getState().open(root);
    expect(replying.getState().target).toBe(root);

    replying.getState().open(other);
    expect(replying.getState().target).toBe(other);
  });

  it("closes the open reply composer", () => {
    const replying = createReplying();
    replying.getState().open(root);

    replying.getState().close();

    expect(replying.getState().target).toBeNull();
  });
});
