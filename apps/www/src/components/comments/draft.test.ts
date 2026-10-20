import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { HashSet, Schema } from "effect";
import { createCommentDraft, textOf } from "@/components/comments/draft";
import type { CommentRow } from "@/components/comments/state";

const commentId = Schema.decodeUnknownSync(Id("comments"));

/** A top-level comment of the lesson, as the list holds it. */
const root = {
  _creationTime: 1,
  _id: commentId("root"),
  likeCount: 0,
  liked: false,
  replyCount: 0,
  replyToUser: null,
  slug: "lesson",
  text: "Root",
  user: null,
  userId: Schema.decodeUnknownSync(Id("users"))("author"),
} satisfies CommentRow;

const other = { ...root, _id: commentId("other"), text: "Other" };

describe("the draft of a list of comments", () => {
  it("opens one reply composer under a comment, and replaces it when another opens", () => {
    const draft = createCommentDraft();

    draft.getState().open(root);
    expect(draft.getState().target).toBe(root);

    draft.getState().open(other);
    expect(draft.getState().target).toBe(other);
  });

  it("closes the open reply composer", () => {
    const draft = createCommentDraft();
    draft.getState().open(root);

    draft.getState().close();

    expect(draft.getState().target).toBeNull();
  });

  it("holds the actions of each comment the server is saving until it answers for it", () => {
    const draft = createCommentDraft();

    draft.getState().startSaving(root._id);
    draft.getState().startSaving(other._id);
    draft.getState().finishSaving(root._id);

    expect(HashSet.has(draft.getState().saving, root._id)).toBe(false);
    expect(HashSet.has(draft.getState().saving, other._id)).toBe(true);
  });

  it("keeps the words of each composer, so a reply composer that closes or gives way keeps them", () => {
    const draft = createCommentDraft();
    draft.getState().open(root);
    draft.getState().write(root._id, "Balasan untuk root");
    draft.getState().open(other);
    draft.getState().write(other._id, "Balasan lain");
    draft.getState().close();

    expect(textOf(draft.getState(), root._id)).toBe("Balasan untuk root");
    expect(textOf(draft.getState(), other._id)).toBe("Balasan lain");
    expect(textOf(draft.getState(), "")).toBe("");
  });

  it("gives refused words back ahead of the words written since, and alone to an empty composer", () => {
    const draft = createCommentDraft();
    draft.getState().write("", "  ");
    draft.getState().restore("", "Ditolak");
    expect(textOf(draft.getState(), "")).toBe("Ditolak");

    draft.getState().write(root._id, "Tulisan baru");
    draft.getState().restore(root._id, "Ditolak lagi");
    expect(textOf(draft.getState(), root._id)).toBe(
      "Ditolak lagi\n\nTulisan baru"
    );
  });
});
