import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { MASCOT } from "@repo/backend/test/mascot";
import { Array as Arr, Schema } from "effect";
import {
  type CommentAuthor,
  type CommentRow,
  changeComment,
  commentAndReplyIds,
  countReplies,
  draftComment,
  likedComment,
  removeComments,
  unlikedComment,
} from "@/components/comments/state";

const commentId = Schema.decodeUnknownSync(Id("comments"));
const userId = Schema.decodeUnknownSync(Id("users"));
const user: CommentAuthor = {
  _id: userId("author"),
  mascot: MASCOT,
  name: "Author",
  picture: "animal",
};

/** A comment row as the content page reads it, with the given changes. */
function row(id: string, change: Partial<CommentRow> = {}): CommentRow {
  return {
    _creationTime: 1,
    _id: commentId(id),
    likeCount: 0,
    liked: false,
    replyCount: 0,
    replyToUser: null,
    slug: "lesson",
    text: id,
    user,
    userId: user._id,
    ...change,
  };
}

describe("comment optimistic state", () => {
  it("shows a like at once: liked, and one more like", () => {
    expect(likedComment(row("a", { likeCount: 2 }))).toMatchObject({
      liked: true,
      likeCount: 3,
    });
  });

  it("returns a liked comment as it is, so a repeated like counts once", () => {
    const liked = row("a", { liked: true, likeCount: 2 });
    expect(likedComment(liked)).toBe(liked);
  });

  it("takes a like back at once, and returns an unliked comment as it is", () => {
    expect(
      unlikedComment(row("a", { liked: true, likeCount: 1 }))
    ).toMatchObject({ liked: false, likeCount: 0 });
    const unliked = row("a");
    expect(unlikedComment(unliked)).toBe(unliked);
  });

  it("changes only the comment with the id, and keeps the order of the page", () => {
    const page = [row("first"), row("second"), row("third")];
    const changed = changeComment(page, commentId("second"), (comment) => ({
      ...comment,
      text: "changed",
    }));
    expect(Arr.map(changed, (comment) => comment.text)).toEqual([
      "first",
      "changed",
      "third",
    ]);
  });

  it("moves the reply count of the top-level comment by a number of replies", () => {
    const page = [row("root", { replyCount: 2 }), row("other")];
    expect(countReplies(page, commentId("root"), 3)).toMatchObject([
      { replyCount: 5 },
      { replyCount: 0 },
    ]);
    expect(countReplies(page, commentId("root"), -2)).toMatchObject([
      { replyCount: 0 },
      { replyCount: 0 },
    ]);
  });

  it("takes the comments with the given ids off a page, and keeps the rest in order", () => {
    const page = [row("a"), row("b"), row("c")];
    expect(
      Arr.map(
        removeComments(page, [commentId("a"), commentId("c")]),
        (comment) => comment.text
      )
    ).toEqual(["b"]);
  });

  it("finds a comment and every reply below it, by parent chain, and leaves the siblings", () => {
    const replies = [
      row("first", { parentId: commentId("root") }),
      row("nested", { parentId: commentId("first") }),
      row("sibling", { parentId: commentId("root") }),
      row("deeper", { parentId: commentId("nested") }),
      row("elsewhere", { parentId: commentId("sibling") }),
    ];
    expect(commentAndReplyIds(replies, commentId("first"))).toEqual([
      commentId("first"),
      commentId("nested"),
      commentId("deeper"),
    ]);
  });

  it("returns only the comment itself when no loaded reply names it", () => {
    expect(commentAndReplyIds([row("lonely")], commentId("lonely"))).toEqual([
      commentId("lonely"),
    ]);
  });

  it("drafts a top-level comment that starts its own thread", () => {
    const draft = draftComment(user, null, {
      _creationTime: 42,
      _id: commentId("draft"),
      slug: "lesson",
      text: "Halo.",
    });
    expect(draft).toMatchObject({
      _creationTime: 42,
      _id: commentId("draft"),
      liked: false,
      likeCount: 0,
      replyCount: 0,
      replyToUser: null,
      slug: "lesson",
      text: "Halo.",
      user,
      userId: user._id,
    });
    expect(draft).not.toHaveProperty("parentId");
    expect(draft).not.toHaveProperty("threadId");
  });

  it("drafts a reply into the thread of its top-level comment, and a reply to a reply into the same thread", () => {
    const top = row("top");
    const first = row("first", {
      parentId: top._id,
      replyCount: 0,
      threadId: top._id,
      user: { ...user, _id: userId("replier") },
    });
    const replyToTop = draftComment(user, top, {
      _creationTime: 1,
      _id: commentId("to-top"),
      slug: "lesson",
      text: "Balasan.",
    });
    const replyToReply = draftComment(user, first, {
      _creationTime: 2,
      _id: commentId("to-reply"),
      slug: "lesson",
      text: "Balasan lagi.",
    });
    expect(replyToTop).toMatchObject({
      parentId: top._id,
      replyToUser: top.user,
      replyToUserId: top.userId,
      threadId: top._id,
    });
    expect(replyToReply).toMatchObject({
      parentId: first._id,
      replyToUser: first.user,
      replyToUserId: first.userId,
      threadId: top._id,
    });
  });
});
