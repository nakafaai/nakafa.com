import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { HomeDraft } from "@repo/backend/confect/exams/home/contract";
import { choiceAnswers, textLabel } from "@repo/backend/confect/exams/question";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, Schema } from "effect";
import {
  addQuestionUpdate,
  answeredQuestion,
  answerUpdate,
  appendedQuestion,
  copyQuestionUpdate,
  type ExamSummary,
  type ExamView,
  insertDraftExam,
  insertedAfter,
  movedQuestion,
  moveUpdate,
  placeholderQuestion,
  pointedQuestion,
  pointsUpdate,
  type Question,
  removedQuestion,
  removeUpdate,
  renamedExam,
  renameUpdate,
  templateUpdate,
} from "@/components/tenant/exams/optimistic";

const examId = Schema.decodeUnknownSync(Id("exams"))("exam-1");
const slug = Schema.decodeSync(TenantSlug)("sekolah");
const questionId = Schema.decodeUnknownSync(Id("examQuestions"));
const promptId = Schema.decodeUnknownSync(Id("editorDocuments"));

/** One single-answer choice of two options, as the server builds a question's choice. */
const [choice] = choiceAnswers([textLabel("A"), textLabel("B")]);

/** The answers of every question in these tests. */
const answers: [Interaction] = [choice];

/** A key that marks the second option of the choice correct. */
const key: [InteractionKey] = [
  { correct: ["option-2"], interaction: "choice", kind: "choice" },
];

/** A question of the exam with no key, at the given revision. */
const question = (id: string, revision = 0): Question => ({
  answers,
  explanation: promptId(`explanation-${id}`),
  id: questionId(id),
  key: null,
  points: 1,
  prompt: promptId(`prompt-${id}`),
  revision,
  rubric: promptId(`rubric-${id}`),
  template: "choice",
});

const first = question("q1");
const second = question("q2");
const third = question("q3");

/** The exam as the editor reads it, with the questions in the given order. */
const viewOf = (questions: readonly Question[]): ExamView => ({
  archived: false,
  id: examId,
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

  it("show a question as true or false with the labels it is given and no key, and keep the others", () => {
    const view = viewOf([{ ...first, key }, second]);
    const { localStore, setQuery } = storeHolding(Option.some(view));

    templateUpdate(localStore, {
      examId,
      labels: ["Benar", "Salah"],
      questionId: first.id,
      revision: first.revision,
      slug,
      template: "truefalse",
    });

    expect(setQuery).toHaveBeenCalledWith(
      exams.exams.open,
      { examId, slug },
      Option.some({
        ...view,
        questions: [
          {
            ...first,
            answers: [
              {
                ...choice,
                options: [
                  { id: "option-1", label: textLabel("Benar") },
                  { id: "option-2", label: textLabel("Salah") },
                ],
              },
            ],
            key: null,
            revision: first.revision + 1,
            template: "truefalse",
          },
          second,
        ],
      })
    );
  });

  it("write nothing for an exam the store does not hold", () => {
    const { localStore, setQuery } = storeHolding(Option.none());

    renameUpdate(localStore, { examId, slug, title: "Biologi" });

    expect(setQuery).not.toHaveBeenCalled();
  });
});

/** A new question with the same answers as the others, under its own placeholder IDs. */
const placeholder = (id: string) => question(id);

describe("placeholderQuestion", () => {
  it("starts a question at revision zero with the answers and key it is given", () => {
    const draft = placeholderQuestion({
      answers,
      explanation: promptId("draft-explanation"),
      id: questionId("draft"),
      key: null,
      points: 3,
      prompt: promptId("draft-prompt"),
      rubric: promptId("draft-rubric"),
      template: "choice",
    });

    expect(draft).toEqual({
      ...placeholder("draft"),
      explanation: promptId("draft-explanation"),
      points: 3,
      prompt: promptId("draft-prompt"),
      rubric: promptId("draft-rubric"),
    });
    expect(draft.revision).toBe(0);
  });
});

describe("appendedQuestion", () => {
  it("adds a question at the end of the exam", () => {
    const added = appendedQuestion(viewOf([first, second]), third);

    expect(added.questions).toEqual([first, second, third]);
  });
});

describe("insertedAfter", () => {
  it("inserts a copy right after its source", () => {
    const copy = placeholder("copy");

    expect(
      insertedAfter(viewOf([first, second]), first.id, copy).questions
    ).toEqual([first, copy, second]);
  });

  it("inserts after the last question when the source is the last", () => {
    const copy = placeholder("copy");

    expect(
      insertedAfter(viewOf([first, second]), second.id, copy).questions
    ).toEqual([first, second, copy]);
  });

  it("leaves the exam as it is when the source is not in it", () => {
    const view = viewOf([first, second]);

    expect(insertedAfter(view, third.id, placeholder("copy"))).toEqual(view);
  });
});

/** A store that holds the given list pages, each with its arguments, and records what is written. */
const listStore = (
  pages: unknown[],
  home: Option.Option<unknown> = Option.none()
) => {
  const getAllQueries = vi.fn();
  getAllQueries.mockReturnValue(pages);
  const getQuery = vi.fn();
  getQuery.mockReturnValue(home);
  const setQuery = vi.fn();
  return {
    localStore: { getAllQueries, getQuery, setQuery },
    setQuery,
  };
};

describe("the optimistic updates of the new questions", () => {
  it("add a question to the end of the exam the store holds", () => {
    const view = viewOf([first]);
    const { localStore, setQuery } = storeHolding(Option.some(view));
    const added = placeholder("added");

    addQuestionUpdate(added)(localStore, {
      examId,
      slug,
      after: null,
    });

    expect(setQuery).toHaveBeenCalledWith(
      exams.exams.open,
      { examId, slug },
      Option.some(appendedQuestion(view, added))
    );
  });

  it("show a copy right after its source in the exam the store holds", () => {
    const view = viewOf([first, second]);
    const { localStore, setQuery } = storeHolding(Option.some(view));
    const copy = placeholder("copy");

    copyQuestionUpdate(copy)(localStore, {
      examId,
      questionId: first.id,
      slug,
    });

    expect(setQuery).toHaveBeenCalledWith(
      exams.exams.open,
      { examId, slug },
      Option.some({ ...view, questions: [first, copy, second] })
    );
  });

  it("show a question added after another one right after it", () => {
    const view = viewOf([first, second]);
    const { localStore, setQuery } = storeHolding(Option.some(view));
    const added = placeholder("added");

    addQuestionUpdate(added)(localStore, {
      examId,
      slug,
      after: first.id,
    });

    expect(setQuery).toHaveBeenCalledWith(
      exams.exams.open,
      { examId, slug },
      Option.some({ ...view, questions: [first, added, second] })
    );
  });

  it("show a new exam first in the first page of each list the store holds", () => {
    const examIdOf = Schema.decodeUnknownSync(Id("exams"));
    const draft: typeof HomeDraft.Type = {
      createdAt: 1,
      id: examIdOf("draft-exam"),
      title: "Draf",
    };
    const existing: ExamSummary = {
      id: examIdOf("exam-old"),
      title: "Lama",
    };
    const firstArgs = { paginationOpts: { cursor: null, numItems: 20 }, slug };
    const nextArgs = { paginationOpts: { cursor: "next", numItems: 20 }, slug };
    const { localStore, setQuery } = listStore([
      {
        args: firstArgs,
        value: Option.some({ isDone: false, page: [existing] }),
      },
      { args: nextArgs, value: Option.some({ isDone: true, page: [] }) },
      { args: firstArgs, value: Option.none() },
    ]);

    insertDraftExam(draft)(localStore, {
      scope: { kind: "tenant" },
      slug,
      title: draft.title,
    });

    expect(setQuery).toHaveBeenCalledTimes(1);
    expect(setQuery).toHaveBeenCalledWith(
      exams.exams.list,
      firstArgs,
      Option.some({ isDone: false, page: [draft, existing] })
    );
  });

  it("show a new exam first among the drafts of the school home the store holds", () => {
    const examIdOf = Schema.decodeUnknownSync(Id("exams"));
    const draft: typeof HomeDraft.Type = {
      createdAt: 1,
      id: examIdOf("draft-exam"),
      title: "Draf",
    };
    const existing: ExamSummary = {
      id: examIdOf("exam-old"),
      title: "Lama",
    };
    const home = { drafts: [existing], live: [], next: [] };
    const { localStore, setQuery } = listStore([], Option.some(home));

    insertDraftExam(draft)(localStore, {
      scope: { kind: "tenant" },
      slug,
      title: draft.title,
    });

    expect(setQuery).toHaveBeenCalledTimes(1);
    expect(setQuery).toHaveBeenCalledWith(
      exams.exams.home,
      { slug },
      Option.some({ ...home, drafts: [draft, existing] })
    );
  });

  it("write nothing to the school home the store does not hold", () => {
    const examIdOf = Schema.decodeUnknownSync(Id("exams"));
    const draft: typeof HomeDraft.Type = {
      createdAt: 1,
      id: examIdOf("draft-exam"),
      title: "Draf",
    };
    const { localStore, setQuery } = listStore([]);

    insertDraftExam(draft)(localStore, {
      scope: { kind: "tenant" },
      slug,
      title: draft.title,
    });

    expect(setQuery).not.toHaveBeenCalled();
  });
});

describe("pointedQuestion", () => {
  it("sets the points of one question and keeps the others", () => {
    const pointed = pointedQuestion(viewOf([first, second]), second.id, 5);

    expect(pointed.questions[0]).toEqual(first);
    expect(pointed.questions[1]).toEqual({ ...second, points: 5 });
  });
});

describe("pointsUpdate", () => {
  it("shows the points of a question in the store while the server saves them", () => {
    const view = viewOf([first, second]);
    const { localStore, setQuery } = storeHolding(Option.some(view));

    pointsUpdate(localStore, {
      examId,
      points: 3,
      questionId: first.id,
      slug,
    });

    expect(setQuery).toHaveBeenCalledWith(
      exams.exams.open,
      { examId, slug },
      Option.some({
        ...view,
        questions: [{ ...first, points: 3 }, second],
      })
    );
  });
});
