import { Id } from "@repo/backend/confect/_generated/id";
import type { CommentSort } from "@repo/backend/confect/comments/queries.spec";
import {
  Array as Arr,
  HashMap,
  HashSet,
  Option,
  Schema,
  String as Str,
} from "effect";
import { createStore } from "zustand";
import type { CommentRow } from "@/components/comments/state";

/**
 * The composer a text belongs to: the id of the comment a reply answers, or the
 * empty key of the list's own composer for a new comment.
 */
export type ComposerKey = Id<"comments"> | "";

/**
 * One photo on its way into a comment: the key the tray knows it by, its address on this device, which shows
 * it before the server holds it, and the upload the server registered once it did, with the size in pixels
 * it went out at (zero until then). A photo the server refused stays marked, so the learner sees which one
 * to take out.
 */
export const TrayPhoto = Schema.Struct({
  failed: Schema.Boolean,
  height: Schema.Int,
  key: Schema.String,
  preview: Schema.String,
  upload: Schema.Option(Id("commentUploads")),
  width: Schema.Int,
});

type Photo = typeof TrayPhoto.Type;

/**
 * What one list of comments is writing and showing: the words and the photos of each composer, the reply
 * composer that is open, the comment being edited, the threads whose replies are open, the order of the
 * list, and the comments the server is still saving. Only the list's own actions write it.
 */
export interface CommentDraft {
  /** Adds photos to one composer's tray. */
  readonly addPhotos: (key: ComposerKey, photos: readonly Photo[]) => void;
  /** Empties one composer once its comment went out: its words, its photos, and a new editor. */
  readonly clear: (key: ComposerKey) => void;
  /** Closes the reply composer. */
  readonly close: () => void;
  /** Opens or closes the edit of a comment's text in its row. */
  readonly edit: (commentId: Id<"comments"> | null) => void;
  /** The comment whose text is being edited in its row, or none. */
  readonly editing: Id<"comments"> | null;
  /** The threads whose replies the reader opened. */
  readonly expanded: HashSet.HashSet<Id<"comments">>;
  /** Forgets a comment once the server has answered for it, saved or refused. */
  readonly finishSaving: (commentId: Id<"comments">) => void;
  /**
   * How many times each composer's words were replaced from outside its editor, by a clear or a restore. The
   * editor owns its words once it exists, so a composer mounts a new editor for each new generation.
   */
  readonly generations: HashMap.HashMap<ComposerKey, number>;
  /** Opens the reply composer under the thread of a comment, answering that comment, with the thread's replies shown. */
  readonly open: (comment: CommentRow) => void;
  /** The photos of each composer's tray. */
  readonly photos: HashMap.HashMap<ComposerKey, readonly Photo[]>;
  /** Changes one photo of a tray, found by its key: its upload and size once the server holds it, or its refusal. */
  readonly placePhoto: (
    key: ComposerKey,
    photoKey: string,
    change: Partial<Pick<Photo, "failed" | "height" | "upload" | "width">>
  ) => void;
  /** Takes photos out of one composer's tray, by their keys. */
  readonly removePhotos: (
    key: ComposerKey,
    photoKeys: readonly string[]
  ) => void;
  /**
   * Gives a refused post's words back to its composer, ahead of any words written there since and a blank
   * line apart, so no words are lost, even when the composer closed meanwhile.
   */
  readonly restore: (key: ComposerKey, text: string) => void;
  /** The placeholder ids of the comments the server is saving, whose rows hold their actions back until it answers. */
  readonly saving: HashSet.HashSet<Id<"comments">>;
  /** The order of the list: the most liked first, or the newest first. */
  readonly sort: typeof CommentSort.Type;
  /** Changes the order of the list. */
  readonly sortBy: (sort: typeof CommentSort.Type) => void;
  /** Remembers the placeholder id of a comment the server is saving. */
  readonly startSaving: (commentId: Id<"comments">) => void;
  /** The comment that the open reply composer answers, or none when no composer is open. */
  readonly target: CommentRow | null;
  /** The words of each composer, kept here so a reply composer that closes keeps them for when it opens again. */
  readonly texts: HashMap.HashMap<ComposerKey, string>;
  /** Opens or closes the replies of one thread. */
  readonly toggleThread: (threadId: Id<"comments">) => void;
  /** Changes the words of one composer. */
  readonly write: (key: ComposerKey, text: string) => void;
}

/** The words of one composer, empty until the learner writes there. */
export const textOf = (draft: CommentDraft, key: ComposerKey) =>
  Option.getOrElse(HashMap.get(draft.texts, key), () => "");

/**
 * The tray of a composer without photos. It is one array for every read, because a store selector that answers a
 * new array on each read makes React render again without end.
 */
const NO_PHOTOS: readonly Photo[] = [];

/** The photos of one composer's tray, none until the learner adds one. */
export const photosOf = (draft: CommentDraft, key: ComposerKey) =>
  Option.getOrElse(HashMap.get(draft.photos, key), () => NO_PHOTOS);

/**
 * Whether the replies of a top-level comment show under it: its reader opened a thread that has replies,
 * or the reply composer stands in it.
 */
export const isThreadShown = (
  draft: CommentDraft,
  comment: Pick<CommentRow, "_id" | "replyCount" | "threadId">
) =>
  comment.threadId === undefined &&
  ((comment.replyCount > 0 && HashSet.has(draft.expanded, comment._id)) ||
    (draft.target !== null &&
      (draft.target.threadId ?? draft.target._id) === comment._id));

/** The generation of one composer's words, which keys its editor. */
export const generationOf = (draft: CommentDraft, key: ComposerKey) =>
  Option.getOrElse(HashMap.get(draft.generations, key), () => 0);

/** The draft's generations with one composer's moved on, so its next editor starts from the stored words. */
const nextGeneration = (draft: CommentDraft, key: ComposerKey) =>
  HashMap.set(draft.generations, key, generationOf(draft, key) + 1);

/** Creates the draft of one list, created once by its provider. */
export function createCommentDraft() {
  return createStore<CommentDraft>()((set) => ({
    addPhotos: (key, photos) =>
      set((draft) => ({
        photos: HashMap.set(
          draft.photos,
          key,
          Arr.appendAll(photosOf(draft, key), photos)
        ),
      })),
    clear: (key) =>
      set((draft) => ({
        generations: nextGeneration(draft, key),
        photos: HashMap.remove(draft.photos, key),
        texts: HashMap.remove(draft.texts, key),
      })),
    close: () => set({ target: null }),
    edit: (commentId) => set({ editing: commentId }),
    editing: null,
    expanded: HashSet.empty(),
    finishSaving: (commentId) =>
      set((draft) => ({ saving: HashSet.remove(draft.saving, commentId) })),
    generations: HashMap.empty(),
    open: (comment) =>
      set((draft) => ({
        expanded: HashSet.add(draft.expanded, comment.threadId ?? comment._id),
        target: comment,
      })),
    photos: HashMap.empty(),
    placePhoto: (key, photoKey, change) =>
      set((draft) => ({
        photos: HashMap.set(
          draft.photos,
          key,
          Arr.map(photosOf(draft, key), (photo) =>
            photo.key === photoKey ? { ...photo, ...change } : photo
          )
        ),
      })),
    removePhotos: (key, photoKeys) =>
      set((draft) => ({
        photos: HashMap.set(
          draft.photos,
          key,
          Arr.filter(
            photosOf(draft, key),
            (photo) => !Arr.contains(photoKeys, photo.key)
          )
        ),
      })),
    restore: (key, text) =>
      set((draft) => {
        const written = textOf(draft, key);
        return {
          generations: nextGeneration(draft, key),
          texts: HashMap.set(
            draft.texts,
            key,
            Str.isEmpty(Str.trim(written)) ? text : `${text}\n\n${written}`
          ),
        };
      }),
    saving: HashSet.empty(),
    sort: "top",
    sortBy: (sort) => set({ sort }),
    startSaving: (commentId) =>
      set((draft) => ({ saving: HashSet.add(draft.saving, commentId) })),
    target: null,
    texts: HashMap.empty(),
    toggleThread: (threadId) =>
      set((draft) => ({
        expanded: HashSet.has(draft.expanded, threadId)
          ? HashSet.remove(draft.expanded, threadId)
          : HashSet.add(draft.expanded, threadId),
      })),
    write: (key, text) =>
      set((draft) => ({ texts: HashMap.set(draft.texts, key, text) })),
  }));
}
