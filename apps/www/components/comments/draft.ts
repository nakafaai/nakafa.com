import type { Id } from "@repo/backend/confect/_generated/id";
import { HashSet } from "effect";
import { createStore } from "zustand";
import type { CommentRow } from "@/components/comments/state";

/**
 * What one list of comments is writing: the reply composer that is open, if any,
 * and the comments the server is still saving. Only the list's own actions write it.
 */
export interface CommentDraft {
  /** Closes the reply composer. */
  readonly close: () => void;
  /** Forgets a comment once the server has answered for it, saved or refused. */
  readonly finishSaving: (commentId: Id<"comments">) => void;
  /** Opens the reply composer under the thread of a comment, answering that comment. */
  readonly open: (comment: CommentRow) => void;
  /**
   * The placeholder ids of the comments the server is saving. The row of a
   * placeholder holds its actions back until the server answers, because the
   * server does not know that id.
   */
  readonly saving: HashSet.HashSet<Id<"comments">>;
  /** Remembers the placeholder id of a comment the server is saving. */
  readonly startSaving: (commentId: Id<"comments">) => void;
  /** The comment that the open reply composer answers, or none when no composer is open. */
  readonly target: CommentRow | null;
}

/** Creates the draft of one list, created once by its provider. */
export function createCommentDraft() {
  return createStore<CommentDraft>()((set) => ({
    close: () => set({ target: null }),
    finishSaving: (commentId) =>
      set((draft) => ({ saving: HashSet.remove(draft.saving, commentId) })),
    open: (comment) => set({ target: comment }),
    saving: HashSet.empty(),
    startSaving: (commentId) =>
      set((draft) => ({ saving: HashSet.add(draft.saving, commentId) })),
    target: null,
  }));
}
