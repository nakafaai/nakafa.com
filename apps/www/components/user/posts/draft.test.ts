import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { createPostDraft } from "@/components/user/posts/draft";

const draftId = Schema.decodeUnknownSync(Id("posts"))("draft-post");

describe("posts draft", () => {
  it("locks the text while a post saves, and holds the placeholder id of that post", () => {
    const draft = createPostDraft();
    draft.getState().startSaving(draftId);
    draft.getState().setText("Tulisan lain");
    expect(draft.getState()).toMatchObject({
      savingPostId: draftId,
      text: "",
    });
  });

  it("releases the placeholder and unlocks the text once the server took the post", () => {
    const draft = createPostDraft();
    draft.getState().startSaving(draftId);
    draft.getState().finishSaving();
    draft.getState().setText("Hari ini");
    expect(draft.getState()).toMatchObject({
      savingPostId: null,
      text: "Hari ini",
    });
  });

  it("gives a refused post back as the text, releases its placeholder, and unlocks it", () => {
    const draft = createPostDraft();
    draft.getState().startSaving(draftId);
    draft.getState().refuseSaving("Tulisan yang ditolak");
    expect(draft.getState()).toMatchObject({
      savingPostId: null,
      text: "Tulisan yang ditolak",
    });
  });
});
