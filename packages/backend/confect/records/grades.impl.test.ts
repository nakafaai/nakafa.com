import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type { Band } from "@repo/backend/confect/records/scheme";
import {
  classOf,
  cohort,
  denied,
  firstPage,
  nf,
  period,
  teach,
} from "@repo/backend/test/classroom";
import { grantRole, journal, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

type Fixture = Effect.Success<typeof tenancyFixture>;

const { enter, mine, release, sheet } = refs.public.records.grades;
const schemes = refs.public.records.schemes;
const placements = refs.public.tenancy.placements;

/** Places a Person in a cohort as the school's Admin. */
const place = Effect.fn("test.records.place")(function* (
  fixture: Fixture,
  cohortId: GenericId.GenericId<"tenantCohorts">,
  personId: GenericId.GenericId<"tenantPeople">
) {
  return yield* fixture
    .as("admin")
    .mutation(placements.place, { cohortId, personId, slug: nf });
});

/**
 * A class of the SMP unit with its subject teacher, and the school's student
 * placed in its cohort.
 */
const setup = Effect.fn("test.records.setup")(function* (fixture: Fixture) {
  const term = yield* period(fixture, fixture.units.smp);
  const x1 = yield* cohort(fixture, term.id, "X-1");
  const fisika = yield* classOf(fixture, x1.id, "Fisika");
  yield* teach(fixture, fisika.id, fixture.people.teacher.personId);
  yield* place(fixture, x1.id, fixture.people.student.personId);
  return { classId: fisika.id, cohortId: x1.id, periodId: term.id };
});

/** A second student of the school, granted the student role over the SMP unit and placed in the cohort. */
const classmate = Effect.fn("test.records.classmate")(function* (
  fixture: Fixture,
  cohortId: GenericId.GenericId<"tenantCohorts">
) {
  yield* fixture.run(
    grantRole(fixture.tenants.nf, fixture.invited, "student", {
      kind: "unit",
      unitId: fixture.units.smp,
    })
  );
  yield* place(fixture, cohortId, fixture.invited);
  return fixture.invited;
});

/** The school's Admin stores one version of the grading scheme, from its effective time on. */
const storeScheme = (
  fixture: Fixture,
  effectiveFrom: number,
  kktp: number,
  bands: readonly (typeof Band.Type)[]
) =>
  fixture
    .as("admin")
    .mutation(schemes.store, { bands, effectiveFrom, kktp, slug: nf });

/** The subject teacher enters a draft for one student of the class. */
const draft = (
  fixture: Fixture,
  classId: GenericId.GenericId<"classes">,
  personId: GenericId.GenericId<"tenantPeople">,
  value: number
) =>
  fixture.as("teacher").mutation(enter, { classId, personId, slug: nf, value });

/** The subject teacher releases one grade. */
const releaseBy = (
  fixture: Fixture,
  gradeId: GenericId.GenericId<"classGrades">
) => fixture.as("teacher").mutation(release, { gradeId, slug: nf });

describe("records/grades entry and gradebook", () => {
  it.effect(
    "lets the subject teacher enter a draft for a placed student, and shows it in the gradebook",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { classId } = yield* setup(fixture);
        const before = yield* fixture.run(journal);
        const entered = yield* draft(
          fixture,
          classId,
          fixture.people.student.personId,
          80
        );
        const listed = yield* fixture
          .as("teacher")
          .query(sheet, { ...firstPage, classId, slug: nf });
        expect(entered).toMatchObject({
          classId,
          kktp: "reached",
          personId: fixture.people.student.personId,
          state: "draft",
          value: 80,
        });
        expect(entered).not.toHaveProperty("band");
        expect(listed.page).toEqual([
          {
            grade: entered,
            student: { id: fixture.people.student.personId, name: "Student" },
          },
        ]);
        expect(yield* fixture.run(journal)).toEqual(before);
      })
  );

  it.effect(
    "replaces the draft that stands, so a student holds one grade",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { classId } = yield* setup(fixture);
        const student = fixture.people.student.personId;
        const first = yield* draft(fixture, classId, student, 80);
        const second = yield* draft(fixture, classId, student, 90);
        const listed = yield* fixture
          .as("teacher")
          .query(sheet, { ...firstPage, classId, slug: nf });
        expect(second.id).toBe(first.id);
        expect(second.value).toBe(90);
        expect(listed.page).toHaveLength(1);
      })
  );

  it.effect(
    "refuses the entry and the list to anyone but the class's subject teacher",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { classId, cohortId } = yield* setup(fixture);
        const biologi = yield* classOf(fixture, cohortId, "Biologi");
        const student = fixture.people.student.personId;
        const refusals = yield* Effect.all([
          fixture
            .as("admin")
            .mutation(enter, {
              classId,
              personId: student,
              slug: nf,
              value: 80,
            })
            .pipe(Effect.flip),
          fixture
            .as("student")
            .mutation(enter, {
              classId,
              personId: student,
              slug: nf,
              value: 80,
            })
            .pipe(Effect.flip),
          fixture
            .as("teacher")
            .mutation(enter, {
              classId: biologi.id,
              personId: student,
              slug: nf,
              value: 80,
            })
            .pipe(Effect.flip),
          fixture
            .as("counselor")
            .query(sheet, { ...firstPage, classId, slug: nf })
            .pipe(Effect.flip),
          fixture
            .as("student")
            .query(sheet, { ...firstPage, classId, slug: nf })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject([
          denied("role"),
          denied("role"),
          denied("role"),
          denied("role"),
          denied("role"),
        ]);
      })
  );

  it.effect(
    "refuses a student who is not placed in the cohort of the class",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { classId } = yield* setup(fixture);
        const refused = yield* draft(
          fixture,
          classId,
          fixture.people.teacher.personId,
          80
        ).pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "GradeNotPlaced",
          code: "GRADE_NOT_PLACED",
        });
      })
  );
});

describe("records/grades release", () => {
  it.effect(
    "releases a draft once, journals grade.released, and answers a repeated release unchanged",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { classId, periodId } = yield* setup(fixture);
        const student = fixture.people.student.personId;
        const entered = yield* draft(fixture, classId, student, 80);
        const released = yield* releaseBy(fixture, entered.id);
        const journaled = yield* fixture.run(journal);
        expect(released).toEqual({ ...entered, state: "released" });
        expect(Option.getOrUndefined(Arr.last(journaled))).toMatchObject({
          actor: { id: fixture.people.teacher.personId, kind: "person" },
          change: {
            classId,
            periodId,
            personId: student,
            state: "released",
            type: "grade.released",
          },
          subject: { id: entered.id, kind: "grade" },
        });
        const again = yield* releaseBy(fixture, entered.id);
        expect(again).toEqual(released);
        expect(yield* fixture.run(journal)).toEqual(journaled);
      })
  );

  it.effect(
    "refuses a release to anyone but the subject teacher, and a new entry for a released grade",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { classId } = yield* setup(fixture);
        const student = fixture.people.student.personId;
        const entered = yield* draft(fixture, classId, student, 80);
        const refusals = yield* Effect.all([
          fixture
            .as("student")
            .mutation(release, { gradeId: entered.id, slug: nf })
            .pipe(Effect.flip),
          fixture
            .as("counselor")
            .mutation(release, { gradeId: entered.id, slug: nf })
            .pipe(Effect.flip),
          fixture
            .as("admin")
            .mutation(release, { gradeId: entered.id, slug: nf })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject([
          denied("role"),
          denied("role"),
          denied("role"),
        ]);
        yield* releaseBy(fixture, entered.id);
        const reentry = yield* draft(fixture, classId, student, 95).pipe(
          Effect.flip
        );
        expect(reentry).toMatchObject({
          _tag: "GradeReleased",
          code: "GRADE_RELEASED",
        });
      })
  );
});

describe("records/grades reads by a student", () => {
  it.effect(
    "lets a student read their own released grade, and nothing of a classmate",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { classId, cohortId } = yield* setup(fixture);
        const mate = yield* classmate(fixture, cohortId);
        const own = yield* draft(
          fixture,
          classId,
          fixture.people.student.personId,
          70
        );
        yield* draft(fixture, classId, mate, 40);
        expect(
          yield* fixture.as("student").query(mine, { classId, slug: nf })
        ).toEqual([]);
        yield* releaseBy(fixture, own.id);
        const readOwn = yield* fixture
          .as("student")
          .query(mine, { classId, slug: nf });
        expect(readOwn).toMatchObject([
          { id: own.id, state: "released", value: 70 },
        ]);
        expect(
          yield* fixture.as("teacher").query(mine, { classId, slug: nf })
        ).toEqual([]);
      })
  );

  it.effect("refuses a student the grades of a class in another cohort", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { periodId } = yield* setup(fixture);
      const x2 = yield* cohort(fixture, periodId, "X-2");
      const other = yield* classOf(fixture, x2.id, "Fisika");
      const refused = yield* fixture
        .as("student")
        .query(mine, { classId: other.id, slug: nf })
        .pipe(Effect.flip);
      expect(refused).toMatchObject(denied("role"));
    })
  );
});

describe("records/grades tenant isolation", () => {
  it.effect("refuses a class and a grade of another school by their IDs", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const foreign = yield* fixture.run(
        Effect.gen(function* () {
          const writer = yield* DatabaseWriter;
          const periodId = yield* writer.table("tenantPeriods").insert({
            end: "2026-12-19",
            name: "Asing",
            start: "2026-07-13",
            status: "planned",
            tenantId: fixture.tenants.other,
            unitId: fixture.units.sd,
          });
          const cohortId = yield* writer.table("tenantCohorts").insert({
            grade: 1,
            name: "1A",
            nameKey: "1a",
            periodId,
            status: "active",
            tenantId: fixture.tenants.other,
            unitId: fixture.units.sd,
          });
          const classId = yield* writer.table("classes").insert({
            cohortId,
            createdAt: 0,
            name: "Asing 1A",
            nameKey: "asing 1a",
            periodId,
            slug: "asing-1a",
            status: "active",
            subjectKey: "",
            tenantId: fixture.tenants.other,
            unitId: fixture.units.sd,
            updatedAt: 0,
          });
          const schemeId = yield* writer.table("gradingSchemes").insert({
            bands: [],
            effectiveFrom: 0,
            kktp: 75,
            tenantId: fixture.tenants.other,
          });
          const gradeId = yield* writer.table("classGrades").insert({
            classId,
            createdAt: 0,
            periodId,
            personId: fixture.people.otherOwner.personId,
            schemeId,
            state: "draft",
            tenantId: fixture.tenants.other,
            updatedAt: 0,
            value: 50,
          });
          return { classId, gradeId };
        })
      );
      const failures = yield* Effect.all([
        fixture
          .as("admin")
          .mutation(enter, {
            classId: foreign.classId,
            personId: fixture.people.student.personId,
            slug: nf,
            value: 60,
          })
          .pipe(Effect.flip),
        fixture
          .as("admin")
          .mutation(release, { gradeId: foreign.gradeId, slug: nf })
          .pipe(Effect.flip),
        fixture
          .as("admin")
          .query(sheet, { ...firstPage, classId: foreign.classId, slug: nf })
          .pipe(Effect.flip),
        fixture
          .as("admin")
          .query(mine, { classId: foreign.classId, slug: nf })
          .pipe(Effect.flip),
      ]);
      expect(failures).toMatchObject([
        denied("resource"),
        denied("resource"),
        denied("resource"),
        denied("resource"),
      ]);
    })
  );
});

describe("records/grades version rules", () => {
  it.effect(
    "judges a grade by the scheme in force at its entry, and keeps that scheme after a newer one takes effect",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { classId, cohortId } = yield* setup(fixture);
        yield* storeScheme(fixture, 1, 60, [
          { label: "Cukup", minimum: 60 },
          { label: "Baik", minimum: 80 },
        ]);
        const mate = yield* classmate(fixture, cohortId);
        const first = yield* draft(
          fixture,
          classId,
          fixture.people.student.personId,
          65
        );
        expect(first).toMatchObject({ band: "Cukup", kktp: "reached" });
        yield* storeScheme(fixture, 2, 70, []);
        const second = yield* draft(fixture, classId, mate, 65);
        expect(second).toMatchObject({ kktp: "notReached" });
        expect(second).not.toHaveProperty("band");
        const released = yield* releaseBy(fixture, first.id);
        expect(released).toMatchObject({ band: "Cukup", kktp: "reached" });
      })
  );

  it.effect(
    "judges a grade by the built-in version it names, which a version stored later leaves alone",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { classId, cohortId } = yield* setup(fixture);
        const mate = yield* classmate(fixture, cohortId);
        const first = yield* draft(
          fixture,
          classId,
          fixture.people.student.personId,
          80
        );
        expect(first).toMatchObject({ kktp: "reached" });
        yield* storeScheme(fixture, 1, 90, []);
        const second = yield* draft(fixture, classId, mate, 80);
        expect(second).toMatchObject({ kktp: "notReached" });
        const released = yield* releaseBy(fixture, first.id);
        expect(released).toMatchObject({ kktp: "reached" });
      })
  );
});
