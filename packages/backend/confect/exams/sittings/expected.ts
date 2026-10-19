import type {
  ExamSittingsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { covers } from "@repo/backend/confect/access/decision";
import { mascotOf } from "@repo/backend/confect/exams/sittings/dashboard";
import type { PaginationOptions } from "convex/server";
import { Array as Arr, Effect, Option, Result, Struct } from "effect";

/**
 * The students that a sitting expects, a page at a time, in the order their source reads them. A
 * cohort sitting expects the students placed in its cohort. A unit sitting expects every student
 * whose active student grant covers its unit. A Person who already has an attempt in the sitting is
 * left out, because that attempt is the seat the proctor sees.
 */
export const expectedSeats = Effect.fn("exams.sittings.expected")(function* (
  sitting: ExamSittingsDoc,
  paginationOpts: PaginationOptions
) {
  const source =
    sitting.cohortId === null
      ? yield* unitStudents(sitting, paginationOpts)
      : yield* cohortStudents(sitting.cohortId, paginationOpts);
  const seats = yield* Effect.forEach(
    source.page,
    (personId) => seatOf(sitting, personId),
    { concurrency: "unbounded" }
  );
  return Struct.assign(source, { page: Arr.getSomes(seats) });
});

/** The students a unit sitting expects: one page of the tenant's student grants that cover the unit. */
const unitStudents = Effect.fn("exams.sittings.expected.unit")(function* (
  sitting: ExamSittingsDoc,
  paginationOpts: PaginationOptions
) {
  const grants = yield* (yield* DatabaseReader)
    .table("tenantGrants")
    .index("by_tenantId_and_role_key_and_status", (query) =>
      query
        .eq("tenantId", sitting.tenantId)
        .eq("role.key", "student")
        .eq("status", "active")
    )
    .paginate(paginationOpts)
    .pipe(Effect.orDie);
  return Struct.assign(grants, {
    page: Arr.filterMap(grants.page, (grant) =>
      covers(grant.scope, [sitting.unitId])
        ? Result.succeed(grant.personId)
        : Result.failVoid
    ),
  });
});

/** The students a cohort sitting expects: one page of the students placed in its cohort. */
const cohortStudents = Effect.fn("exams.sittings.expected.cohort")(function* (
  cohortId: NonNullable<ExamSittingsDoc["cohortId"]>,
  paginationOpts: PaginationOptions
) {
  const placed = yield* (yield* DatabaseReader)
    .table("tenantCohortMembers")
    .index("by_cohortId_and_personId", (query) =>
      query.eq("cohortId", cohortId)
    )
    .paginate(paginationOpts)
    .pipe(Effect.orDie);
  return Struct.assign(placed, {
    page: Arr.map(placed.page, (member) => member.personId),
  });
});

/**
 * The seat of one expected student, or none: a student who is not an active member, or who has an
 * attempt in the sitting already, expects no seat.
 */
const seatOf = Effect.fn("exams.sittings.expected.seat")(function* (
  sitting: ExamSittingsDoc,
  personId: TenantPeopleDoc["_id"]
) {
  const reader = yield* DatabaseReader;
  const person = yield* reader
    .table("tenantPeople")
    .get(personId)
    .pipe(Effect.orDie);
  if (person.kind !== "member" || person.status !== "active") {
    return Option.none();
  }
  const attempt = yield* reader
    .table("examAttempts")
    .index("by_sittingId_and_personId", (query) =>
      query.eq("sitting", sitting._id).eq("person", person._id)
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(attempt)) {
    return Option.none();
  }
  return Option.some({
    id: person._id,
    mascot: yield* mascotOf(person),
    name: person.name,
  });
});
