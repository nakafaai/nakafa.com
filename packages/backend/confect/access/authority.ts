import { MiddlewareImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Grant, GrantAccess } from "@repo/backend/confect/access/access";
import { grant } from "@repo/backend/confect/access/kinds";
import { Authority } from "@repo/backend/confect/access/policy";
import { GrantScope } from "@repo/backend/confect/access/schema";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import { Effect } from "effect";

/** An ended grant is locked; a unit grant belongs to its unit. */
export const grantAuthority = Authority.make(grant, Authority.load(grant), {
  place: (row) =>
    Effect.succeed({
      locked: row.status !== "active",
      units: GrantScope.match(row.scope, {
        tenant: () => [],
        unit: ({ unitId }) => [unitId],
      }),
    }),
  relations: {
    holder: (row, member) => Effect.succeed(row.personId === member.person._id),
  },
  tenantOf: (row) => row.tenantId,
});

export const grantAccess = MiddlewareImpl.make(
  databaseSchema,
  GrantAccess,
  grantAuthority.middleware(Grant)
);

/** Decides a tenant-level action on the member's own tenant. */
export const tenantAccess = MiddlewareImpl.make(
  databaseSchema,
  TenantAccess,
  Effect.fn("access.tenant")(function* (effect, { options }) {
    yield* tenantAuthority.check(options.action, (yield* Member).tenant);
    return yield* effect;
  })
);
