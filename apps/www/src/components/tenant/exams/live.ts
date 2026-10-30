import type { Id } from "@repo/backend/confect/_generated/id";
import type { Node } from "@tiptap/pm/model";
import { Equal, HashMap } from "effect";
import { createStore } from "zustand";

/**
 * The prompts the teacher has open in this editor, as their editors hold them now, so the
 * strip draws the open question from what is on the canvas, without a read of its own. A
 * ProseMirror node is a parsed document that no Schema describes, so this state is a plain
 * shape. Each document is kept by reference: Effect's map compares a value it replaces,
 * and a structural comparison would hash the whole node graph, its schema included, on
 * every keystroke (about 1.4 seconds a key on 19 Oct).
 */
export interface ExamLive {
  /** The document of each prompt the canvas has opened, as its editor last held it. */
  readonly docs: HashMap.HashMap<Id<"editorDocuments">, Node>;
  /** Keeps the document a prompt's editor holds now. */
  readonly show: (prompt: Id<"editorDocuments">, doc: Node) => void;
}

/**
 * Creates the live prompts of one editor, with none open. Each provider creates its own, once,
 * and each prompt's editor keeps its document once it holds it.
 */
export const createExamLive = () =>
  createStore<ExamLive>()((set) => ({
    docs: HashMap.empty<Id<"editorDocuments">, Node>(),
    show: (prompt, doc) =>
      set((state) => ({
        docs: HashMap.set(state.docs, prompt, Equal.byReferenceUnsafe(doc)),
      })),
  }));
