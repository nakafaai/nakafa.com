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
  explanation: promptId(`explanation-${id}`),
  id: questionId(id),
  key: null,
  points: 1,
  prompt: promptId(`prompt-${id}`),
  revision: 0,
  rubric: promptId(`rubric-${id}`),
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

  it("holds a pinned question until it is released, and keeps it chosen after", () => {
    const selection = createExamSelection();

    selection.getState().pin(second.id);

    expect(selection.getState().selected).toBe(second.id);
    expect(selection.getState().pinned).toBe(true);

    selection.getState().unpin();

    expect(selection.getState().selected).toBe(second.id);
    expect(selection.getState().pinned).toBe(false);
  });

  it("lists the questions still being saved until each one ends", () => {
    const selection = createExamSelection();

    selection.getState().startPending(first.id);
    selection.getState().startPending(second.id);
    selection.getState().endPending(first.id);

    expect(selection.getState().pending).toEqual([second.id]);
  });

  it("puts back the question chosen before a placeholder the server refused", () => {
    const selection = createExamSelection();
    const placeholder = questionId("placeholder");

    selection.getState().select(second.id);
    selection.getState().select(placeholder);
    selection.getState().replace(placeholder, second.id);

    expect(selection.getState().selected).toBe(second.id);
  });

  it("leaves the question the teacher chose meanwhile when a placeholder is refused", () => {
    const selection = createExamSelection();
    const placeholder = questionId("placeholder");

    selection.getState().select(second.id);
    selection.getState().select(placeholder);
    selection.getState().select(first.id);
    selection.getState().replace(placeholder, second.id);

    expect(selection.getState().selected).toBe(first.id);
  });

  it("selects the saved question in place of its placeholder, unless the teacher chose another meanwhile", () => {
    const selection = createExamSelection();
    const placeholder = questionId("placeholder");

    selection.getState().select(placeholder);
    selection.getState().replace(placeholder, second.id);
    expect(selection.getState().selected).toBe(second.id);

    selection.getState().select(placeholder);
    selection.getState().select(first.id);
    selection.getState().replace(placeholder, second.id);
    expect(selection.getState().selected).toBe(first.id);
  });
});

describe("focus request", () => {
  it("holds the request for one question until the page settles it", () => {
    const selection = createExamSelection();
    const first = questionId("first");

    expect(selection.getState().focus).toBeNull();
    selection.getState().requestFocus(first);
    expect(selection.getState().focus).toBe(first);
    selection.getState().settleFocus();
    expect(selection.getState().focus).toBeNull();
  });
});
