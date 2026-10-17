import { createStore } from "zustand";

/**
 * The words an author writes in the composer, and whether the server is saving
 * the post the composer sent. The lock lives here and not in the composer, so a
 * Retry of the list, which remounts the composer, keeps the lock of a post that
 * is still saving.
 */
export interface PostDraft {
  /** Unlocks the text once the server took the post, so the text stays empty. */
  readonly finishSaving: () => void;
  /** Unlocks the text and gives the refused post back as the text. */
  readonly refuseSaving: (text: string) => void;
  /** Whether the server is saving a post, which keeps the text locked. */
  readonly saving: boolean;
  /** Changes the text, unless a post is being saved. */
  readonly setText: (text: string) => void;
  /** Clears the text and locks it while the server saves the post it held. */
  readonly startSaving: () => void;
  readonly text: string;
}

/** Creates the draft of one provider. The composer writes it, and a Retry of the list keeps it. */
export function createPostDraft() {
  return createStore<PostDraft>()((set) => ({
    saving: false,
    text: "",
    startSaving: () => set({ saving: true, text: "" }),
    finishSaving: () => set({ saving: false }),
    refuseSaving: (text) => set({ saving: false, text }),
    setText: (text) => set((draft) => (draft.saving ? {} : { text })),
  }));
}
