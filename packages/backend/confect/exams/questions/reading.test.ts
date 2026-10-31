import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { documentRows, nf } from "@repo/backend/test/editor";
import { teacherExam } from "@repo/backend/test/exams";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { open } = refs.public.exams.exams;
const { add, copy, reading, remove } = refs.public.exams.questions;

describe("exams/questions reading", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "gives a question a new reading, shares it with another, keeps it while one holds it, and copies it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Bacaan");
        const [first] = exam.questions;
        const second = yield* teacher.mutation(add, {
          after: first.id,
          examId: exam.id,
          slug: nf,
        });
        const ids = { examId: exam.id, slug: nf };

        expect(first.reading).toBeNull();
        const written = yield* teacher.mutation(reading, {
          ...ids,
          questionId: first.id,
          source: "new",
        });
        expect(written.reading).not.toBeNull();
        const shared = yield* teacher.mutation(reading, {
          ...ids,
          questionId: second.id,
          source: first.id,
        });
        expect(shared.reading).toBe(written.reading);
        const copied = yield* teacher.mutation(copy, {
          ...ids,
          questionId: first.id,
        });
        expect(copied.reading).toBe(written.reading);

        const same = yield* teacher.mutation(reading, {
          ...ids,
          questionId: second.id,
          source: first.id,
        });
        expect(same.reading).toBe(written.reading);
        const without = yield* teacher.mutation(reading, {
          ...ids,
          questionId: second.id,
          source: "none",
        });
        expect(without.reading).toBeNull();
        const opened = yield* teacher.query(open, ids);
        expect(opened.questions[0].reading).toBe(written.reading);
      })
  );

  it.effect("refuses the reading of a question of another exam", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const teacher = fixture.as("teacher");
      const exam = yield* teacherExam(fixture, "Bacaan");
      const other = yield* teacherExam(fixture, "Lain");
      const refused = yield* teacher
        .mutation(reading, {
          examId: exam.id,
          questionId: exam.questions[0].id,
          slug: nf,
          source: other.questions[0].id,
        })
        .pipe(Effect.flip);
      expect(String(refused)).toContain("AccessDenied");
    })
  );

  it.effect(
    "deletes a reading with the last question that holds it, and only then",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Bacaan");
        const [first] = exam.questions;
        const ids = { examId: exam.id, slug: nf };
        const written = yield* teacher.mutation(reading, {
          ...ids,
          questionId: first.id,
          source: "new",
        });
        const second = yield* teacher.mutation(add, {
          ...ids,
          after: first.id,
        });
        yield* teacher.mutation(reading, {
          ...ids,
          questionId: second.id,
          source: first.id,
        });
        yield* teacher.mutation(remove, { ...ids, questionId: first.id });
        yield* fixture.finishScheduled();
        const rows = yield* fixture.run(documentRows);
        const before = rows.length;
        expect(Arr.some(rows, (row) => row._id === written.reading)).toBe(true);

        yield* teacher.mutation(reading, {
          ...ids,
          questionId: second.id,
          source: "new",
        });
        yield* fixture.finishScheduled();
        const after = yield* fixture.run(documentRows);
        expect(Arr.some(after, (row) => row._id === written.reading)).toBe(
          false
        );
        expect(after).toHaveLength(before);
      })
  );
});
