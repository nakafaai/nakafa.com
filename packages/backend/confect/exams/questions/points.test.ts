import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { nf } from "@repo/backend/test/editor";
import { teacherExam } from "@repo/backend/test/exams";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

const { open } = refs.public.exams.exams;
const { copy, points, scoring, template } = refs.public.exams.questions;

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

  it.effect(
    "scores a table by the rule the teacher chooses, raises points too few for its steps, copies it, and a template without parts reads all or nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Aturan skor");
        const [first] = exam.questions;
        const ids = { examId: exam.id, questionId: first.id, slug: nf };
        const refused = yield* teacher
          .mutation(scoring, { ...ids, scoring: "wrongParts" })
          .pipe(Effect.flip);
        expect(String(refused)).toContain("ScoringDoesNotFit");

        const table = yield* teacher.mutation(template, {
          ...ids,
          labels: ["Benar", "Salah"],
          revision: first.revision,
          template: "table",
        });
        expect(table.scoring).toEqual({ kind: "allOrNothing" });
        const bands = yield* teacher.mutation(scoring, {
          ...ids,
          scoring: "wrongParts",
        });
        expect(bands.scoring.kind).toBe("wrongParts");
        expect(bands.points).toBe(2);
        expect(bands.revision).toBe(table.revision);

        yield* teacher.mutation(points, { ...ids, points: 5 });
        const shares = yield* teacher.mutation(scoring, {
          ...ids,
          scoring: "perPart",
        });
        expect(shares.scoring).toEqual({
          floor: 0,
          kind: "perPart",
          penaltyPerWrongPart: 1,
          pointsPerPart: 1,
        });
        expect(shares.points).toBe(5);

        const copied = yield* teacher.mutation(copy, ids);
        const opened = yield* teacher.query(open, {
          examId: exam.id,
          slug: nf,
        });
        expect(
          Option.map(
            Arr.findFirst(
              opened.questions,
              (question) => question.id === copied.id
            ),
            (question) => question.scoring.kind
          )
        ).toEqual(Option.some("perPart"));

        const short = yield* teacher.mutation(template, {
          ...ids,
          labels: [],
          revision: shares.revision,
          template: "short",
        });
        expect(short.scoring).toEqual({ kind: "allOrNothing" });
      })
  );
});
