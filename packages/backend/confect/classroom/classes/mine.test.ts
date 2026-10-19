import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  classOf,
  cohort,
  denied,
  nf,
  openPeriod,
  period,
  sdUnit,
  teach,
} from "@repo/backend/test/classroom";
import { grantRole, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Order, pipe } from "effect";

const { archive, get, mine, resolve } = refs.public.classroom.classes;
const grants = refs.public.access.grants;
const periods = refs.public.tenancy.periods;
const placements = refs.public.tenancy.placements;

describe("classroom/classes mine", () => {
  it.effect(
    "lists a student's own active classes of the active period, and nothing to a leader with no class",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        yield* openPeriod(fixture, term.id);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const x2 = yield* cohort(fixture, term.id, "X-2");
        yield* fixture.as("admin").mutation(placements.place, {
          cohortId: x1.id,
          personId: fixture.people.student.personId,
          slug: nf,
        });
        const own = yield* classOf(fixture, x1.id, "Fisika");
        yield* classOf(fixture, x2.id, "Fisika");
        const kimia = yield* classOf(fixture, x1.id, "Kimia");
        yield* fixture
          .as("admin")
          .mutation(archive, { classId: kimia.id, slug: nf });
        const studentView = yield* fixture
          .as("student")
          .query(mine, { slug: nf });
        const adminView = yield* fixture.as("admin").query(mine, { slug: nf });
        expect(Arr.map(studentView, (row) => row.id)).toEqual([own.id]);
        expect(adminView).toEqual([]);
      })
  );

  it.effect(
    "lists a class only while its period is active: not while it is planned, and not once it is archived",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        yield* fixture.as("admin").mutation(placements.place, {
          cohortId: x1.id,
          personId: fixture.people.student.personId,
          slug: nf,
        });
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        const planned = yield* fixture.as("student").query(mine, { slug: nf });
        yield* openPeriod(fixture, term.id);
        const open = yield* fixture.as("student").query(mine, { slug: nf });
        yield* fixture
          .as("admin")
          .mutation(periods.archive, { periodId: term.id, slug: nf });
        const archived = yield* fixture.as("student").query(mine, { slug: nf });
        expect(planned).toEqual([]);
        expect(Arr.map(open, (row) => row.id)).toEqual([fisika.id]);
        expect(archived).toEqual([]);
      })
  );

  it.effect(
    "answers a member of another school with not member, and lists nothing to it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        yield* openPeriod(fixture, term.id);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        yield* classOf(fixture, x1.id, "Fisika");
        const outsider = yield* fixture
          .as("otherOwner")
          .query(mine, { slug: nf })
          .pipe(Effect.flip);
        expect(outsider).toMatchObject({ _tag: "NotMember" });
      })
  );

  it.effect(
    "lists the active classes a teacher teaches in a period, by name",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        yield* openPeriod(fixture, term.id);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        const kimia = yield* classOf(fixture, x1.id, "Kimia");
        yield* teach(fixture, fisika.id, fixture.people.teacher.personId);
        yield* teach(fixture, kimia.id, fixture.people.teacher.personId);
        yield* fixture
          .as("admin")
          .mutation(archive, { classId: kimia.id, slug: nf });
        const taught = yield* fixture.as("teacher").query(mine, { slug: nf });
        expect(Arr.map(taught, (row) => row.name)).toEqual(["Fisika X-1"]);
      })
  );

  it.effect(
    "lists a teacher's classes by name, whatever order they were made in",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        yield* openPeriod(fixture, term.id);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const subjects = [
          "Matematika",
          "Biologi",
          "Kimia",
          "Fisika",
          "Sejarah",
          "Ekonomi",
        ];
        yield* Effect.forEach(
          subjects,
          (subject) =>
            classOf(fixture, x1.id, subject).pipe(
              Effect.flatMap((made) =>
                teach(fixture, made.id, fixture.people.teacher.personId)
              )
            ),
          { discard: true }
        );
        const taught = yield* fixture.as("teacher").query(mine, { slug: nf });
        expect(Arr.map(taught, (row) => row.name)).toEqual([
          "Biologi X-1",
          "Ekonomi X-1",
          "Fisika X-1",
          "Kimia X-1",
          "Matematika X-1",
          "Sejarah X-1",
        ]);
      })
  );

  it.effect(
    "lists the homeroom class of a cohort first, then the classes by name",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { personId } = fixture.people.student;
        const sd = yield* sdUnit(fixture);
        const sdTerm = yield* period(fixture, sd);
        yield* openPeriod(fixture, sdTerm.id);
        const sdCohort = yield* cohort(fixture, sdTerm.id, "X-1");
        yield* classOf(fixture, sdCohort.id);
        yield* fixture.run(
          grantRole(fixture.tenants.nf, personId, "student", {
            kind: "unit",
            unitId: sd,
          })
        );
        yield* fixture.as("admin").mutation(placements.place, {
          cohortId: sdCohort.id,
          personId,
          slug: nf,
        });
        const smpTerm = yield* period(fixture, fixture.units.smp);
        yield* openPeriod(fixture, smpTerm.id);
        const smpCohort = yield* cohort(fixture, smpTerm.id, "X-1");
        yield* classOf(fixture, smpCohort.id, "Fisika");
        yield* fixture.as("admin").mutation(placements.place, {
          cohortId: smpCohort.id,
          personId,
          slug: nf,
        });
        const listed = yield* fixture.as("student").query(mine, { slug: nf });
        expect(Arr.map(listed, (row) => row.name)).toEqual([
          "X-1",
          "Fisika X-1",
        ]);
      })
  );

  it.effect(
    "lists the classes of the active period of every active unit, and not a unit whose period is planned",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { personId } = fixture.people.teacher;
        const smp = yield* period(fixture, fixture.units.smp);
        yield* openPeriod(fixture, smp.id);
        const sma = yield* period(fixture, fixture.units.sma);
        const smpCohort = yield* cohort(fixture, smp.id, "X-1");
        const smaCohort = yield* cohort(fixture, sma.id, "XI-1");
        const fisika = yield* classOf(fixture, smpCohort.id, "Fisika");
        const kimia = yield* classOf(fixture, smaCohort.id, "Kimia");
        yield* fixture.run(
          grantRole(fixture.tenants.nf, personId, "teacher", {
            kind: "unit",
            unitId: fixture.units.sma,
          })
        );
        yield* teach(fixture, fisika.id, personId);
        yield* teach(fixture, kimia.id, personId);
        const planned = yield* fixture.as("teacher").query(mine, { slug: nf });
        yield* openPeriod(fixture, sma.id);
        const both = yield* fixture.as("teacher").query(mine, { slug: nf });
        expect(Arr.map(planned, (row) => row.id)).toEqual([fisika.id]);
        expect(Arr.map(both, (row) => row.id)).toEqual([fisika.id, kimia.id]);
      })
  );

  it.effect(
    "lists two classes of one name from two units in one fixed order, by identity",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { personId } = fixture.people.teacher;
        const smp = yield* period(fixture, fixture.units.smp);
        const sma = yield* period(fixture, fixture.units.sma);
        yield* openPeriod(fixture, smp.id);
        yield* openPeriod(fixture, sma.id);
        const smpCohort = yield* cohort(fixture, smp.id, "X-1");
        const smaCohort = yield* cohort(fixture, sma.id, "X-1");
        const smpFisika = yield* classOf(fixture, smpCohort.id, "Fisika");
        const smaFisika = yield* classOf(fixture, smaCohort.id, "Fisika");
        yield* fixture.run(
          grantRole(fixture.tenants.nf, personId, "teacher", {
            kind: "unit",
            unitId: fixture.units.sma,
          })
        );
        yield* teach(fixture, smpFisika.id, personId);
        yield* teach(fixture, smaFisika.id, personId);
        const listed = yield* fixture.as("teacher").query(mine, { slug: nf });
        expect(Arr.map(listed, (row) => row.name)).toEqual([
          "Fisika X-1",
          "Fisika X-1",
        ]);
        expect(Arr.map(listed, (row) => row.id)).toEqual(
          pipe([smpFisika.id, smaFisika.id], Arr.sort(Order.String))
        );
      })
  );

  it.effect(
    "gives each sidebar entry of two classes of one name the address that resolves to its own class",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { personId } = fixture.people.teacher;
        const smp = yield* period(fixture, fixture.units.smp);
        const sma = yield* period(fixture, fixture.units.sma);
        yield* openPeriod(fixture, smp.id);
        yield* openPeriod(fixture, sma.id);
        const smpCohort = yield* cohort(fixture, smp.id, "X-1");
        const smaCohort = yield* cohort(fixture, sma.id, "X-1");
        const smpFisika = yield* classOf(fixture, smpCohort.id, "Fisika");
        const smaFisika = yield* classOf(fixture, smaCohort.id, "Fisika");
        yield* fixture.run(
          grantRole(fixture.tenants.nf, personId, "teacher", {
            kind: "unit",
            unitId: fixture.units.sma,
          })
        );
        yield* teach(fixture, smpFisika.id, personId);
        yield* teach(fixture, smaFisika.id, personId);
        const listed = yield* fixture.as("teacher").query(mine, { slug: nf });
        const resolved = yield* Effect.forEach(listed, (row) =>
          fixture
            .as("teacher")
            .query(resolve, { classSlug: row.slug, slug: nf })
        );
        expect(Arr.map(resolved, (row) => row.id)).toEqual(
          Arr.map(listed, (row) => row.id)
        );
        expect(
          pipe(
            Arr.map(listed, (row) => row.slug),
            Arr.sort(Order.String)
          )
        ).toEqual(["fisika-x-1", "fisika-x-1-2"]);
      })
  );

  it.effect(
    "lists a class once when its teacher is also placed in its cohort",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        yield* openPeriod(fixture, term.id);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        yield* fixture.run(
          grantRole(
            fixture.tenants.nf,
            fixture.people.teacher.personId,
            "student",
            { kind: "unit", unitId: fixture.units.smp }
          )
        );
        yield* fixture.as("admin").mutation(placements.place, {
          cohortId: x1.id,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        yield* teach(fixture, fisika.id, fixture.people.teacher.personId);
        const listed = yield* fixture.as("teacher").query(mine, { slug: nf });
        expect(Arr.map(listed, (row) => row.id)).toEqual([fisika.id]);
      })
  );

  it.effect(
    "lists a taught class only while the teacher grant over its unit stands",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        yield* openPeriod(fixture, term.id);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        const { grantId, personId } = fixture.people.teacher;
        yield* teach(fixture, fisika.id, personId);
        const before = yield* fixture.as("teacher").query(mine, { slug: nf });
        yield* fixture
          .as("owner")
          .mutation(grants.revoke, { grantId, slug: nf });
        const revoked = yield* fixture.as("teacher").query(mine, { slug: nf });
        const refused = yield* fixture
          .as("teacher")
          .query(get, { classId: fisika.id, slug: nf })
          .pipe(Effect.flip);
        yield* fixture.as("owner").mutation(grants.assign, {
          personId,
          role: "teacher",
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
        });
        const restored = yield* fixture.as("teacher").query(mine, { slug: nf });
        expect(Arr.map(before, (row) => row.id)).toEqual([fisika.id]);
        expect(revoked).toEqual([]);
        expect(refused).toMatchObject(denied("role"));
        expect(Arr.map(restored, (row) => row.id)).toEqual([fisika.id]);
      })
  );
});
