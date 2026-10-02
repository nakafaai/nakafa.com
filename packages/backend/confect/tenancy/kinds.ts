import { Id } from "@repo/backend/confect/_generated/id";
import { Kind } from "@repo/backend/confect/access/kind";
import { ClaimMethod } from "@repo/backend/confect/tenancy/schema";
import { Schema } from "effect";

/**
 * The tenant itself. Every active member Person reaches the School shell
 * through the `member` relation; operator Persons act only through their
 * audited grants.
 */
export const tenant = Kind.root({
  actions: {
    "audit.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: ["admin", "principal", "auditor"],
    },
    "tenant.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
    "tenant.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["member"],
      roles: ["admin", "auditor"],
    },
  },
  changes: [Schema.Struct({ type: Schema.Literal("tenant.provisioned") })],
  name: "tenant",
  published: [],
  relations: ["member"],
  table: "tenants",
});

/** One school (SD, SMP, SMA) inside a tenant; unit grants cover its subjects. */
export const unit = Kind.object({
  actions: {
    "unit.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["member"],
      roles: ["admin", "auditor"],
    },
  },
  changes: [Schema.Struct({ type: Schema.Literal("unit.created") })],
  name: "unit",
  published: ["unit.created"],
  relations: ["member"],
  table: "tenantUnits",
});

/** A Person: the school's record of someone, claimed by at most one account. */
export const person = Kind.object({
  actions: {
    "person.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["self"],
      roles: ["admin", "principal", "deputy", "counselor", "staff", "auditor"],
    },
  },
  changes: [
    Schema.Struct({ type: Schema.Literal("person.created") }),
    Schema.Struct({
      invite: Id("tenantInvites"),
      type: Schema.Literal("person.invited"),
    }),
    Schema.Struct({
      method: ClaimMethod,
      type: Schema.Literal("person.claimed"),
    }),
    Schema.Struct({ type: Schema.Literal("person.released") }),
    Schema.Struct({ type: Schema.Literal("person.removed") }),
  ],
  name: "person",
  published: [
    "person.created",
    "person.claimed",
    "person.released",
    "person.removed",
  ],
  relations: ["self"],
  table: "tenantPeople",
});

export const tenancy = {
  extensions: [],
  kinds: [tenant, unit, person],
} as const;
