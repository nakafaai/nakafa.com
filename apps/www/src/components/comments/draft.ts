import type { Id } from "@repo/backend/confect/_generated/id";
import { HashMap, HashSet, Option, String as Str } from "effect";
import { createStore } from "zustand";
import type { CommentRow } from "@/components/comments/state";

/**
 * The composer a text belongs to: the id of the comment a reply answers, or the
 * empty key of the list's own composer for a new comment.
 */
export type ComposerKey = Id<"comments"> | "";

/**
 * What one list of comments is writing: the words of each composer, the reply
 * composer that is open, if any, and the comments the server is still saving.
 * Only the list's own actions write it.
 */
export interface CommentDraft {
  /** Closes the reply composer. */
  readonly close: () => void;
  /** Forgets a comment once the server has answered for it, saved or refused. */
  readonly finishSaving: (commentId: Id<"comments">) => void;
  /** Opens the reply composer under the thread of a comment, answering that comment. */
  readonly open: (comment: CommentRow) => void;
  /**
   * Gives a refused post's words back to its composer, ahead of any words
   * written there since and a blank line apart, so no words are lost, even when
   * the composer closed meanwhile.
   */
  readonly restore: (key: ComposerKey, text: string) => void;
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
  /**
   * The words of each composer. They live here and not in the composer, so a
   * reply composer that closes, or gives way to another one, keeps its words
   * for when it opens again.
   */
  readonly texts: HashMap.HashMap<ComposerKey, string>;
  /** Changes the words of one composer. */
  readonly write: (key: ComposerKey, text: string) => void;
}

/** The words of one composer, empty until the learner writes there. */
export const textOf = (draft: CommentDraft, key: ComposerKey) =>
  Option.getOrElse(HashMap.get(draft.texts, key), () => "");

/** Creates the draft of one list, created once by its provider. */
export function createCommentDraft() {
  return createStore<CommentDraft>()((set) => ({
    close: () => set({ target: null }),
    finishSaving: (commentId) =>
      set((draft) => ({ saving: HashSet.remove(draft.saving, commentId) })),
    open: (comment) => set({ target: comment }),
    restore: (key, text) =>
      set((draft) => {
        const written = textOf(draft, key);
        return {
          texts: HashMap.set(
            draft.texts,
            key,
            Str.isEmpty(Str.trim(written)) ? text : `${text}\n\n${written}`
          ),
        };
      }),
    saving: HashSet.empty(),
    startSaving: (commentId) =>
      set((draft) => ({ saving: HashSet.add(draft.saving, commentId) })),
    target: null,
    texts: HashMap.empty(),
    write: (key, text) =>
      set((draft) => ({ texts: HashMap.set(draft.texts, key, text) })),
  }));
}
