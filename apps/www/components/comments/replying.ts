import { createStore } from "zustand";
import type { CommentRow } from "@/components/comments/state";

/** Which reply composer is open in one list of comments, if any. */
export interface Replying {
  /** Closes the reply composer. */
  readonly close: () => void;
  /** Opens the reply composer under the thread of a comment, answering that comment. */
  readonly open: (comment: CommentRow) => void;
  /** The comment that the open reply composer answers, or none when no composer is open. */
  readonly target: CommentRow | null;
}

/** Creates the reply composer state of one list, which only the list's own actions write. */
export function createReplying() {
  return createStore<Replying>()((set) => ({
    close: () => set({ target: null }),
    open: (comment) => set({ target: comment }),
    target: null,
  }));
}
