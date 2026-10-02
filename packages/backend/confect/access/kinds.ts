import { Id } from "@repo/backend/confect/_generated/id";
import { Kind } from "@repo/backend/confect/access/kind";
import {
  GrantEndReason,
  GrantScope,
  GrantTerm,
  RoleRef,
} from "@repo/backend/confect/access/schema";
import { person, tenant, unit } from "@repo/backend/confect/tenancy/kinds";
import { Schema } from "effect";

/**
 * One role a Person holds; its holder may always see it. Ending it is decided
 * on the grant itself, covered by its unit, so a grant in an archived unit
 * can still be ended: only the grant's own status locks it.
 */
export const grant = Kind.make("grant", "tenantGrants", {
  actions: {
    "grant.revoke": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
    "grant.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["holder"],
      roles: ["admin", "principal", "auditor"],
    },
  },
  changes: [],
  published: [],
  relations: ["holder"],
});

/**
 * Giving a role (`grant.manage`) is evaluated on the scope the new grant
 * covers: the tenant for tenant-wide roles, the unit for unit roles.
 * `owner.manage` additionally gates giving or ending every Owner and Admin
 * grant and belongs to Owners alone.
 */
export const tenantGrants = Kind.extend(tenant, {
  actions: {
    "grant.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
    "owner.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: [],
    },
  },
  changes: [],
  published: [],
});

export const unitGrants = Kind.extend(unit, {
  actions: {
    "grant.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
  },
  changes: [],
  published: [],
});

/** Grant changes are filed under the Person who holds the grant. */
export const personGrants = Kind.extend(person, {
  actions: {},
  changes: [
    Schema.Struct({
      grant: Id("tenantGrants"),
      role: RoleRef,
      scope: GrantScope,
      term: GrantTerm,
      type: Schema.Literal("grant.created"),
    }),
    Schema.Struct({
      grant: Id("tenantGrants"),
      reason: GrantEndReason,
      type: Schema.Literal("grant.ended"),
    }),
  ],
  published: ["grant.created", "grant.ended"],
});

export const access = {
  extensions: [tenantGrants, unitGrants, personGrants],
  kinds: [grant],
} as const;
