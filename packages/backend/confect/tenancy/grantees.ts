import type { GenericId } from "@confect/core";
import type {
  TenantGrantsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { covers } from "@repo/backend/confect/access/decision";
import { activeGrants } from "@repo/backend/confect/access/policy";
import { namedPeople } from "@repo/backend/confect/tenancy/named";
import type { PaginationOptions } from "convex/server";
import { Array as Arr, Effect, Struct } from "effect";

/** Whether a Person is an active member of the school, the only people a picker offers. */
const isActiveMember = (person: TenantPeopleDoc) =>
  person.status === "active" && person.kind === "member";

/**
 * One page of the school's active members who hold an active grant of one role, keeping the
 * grants `holds` accepts. The grants are read a page at a time, so a Person with a grant in
 * more than one unit is on the page once for each grant, and a page may come back short. A
 * search reads the people its words name instead, best match first, so it reaches every page.
 */
const granteesOf = Effect.fn("tenancy.grantees.of")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  role: "student" | "teacher",
  paginationOpts: PaginationOptions,
  holds: (grant: TenantGrantsDoc) => boolean,
  search: string | undefined
) {
  if (search !== undefined) {
    const found = yield* namedPeople(tenantId, search, paginationOpts);
    const named = yield* Effect.filter(
      Arr.filter(found.page, isActiveMember),
      (person) =>
        Effect.map(
          activeGrants(person._id),
          Arr.some((grant) => grant.role.key === role && holds(grant))
        ),
      { concurrency: "unbounded" }
    );
    return Struct.assign(found, { page: named });
  }
  const reader = yield* DatabaseReader;
  const grants = yield* reader
    .table("tenantGrants")
    .index("by_tenantId_and_role_key_and_status", (query) =>
      query.eq("tenantId", tenantId).eq("role.key", role).eq("status", "active")
    )
    .paginate(paginationOpts)
    .pipe(Effect.orDie);
  const people = yield* Effect.forEach(
    Arr.filter(grants.page, holds),
    (grant) =>
      reader.table("tenantPeople").get(grant.personId).pipe(Effect.orDie),
    { concurrency: "unbounded" }
  );
  const grantees: readonly TenantPeopleDoc[] = Arr.filter(
    people,
    isActiveMember
  );
  return Struct.assign(grants, { page: grantees });
});

/** One page of the school's active members who hold an active student grant. */
export const studentsOf = Effect.fn("tenancy.grantees.students")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  paginationOpts: PaginationOptions,
  search?: string
) {
  return yield* granteesOf(
    tenantId,
    "student",
    paginationOpts,
    () => true,
    search
  );
});

/**
 * One page of the active members who teach in a unit: an active teacher grant over the unit,
 * or over the whole school. These are the people a homeroom or a class of the unit accepts.
 */
export const teachersOf = Effect.fn("tenancy.grantees.teachers")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  unitId: GenericId.GenericId<"tenantUnits">,
  paginationOpts: PaginationOptions,
  search?: string
) {
  return yield* granteesOf(
    tenantId,
    "teacher",
    paginationOpts,
    (grant) => covers(grant.scope, [unitId]),
    search
  );
});
