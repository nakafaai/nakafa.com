import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { PERSON_PLACEMENT_LIMIT } from "@repo/backend/confect/tenancy/placement";
import {
  grantRole,
  journal,
  slugOf,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const { place, move } = refs.public.tenancy.placements;
const { members, rename, create } = refs.public.tenancy.cohorts;
const periods = refs.public.tenancy.periods;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const firstPage = { paginationOpts: { cursor: null, numItems: 10 } };

type Fixture = Effect.Success<typeof tenancyFixture>;

/** Creates the SMA period of the fixture, planned, and returns the period the mutation made. */
const sma = (fixture: Fixture) =>
  fixture.as("admin").mutation(periods.create, {
    end: "2026-12-19",
    name: "Ganjil 2026/2027",
    slug: nf,
    start: "2026-07-13",
    unitId: fixture.units.sma,
  });

/** Creates one cohort of a period as the school's Admin. */
const cohort = (
  fixture: Fixture,
  periodId: GenericId.GenericId<"tenantPeriods">,
  name: string
) =>
  fixture.as("admin").mutation(create, { grade: 7, name, periodId, slug: nf });

/** Enrols the fixture's student in the SMA unit, so a cohort of that unit may hold them. */
const enrolInSma = (fixture: Fixture) =>
  fixture.run(
    grantRole(fixture.tenants.nf, fixture.people.student.personId, "student", {
      kind: "unit",
      unitId: fixture.units.sma,
    })
  );

describe("tenancy/placements place", () => {
  it.effect("places an active Person in a cohort, and records it", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const period = yield* sma(fixture);
      yield* enrolInSma(fixture);
      const seventhA = yield* cohort(fixture, period.id, "7A");
      const placed = yield* fixture.as("admin").mutation(place, {
        cohortId: seventhA.id,
        personId: fixture.people.student.personId,
        slug: nf,
      });
      expect(placed).toEqual({
        cohortId: seventhA.id,
        periodId: period.id,
        personId: fixture.people.student.personId,
      });
      expect(yield* fixture.run(journal)).toMatchObject([
        { change: { type: "period.created" } },
        { change: { type: "cohort.created" } },
        {
          actor: { id: fixture.people.admin.personId, kind: "person" },
          change: { cohort: seventhA.id, type: "person.placed" },
          subject: { id: fixture.people.student.personId, kind: "person" },
        },
      ]);
    })
  );

  it.effect(
    "refuses a second placement in the same period, and allows one in another",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const seventhA = yield* cohort(fixture, period.id, "7A");
        const seventhB = yield* cohort(fixture, period.id, "7B");
        const student = fixture.people.student.personId;
        yield* enrolInSma(fixture);
        yield* fixture.as("admin").mutation(place, {
          cohortId: seventhA.id,
          personId: student,
          slug: nf,
        });
        const second = yield* fixture
          .as("admin")
          .mutation(place, {
            cohortId: seventhB.id,
            personId: student,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(second).toMatchObject({ _tag: "PersonAlreadyPlaced" });
        const nextPeriod = yield* fixture.as("admin").mutation(periods.create, {
          end: "2027-06-30",
          name: "Genap 2026/2027",
          slug: nf,
          start: "2027-01-04",
          unitId: fixture.units.sma,
        });
        const nextCohort = yield* cohort(fixture, nextPeriod.id, "7A");
        const again = yield* fixture.as("admin").mutation(place, {
          cohortId: nextCohort.id,
          personId: student,
          slug: nf,
        });
        expect(again.periodId).toBe(nextPeriod.id);
      })
  );

  it.effect("refuses a Person past the placements one Person may hold", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const student = fixture.people.student.personId;
      const period = yield* sma(fixture);
      yield* enrolInSma(fixture);
      // Earlier placements are written directly, one per archived period, so the
      // Person already holds the most placements the school allows.
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          Effect.forEach(
            Arr.makeBy(PERSON_PLACEMENT_LIMIT, (index) => index),
            (index) =>
              Effect.gen(function* () {
                const earlier = yield* writer.table("tenantPeriods").insert({
                  end: "2026-12-19",
                  name: `Lama ${index}`,
                  start: "2026-07-13",
                  status: "archived",
                  tenantId: fixture.tenants.nf,
                  unitId: fixture.units.sma,
                });
                const cohortId = yield* writer.table("tenantCohorts").insert({
                  grade: 7,
                  name: `Lama ${index}`,
                  nameKey: `lama ${index}`,
                  periodId: earlier,
                  status: "archived",
                  tenantId: fixture.tenants.nf,
                  unitId: fixture.units.sma,
                });
                yield* writer.table("tenantCohortMembers").insert({
                  cohortId,
                  periodId: earlier,
                  personId: student,
                  tenantId: fixture.tenants.nf,
                });
              }),
            { discard: true }
          )
        )
      );
      const target = yield* cohort(fixture, period.id, "7A");
      const refusal = yield* fixture
        .as("admin")
        .mutation(place, { cohortId: target.id, personId: student, slug: nf })
        .pipe(Effect.flip);
      expect(refusal).toMatchObject({ _tag: "PersonPlacementLimit" });
    })
  );

  it.effect(
    "places a student whose grant covers the whole school, and refuses a teacher of the unit and a student of another unit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const target = yield* cohort(fixture, period.id, "7A");
        yield* fixture.run(
          grantRole(
            fixture.tenants.nf,
            fixture.people.teacher.personId,
            "teacher",
            { kind: "unit", unitId: fixture.units.sma }
          )
        );
        const refusals = yield* Effect.all([
          fixture
            .as("admin")
            .mutation(place, {
              cohortId: target.id,
              personId: fixture.people.teacher.personId,
              slug: nf,
            })
            .pipe(Effect.flip),
          fixture
            .as("admin")
            .mutation(place, {
              cohortId: target.id,
              personId: fixture.people.student.personId,
              slug: nf,
            })
            .pipe(Effect.flip),
        ]);
        yield* fixture.run(
          grantRole(fixture.tenants.nf, fixture.invited, "student", {
            kind: "tenant",
          })
        );
        const placed = yield* fixture.as("admin").mutation(place, {
          cohortId: target.id,
          personId: fixture.invited,
          slug: nf,
        });
        expect(refusals).toMatchObject([
          { _tag: "PersonNotStudent", code: "PERSON_NOT_STUDENT" },
          { _tag: "PersonNotStudent", code: "PERSON_NOT_STUDENT" },
        ]);
        expect(placed.personId).toBe(fixture.invited);
      })
  );

  it.effect(
    "refuses a suspended Person, a Person of another school, and a plan role",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const target = yield* cohort(fixture, period.id, "7A");
        const suspended = yield* fixture
          .as("admin")
          .mutation(place, {
            cohortId: target.id,
            personId: fixture.people.suspended.personId,
            slug: nf,
          })
          .pipe(Effect.flip);
        const foreign = yield* fixture
          .as("admin")
          .mutation(place, {
            cohortId: target.id,
            personId: fixture.people.otherOwner.personId,
            slug: nf,
          })
          .pipe(Effect.flip);
        const byPrincipal = yield* fixture
          .as("principal")
          .mutation(place, {
            cohortId: target.id,
            personId: fixture.people.student.personId,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect([suspended, foreign, byPrincipal]).toMatchObject([
          denied("condition"),
          denied("resource"),
          denied("role"),
        ]);
      })
  );
});

describe("tenancy/placements move", () => {
  it.effect(
    "moves a placed Person to another cohort of the period, and records it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const seventhA = yield* cohort(fixture, period.id, "7A");
        const seventhB = yield* cohort(fixture, period.id, "7B");
        const student = fixture.people.student.personId;
        yield* enrolInSma(fixture);
        yield* fixture.as("admin").mutation(place, {
          cohortId: seventhA.id,
          personId: student,
          slug: nf,
        });
        const moved = yield* fixture.as("admin").mutation(move, {
          cohortId: seventhB.id,
          personId: student,
          slug: nf,
        });
        const again = yield* fixture.as("admin").mutation(move, {
          cohortId: seventhB.id,
          personId: student,
          slug: nf,
        });
        expect([moved.cohortId, again.cohortId]).toEqual([
          seventhB.id,
          seventhB.id,
        ]);
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "period.created" } },
          { change: { type: "cohort.created" } },
          { change: { type: "cohort.created" } },
          { change: { type: "person.placed" } },
          {
            change: {
              from: seventhA.id,
              to: seventhB.id,
              type: "person.moved",
            },
            subject: { id: student, kind: "person" },
          },
        ]);
      })
  );

  it.effect("refuses to move a Person who has no cohort in the period", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const period = yield* sma(fixture);
      const seventhA = yield* cohort(fixture, period.id, "7A");
      const notPlaced = yield* fixture
        .as("admin")
        .mutation(move, {
          cohortId: seventhA.id,
          personId: fixture.people.teacher.personId,
          slug: nf,
        })
        .pipe(Effect.flip);
      expect(notPlaced).toMatchObject({ _tag: "PersonNotPlaced" });
    })
  );

  it.effect(
    "refuses to move a placed Person who holds no student grant over the unit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const seventhA = yield* cohort(fixture, period.id, "7A");
        const seventhB = yield* cohort(fixture, period.id, "7B");
        const teacher = fixture.people.teacher.personId;
        yield* fixture.run(
          grantRole(fixture.tenants.nf, teacher, "teacher", {
            kind: "unit",
            unitId: fixture.units.sma,
          })
        );
        // A placement written directly, as one made before the student rule.
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantCohortMembers").insert({
              cohortId: seventhA.id,
              periodId: period.id,
              personId: teacher,
              tenantId: fixture.tenants.nf,
            })
          )
        );
        const refused = yield* fixture
          .as("admin")
          .mutation(move, { cohortId: seventhB.id, personId: teacher, slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "PersonNotStudent",
          code: "PERSON_NOT_STUDENT",
        });
      })
  );
});

describe("tenancy/placements cohortMember relation", () => {
  it.effect(
    "opens the cohort to the Person placed in it, and to no one else",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const seventhA = yield* cohort(fixture, period.id, "7A");
        const seventhB = yield* cohort(fixture, period.id, "7B");
        yield* enrolInSma(fixture);
        yield* fixture.as("admin").mutation(place, {
          cohortId: seventhA.id,
          personId: fixture.people.student.personId,
          slug: nf,
        });
        const placedReads = yield* fixture
          .as("student")
          .query(members, { ...firstPage, cohortId: seventhA.id, slug: nf });
        expect(Arr.map(placedReads.page, (row) => row.id)).toEqual([
          fixture.people.student.personId,
        ]);
        const otherCohort = yield* fixture
          .as("student")
          .query(members, { ...firstPage, cohortId: seventhB.id, slug: nf })
          .pipe(Effect.flip);
        const renamed = yield* fixture
          .as("student")
          .mutation(rename, { cohortId: seventhA.id, name: "Saya", slug: nf })
          .pipe(Effect.flip);
        const placedSomeoneElse = yield* fixture
          .as("student")
          .mutation(place, {
            cohortId: seventhA.id,
            personId: fixture.people.teacher.personId,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect([otherCohort, renamed, placedSomeoneElse]).toMatchObject([
          denied("role"),
          denied("role"),
          denied("role"),
        ]);
      })
  );

  it.effect(
    "keeps the members of a cohort closed to a Person placed nowhere in it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const seventhA = yield* cohort(fixture, period.id, "7A");
        const teacherReads = yield* fixture
          .as("teacher")
          .query(members, { ...firstPage, cohortId: seventhA.id, slug: nf })
          .pipe(Effect.flip);
        expect(teacherReads).toMatchObject(denied("role"));
      })
  );
});

describe("tenancy/placements owner, unit admin, and tenants", () => {
  it.effect(
    "lets the Owner place a Person, and refuses a unit's Admin, a teacher, and a non-member",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const seventhA = yield* cohort(fixture, period.id, "7A");
        yield* enrolInSma(fixture);
        const owned = yield* fixture.as("owner").mutation(place, {
          cohortId: seventhA.id,
          personId: fixture.people.student.personId,
          slug: nf,
        });
        const unitAdmin = yield* fixture
          .as("unitAdmin")
          .mutation(place, {
            cohortId: seventhA.id,
            personId: fixture.invited,
            slug: nf,
          })
          .pipe(Effect.flip);
        const teacher = yield* fixture
          .as("teacher")
          .mutation(place, {
            cohortId: seventhA.id,
            personId: fixture.invited,
            slug: nf,
          })
          .pipe(Effect.flip);
        const stranger = yield* fixture
          .as("stranger")
          .mutation(place, {
            cohortId: seventhA.id,
            personId: fixture.invited,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(owned).toMatchObject({
          cohortId: seventhA.id,
          periodId: period.id,
          personId: fixture.people.student.personId,
        });
        expect([unitAdmin, teacher, stranger]).toMatchObject([
          denied("role"),
          denied("role"),
          { _tag: "NotMember", code: "NOT_MEMBER" },
        ]);
      })
  );

  it.effect("refuses to place a Person of another school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const period = yield* sma(fixture);
      const seventhA = yield* cohort(fixture, period.id, "7A");
      const refusal = yield* fixture
        .as("admin")
        .mutation(place, {
          cohortId: seventhA.id,
          personId: fixture.people.otherOwner.personId,
          slug: nf,
        })
        .pipe(Effect.flip);
      expect(refusal).toMatchObject(denied("resource"));
    })
  );
});
