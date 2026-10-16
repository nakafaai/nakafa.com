import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { cohortAuthority } from "@repo/backend/confect/tenancy/authority";
import { grantRole, slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const { assign } = refs.public.tenancy.assignments;
const cohorts = refs.public.tenancy.cohorts;
const { members, rename } = refs.public.tenancy.cohorts;
const periods = refs.public.tenancy.periods;
const people = refs.public.tenancy.people;
const { place } = refs.public.tenancy.placements;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const firstPage = { paginationOpts: { cursor: null, numItems: 10 } };

type Fixture = Effect.Success<typeof tenancyFixture>;

/** Creates one planned period of a school as its Admin. */
const plannedPeriod = (
  fixture: Fixture,
  unitId: GenericId.GenericId<"tenantUnits">
) =>
  fixture.as("admin").mutation(periods.create, {
    end: "2026-12-19",
    name: "Ganjil 2026/2027",
    slug: nf,
    start: "2026-07-13",
    unitId,
  });

/** Creates one cohort of a period as the school's Admin. */
const cohort = (
  fixture: Fixture,
  periodId: GenericId.GenericId<"tenantPeriods">,
  name: string
) =>
  fixture
    .as("admin")
    .mutation(cohorts.create, { grade: 7, name, periodId, slug: nf });

/** Enrols the fixture's student in the SMA unit, so a cohort of that unit may hold them. */
const enrolInSma = (fixture: Fixture) =>
  fixture.run(
    grantRole(fixture.tenants.nf, fixture.people.student.personId, "student", {
      kind: "unit",
      unitId: fixture.units.sma,
    })
  );

/** Places one Person in one cohort, as the school's Admin. */
const placeAdmin = (
  fixture: Fixture,
  cohortId: GenericId.GenericId<"tenantCohorts">,
  personId: GenericId.GenericId<"tenantPeople">
) => fixture.as("admin").mutation(place, { cohortId, personId, slug: nf });

/**
 * Whether one Person may view a cohort, as the cohort's own authority decides it. The
 * Person is the caller and holds no role grant, so only the cohort's relations can
 * open the cohort to them.
 */
const mayView = (
  fixture: Fixture,
  cohortId: GenericId.GenericId<"tenantCohorts">,
  personId: GenericId.GenericId<"tenantPeople">
) =>
  fixture.run(
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const row = yield* reader
        .table("tenantCohorts")
        .get(cohortId)
        .pipe(Effect.orDie);
      const person = yield* reader
        .table("tenantPeople")
        .get(personId)
        .pipe(Effect.orDie);
      const tenant = yield* reader
        .table("tenants")
        .get(fixture.tenants.nf)
        .pipe(Effect.orDie);
      return yield* cohortAuthority.check("cohort.view", row).pipe(
        Effect.provideService(Member, { grants: [], person, tenant }),
        Effect.as(true),
        Effect.catchTag("AccessDenied", () => Effect.succeed(false))
      );
    })
  );

describe("tenancy/authority homeroom relation", () => {
  it.effect(
    "opens the cohort to its homeroom teacher, and to no teacher once removed",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* plannedPeriod(fixture, fixture.units.smp);
        const made = yield* cohort(fixture, period.id, "7A");
        const teacher = fixture.people.teacher.personId;
        const before = yield* mayView(fixture, made.id, teacher);
        yield* fixture.as("admin").mutation(assign, {
          cohortId: made.id,
          personId: teacher,
          slug: nf,
        });
        const assigned = yield* mayView(fixture, made.id, teacher);
        yield* fixture
          .as("admin")
          .mutation(people.remove, { personId: teacher, slug: nf });
        const removed = yield* mayView(fixture, made.id, teacher);
        expect([before, assigned, removed]).toEqual([false, true, false]);
      })
  );
});

describe("tenancy/authority cohortMember relation", () => {
  it.effect(
    "opens the cohort to the Person placed in it, and to no one else",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* plannedPeriod(fixture, fixture.units.sma);
        const seventhA = yield* cohort(fixture, period.id, "7A");
        const seventhB = yield* cohort(fixture, period.id, "7B");
        yield* enrolInSma(fixture);
        yield* placeAdmin(
          fixture,
          seventhA.id,
          fixture.people.student.personId
        );
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
        const period = yield* plannedPeriod(fixture, fixture.units.sma);
        const seventhA = yield* cohort(fixture, period.id, "7A");
        const teacherReads = yield* fixture
          .as("teacher")
          .query(members, { ...firstPage, cohortId: seventhA.id, slug: nf })
          .pipe(Effect.flip);
        expect(teacherReads).toMatchObject(denied("role"));
      })
  );
});
