import { MiddlewareImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Authority, activeGrants } from "@repo/backend/confect/access/policy";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Person, PersonAccess } from "@repo/backend/confect/tenancy/access";
import { person, tenant, unit } from "@repo/backend/confect/tenancy/kinds";
import { Effect } from "effect";

/** Member Persons only; operator Persons act through their audited grants. */
const memberOf = (_row: unknown, member: Member["Service"]) =>
  Effect.succeed(member.person.kind === "member");

export const tenantAuthority = Authority.make(tenant, {
  place: () => Effect.succeed({ locked: false, units: [] }),
  relations: { member: memberOf },
  tenantOf: (row) => row._id,
});

export const unitAuthority = Authority.make(unit, {
  place: (row) =>
    Effect.succeed({ locked: row.status === "archived", units: [row._id] }),
  relations: { member: memberOf },
  tenantOf: (row) => row.tenantId,
});

/** A Person belongs to every unit where they hold an active grant. */
export const personAuthority = Authority.make(person, {
  place: (row) =>
    activeGrants(row._id).pipe(
      Effect.map((grants) => ({
        locked: row.status !== "active",
        units: grants.flatMap((grant) =>
          grant.scope.kind === "unit" ? [grant.scope.unitId] : []
        ),
      }))
    ),
  relations: {
    self: (row, member) => Effect.succeed(row._id === member.person._id),
  },
  tenantOf: (row) => row.tenantId,
});

export const tenancyAuthorities = {
  person: personAuthority,
  tenant: tenantAuthority,
  unit: unitAuthority,
} as const;

export const personAccess = MiddlewareImpl.make(
  databaseSchema,
  PersonAccess,
  Authority.middleware(Person, personAuthority)
);
