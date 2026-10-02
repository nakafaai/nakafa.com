import { MiddlewareImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Authority, activeGrants } from "@repo/backend/confect/access/policy";
import { GrantScope } from "@repo/backend/confect/access/schema";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Person, PersonAccess } from "@repo/backend/confect/tenancy/access";
import { person, tenant, unit } from "@repo/backend/confect/tenancy/kinds";
import { Array as Arr, Effect, pipe } from "effect";

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
