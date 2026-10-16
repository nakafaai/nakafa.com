import { CountryCodeSchema } from "@nakafa/aksara-contracts/country";
import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import { Kind } from "@repo/backend/confect/access/kind";
import type { RuleRole } from "@repo/backend/confect/access/schema";
import { Contract } from "@repo/backend/confect/tenancy/contract";
import { Currency, TimeZone } from "@repo/backend/confect/tenancy/locale";
import { PolicyKey } from "@repo/backend/confect/tenancy/policy";
import {
  ClaimMethod,
  PersonReason,
} from "@repo/backend/confect/tenancy/schema";
import { Schema } from "effect";

/**
 * The school roles and integration clients that read the periods and cohorts
 * of their school. A client holds a read only when its action list names it.
 */
const planReaders: (typeof RuleRole.Type)[] = [
  "admin",
  "principal",
  "deputy",
  "staff",
  "auditor",
  "integration",
];

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
    "person.invite": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
    "person.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
    "person.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["self"],
      roles: [
        "admin",
        "principal",
        "deputy",
        "counselor",
        "staff",
        "auditor",
        "integration",
      ],
    },
  },
  changes: [
    Schema.Struct({ type: Schema.Literal("person.created") }),
    Schema.Struct({
      invite: Id("tenantInvites"),
      reason: Schema.optionalKey(PersonReason),
      type: Schema.Literal("person.invited"),
    }),
    Schema.Struct({
      method: ClaimMethod,
      type: Schema.Literal("person.claimed"),
    }),
    Schema.Struct({ type: Schema.Literal("person.released") }),
    Schema.Struct({
      reason: Schema.optionalKey(PersonReason),
      type: Schema.Literal("person.removed"),
    }),
    Schema.Struct({ type: Schema.Literal("person.renamed") }),
    Schema.Struct({
      cohort: Id("tenantCohorts"),
      type: Schema.Literal("person.placed"),
    }),
    Schema.Struct({
      from: Id("tenantCohorts"),
      to: Id("tenantCohorts"),
      type: Schema.Literal("person.moved"),
    }),
    Schema.Struct({
      invite: Id("tenantInvites"),
      type: Schema.Literal("invite.expired"),
    }),
    Schema.Struct({
      invite: Id("tenantInvites"),
      type: Schema.Literal("invite.resent"),
    }),
    Schema.Struct({
      invite: Id("tenantInvites"),
      type: Schema.Literal("invite.revoked"),
    }),
  ],
  published: [
    "person.created",
    "person.claimed",
    "person.released",
    "person.removed",
  ],
  relations: ["self"],
});

/** One period of a school (a semester or a school year): planned, active, then archived. */
export const period = Kind.make("period", "tenantPeriods", {
  actions: {
    "period.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
    "period.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: planReaders,
    },
  },
  changes: [
    Schema.Struct({ type: Schema.Literal("period.created") }),
    Schema.Struct({ type: Schema.Literal("period.opened") }),
    Schema.Struct({ type: Schema.Literal("period.archived") }),
  ],
  published: [],
  relations: [],
});

/**
 * One cohort (a class group) of a period. A Person placed in it holds the
 * `cohortMember` relation, which opens the cohort to them and to nobody else
 * through that relation.
 */
export const cohort = Kind.make("cohort", "tenantCohorts", {
  actions: {
    "cohort.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
    "cohort.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["cohortMember"],
      roles: planReaders,
    },
  },
  changes: [
    Schema.Struct({ type: Schema.Literal("cohort.created") }),
    Schema.Struct({ type: Schema.Literal("cohort.renamed") }),
    Schema.Struct({ type: Schema.Literal("cohort.archived") }),
  ],
  published: [],
  relations: ["cohortMember"],
});

/**
 * People and invites are tenant-wide: an Admin invites anyone, and the
 * tenant-level reads list the people and the pending invites of the school.
 */
const tenantPeople = Kind.extend(tenant, {
  actions: {
    "invite.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
    "person.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
    "person.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: [
        "admin",
        "principal",
        "deputy",
        "counselor",
        "staff",
        "auditor",
        "integration",
      ],
    },
  },
  changes: [],
  published: [],
});

/**
 * Periods are listed and created on their school, so a school's Admin creates
 * a period in the school and an archived school refuses it.
 */
const unitPeriods = Kind.extend(unit, {
  actions: {
    "period.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
    "period.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: planReaders,
    },
  },
  changes: [],
  published: [],
});

/** Cohorts are created in their period, so a period that is archived refuses them. */
const periodCohorts = Kind.extend(period, {
  actions: {
    "cohort.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
  },
  changes: [],
  published: [],
});

export const tenancy = {
  extensions: [tenantPeople, unitPeriods, periodCohorts],
  kinds: [tenant, unit, person, period, cohort],
} as const;
