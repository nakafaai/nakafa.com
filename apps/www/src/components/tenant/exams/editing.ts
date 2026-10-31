import type { DocumentEditorInstance } from "@repo/design-system/components/editor/document";
import { Array as Arr } from "effect";
import { createStore } from "zustand";
import type { FigureDraft } from "@/components/tenant/exams/figure/draft";

/** A picture that waits for its alt text, and the editor it goes into. */
export interface PendingPicture<E extends object = DocumentEditorInstance> {
  readonly editor: E;
  readonly file: File;
}

/** A figure the dialog writes: its draft, the editor it goes into, and where it stands when it replaces one. */
export interface PendingFigure<E extends object = DocumentEditorInstance> {
  readonly draft: FigureDraft;
  readonly editor: E;
  /** The place of the figure it edits, or none for a new one at the caret. */
  readonly position: number | null;
}

/**
 * The editing state of one exam editor. The toolbar acts on the active editor, the one that took
 * focus last, so it keeps its place when the focus moves to one of its controls. An editor that is
 * removed gives its place up, so the toolbar never acts on a destroyed editor. The pictures the
 * teacher chose wait here, in order, each with the editor it goes into, and so does the figure being written.
 */
export interface ExamEditing<E extends object = DocumentEditorInstance> {
  /** Makes an editor the one the toolbar acts on. */
  readonly activate: (editor: E) => void;
  /** The editor the toolbar acts on, or none before an editor takes focus. */
  readonly active: E | null;
  /** Closes the figure's dialog. */
  readonly closeFigure: () => void;
  /** The figure the dialog writes, or none while it is closed. */
  readonly figure: PendingFigure<E> | null;
  /** Opens the figure's dialog on a new figure or on one already in a text. */
  readonly openFigure: (figure: PendingFigure<E>) => void;
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
    closeFigure: () => set({ figure: null }),
    figure: null,
    openFigure: (figure) => set({ figure }),
    pictures: [],
    queuePicture: (picture) =>
      set((state) => ({ pictures: Arr.append(state.pictures, picture) })),
    release: (editor) =>
      set((state) => (state.active === editor ? { active: null } : {})),
    shiftPicture: () =>
      set((state) => ({ pictures: Arr.drop(state.pictures, 1) })),
  }));
