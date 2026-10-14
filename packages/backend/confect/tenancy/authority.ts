import type { GenericId } from "@confect/core";
import { MiddlewareImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Authority, activeGrants } from "@repo/backend/confect/access/policy";
import { GrantScope } from "@repo/backend/confect/access/schema";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import {
  Cohort,
  CohortAccess,
  Period,
  PeriodAccess,
  Person,
  PersonAccess,
} from "@repo/backend/confect/tenancy/access";
import {
  cohort,
  period,
  person,
  tenant,
  unit,
} from "@repo/backend/confect/tenancy/kinds";
import { Array as Arr, Effect, Option, pipe } from "effect";

/** Every active member Person; operator Persons act only through their audited grants. */
const membership = (_subject: unknown, member: Member["Service"]) =>
  Effect.succeed(member.person.kind === "member");

/** The member's tenant is the subject of every tenant-level action. */
export const tenantAuthority = Authority.make(tenant, Authority.load(tenant), {
  place: () => Effect.succeed({ locked: false, units: [] }),
  relations: { member: membership },
  tenantOf: (row) => row._id,
});

/** An archived unit is locked; unit grants cover it. */
export const unitAuthority = Authority.make(unit, Authority.load(unit), {
  place: (row) =>
    Effect.succeed({ locked: row.status === "archived", units: [row._id] }),
  relations: { member: membership },
  tenantOf: (row) => row.tenantId,
});

/** Reads one school by ID, for a subject whose lock depends on it. */
const readUnit = Effect.fnUntraced(function* (
  unitId: GenericId.GenericId<"tenantUnits">
) {
  return yield* (yield* DatabaseReader)
    .table("tenantUnits")
    .get(unitId)
    .pipe(Effect.orDie);
});

/** Reads one period by ID, for a subject whose lock depends on it. */
const readPeriod = Effect.fnUntraced(function* (
  periodId: GenericId.GenericId<"tenantPeriods">
) {
  return yield* (yield* DatabaseReader)
    .table("tenantPeriods")
    .get(periodId)
    .pipe(Effect.orDie);
});

/**
 * The placement of one Person in one period, if any. A Person holds at most one
 * per period, so the lookup is one indexed read.
 */
export const placementOf = Effect.fn("tenancy.authority.placementOf")(
  function* (
    periodId: GenericId.GenericId<"tenantPeriods">,
    personId: GenericId.GenericId<"tenantPeople">
  ) {
    return yield* (yield* DatabaseReader)
      .table("tenantCohortMembers")
      .get("by_periodId_and_personId", periodId, personId)
      .pipe(
        Effect.asSome,
        Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
        Effect.orDie
      );
  }
);

/**
 * Whether one Person holds an active student grant that covers a unit. A cohort
 * holds only the students of its own unit, so a placement checks this first.
 */
export const studentOf = Effect.fn("tenancy.authority.studentOf")(function* (
  personId: GenericId.GenericId<"tenantPeople">,
  unitId: GenericId.GenericId<"tenantUnits">
) {
  const grants = yield* activeGrants(personId);
  return Arr.some(
    grants,
    (grant) =>
      grant.role.key === "student" &&
      GrantScope.match(grant.scope, {
        tenant: () => true,
        unit: (scope) => scope.unitId === unitId,
      })
  );
});

/**
 * A period is locked once it is archived, and so is every period of an archived
 * school. Its school's grants cover it.
 */
export const periodAuthority = Authority.make(period, Authority.load(period), {
  place: (row) =>
    readUnit(row.unitId).pipe(
      Effect.map((parent) => ({
        locked: row.status === "archived" || parent.status === "archived",
        units: [row.unitId],
      }))
    ),
  relations: {},
  tenantOf: (row) => row.tenantId,
});

/**
 * A cohort is locked once it, its period, or its school is archived. A Person
 * holds the `cohortMember` relation to the cohort their placement names in the
 * cohort's period, and nothing more.
 */
export const cohortAuthority = Authority.make(cohort, Authority.load(cohort), {
  place: (row) =>
    Effect.all({
      parent: readUnit(row.unitId),
      term: readPeriod(row.periodId),
    }).pipe(
      Effect.map(({ parent, term }) => ({
        locked:
          row.status === "archived" ||
          term.status === "archived" ||
          parent.status === "archived",
        units: [row.unitId],
      }))
    ),
  relations: {
    cohortMember: (row, member) =>
      placementOf(row.periodId, member.person._id).pipe(
        Effect.map((placement) =>
          Option.exists(placement, (found) => found.cohortId === row._id)
        )
      ),
  },
  tenantOf: (row) => row.tenantId,
});

/** A Person belongs to every unit where they hold an active grant. */
export const personAuthority = Authority.make(person, Authority.load(person), {
  place: (row) =>
    activeGrants(row._id).pipe(
      Effect.map((grants) => ({
        locked: row.status !== "active",
        units: pipe(
          grants,
          Arr.map((grant) => grant.scope),
          Arr.filter(GrantScope.guards.unit),
          Arr.map((scope) => scope.unitId)
        ),
      }))
    ),
  relations: {
    self: (row, member) => Effect.succeed(row._id === member.person._id),
  },
  tenantOf: (row) => row.tenantId,
});

export const personAccess = MiddlewareImpl.make(
  databaseSchema,
  PersonAccess,
  personAuthority.middleware(Person)
);

export const periodAccess = MiddlewareImpl.make(
  databaseSchema,
  PeriodAccess,
  periodAuthority.middleware(Period)
);

export const cohortAccess = MiddlewareImpl.make(
  databaseSchema,
  CohortAccess,
  cohortAuthority.middleware(Cohort)
);
