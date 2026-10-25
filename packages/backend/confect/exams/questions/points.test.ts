import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { nf } from "@repo/backend/test/editor";
import { teacherExam } from "@repo/backend/test/exams";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { open } = refs.public.exams.exams;
const { points } = refs.public.exams.questions;

describe("exams/questions points", () => {
  it.effect(
    "takes points from one to one hundred as whole numbers, and refuses any other value with nothing written",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Batas poin");
        const [first] = exam.questions;
        const setPoints = (value: number) =>
          teacher.mutation(points, {
            examId: exam.id,
            points: value,
            questionId: first.id,
            slug: nf,
          });
        const refusals = yield* Effect.forEach([0, 101, 2.5, -1], (value) =>
          setPoints(value).pipe(Effect.flip)
        );
        expect(refusals).toHaveLength(4);
        const opened = yield* teacher.query(open, {
          examId: exam.id,
          slug: nf,
        });
        expect(opened.questions[0].points).toBe(first.points);
        const lowest = yield* setPoints(1);
        const highest = yield* setPoints(100);
        expect([lowest.points, highest.points]).toEqual([1, 100]);
      })
  );
});
