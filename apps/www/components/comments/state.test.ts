import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import {
  deleteCommentFromPage,
  updateCommentVote,
} from "@/components/comments/state";

const parentId = "parent" as Id<"comments">;
const replyId = "reply" as Id<"comments">;
const parent = {
  _creationTime: 1,
  _id: parentId,
  downvoteCount: 0,
  replyCount: 1,
  slug: "lesson",
  text: "Parent",
  upvoteCount: 2,
  userId: "user" as Id<"users">,
  viewerVote: 1 as const,
};
const reply = {
  ...parent,
  _id: replyId,
  parentId,
  replyCount: 0,
  text: "Reply",
  viewerVote: null,
};

describe("comment optimistic state", () => {
  it("switches an upvote to a downvote", () => {
    expect(updateCommentVote(parent, -1)).toMatchObject({
      downvoteCount: 1,
      upvoteCount: 1,
      viewerVote: -1,
    });
  });

  it("adds and removes a vote without producing negative counts", () => {
    const added = updateCommentVote(reply, 1);
    const removed = updateCommentVote(
      { ...reply, downvoteCount: 0, viewerVote: -1 as const },
      0
    );

    expect(added).toMatchObject({ upvoteCount: 3, viewerVote: 1 });
    expect(removed).toMatchObject({ downvoteCount: 0, viewerVote: null });
  });

  it("keeps counts stable when the requested vote is unchanged", () => {
    expect(updateCommentVote(parent, 1)).toMatchObject({
      upvoteCount: 2,
      viewerVote: 1,
    });
  });

  it("deletes a reply and decrements its loaded parent", () => {
    expect(deleteCommentFromPage([parent, reply], replyId)).toEqual([
      { ...parent, replyCount: 0 },
    ]);
  });

  it("deletes a root comment without changing unrelated rows", () => {
    expect(deleteCommentFromPage([parent, reply], parentId)).toEqual([reply]);
  });

  it("preserves the original page when the target is not loaded", () => {
    const page = [parent, reply];
    expect(deleteCommentFromPage(page, "missing" as Id<"comments">)).toBe(page);
  });
});
