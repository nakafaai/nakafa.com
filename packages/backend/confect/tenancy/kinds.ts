import { CountryCodeSchema } from "@nakafa/aksara-contracts/country";
import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import { Kind } from "@repo/backend/confect/access/kind";
import type { RuleRole } from "@repo/backend/confect/access/schema";
import { AssignmentKind } from "@repo/backend/confect/tenancy/assignment";
import { Contract } from "@repo/backend/confect/tenancy/contract";
import { Currency, TimeZone } from "@repo/backend/confect/tenancy/locale";
import { PolicyKey } from "@repo/backend/confect/tenancy/policy";
import {
  PromotionReturnReason,
  PromotionStep,
} from "@repo/backend/confect/tenancy/promotion/schema";
import {
  ClaimMethod,
  Npsn,
  PersonReason,
  TenantName,
} from "@repo/backend/confect/tenancy/schema";
import { SchoolSize } from "@repo/backend/confect/tenancy/start";
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

/** The school roles and integration clients that read the people of their school. */
const personReaders: (typeof RuleRole.Type)[] = [
  "admin",
  "principal",
  "deputy",
  "counselor",
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
      size: SchoolSize,
      type: Schema.Literal("tenant.founded"),
    }),
    Schema.Struct({
      country: CountryCodeSchema,
      currency: Currency,
      type: Schema.Literal("tenant.locale.set"),
    }),
    Schema.Struct({ type: Schema.Literal("tenant.logo.removed") }),
    Schema.Struct({ type: Schema.Literal("tenant.logo.set") }),
    Schema.Struct({
      key: PolicyKey,
      type: Schema.Literal("tenant.policy.set"),
    }),
    Schema.Struct({
      name: TenantName,
      type: Schema.Literal("tenant.name.set"),
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
    Schema.Struct({
      npsn: Npsn,
      type: Schema.Literal("unit.npsn.set"),
    }),
  ],
  published: ["unit.created"],
  relations: ["member"],
});

/** A Person: the school's record of someone, claimed by at most one account. */
export const person = Kind.make("person", "tenantPeople", {
  actions: {
    "card.issue": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
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
      roles: personReaders,
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
      promotion: Id("tenantPromotions"),
      type: Schema.Literal("person.graduated"),
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
    Schema.Struct({
      card: Id("loginCards"),
      type: Schema.Literal("card.issued"),
    }),
    Schema.Struct({
      card: Id("loginCards"),
      type: Schema.Literal("card.reissued"),
    }),
    Schema.Struct({
      card: Id("loginCards"),
      type: Schema.Literal("card.redeemed"),
    }),
    Schema.Struct({
      card: Id("loginCards"),
      type: Schema.Literal("card.printed"),
    }),
  ],
  published: [
    "person.created",
    "person.invited",
    "person.claimed",
    "person.released",
    "person.removed",
    "card.redeemed",
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
    Schema.Struct({ type: Schema.Literal("period.restored") }),
    Schema.Struct({ type: Schema.Literal("period.rename") }),
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
      relations: ["cohortMember", "homeroom"],
      roles: planReaders,
    },
  },
  changes: [
    Schema.Struct({ type: Schema.Literal("cohort.created") }),
    Schema.Struct({ type: Schema.Literal("cohort.renamed") }),
    Schema.Struct({ type: Schema.Literal("cohort.archived") }),
    Schema.Struct({ type: Schema.Literal("cohort.restored") }),
    Schema.Struct({
      assignment: AssignmentKind,
      person: Id("tenantPeople"),
      type: Schema.Literal("assignment.created"),
    }),
    Schema.Struct({
      assignment: AssignmentKind,
      person: Id("tenantPeople"),
      type: Schema.Literal("assignment.removed"),
    }),
  ],
  published: [],
  relations: ["cohortMember", "homeroom"],
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
      roles: personReaders,
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

/**
 * One promotion of a school's students to its next period. The Admin prepares
 * and applies it, and the principal approves it. Each write that applying it
 * makes is journaled on its own subject: the archived period, the new cohorts,
 * the placements and graduations of students, and the copied homeroom teachers.
 */
export const promotion = Kind.make("promotion", "tenantPromotions", {
  actions: {
    "promotion.apply": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
    "promotion.approve": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["principal"],
    },
    "promotion.prepare": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
    "promotion.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: ["admin", "principal", "deputy", "staff", "auditor"],
    },
  },
  changes: [
    Schema.Struct({ type: Schema.Literal("promotion.applied") }),
    Schema.Struct({ type: Schema.Literal("promotion.approved") }),
    Schema.Struct({ type: Schema.Literal("promotion.cancelled") }),
    Schema.Struct({ type: Schema.Literal("promotion.created") }),
    Schema.Struct({ type: Schema.Literal("promotion.opened") }),
    Schema.Struct({ type: Schema.Literal("promotion.planned") }),
    Schema.Struct({
      person: Id("tenantPeople"),
      type: Schema.Literal("promotion.studentPlanned"),
    }),
    Schema.Struct({ type: Schema.Literal("promotion.submitted") }),
    Schema.Struct({
      reason: PromotionReturnReason,
      type: Schema.Literal("promotion.returned"),
    }),
    Schema.Struct({
      step: PromotionStep,
      type: Schema.Literal("promotion.undone"),
    }),
  ],
  published: [],
  relations: [],
});

export const tenancy = {
  extensions: [tenantPeople, unitPeriods, periodCohorts],
  kinds: [tenant, unit, person, period, cohort, promotion],
} as const;
