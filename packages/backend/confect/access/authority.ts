import { MiddlewareImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Grant, GrantAccess } from "@repo/backend/confect/access/access";
import { grant } from "@repo/backend/confect/access/kinds";
import { Authority } from "@repo/backend/confect/access/policy";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import { Effect } from "effect";

/** An ended grant is locked; a unit grant belongs to its unit. */
export const grantAuthority = Authority.make(grant, {
  place: (row) =>
    Effect.succeed({
      locked: row.status !== "active",
      units: row.scope.kind === "unit" ? [row.scope.unitId] : [],
    }),
  relations: {
    holder: (row, member) => Effect.succeed(row.personId === member.person._id),
  },
  tenantOf: (row) => row.tenantId,
});

export const accessAuthorities = { grant: grantAuthority } as const;

export const grantAccess = MiddlewareImpl.make(
  databaseSchema,
  GrantAccess,
  Authority.middleware(Grant, grantAuthority)
);

export const tenantAccess = MiddlewareImpl.make(
  databaseSchema,
  TenantAccess,
  Authority.root(tenantAuthority)
);
