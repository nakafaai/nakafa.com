import type { Id } from "@repo/backend/confect/_generated/id";
import type { Node } from "@tiptap/pm/model";
import { Effect, Equal, HashMap } from "effect";
import { createStore } from "zustand";
import { assessmentSchema } from "@/lib/editor/assessment";
import { foldedDocument } from "@/lib/editor/fold";
import type { readExamEditorFn } from "@/lib/tenant/exams.functions";

/**
 * The prompts the teacher has open in this editor, as their editors hold them now, so the
 * strip draws the open question from what is on the canvas, without a read of its own. The
 * first question's prompt starts as the editor's loader read it, until its editor holds it. A
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

/** The first question's prompt as the editor's loader read it from the server. */
type LoadedPrompt = Awaited<ReturnType<typeof readExamEditorFn>>["prompt"];

/**
 * The documents the live prompts start from: the prompt the loader read, so the first page draws it
 * before its editor holds it. A prompt this build cannot read starts nothing, and its editor reports
 * the failure when it opens.
 */
const loadedDocs = (prompt: LoadedPrompt | undefined) =>
  prompt === undefined
    ? HashMap.empty<Id<"editorDocuments">, Node>()
    : Effect.runSync(
        foldedDocument(assessmentSchema, prompt.opened).pipe(
          Effect.map((doc) =>
            HashMap.make([prompt.documentId, Equal.byReferenceUnsafe(doc)])
          ),
          Effect.catchTag("SyncFailed", () =>
            Effect.succeed(HashMap.empty<Id<"editorDocuments">, Node>())
          )
        )
      );

/**
 * Creates the live prompts of one editor, from the prompt its loader read. Each provider creates
 * its own, once, and each prompt's editor replaces its document once it holds it.
 */
export const createExamLive = (loaded?: LoadedPrompt) =>
  createStore<ExamLive>()((set) => ({
    docs: loadedDocs(loaded),
    show: (prompt, doc) =>
      set((state) => ({
        docs: HashMap.set(state.docs, prompt, Equal.byReferenceUnsafe(doc)),
      })),
  }));
