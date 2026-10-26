import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { PlacedQuestion } from "@repo/backend/confect/exams/import";
import { encodeKey } from "@repo/backend/confect/exams/question";
import { nf } from "@repo/backend/test/editor";
import { examImage, teacherExam } from "@repo/backend/test/exams";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

const { keys, place } = refs.public.exams.imports;

/** The exam's questions in its order. */
const questionsOf = (examId: GenericId.GenericId<"exams">) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const exam = yield* reader.table("exams").get(examId).pipe(Effect.orDie);
    return yield* Effect.forEach(exam.questions, (id) =>
      reader.table("examQuestions").get(id).pipe(Effect.orDie)
    );
  });

/** The exam's first question. */
const firstOf = (examId: GenericId.GenericId<"exams">) =>
  Effect.map(questionsOf(examId), (questions) =>
    Option.getOrThrow(Arr.head(questions))
  );

/** The stored text of a document's snapshot. */
const snapshotOf = (documentId: GenericId.GenericId<"editorDocuments">) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader
      .table("editorSnapshots")
      .index("by_documentId", (query) => query.eq("documentId", documentId))
      .first()
      .pipe(
        Effect.orDie,
        Effect.map((row) => Option.getOrThrow(row).content)
      )
  );

/** Freezes an exam, as its first scheduled sitting does. */
const freeze = (examId: GenericId.GenericId<"exams">) =>
  Effect.flatMap(DatabaseWriter, (writer) =>
    writer
      .table("exams")
      .patch(examId, { frozenAt: TENANCY_NOW })
      .pipe(Effect.orDie)
  );

/** Fills an exam's order to its limit with one question, as two hundred placements would. */
const fill = (
  examId: GenericId.GenericId<"exams">,
  questionId: GenericId.GenericId<"examQuestions">
) =>
  Effect.flatMap(DatabaseWriter, (writer) =>
    writer
      .table("exams")
      .patch(examId, { questions: Arr.makeBy(200, () => questionId) })
      .pipe(Effect.orDie)
  );

/** Marks a document as edited by the teacher, which moves its head past zero. */
const edit = (documentId: GenericId.GenericId<"editorDocuments">) =>
  Effect.flatMap(DatabaseWriter, (writer) =>
    writer
      .table("editorDocuments")
      .patch(documentId, { head: 1 })
      .pipe(Effect.orDie)
  );

/** Marks a question as edited by the teacher, which counts its revision up. */
const touch = (questionId: GenericId.GenericId<"examQuestions">) =>
  Effect.flatMap(DatabaseWriter, (writer) =>
    writer
      .table("examQuestions")
      .patch(questionId, { revision: 1 })
      .pipe(Effect.orDie)
  );

/** A question to place: two options, with the given answer and figures. */
const toPlace = (
  prompt: string,
  answer: number | null,
  figures: PlacedQuestion["figures"] = []
) => ({
  answer,
  explanation: "",
  figures,
  number: null,
  options: ["A", "B"],
  prompt,
});

describe("exams/imports place and keys", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "places questions at the end of a new exam in order, with their keys, formulas, and worked solutions, in place of the untouched first question",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* teacherExam(fixture, "PTS Matematika");
        const placed = yield* fixture.as("teacher").mutation(place, {
          examId: exam.id,
          questions: [
            {
              ...toPlace("Berapa \\(2 + 3\\)?", 1),
              explanation: "Karena \\(2 + 3 = 5\\).",
              number: 1,
            },
            toPlace("Ibu kota Indonesia?", null),
            { ...toPlace("Jelaskan.", null), options: [] },
          ],
          slug: nf,
        });
        const questions = yield* fixture.run(questionsOf(exam.id));
        expect(placed).toEqual({
          keyless: 1,
          left: 1,
          placed: Arr.map(questions, (question, index) => ({
            id: question._id,
            number: index === 0 ? 1 : null,
          })),
        });
        expect(Arr.map(questions, (question) => question.key)).toEqual([
          yield* encodeKey([
            { correct: ["option-2"], interaction: "choice", kind: "choice" },
          ]),
          null,
        ]);
        const first = yield* fixture.run(firstOf(exam.id));
        expect(yield* fixture.run(snapshotOf(first.prompt))).toContain(
          '"type":"mathInline"'
        );
        expect(yield* fixture.run(snapshotOf(first.explanation))).toContain(
          '"latex":"2 + 3 = 5"'
        );
        expect(first).toMatchObject({ points: 1, revision: 0 });
        expect(yield* fixture.run(snapshotOf(first.rubric))).not.toContain(
          '"text"'
        );
      })
  );

  it.effect(
    "keeps a first question the teacher touched, its explanation alone included, and places nothing for a read without a question",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* teacherExam(fixture, "PTS Matematika");
        const teacher = fixture.as("teacher");
        const empty = yield* teacher.mutation(place, {
          examId: exam.id,
          questions: [],
          slug: nf,
        });
        expect(empty).toEqual({ keyless: 0, left: 0, placed: [] });
        const first = yield* fixture.run(firstOf(exam.id));
        yield* fixture.run(touch(first._id));
        yield* teacher.mutation(place, {
          examId: exam.id,
          questions: [toPlace("Soal", 0)],
          slug: nf,
        });
        const questions = yield* fixture.run(questionsOf(exam.id));
        expect(Arr.map(questions, (question) => question._id)).toHaveLength(2);
        expect(yield* fixture.run(firstOf(exam.id))).toMatchObject({
          _id: first._id,
        });
        const explained = yield* teacherExam(fixture, "PTS Matematika");
        const kept = yield* fixture.run(firstOf(explained.id));
        yield* fixture.run(edit(kept.explanation));
        yield* teacher.mutation(place, {
          examId: explained.id,
          questions: [toPlace("Soal", 0)],
          slug: nf,
        });
        expect(
          Arr.map(
            yield* fixture.run(questionsOf(explained.id)),
            (question) => question._id
          )
        ).toEqual([kept._id, expect.any(String)]);
      })
  );

  it.effect(
    "refuses a figure of another exam, a student, a full exam and a frozen one, writing nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* teacherExam(fixture, "PTS Matematika");
        const other = yield* teacherExam(fixture, "PTS Matematika");
        const foreign = yield* examImage(fixture, other.id);
        const send = (
          account: "student" | "teacher",
          questions: readonly ReturnType<typeof toPlace>[]
        ) =>
          fixture
            .as(account)
            .mutation(place, { examId: exam.id, questions, slug: nf })
            .pipe(Effect.flip);
        const figure = yield* send("teacher", [
          toPlace("{{figure:1}}", 0, [{ alt: "Gambar", asset: foreign.id }]),
        ]);
        const student = yield* send("student", [toPlace("Soal", 0)]);
        const first = yield* fixture.run(firstOf(exam.id));
        yield* fixture.run(fill(exam.id, first._id));
        const full = yield* send("teacher", [toPlace("Soal", 0)]);
        yield* fixture.run(freeze(exam.id));
        const frozen = yield* send("teacher", [toPlace("Soal", 0)]);
        expect(
          Arr.map([figure, student, full, frozen], (error) => error._tag)
        ).toEqual(["AccessDenied", "AccessDenied", "ExamFull", "ExamFrozen"]);
      })
  );

  it.effect(
    "gives each placed question without a key the answer a later key table names, and leaves the others as they are",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* teacherExam(fixture, "PTS Matematika");
        const teacher = fixture.as("teacher");
        const placed = yield* teacher.mutation(place, {
          examId: exam.id,
          questions: [
            toPlace("Satu", null),
            toPlace("Dua", 0),
            toPlace("Tiga", null),
            toPlace("Empat", null),
          ],
          slug: nf,
        });
        const ids = Arr.map(placed.placed, (question) => question.id);
        const idAt = (index: number) => Option.getOrThrow(Arr.get(ids, index));
        yield* fixture.run(touch(idAt(3)));
        const keyed = yield* teacher.mutation(keys, {
          examId: exam.id,
          keys: [
            { answer: 1, questionId: idAt(0) },
            { answer: 1, questionId: idAt(1) },
            { answer: 7, questionId: idAt(2) },
            { answer: 0, questionId: idAt(3) },
          ],
          slug: nf,
        });
        expect(keyed).toEqual({ keyed: 1 });
        const questions = yield* fixture.run(questionsOf(exam.id));
        expect(Arr.map(questions, (question) => question.key)).toEqual([
          yield* encodeKey([
            { correct: ["option-2"], interaction: "choice", kind: "choice" },
          ]),
          yield* encodeKey([
            { correct: ["option-1"], interaction: "choice", kind: "choice" },
          ]),
          null,
          null,
        ]);
        const other = yield* teacherExam(fixture, "PTS Matematika");
        const foreign = yield* teacher
          .mutation(keys, {
            examId: other.id,
            keys: [{ answer: 0, questionId: idAt(2) }],
            slug: nf,
          })
          .pipe(Effect.flip);
        yield* fixture.run(freeze(exam.id));
        const frozen = yield* teacher
          .mutation(keys, { examId: exam.id, keys: [], slug: nf })
          .pipe(Effect.flip);
        expect([foreign._tag, frozen._tag]).toEqual([
          "AccessDenied",
          "ExamFrozen",
        ]);
      })
  );
});
