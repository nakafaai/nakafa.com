import { CountryCodeSchema } from "@nakafa/aksara-contracts/country";
import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import { Kind } from "@repo/backend/confect/access/kind";
import { Contract } from "@repo/backend/confect/tenancy/contract";
import { Currency, TimeZone } from "@repo/backend/confect/tenancy/locale";
import { PolicyKey } from "@repo/backend/confect/tenancy/policy";
import { ClaimMethod } from "@repo/backend/confect/tenancy/schema";
import { Schema } from "effect";

/**
 * The tenant itself. Every active member Person reaches the School shell
 * through the `member` relation; operator Persons act only through their
 * audited grants.
 */
export const tenant = Kind.make("tenant", "tenants", {
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
  changes: [
    Schema.Struct({
      contract: Contract,
      type: Schema.Literal("tenant.provisioned"),
    }),
    Schema.Struct({
      country: CountryCodeSchema,
      currency: Currency,
      type: Schema.Literal("tenant.locale.set"),
    }),
    Schema.Struct({
      key: PolicyKey,
      type: Schema.Literal("tenant.policy.set"),
    }),
  ],
  published: [],
  relations: ["member"],
});

/** One school (SD, SMP, SMA) inside a tenant; unit grants cover its subjects. */
export const unit = Kind.make("unit", "tenantUnits", {
  actions: {
    "unit.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
    "unit.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["member"],
      roles: ["admin", "auditor"],
    },
  },
  changes: [
    Schema.Struct({ type: Schema.Literal("unit.created") }),
    Schema.Struct({
      contentLanguage: AppLocaleCodeSchema,
      timeZone: TimeZone,
      type: Schema.Literal("unit.locale.set"),
    }),
    Schema.Struct({ type: Schema.Literal("unit.archived") }),
    Schema.Struct({ type: Schema.Literal("unit.unarchived") }),
  ],
  published: ["unit.created"],
  relations: ["member"],
});

/** A Person: the school's record of someone, claimed by at most one account. */
export const person = Kind.make("person", "tenantPeople", {
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
  published: [
    "person.created",
    "person.claimed",
    "person.released",
    "person.removed",
  ],
  relations: ["self"],
});

export const tenancy = {
  extensions: [],
  kinds: [tenant, unit, person],
} as const;
