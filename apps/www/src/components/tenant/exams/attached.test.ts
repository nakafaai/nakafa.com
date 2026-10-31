import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { choiceAnswers, textLabel } from "@repo/backend/confect/exams/question";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import {
  mediaQuestion,
  mediaUpdate,
  readingUpdate,
  readQuestionWith,
  sharedReadings,
} from "@/components/tenant/exams/attached";
import type { ExamView, Question } from "@/components/tenant/exams/optimistic";

const examId = Schema.decodeUnknownSync(Id("exams"))("exam-1");
const slug = Schema.decodeSync(TenantSlug)("sekolah");
const questionId = Schema.decodeUnknownSync(Id("examQuestions"));
const promptId = Schema.decodeUnknownSync(Id("editorDocuments"));

/** A question of the exam with no reading and no media. */
const question = (id: string): Question => ({
  answers: choiceAnswers([textLabel("A"), textLabel("B")]),
  explanation: promptId(`explanation-${id}`),
  id: questionId(id),
  key: null,
  media: [],
  points: 1,
  prompt: promptId(`prompt-${id}`),
  reading: null,
  revision: 0,
  rubric: promptId(`rubric-${id}`),
  scoring: { kind: "allOrNothing" },
  template: "choice",
});

const first = question("q1");
const second = question("q2");

/** The exam as the editor reads it, with the questions in the given order. */
const viewOf = (questions: readonly Question[]): ExamView => ({
  archived: false,
  id: examId,
  questions,
  title: "Matematika",
});

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

describe("question media", () => {
  const video = { alt: "Video", kind: "video", video: "dQw4w9WgXcQ" } as const;

  it("sets the media of one question and keeps the others", () => {
    const changed = mediaQuestion(viewOf([first, second]), second.id, [video]);

    expect(changed.questions[0]).toEqual(first);
    expect(changed.questions[1]).toEqual({ ...second, media: [video] });
  });

  it("shows the media of a question in the store while the server saves it", () => {
    const view = viewOf([first, second]);
    const { localStore, setQuery } = storeHolding(Option.some(view));

    mediaUpdate(localStore, {
      examId,
      media: [video],
      questionId: first.id,
      slug,
    });

    expect(setQuery).toHaveBeenCalledWith(
      exams.exams.open,
      { examId, slug },
      Option.some(mediaQuestion(view, first.id, [video]))
    );
  });
});

describe("shared readings", () => {
  const reading = promptId("reading-1");
  const held = { ...first, reading };

  it("offers each other question's reading once, by the first question that holds it", () => {
    const third = {
      ...second,
      id: questionId("q3"),
      reading,
    };

    expect(sharedReadings([held, second, third], second.id)).toEqual([
      { number: 1, reading, source: held.id },
    ]);
    expect(sharedReadings([held, second], held.id)).toEqual([]);
  });

  it("shares a reading, takes one away, and leaves a new reading to the server", () => {
    const view = viewOf([held, second]);

    expect(readQuestionWith(view, second.id, held.id).questions[1]).toEqual({
      ...second,
      reading,
    });
    expect(readQuestionWith(view, first.id, "none").questions[0]).toEqual({
      ...held,
      reading: null,
    });
    expect(readQuestionWith(view, first.id, "new")).toBe(view);
    expect(
      readQuestionWith(view, first.id, questionId("gone")).questions[0]
    ).toEqual({ ...held, reading: null });
  });

  it("shows the reading of a question in the store while the server saves it", () => {
    const view = viewOf([held, second]);
    const { localStore, setQuery } = storeHolding(Option.some(view));

    readingUpdate(localStore, {
      examId,
      questionId: first.id,
      slug,
      source: "none",
    });

    expect(setQuery).toHaveBeenCalledWith(
      exams.exams.open,
      { examId, slug },
      Option.some(readQuestionWith(view, first.id, "none"))
    );
  });
});
