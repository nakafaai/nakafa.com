import type { DocumentEditorInstance } from "@repo/design-system/components/editor/document";
import { Array as Arr } from "effect";
import { createStore } from "zustand";

/** A picture that waits for its alt text, and the editor it goes into. */
export interface PendingPicture<E extends object = DocumentEditorInstance> {
  readonly editor: E;
  readonly file: File;
}

/**
 * The editing state of one exam editor. The toolbar acts on the active editor, the one that took
 * focus last, so it keeps its place when the focus moves to one of its controls. An editor that is
 * removed gives its place up, so the toolbar never acts on a destroyed editor. The pictures the
 * teacher chose wait here, in order, each with the editor it goes into.
 */
export interface ExamEditing<E extends object = DocumentEditorInstance> {
  /** Makes an editor the one the toolbar acts on. */
  readonly activate: (editor: E) => void;
  /** The editor the toolbar acts on, or none before an editor takes focus. */
  readonly active: E | null;
  /** The pictures that wait for their alt text, the first one first. */
  readonly pictures: readonly PendingPicture<E>[];
  /** Queues a picture that waits for its alt text. */
  readonly queuePicture: (picture: PendingPicture<E>) => void;
  /** Gives up the place of an editor that is removed, when it still holds it. */
  readonly release: (editor: E) => void;
  /** Takes the first picture out of the queue, once its alt text is confirmed or cancelled. */
  readonly shiftPicture: () => void;
}

/**
 * Creates the editing state of one exam editor, over the Tiptap editor by default. Each provider
 * creates its own, once.
 */
export const createExamEditing = <
  E extends object = DocumentEditorInstance,
>() =>
  createStore<ExamEditing<E>>()((set) => ({
    active: null,
    activate: (editor) => set({ active: editor }),
    pictures: [],
    queuePicture: (picture) =>
      set((state) => ({ pictures: Arr.append(state.pictures, picture) })),
    release: (editor) =>
      set((state) => (state.active === editor ? { active: null } : {})),
    shiftPicture: () =>
      set((state) => ({ pictures: Arr.drop(state.pictures, 1) })),
  }));
