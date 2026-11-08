import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { HashSet, Option, Schema } from "effect";
import {
  createCommentDraft,
  generationOf,
  isThreadShown,
  photosOf,
  textOf,
} from "@/components/comments/draft";
import type { CommentRow } from "@/components/comments/state";

const commentId = Schema.decodeUnknownSync(Id("comments"));

/** A top-level comment of the lesson, as the list holds it. */
const root = {
  _creationTime: 1,
  _id: commentId("root"),
  likeCount: 0,
  liked: false,
  photos: [],
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

  it("keeps the photos of each composer, places each upload by its key, and takes photos out", () => {
    const draft = createCommentDraft();
    const photo = {
      failed: false,
      height: 0,
      key: "one",
      preview: "blob:one",
      upload: Option.none(),
      width: 0,
    };
    draft.getState().addPhotos("", [photo, { ...photo, key: "two" }]);
    draft.getState().placePhoto("", "one", {
      height: 600,
      upload: Option.some(
        Schema.decodeUnknownSync(Id("commentUploads"))("upload")
      ),
      width: 800,
    });
    draft.getState().placePhoto("", "two", { failed: true });

    expect(photosOf(draft.getState(), "")).toMatchObject([
      { height: 600, key: "one", width: 800 },
      { failed: true, key: "two" },
    ]);
    draft.getState().removePhotos("", ["two"]);
    expect(photosOf(draft.getState(), "")).toMatchObject([{ key: "one" }]);
    expect(photosOf(draft.getState(), root._id)).toEqual([]);
  });

  it("empties a composer that sent, with a new editor, and starts one again for restored words", () => {
    const draft = createCommentDraft();
    draft.getState().write("", "Terkirim");
    draft.getState().addPhotos("", [
      {
        failed: false,
        height: 1,
        key: "one",
        preview: "blob:one",
        upload: Option.none(),
        width: 1,
      },
    ]);

    draft.getState().clear("");
    expect(textOf(draft.getState(), "")).toBe("");
    expect(photosOf(draft.getState(), "")).toEqual([]);
    expect(generationOf(draft.getState(), "")).toBe(1);

    draft.getState().restore("", "Terkirim");
    expect(generationOf(draft.getState(), "")).toBe(2);
    expect(generationOf(draft.getState(), root._id)).toBe(0);
  });

  it("orders the list, edits one comment at a time, and shows a thread's replies once opened or answered", () => {
    const draft = createCommentDraft();
    expect(draft.getState().sort).toBe("top");
    draft.getState().sortBy("newest");
    expect(draft.getState().sort).toBe("newest");

    draft.getState().edit(root._id);
    expect(draft.getState().editing).toBe(root._id);
    draft.getState().edit(null);
    expect(draft.getState().editing).toBeNull();

    const threaded = { ...root, replyCount: 2 };
    const reply = { ...other, threadId: root._id };
    expect(isThreadShown(draft.getState(), threaded)).toBe(false);
    draft.getState().toggleThread(root._id);
    expect(isThreadShown(draft.getState(), threaded)).toBe(true);
    expect(isThreadShown(draft.getState(), reply)).toBe(false);
    draft.getState().toggleThread(root._id);
    expect(isThreadShown(draft.getState(), threaded)).toBe(false);

    draft.getState().open(reply);
    expect(isThreadShown(draft.getState(), root)).toBe(true);
    expect(HashSet.has(draft.getState().expanded, root._id)).toBe(true);
  });
});
