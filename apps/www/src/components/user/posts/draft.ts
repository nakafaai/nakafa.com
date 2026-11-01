import type { Id } from "@repo/backend/confect/_generated/id";
import { HashSet, String as Str } from "effect";
import { createStore } from "zustand";

/**
 * The words an author writes in the composer, and the posts the server is
 * saving for it. The composer stands above the list, so a Retry and the client's
 * arrival, which both remount the list, leave its field and its focus alone. The
 * list and the client reach it through here: what sends the words, and whether
 * the list can show a new post. The composer is never locked: the words clear on
 * Post, and the author can write the next post while the last one saves.
 */
export interface PostDraft {
  /** Forgets a post once the server took it. */
  readonly finishSaving: (postId: Id<"posts">) => void;
  /** Whether the live list holds its first page, so a new post shows in it at once. */
  readonly ready: boolean;
  /**
   * Forgets a refused post and gives its words back to the composer. A next
   * post the author started there stays after them, a blank line apart, so no
   * words are lost.
   */
  readonly refuseSaving: (postId: Id<"posts">, text: string) => void;
  /**
   * The placeholder ids of the posts the server is saving. The row of a
   * placeholder holds its actions back until the server answers, because the
   * server does not know that id.
   */
  readonly saving: HashSet.HashSet<Id<"posts">>;
  /** Sends a post's text, once the page holds its client. Until then there is nothing to send it with. */
  readonly send: ((text: string) => void) | null;
  /** Says whether the live list holds its first page. */
  readonly setReady: (ready: boolean) => void;
  /** Hands the composer what sends its words, as the client arrives or leaves. */
  readonly setSend: (send: ((text: string) => void) | null) => void;
  /** Changes the words in the composer. */
  readonly setText: (text: string) => void;
  /** Clears the words and remembers the placeholder id of the post the server saves. */
  readonly startSaving: (postId: Id<"posts">) => void;
  readonly text: string;
}

/** Creates the draft of one provider. The composer writes it, and a Retry of the list keeps it. */
export function createPostDraft() {
  return createStore<PostDraft>()((set) => ({
    ready: false,
    saving: HashSet.empty(),
    send: null,
    text: "",
    startSaving: (postId) =>
      set((draft) => ({ saving: HashSet.add(draft.saving, postId), text: "" })),
    finishSaving: (postId) =>
      set((draft) => ({ saving: HashSet.remove(draft.saving, postId) })),
    refuseSaving: (postId, text) =>
      set((draft) => ({
        saving: HashSet.remove(draft.saving, postId),
        text: Str.isEmpty(Str.trim(draft.text))
          ? text
          : `${text}\n\n${draft.text}`,
      })),
    setReady: (ready) => set({ ready }),
    setSend: (send) => set({ send }),
    setText: (text) => set({ text }),
  }));
}
