import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { PaginationOptions } from "convex/server";
import { Effect, Struct } from "effect";

/**
 * One page of the Persons placed in a cohort. The page follows the placements,
 * and each placement's Person is read once, concurrently, so a page costs one
 * read per placement and no more.
 */
export const cohortMembers = Effect.fn("tenancy.members.cohort")(function* (
  cohortId: GenericId.GenericId<"tenantCohorts">,
  paginationOpts: PaginationOptions
) {
  const reader = yield* DatabaseReader;
  const placements = yield* reader
    .table("tenantCohortMembers")
    .index("by_cohortId_and_personId", (query) =>
      query.eq("cohortId", cohortId)
    )
    .paginate(paginationOpts)
    .pipe(Effect.orDie);
  const people = yield* Effect.forEach(
    placements.page,
    (placement) =>
      reader.table("tenantPeople").get(placement.personId).pipe(Effect.orDie),
    { concurrency: "unbounded" }
  );
  return Struct.assign(placements, { page: people });
});
