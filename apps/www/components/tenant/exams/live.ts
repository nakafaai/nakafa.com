import type { Id } from "@repo/backend/confect/_generated/id";
import type { Node } from "@tiptap/pm/model";
import { HashMap } from "effect";
import { createStore } from "zustand";

/**
 * The prompts the teacher has open in this editor, as their editors hold them now, so the
 * strip draws the open question from what is on the canvas, without a read of its own. A
 * ProseMirror node is a parsed document that no Schema describes, so this state is a plain
 * shape.
 */
export interface ExamLive {
  /** The document of each prompt the canvas has opened, as its editor last held it. */
  readonly docs: HashMap.HashMap<Id<"editorDocuments">, Node>;
  /** Keeps the document a prompt's editor holds now. */
  readonly show: (prompt: Id<"editorDocuments">, doc: Node) => void;
}

/** Creates the live prompts of one editor. Each provider creates its own, once. */
export const createExamLive = () =>
  createStore<ExamLive>()((set) => ({
    docs: HashMap.empty(),
    show: (prompt, doc) =>
      set((state) => ({ docs: HashMap.set(state.docs, prompt, doc) })),
  }));
