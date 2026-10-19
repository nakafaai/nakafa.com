import type { GenericId } from "@confect/core";
import { DeliveryLanguageSchema } from "@nakafa/aksara-contracts/locale";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import type { tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

/** Every exam row, for a test that expects none or one. */
export const examRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("exams").index("by_creation_time").take(100)
);

/** Every question row, for a test that counts them. A full exam holds 200. */
export const questionRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("examQuestions").index("by_creation_time").take(300)
);

/** The content language of the test exams: Indonesian. */
export const LANGUAGE = Schema.decodeSync(DeliveryLanguageSchema)("id");

/** The fixture the exam tests seed. */
type ExamFixture = Effect.Success<typeof tenancyFixture>;

const { create, open } = refs.public.exams.exams;

/** The accounts that write an exam in the tests: the teacher, or the school's Admin. */
export type ExamAuthor = "admin" | "teacher";

/** An exam in the SMP unit, written by one account and opened by it: its ID, and its questions in order. */
export const examBy = Effect.fn("test.exams.examBy")(function* (
  fixture: ExamFixture,
  author: ExamAuthor,
  title: string
) {
  const writer = fixture.as(author);
  const made = yield* writer.mutation(create, {
    language: LANGUAGE,
    scope: { kind: "unit", unitId: fixture.units.smp },
    slug: nf,
    title,
  });
  return yield* writer.query(open, { examId: made.id, slug: nf });
});

/** A teacher's exam in the unit the teacher teaches, opened: its ID, and its questions in order. */
export const teacherExam = Effect.fn("test.exams.teacherExam")(function* (
  fixture: ExamFixture,
  title: string
) {
  return yield* examBy(fixture, "teacher", title);
});

/** Archives one unit of the school, which locks the edits of the exams and documents in it. */
export const archiveUnit = Effect.fn("test.exams.archiveUnit")(function* (
  unitId: GenericId.GenericId<"tenantUnits">
) {
  yield* (yield* DatabaseWriter)
    .table("tenantUnits")
    .patch(unitId, { status: "archived" })
    .pipe(Effect.orDie);
});

/**
 * Seeds an exam up to `count` questions. Each extra question is a row of its own that
 * shares the first question's prompt, so the test starts from a full exam without one
 * mutation per question. Only the count matters to the limit under test.
 */
export const fillExam = Effect.fn("test.exams.fill")(function* (
  examId: GenericId.GenericId<"exams">,
  questionId: GenericId.GenericId<"examQuestions">,
  count: number
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const first = yield* reader
    .table("examQuestions")
    .get(questionId)
    .pipe(Effect.orDie);
  const extra = yield* Effect.forEach(
    Arr.makeBy(count - 1, () => first),
    (row) =>
      writer
        .table("examQuestions")
        .insert({
          answers: row.answers,
          examId,
          key: row.key,
          prompt: row.prompt,
          revision: 0,
          template: row.template,
          tenantId: row.tenantId,
          updatedAt: row.updatedAt,
        })
        .pipe(Effect.orDie)
  );
  yield* writer
    .table("exams")
    .patch(examId, { questions: [questionId, ...extra] })
    .pipe(Effect.orDie);
});
