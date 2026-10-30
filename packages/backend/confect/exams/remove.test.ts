import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { documentRows, nf } from "@repo/backend/test/editor";
import {
  examImage,
  examRows,
  questionRows,
  teacherExam,
} from "@repo/backend/test/exams";
import { storageUrl } from "@repo/backend/test/logo";
import {
  CLOSES_AT,
  keyedExam,
  keyedSchool,
  OPENS_AT,
  scheduleSitting,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { remove } = refs.public.exams.exams;
const { add } = refs.public.exams.questions;

/** Every row of the images, so a test reads what the deletion left. */
const assetRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("examAssets").index("by_creation_time").take(100)
);

describe("exams/remove", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.effect(
    "deletes a draft exam with its questions at once, and their documents and its images once the scheduled deletions run",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Hapus ujian");
        yield* teacher.mutation(add, {
          after: exam.questions[0].id,
          examId: exam.id,
          slug: nf,
        });
        const image = yield* examImage(fixture, exam.id);
        const { storageId } = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("examAssets").get(image.id).pipe(Effect.orDie)
          )
        );
        expect(
          yield* teacher.mutation(remove, { examId: exam.id, slug: nf })
        ).toBeNull();
        expect(yield* fixture.run(examRows)).toEqual([]);
        expect(yield* fixture.run(questionRows)).toEqual([]);
        yield* fixture.finishScheduled();
        expect(yield* fixture.run(documentRows)).toEqual([]);
        expect(yield* fixture.run(assetRows)).toEqual([]);
        expect(yield* storageUrl(fixture.convex, storageId)).toBeNull();
      })
  );

  it.effect(
    "refuses a student and an exam that has a sitting, and keeps the exam with its questions",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "Terjadwal");
        const student = yield* fixture
          .as("student")
          .mutation(remove, { examId, slug: nf })
          .pipe(Effect.flip);
        expect(student).toMatchObject({ _tag: "AccessDenied" });
        yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
        const scheduled = yield* fixture
          .as("teacher")
          .mutation(remove, { examId, slug: nf })
          .pipe(Effect.flip);
        expect(scheduled).toMatchObject({
          _tag: "ExamInUse",
          code: "EXAM_IN_USE",
        });
        expect(yield* fixture.run(examRows)).toHaveLength(1);
      })
  );
});
