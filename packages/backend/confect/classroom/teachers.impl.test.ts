import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { CLASS_LIMIT } from "@repo/backend/confect/classroom/class";
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
import { Array as Arr, Effect } from "effect";

const { archive, get } = refs.public.classroom.classes;
const { assign, remove, list } = refs.public.classroom.teachers;

describe("classroom/teachers assign", () => {
  it.effect(
    "assigns a teacher of the class's unit, lists them, and journals it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        const taught = yield* teach(
          fixture,
          fisika.id,
          fixture.people.teacher.personId
        );
        const listed = yield* fixture
          .as("admin")
          .query(list, { ...firstPage, classId: fisika.id, slug: nf });
        expect(taught).toEqual({
          id: fixture.people.teacher.personId,
          name: "Teacher",
        });
        expect(listed.page).toEqual([taught]);
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "period.created" } },
          { change: { type: "cohort.created" } },
          { change: { type: "class.created" } },
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: {
              teacher: fixture.people.teacher.personId,
              type: "class.teacherAssigned",
            },
            subject: { id: fisika.id, kind: "class" },
          },
        ]);
      })
  );

  it.effect(
    "answers a repeat assignment as it stands, and journals nothing new",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        const first = yield* teach(
          fixture,
          fisika.id,
          fixture.people.teacher.personId
        );
        const before = yield* fixture.run(journal);
        const again = yield* teach(
          fixture,
          fisika.id,
          fixture.people.teacher.personId
        );
        expect(again).toEqual(first);
        expect(yield* fixture.run(journal)).toEqual(before);
      })
  );

  it.effect(
    "refuses a Person with no teacher grant over the class's unit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        const byStudent = yield* teach(
          fixture,
          fisika.id,
          fixture.people.student.personId
        ).pipe(Effect.flip);
        const byPrincipal = yield* teach(
          fixture,
          fisika.id,
          fixture.people.principal.personId
        ).pipe(Effect.flip);
        expect([byStudent, byPrincipal]).toMatchObject([
          { _tag: "PersonNotTeacher", code: "PERSON_NOT_TEACHER" },
          { _tag: "PersonNotTeacher", code: "PERSON_NOT_TEACHER" },
        ]);
      })
  );

  it.effect(
    "refuses a teacher of another unit, and accepts a teacher of the whole school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.sma);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const sma = yield* classOf(fixture, x1.id, "Fisika");
        const otherUnit = yield* teach(
          fixture,
          sma.id,
          fixture.people.teacher.personId
        ).pipe(Effect.flip);
        yield* fixture.run(
          grantRole(fixture.tenants.nf, fixture.invited, "teacher", {
            kind: "tenant",
          })
        );
        const wholeSchool = yield* teach(fixture, sma.id, fixture.invited);
        expect(otherUnit).toMatchObject({ _tag: "PersonNotTeacher" });
        expect(wholeSchool).toEqual({
          id: fixture.invited,
          name: "Invited",
        });
      })
  );

  it.effect("refuses a Person of another school, and a suspended teacher", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const term = yield* period(fixture, fixture.units.smp);
      const x1 = yield* cohort(fixture, term.id, "X-1");
      const fisika = yield* classOf(fixture, x1.id, "Fisika");
      const foreign = yield* teach(
        fixture,
        fisika.id,
        fixture.people.otherOwner.personId
      ).pipe(Effect.flip);
      const suspended = yield* teach(
        fixture,
        fisika.id,
        fixture.people.suspended.personId
      ).pipe(Effect.flip);
      expect([foreign, suspended]).toMatchObject([
        denied("resource"),
        denied("condition"),
      ]);
    })
  );

  it.effect(
    "refuses a teacher who already teaches the most classes of the period",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const other = yield* classOf(fixture, x1.id, "Kimia");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            Effect.forEach(
              Arr.makeBy(CLASS_LIMIT, (index) => index),
              () =>
                writer.table("classTeachers").insert({
                  classId: other.id,
                  createdAt: 0,
                  periodId: term.id,
                  personId: fixture.people.teacher.personId,
                  tenantId: fixture.tenants.nf,
                }),
              { discard: true }
            )
          )
        );
        const refusal = yield* teach(
          fixture,
          fisika.id,
          fixture.people.teacher.personId
        ).pipe(Effect.flip);
        expect(refusal).toMatchObject({
          _tag: "PersonClassLimit",
          code: "PERSON_CLASS_LIMIT",
        });
      })
  );

  it.effect(
    "refuses assignments by a school leader or by the class's own teacher, and to an archived class",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        yield* teach(fixture, fisika.id, fixture.people.teacher.personId);
        const byPrincipal = yield* fixture
          .as("principal")
          .mutation(assign, {
            classId: fisika.id,
            personId: fixture.people.student.personId,
            slug: nf,
          })
          .pipe(Effect.flip);
        const byTeacher = yield* fixture
          .as("teacher")
          .mutation(assign, {
            classId: fisika.id,
            personId: fixture.people.student.personId,
            slug: nf,
          })
          .pipe(Effect.flip);
        yield* fixture
          .as("admin")
          .mutation(archive, { classId: fisika.id, slug: nf });
        const archivedRefusal = yield* teach(
          fixture,
          fisika.id,
          fixture.people.teacher.personId
        ).pipe(Effect.flip);
        expect([byPrincipal, byTeacher, archivedRefusal]).toMatchObject([
          denied("role"),
          denied("role"),
          denied("condition"),
        ]);
      })
  );
});

describe("classroom/teachers remove", () => {
  it.effect(
    "ends a teaching, journals it, answers a repeat as it stands, and ends the teacher's reading",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        yield* teach(fixture, fisika.id, fixture.people.teacher.personId);
        const readBefore = yield* fixture
          .as("teacher")
          .query(get, { classId: fisika.id, slug: nf });
        const removed = yield* fixture.as("admin").mutation(remove, {
          classId: fisika.id,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        const again = yield* fixture.as("admin").mutation(remove, {
          classId: fisika.id,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        const readAfter = yield* fixture
          .as("teacher")
          .query(get, { classId: fisika.id, slug: nf })
          .pipe(Effect.flip);
        expect(readBefore.id).toBe(fisika.id);
        expect([removed, again]).toEqual([
          { id: fixture.people.teacher.personId },
          { id: fixture.people.teacher.personId },
        ]);
        expect(readAfter).toMatchObject(denied("role"));
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "period.created" } },
          { change: { type: "cohort.created" } },
          { change: { type: "class.created" } },
          { change: { type: "class.teacherAssigned" } },
          {
            change: {
              teacher: fixture.people.teacher.personId,
              type: "class.teacherRemoved",
            },
            subject: { id: fisika.id },
          },
        ]);
      })
  );

  it.effect("answers a removal of a Person who never taught as nothing", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const term = yield* period(fixture, fixture.units.smp);
      const x1 = yield* cohort(fixture, term.id, "X-1");
      const fisika = yield* classOf(fixture, x1.id, "Fisika");
      const before = yield* fixture.run(journal);
      const answer = yield* fixture.as("admin").mutation(remove, {
        classId: fisika.id,
        personId: fixture.people.teacher.personId,
        slug: nf,
      });
      expect(answer).toEqual({ id: fixture.people.teacher.personId });
      expect(yield* fixture.run(journal)).toEqual(before);
    })
  );
});

describe("classroom/teachers read", () => {
  it.effect(
    "lets the subject teacher read their class, and refuses an unplaced student of its unit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        yield* teach(fixture, fisika.id, fixture.people.teacher.personId);
        const read = yield* fixture
          .as("teacher")
          .query(get, { classId: fisika.id, slug: nf });
        const refused = yield* fixture
          .as("student")
          .query(get, { classId: fisika.id, slug: nf })
          .pipe(Effect.flip);
        expect(read.id).toBe(fisika.id);
        expect(refused).toMatchObject(denied("role"));
      })
  );

  it.effect("lists a class's teachers a page at a time", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const term = yield* period(fixture, fixture.units.smp);
      const x1 = yield* cohort(fixture, term.id, "X-1");
      const fisika = yield* classOf(fixture, x1.id, "Fisika");
      yield* fixture.run(
        grantRole(fixture.tenants.nf, fixture.invited, "teacher", {
          kind: "tenant",
        })
      );
      yield* teach(fixture, fisika.id, fixture.people.teacher.personId);
      yield* teach(fixture, fisika.id, fixture.invited);
      const firstOfTwo = yield* fixture.as("admin").query(list, {
        paginationOpts: { cursor: null, numItems: 1 },
        classId: fisika.id,
        slug: nf,
      });
      const all = yield* fixture
        .as("admin")
        .query(list, { ...firstPage, classId: fisika.id, slug: nf });
      expect(firstOfTwo.page).toHaveLength(1);
      expect(firstOfTwo.isDone).toBe(false);
      expect(Arr.map(all.page, (row) => row.name)).toEqual(
        expect.arrayContaining(["Invited", "Teacher"])
      );
      expect(all.page).toHaveLength(2);
    })
  );

  it.effect(
    "refuses every teaching function on a class of another school, by its ID",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const foreignClass = yield* fixture.run(
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
            return yield* writer.table("classes").insert({
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
          })
        );
        const failures = yield* Effect.all([
          fixture
            .as("admin")
            .mutation(assign, {
              classId: foreignClass,
              personId: fixture.people.teacher.personId,
              slug: nf,
            })
            .pipe(Effect.flip),
          fixture
            .as("admin")
            .mutation(remove, {
              classId: foreignClass,
              personId: fixture.people.teacher.personId,
              slug: nf,
            })
            .pipe(Effect.flip),
          fixture
            .as("admin")
            .query(list, {
              ...firstPage,
              classId: foreignClass,
              slug: nf,
            })
            .pipe(Effect.flip),
        ]);
        expect(failures).toMatchObject([
          denied("resource"),
          denied("resource"),
          denied("resource"),
        ]);
      })
  );
});
