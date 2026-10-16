import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type { GrantScope } from "@repo/backend/confect/access/schema";
import { denied, nf, otherSchoolTeacher } from "@repo/backend/test/editor";
import { examRows, LANGUAGE } from "@repo/backend/test/exams";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { create, list, open, rename } = refs.public.exams.exams;

/** One minute, so two exams made in turn have different creation times. */
const LATER = TENANCY_NOW + 60_000;

describe("exams/exams", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "creates an exam whose first question is a single-answer choice of four empty options",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* teacher.mutation(create, {
          language: LANGUAGE,
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
          title: "PTS Matematika",
        });
        const opened = yield* teacher.query(open, {
          examId: made.id,
          slug: nf,
        });
        expect(opened).toMatchObject({
          language: LANGUAGE,
          title: "PTS Matematika",
        });
        expect(opened.questions).toHaveLength(1);
        const [question] = opened.questions;
        expect(question).toMatchObject({
          key: null,
          revision: 0,
          template: "choice",
        });
        const [choice] = question.answers;
        expect(choice).toMatchObject({
          kind: "choice",
          maxChoices: 1,
          minChoices: 1,
          options: [
            { id: "option-1" },
            { id: "option-2" },
            { id: "option-3" },
            { id: "option-4" },
          ],
          shuffle: false,
        });
        expect(yield* fixture.run(examRows)).toHaveLength(1);
      })
  );

  it.effect(
    "refuses to create in a unit the teacher does not teach, or for a student",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const scope: GrantScope = { kind: "unit", unitId: fixture.units.sma };
        const other = yield* fixture
          .as("teacher")
          .mutation(create, {
            language: LANGUAGE,
            scope,
            slug: nf,
            title: "Lain",
          })
          .pipe(Effect.flip);
        const student = yield* fixture
          .as("student")
          .mutation(create, {
            language: LANGUAGE,
            scope: { kind: "tenant" },
            slug: nf,
            title: "Siswa",
          })
          .pipe(Effect.flip);
        expect([other, student]).toMatchObject([
          denied("role"),
          denied("role"),
        ]);
        expect(yield* fixture.run(examRows)).toEqual([]);
      })
  );

  it.effect(
    "lists the exams a caller may view, newest first, and shows a scoped teacher only its unit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const page = {
          paginationOpts: { cursor: null, numItems: 10 },
          slug: nf,
        };
        yield* fixture.as("admin").mutation(create, {
          language: LANGUAGE,
          scope: { kind: "tenant" },
          slug: nf,
          title: "Seluruh sekolah",
        });
        vi.setSystemTime(LATER);
        yield* fixture.as("teacher").mutation(create, {
          language: LANGUAGE,
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
          title: "Kelas SMP",
        });
        const admin = yield* fixture.as("admin").query(list, page);
        expect(Arr.map(admin.page, (exam) => exam.title)).toEqual([
          "Kelas SMP",
          "Seluruh sekolah",
        ]);
        const teacher = yield* fixture.as("teacher").query(list, page);
        expect(Arr.map(teacher.page, (exam) => exam.title)).toEqual([
          "Kelas SMP",
        ]);
        const student = yield* fixture.as("student").query(list, page);
        expect(student.page).toEqual([]);
      })
  );

  it.effect(
    "opens an exam to the teachers whose grant covers it, and refuses a student and another school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* fixture.as("admin").mutation(create, {
          language: LANGUAGE,
          scope: { kind: "tenant" },
          slug: nf,
          title: "Seluruh sekolah",
        });
        const teacher = yield* fixture
          .as("teacher")
          .query(open, { examId: made.id, slug: nf })
          .pipe(Effect.flip);
        const student = yield* fixture
          .as("student")
          .query(open, { examId: made.id, slug: nf })
          .pipe(Effect.flip);
        const foreign = yield* (yield* otherSchoolTeacher(fixture))
          .query(open, { examId: made.id, slug: nf })
          .pipe(Effect.flip);
        expect(teacher).toMatchObject(denied("role"));
        expect(student).toMatchObject(denied("role"));
        expect(foreign).toMatchObject({
          _tag: "NotMember",
          code: "NOT_MEMBER",
        });
      })
  );

  it.effect(
    "renames an exam its editor may edit, and refuses a rename once its unit is archived",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* teacher.mutation(create, {
          language: LANGUAGE,
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
          title: "Ulangan",
        });
        const renamed = yield* teacher.mutation(rename, {
          examId: made.id,
          slug: nf,
          title: "Ulangan harian",
        });
        expect(renamed).toMatchObject({ id: made.id, title: "Ulangan harian" });
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("tenantUnits")
              .patch(fixture.units.smp, { status: "archived" })
          )
        );
        const archived = yield* teacher
          .mutation(rename, { examId: made.id, slug: nf, title: "Terkunci" })
          .pipe(Effect.flip);
        expect(archived).toMatchObject(denied("condition"));
      })
  );
});
