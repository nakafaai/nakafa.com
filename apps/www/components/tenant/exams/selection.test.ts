import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import { Id } from "@repo/backend/confect/_generated/id";
import { Option, Schema } from "effect";
import type { Question } from "@/components/tenant/exams/optimistic";
import {
  activeQuestion,
  createExamSelection,
} from "@/components/tenant/exams/selection";

const questionId = Schema.decodeUnknownSync(Id("examQuestions"));
const promptId = Schema.decodeUnknownSync(Id("editorDocuments"));

/** One single-answer choice, which a question holds. */
const choice: Interaction = {
  id: "choice",
  kind: "choice",
  label: "Answer",
  maxChoices: 1,
  minChoices: 1,
  options: [
    {
      id: "option-1",
      label: { content: [{ type: "paragraph" }], type: "doc" },
    },
    {
      id: "option-2",
      label: { content: [{ type: "paragraph" }], type: "doc" },
    },
  ],
  shuffle: false,
};

/** A question of an exam, with no key. */
const question = (id: string): Question => ({
  answers: [choice],
  id: questionId(id),
  key: null,
  prompt: promptId(`prompt-${id}`),
  revision: 0,
  template: "choice",
});

const first = question("q1");
const second = question("q2");
const outside = questionId("q9");

describe("activeQuestion", () => {
  it("shows the chosen question with its place", () => {
    expect(activeQuestion([first, second], second.id)).toEqual(
      Option.some({ index: 1, question: second })
    );
  });

  it("shows the first question while none is chosen", () => {
    expect(activeQuestion([first, second], null)).toEqual(
      Option.some({ index: 0, question: first })
    );
  });

  it("shows the first question when the chosen one is no longer there", () => {
    expect(activeQuestion([first, second], outside)).toEqual(
      Option.some({ index: 0, question: first })
    );
  });

  it("shows nothing for an exam with no question", () => {
    expect(activeQuestion([], null)).toEqual(Option.none());
  });
});

describe("createExamSelection", () => {
  it("chooses no question until one is selected", () => {
    const selection = createExamSelection();

    expect(selection.getState().selected).toBeNull();

    selection.getState().select(second.id);

    expect(selection.getState().selected).toBe(second.id);
  });
});
