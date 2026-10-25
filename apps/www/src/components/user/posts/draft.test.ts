import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { HashSet, Schema } from "effect";
import { createPostDraft } from "@/components/user/posts/draft";

const postId = Schema.decodeUnknownSync(Id("posts"));
const first = postId("draft-post");
const second = postId("next-post");

describe("posts draft", () => {
  it("clears the words on Post and lets the author write the next post while it saves", () => {
    const draft = createPostDraft();
    draft.getState().setText("Tulisan pertama");
    draft.getState().startSaving(first);
    expect(draft.getState().text).toBe("");
    draft.getState().setText("Tulisan lain");
    expect(draft.getState().text).toBe("Tulisan lain");
    expect(HashSet.has(draft.getState().saving, first)).toBe(true);
  });

  it("holds each post in flight until the server answers for it", () => {
    const draft = createPostDraft();
    draft.getState().startSaving(first);
    draft.getState().startSaving(second);
    draft.getState().finishSaving(first);
    expect(HashSet.has(draft.getState().saving, first)).toBe(false);
    expect(HashSet.has(draft.getState().saving, second)).toBe(true);
  });

  it("gives a refused post back to the composer, ahead of a next post the author started", () => {
    const draft = createPostDraft();
    draft.getState().startSaving(first);
    draft.getState().refuseSaving(first, "Tulisan yang ditolak");
    expect(draft.getState().text).toBe("Tulisan yang ditolak");
    expect(HashSet.has(draft.getState().saving, first)).toBe(false);

    draft.getState().setText("");
    draft.getState().startSaving(second);
    draft.getState().setText("Tulisan baru");
    draft.getState().refuseSaving(second, "Ditolak lagi");
    expect(draft.getState().text).toBe("Ditolak lagi\n\nTulisan baru");
  });

  it("treats a composer that holds only spaces as empty", () => {
    const draft = createPostDraft();
    draft.getState().startSaving(first);
    draft.getState().setText("  ");
    draft.getState().refuseSaving(first, "Tulisan yang ditolak");
    expect(draft.getState().text).toBe("Tulisan yang ditolak");
  });
});
