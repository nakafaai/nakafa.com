import { describe, expect, it } from "@effect/vitest";
import { createPostDraft } from "@/components/user/posts/draft";

describe("posts draft", () => {
  it("locks the text while a post saves, so an edit cannot replace the post", () => {
    const draft = createPostDraft();
    draft.getState().startSaving();
    draft.getState().setText("Tulisan lain");
    expect(draft.getState()).toMatchObject({ saving: true, text: "" });
  });

  it("unlocks the text once the server took the post, so the next one can be written", () => {
    const draft = createPostDraft();
    draft.getState().startSaving();
    draft.getState().finishSaving();
    draft.getState().setText("Hari ini");
    expect(draft.getState()).toMatchObject({ saving: false, text: "Hari ini" });
  });

  it("gives a refused post back as the text, and unlocks it", () => {
    const draft = createPostDraft();
    draft.getState().startSaving();
    draft.getState().refuseSaving("Tulisan yang ditolak");
    expect(draft.getState()).toMatchObject({
      saving: false,
      text: "Tulisan yang ditolak",
    });
  });
});
