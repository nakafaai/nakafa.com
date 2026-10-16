import { Id } from "@repo/backend/confect/_generated/id";
import { Kind } from "@repo/backend/confect/access/kind";
import { GrantScope } from "@repo/backend/confect/access/schema";
import { tenant, unit } from "@repo/backend/confect/tenancy/kinds";
import { Schema } from "effect";

/**
 * One integration client of a school: an app or a system that calls the school
 * API with its own credential. Owners and Admins manage it. Its audited changes
 * hold IDs and enums only, so a client's name never reaches the journal.
 */
export const integration = Kind.make("integration", "integrationClients", {
  actions: {
    "integration.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
    "integration.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
  },
  changes: [
    Schema.Struct({
      client: Id("integrationClients"),
      scope: GrantScope,
      type: Schema.Literal("integration.created"),
    }),
    Schema.Struct({
      client: Id("integrationClients"),
      type: Schema.Literal("integration.rotated"),
    }),
    Schema.Struct({
      client: Id("integrationClients"),
      type: Schema.Literal("integration.revoked"),
    }),
  ],
  published: [],
  relations: [],
});

/**
 * Creating a client is decided on the scope it covers, as a grant is: the
 * tenant for a tenant-wide client, the unit for a unit client.
 */
const tenantIntegrations = Kind.extend(tenant, {
  actions: {
    "integration.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
    "integration.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
  },
  changes: [],
  published: [],
});

const unitIntegrations = Kind.extend(unit, {
  actions: {
    "integration.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
  },
  changes: [],
  published: [],
});

/**
 * The integration module's kinds for the access catalog: the client, and its
 * extensions on the tenant and the unit.
 */
export const integrations = {
  extensions: [tenantIntegrations, unitIntegrations],
  kinds: [integration],
};
