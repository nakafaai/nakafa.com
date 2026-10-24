import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type { GrantScope } from "@repo/backend/confect/access/schema";
import { denied, nf, otherSchoolTeacher } from "@repo/backend/test/editor";
import { archiveUnit, examRows } from "@repo/backend/test/exams";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { cohorts, create, list, open, rename } = refs.public.exams.exams;

/** One minute, so two exams made in turn have different creation times. */
const LATER = TENANCY_NOW + 60_000;

/** Two minutes, so the newest exam of a test is made after the others. */
const LATEST = TENANCY_NOW + 120_000;

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
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
          title: "PTS Matematika",
        });
        const opened = yield* teacher.query(open, {
          examId: made.id,
          slug: nf,
        });
        expect(opened).toMatchObject({
          title: "PTS Matematika",
        });
        expect(opened.questions).toHaveLength(1);
        const [question] = opened.questions;
        expect(question).toMatchObject({
          key: null,
          revision: 0,
          template: "choice",
        });
        const emptyLabel = { content: [{ type: "paragraph" }], type: "doc" };
        const [choice] = question.answers;
        expect(choice).toMatchObject({
          kind: "choice",
          maxChoices: 1,
          minChoices: 1,
          options: [
            { id: "option-1", label: emptyLabel },
            { id: "option-2", label: emptyLabel },
            { id: "option-3", label: emptyLabel },
            { id: "option-4", label: emptyLabel },
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
            scope,
            slug: nf,
            title: "Lain",
          })
          .pipe(Effect.flip);
        const student = yield* fixture
          .as("student")
          .mutation(create, {
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
          scope: { kind: "tenant" },
          slug: nf,
          title: "Seluruh sekolah",
        });
        vi.setSystemTime(LATER);
        yield* fixture.as("teacher").mutation(create, {
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
          title: "Kelas SMP",
        });
        vi.setSystemTime(LATEST);
        yield* fixture.as("admin").mutation(create, {
          scope: { kind: "unit", unitId: fixture.units.sma },
          slug: nf,
          title: "Kelas SMA",
        });
        const admin = yield* fixture.as("admin").query(list, page);
        expect(Arr.map(admin.page, (exam) => exam.title)).toEqual([
          "Kelas SMA",
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
    "pages the exam list at twenty exams at most, and says that more follow",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        for (let index = 0; index < 21; index += 1) {
          yield* teacher.mutation(create, {
            scope: { kind: "unit", unitId: fixture.units.smp },
            slug: nf,
            title: `Ujian ${index + 1}`,
          });
        }
        const page = yield* teacher.query(list, {
          paginationOpts: { cursor: null, numItems: 50 },
          slug: nf,
        });
        expect(page.page).toHaveLength(20);
        expect(page.isDone).toBe(false);
      })
  );

  it.effect(
    "opens an exam to an Admin of the school, and to a Teacher whose grant covers its unit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const school = yield* fixture.as("admin").mutation(create, {
          scope: { kind: "tenant" },
          slug: nf,
          title: "Seluruh sekolah",
        });
        const unit = yield* fixture.as("teacher").mutation(create, {
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
          title: "Kelas SMP",
        });
        const admin = yield* fixture.as("admin").query(open, {
          examId: school.id,
          slug: nf,
        });
        expect(admin).toMatchObject({ title: "Seluruh sekolah" });
        const teacher = yield* fixture.as("teacher").query(open, {
          examId: unit.id,
          slug: nf,
        });
        expect(teacher).toMatchObject({ title: "Kelas SMP" });
      })
  );

  it.effect(
    "refuses a student, a teacher whose grant does not cover the exam, and another school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const school = yield* fixture.as("admin").mutation(create, {
          scope: { kind: "tenant" },
          slug: nf,
          title: "Seluruh sekolah",
        });
        const outside = yield* fixture.as("admin").mutation(create, {
          scope: { kind: "unit", unitId: fixture.units.sma },
          slug: nf,
          title: "Kelas SMA",
        });
        const teacher = yield* fixture
          .as("teacher")
          .query(open, { examId: school.id, slug: nf })
          .pipe(Effect.flip);
        const teacherOutside = yield* fixture
          .as("teacher")
          .query(open, { examId: outside.id, slug: nf })
          .pipe(Effect.flip);
        const student = yield* fixture
          .as("student")
          .query(open, { examId: school.id, slug: nf })
          .pipe(Effect.flip);
        const foreign = yield* (yield* otherSchoolTeacher(fixture))
          .query(open, { examId: school.id, slug: nf })
          .pipe(Effect.flip);
        expect([teacher, teacherOutside, student]).toMatchObject([
          denied("role"),
          denied("role"),
          denied("role"),
        ]);
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
        yield* fixture.run(archiveUnit(fixture.units.smp));
        const archived = yield* teacher
          .mutation(rename, { examId: made.id, slug: nf, title: "Terkunci" })
          .pipe(Effect.flip);
        expect(archived).toMatchObject(denied("condition"));
      })
  );

  it.effect(
    "opens an exam of an archived unit as archived, and an exam of a live unit as editable",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const live = yield* teacher.mutation(create, {
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
          title: "Hidup",
        });
        expect(
          yield* teacher.query(open, { examId: live.id, slug: nf })
        ).toMatchObject({ archived: false });
        yield* fixture.run(archiveUnit(fixture.units.smp));
        expect(
          yield* teacher.query(open, { examId: live.id, slug: nf })
        ).toMatchObject({ archived: true });
      })
  );
});

describe("exams/exams cohorts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "lists the active cohorts of the unit's active period to a teacher, and no archived cohort",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const unitId = fixture.units.smp;
        const before = yield* teacher.query(cohorts, { slug: nf, unitId });
        expect(before).toEqual([]);
        const ids = yield* fixture.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const periodId = yield* writer.table("tenantPeriods").insert({
              end: "2026-12-19",
              name: "Ganjil",
              start: "2026-07-13",
              status: "active",
              tenantId: fixture.tenants.nf,
              unitId,
            });
            const active = yield* writer.table("tenantCohorts").insert({
              grade: 10,
              name: "10A",
              nameKey: "10a",
              periodId,
              status: "active",
              tenantId: fixture.tenants.nf,
              unitId,
            });
            yield* writer.table("tenantCohorts").insert({
              grade: 10,
              name: "10B",
              nameKey: "10b",
              periodId,
              status: "archived",
              tenantId: fixture.tenants.nf,
              unitId,
            });
            return { active };
          })
        );
        const listed = yield* teacher.query(cohorts, { slug: nf, unitId });
        expect(listed).toEqual([{ id: ids.active, name: "10A" }]);
      })
  );

  it.effect(
    "refuses the cohorts of a unit the caller may not schedule in",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const refused = yield* fixture
          .as("student")
          .query(cohorts, { slug: nf, unitId: fixture.units.smp })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "AccessDenied" });
      })
  );
});
