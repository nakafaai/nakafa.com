import type { Node } from "@tiptap/pm/model";
import type { Option } from "effect";
import { createContext, use } from "react";
import type { QuestionEditing } from "@/components/tenant/exams/edits";
import type { Question } from "@/components/tenant/exams/optimistic";

/**
 * The question one page of the editor shows, which every part of the page and its teacher's layer reads: its number
 * in the exam, the question as the server holds it, its edits, whether its page is the chosen one, the prompt it draws
 * while its editors are not mounted, and the exam's one lock (`useExamLocked`). It holds the edits' functions, which no Schema describes as data.
 */
export const QuestionPageContext = createContext<{
  /** Whether the page is the one the teacher works on, which shows the actions that add a part. */
  readonly chosen: boolean;
  /** The prompt as the page draws it without its editors, and whether the server's documents may be read now. */
  readonly drawn: {
    readonly prompt: Option.Option<Node>;
    readonly read: boolean;
  };
  readonly editing: QuestionEditing;
  /** Whether the exam takes no change: it is locked or gone. */
  readonly locked: boolean;
  /** The place of the question in the exam, from one, which names its parts for assistive technology. */
  readonly number: number;
  readonly question: Question;
} | null>(null);

/** Reads the question of the page around it. It throws outside a page, which always provides it. */
export function useQuestionPage() {
  const page = use(QuestionPageContext);
  if (page === null) {
    throw new Error("useQuestionPage must be used within ExamPage");
  }
  return page;
}
