import type { GenericId } from "@confect/core";
import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { PaginationOptions } from "convex/server";
import { Array as Arr, Effect, Struct } from "effect";

/**
 * One page of the school's active members who hold an active student grant. The grants are read a
 * page at a time, so a Person with a grant in more than one unit is on the page once for each grant.
 */
export const studentsOf = Effect.fn("tenancy.students.of")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  paginationOpts: PaginationOptions
) {
  const reader = yield* DatabaseReader;
  const grants = yield* reader
    .table("tenantGrants")
    .index("by_tenantId_and_role_key_and_status", (query) =>
      query
        .eq("tenantId", tenantId)
        .eq("role.key", "student")
        .eq("status", "active")
    )
    .paginate(paginationOpts)
    .pipe(Effect.orDie);
  const people = yield* Effect.forEach(
    grants.page,
    (grant) =>
      reader.table("tenantPeople").get(grant.personId).pipe(Effect.orDie),
    { concurrency: "unbounded" }
  );
  const students: readonly TenantPeopleDoc[] = Arr.filter(
    people,
    (person) => person.status === "active" && person.kind === "member"
  );
  return Struct.assign(grants, { page: students });
});
