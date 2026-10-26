import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { PaginationOptions } from "convex/server";
import { Effect, Option, Struct } from "effect";

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

/**
 * Whether an account belongs to a school: it holds an active or a suspended member
 * Person in any tenant. An operator Person and a removed member do not count. A
 * school member has no public profile (K15, ADR 0009).
 */
export const belongsToSchool = Effect.fn("tenancy.members.belongs")(function* (
  userId: GenericId.GenericId<"users">
) {
  const people = (yield* DatabaseReader).table("tenantPeople");
  const [active, suspended] = yield* Effect.all(
    [
      people
        .index("by_account_userId_and_kind_and_status", (query) =>
          query
            .eq("account.userId", userId)
            .eq("kind", "member")
            .eq("status", "active")
        )
        .first(),
      people
        .index("by_account_userId_and_kind_and_status", (query) =>
          query
            .eq("account.userId", userId)
            .eq("kind", "member")
            .eq("status", "suspended")
        )
        .first(),
    ],
    { concurrency: "unbounded" }
  ).pipe(Effect.orDie);
  return Option.isSome(active) || Option.isSome(suspended);
});
