import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { DeliveryLanguageSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, Schema } from "effect";
import {
  answeredQuestion,
  answerUpdate,
  type ExamView,
  movedQuestion,
  moveUpdate,
  type Question,
  removedQuestion,
  removeUpdate,
  renamedExam,
  renameUpdate,
} from "@/components/tenant/exams/optimistic";

const examId = Schema.decodeUnknownSync(Id("exams"))("exam-1");
const slug = Schema.decodeSync(TenantSlug)("sekolah");
const questionId = Schema.decodeUnknownSync(Id("examQuestions"));
const promptId = Schema.decodeUnknownSync(Id("editorDocuments"));

/** One single-answer choice with two empty options, which a new question holds. */
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

/** The answers of every question in these tests. */
const answers: [Interaction] = [choice];

/** A question of the exam with no key, at the given revision. */
const question = (id: string, revision = 0): Question => ({
  answers,
  id: questionId(id),
  key: null,
  prompt: promptId(`prompt-${id}`),
  revision,
  template: "choice",
});

const first = question("q1");
const second = question("q2");
const third = question("q3");

/** The exam as the editor reads it, with the questions in the given order. */
const viewOf = (questions: readonly Question[]): ExamView => ({
  id: examId,
  language: Schema.decodeSync(DeliveryLanguageSchema)("id"),
  questions,
  title: "Matematika",
});

/** The IDs of the questions, in their order. */
const orderOf = (view: ExamView) => Arr.map(view.questions, (item) => item.id);

/** A store that holds `current` for the exam, and records what is written to it. */
const storeHolding = (current: Option.Option<ExamView>) => {
  const getQuery = vi.fn();
  getQuery.mockReturnValue(current);
  const setQuery = vi.fn();
  return {
    localStore: { getAllQueries: vi.fn(), getQuery, setQuery },
    setQuery,
  };
};

describe("renamedExam", () => {
  it("changes the title and keeps the questions", () => {
    const view = viewOf([first]);

    expect(renamedExam(view, "Biologi")).toEqual({ ...view, title: "Biologi" });
  });
});

describe("movedQuestion", () => {
  it("moves a question to the index it names", () => {
    const moved = movedQuestion(viewOf([first, second, third]), third.id, 0);

    expect(orderOf(moved)).toEqual([third.id, first.id, second.id]);
  });

  it("places a question after the last one when the index is past the end", () => {
    const moved = movedQuestion(viewOf([first, second, third]), first.id, 9);

    expect(orderOf(moved)).toEqual([second.id, third.id, first.id]);
  });
});

describe("removedQuestion", () => {
  it("takes the question out and keeps the order of the rest", () => {
    const removed = removedQuestion(viewOf([first, second, third]), second.id);

    expect(removed.questions).toEqual([first, third]);
  });
});

describe("answeredQuestion", () => {
  it("saves the answers and the key of one question at its next revision", () => {
    const key: [InteractionKey] = [
      { correct: ["option-2"], interaction: "choice", kind: "choice" },
    ];
    const answered = answeredQuestion(viewOf([first, second]), second.id, {
      answers,
      key,
    });

    expect(answered.questions[0]).toEqual(first);
    expect(answered.questions[1]).toEqual({
      ...second,
      key,
      revision: second.revision + 1,
    });
  });
});

describe("the optimistic updates", () => {
  it("rename the exam the store holds", () => {
    const view = viewOf([first]);
    const { localStore, setQuery } = storeHolding(Option.some(view));

    renameUpdate(localStore, { examId, slug, title: "Biologi" });

    expect(setQuery).toHaveBeenCalledWith(
      exams.exams.open,
      { examId, slug },
      Option.some({ ...view, title: "Biologi" })
    );
  });

  it("move a question in the store", () => {
    const view = viewOf([first, second]);
    const { localStore, setQuery } = storeHolding(Option.some(view));

    moveUpdate(localStore, { examId, index: 1, questionId: first.id, slug });

    expect(setQuery).toHaveBeenCalledWith(
      exams.exams.open,
      { examId, slug },
      Option.some({ ...view, questions: [second, first] })
    );
  });

  it("remove a question from the store", () => {
    const view = viewOf([first, second]);
    const { localStore, setQuery } = storeHolding(Option.some(view));

    removeUpdate(localStore, { examId, questionId: second.id, slug });

    expect(setQuery).toHaveBeenCalledWith(
      exams.exams.open,
      { examId, slug },
      Option.some({ ...view, questions: [first] })
    );
  });

  it("save a question's answer in the store", () => {
    const view = viewOf([first]);
    const { localStore, setQuery } = storeHolding(Option.some(view));
    const key: [InteractionKey] = [
      { correct: ["option-2"], interaction: "choice", kind: "choice" },
    ];

    answerUpdate(localStore, {
      answers,
      examId,
      key,
      questionId: first.id,
      revision: first.revision,
      slug,
    });

    expect(setQuery).toHaveBeenCalledWith(
      exams.exams.open,
      { examId, slug },
      Option.some({
        ...view,
        questions: [{ ...first, key, revision: first.revision + 1 }],
      })
    );
  });

  it("write nothing for an exam the store does not hold", () => {
    const { localStore, setQuery } = storeHolding(Option.none());

    renameUpdate(localStore, { examId, slug, title: "Biologi" });

    expect(setQuery).not.toHaveBeenCalled();
  });
});
