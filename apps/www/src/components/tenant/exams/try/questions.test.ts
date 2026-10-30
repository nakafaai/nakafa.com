import { describe, expect, it } from "@effect/vitest";
import { InteractionSchema } from "@nakafa/aksara-contracts/assessment/interaction";
import { Id } from "@repo/backend/confect/_generated/id";
import { choiceAnswers, textLabel } from "@repo/backend/confect/exams/question";
import { Array as Arr, Schema } from "effect";
import type { Question } from "@/components/tenant/exams/optimistic";
import { projectTryQuestions } from "@/components/tenant/exams/try/questions";
import { createExamTry } from "@/components/tenant/exams/try/store";

const questionId = Schema.decodeUnknownSync(Id("examQuestions"));
const documentId = Schema.decodeUnknownSync(Id("editorDocuments"));

/** One single-answer choice of two options, as the server builds a question's choice. */
const [choice] = choiceAnswers([textLabel("A"), textLabel("B")]);

/** A short answer, which no digit key picks. */
const typed = Schema.decodeSync(InteractionSchema)({
  id: "typed",
  kind: "textEntry",
  label: "Ibu kota",
});

/** A question of the exam with the given answers. */
const question = (id: string, answers: Question["answers"]): Question => ({
  answers,
  explanation: documentId(`explanation-${id}`),
  id: questionId(id),
  key: null,
  points: 1,
  prompt: documentId(`prompt-${id}`),
  revision: 0,
  rubric: documentId(`rubric-${id}`),
  template: "choice",
});

describe("projectTryQuestions", () => {
  it("marks, flags and picks the try's questions as a sitting's navigator and keys do", () => {
    const store = createExamTry();
    const questions = [question("q1", [choice]), question("q2", [typed])];
    const project = () =>
      projectTryQuestions({ questions, try: store.getState() });

    const [first, second] = project();
    expect(first?.pick(1)).toBe(true);
    expect(second?.pick(0)).toBe(false);
    first?.flag();

    expect(
      Arr.map(project(), ({ answered, flagged, key }) => ({
        answered,
        flagged,
        key,
      }))
    ).toEqual([
      { answered: true, flagged: true, key: "q1" },
      { answered: false, flagged: false, key: "q2" },
    ]);
    expect(store.getState().responses).toEqual({ q1: ["option-2"] });
  });
});
