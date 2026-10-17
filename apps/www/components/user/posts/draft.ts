import type { Id } from "@repo/backend/confect/_generated/id";
import { createStore } from "zustand";

/**
 * The words an author writes in the composer, and the post the server is saving
 * for it. The lock lives here and not in the composer, so a Retry of the list,
 * which remounts the composer, keeps the lock of a post that is still saving.
 */
export interface PostDraft {
  /** Unlocks the text once the server took the post, so the text stays empty. */
  readonly finishSaving: () => void;
  /** Unlocks the text and gives the refused post back as the text. */
  readonly refuseSaving: (text: string) => void;
  /**
   * The placeholder id of the post the server is saving, or none. The row of
   * that placeholder holds its actions back until the server answers.
   */
  readonly savingPostId: Id<"posts"> | null;
  /** Changes the text, unless a post is being saved. */
  readonly setText: (text: string) => void;
  /** Clears the text and locks it while the server saves the post with this placeholder id. */
  readonly startSaving: (postId: Id<"posts">) => void;
  readonly text: string;
}

/** Creates the draft of one provider. The composer writes it, and a Retry of the list keeps it. */
export function createPostDraft() {
  return createStore<PostDraft>()((set) => ({
    savingPostId: null,
    text: "",
    startSaving: (postId) => set({ savingPostId: postId, text: "" }),
    finishSaving: () => set({ savingPostId: null }),
    refuseSaving: (text) => set({ savingPostId: null, text }),
    setText: (text) =>
      set((draft) => (draft.savingPostId === null ? { text } : {})),
  }));
}
