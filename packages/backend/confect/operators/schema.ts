import { Id } from "@repo/backend/confect/_generated/id";
import { GrantEndReason } from "@repo/backend/confect/access/schema";
import {
  TenantKind,
  TenantName,
  TenantStatus,
} from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * An operator row is active while its account may enter schools, and revoked
 * once staff take that away.
 */
const OperatorStatus = Schema.Literals(["active", "revoked"]);

/**
 * One Nakafa staff account allowed to operate on this deployment. The journal
 * records tenant changes only, so the change times of an operator live here.
 */
export const operatorValidator = Schema.Struct({
  changedAt: Schema.Finite,
  grantedAt: Schema.Finite,
  status: OperatorStatus,
  userId: Id("users"),
});

/** Why an operator asks for a visit: a reason code the school can read at a glance. */
export const VisitReason = Schema.Literals([
  "support",
  "onboarding",
  "incident",
]);

/** The free-text note an operator writes with a request, up to 500 characters. */
export const VisitNote = Schema.String.check(Schema.isMaxLength(500));

/** The shortest and the longest visit an operator may ask for, in minutes. */
const VISIT_MIN_MINUTES = 15;
const VISIT_MAX_MINUTES = 1440;
export const VisitMinutes = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(VISIT_MIN_MINUTES),
  Schema.isLessThanOrEqualTo(VISIT_MAX_MINUTES)
);

/** Why a visit ended: the operator left, its term ran out, or the school ended it. */
export const VisitEndReason = GrantEndReason.pick([
  "expired",
  "left",
  "revoked",
]);

/** The name of an operator's Person in a school. The school never sees the account behind it. */
export const OPERATOR_PERSON_NAME = "Operator Nakafa";

/** A request the school has not answered yet. */
const PendingVisit = Schema.Struct({ status: Schema.Literal("pending") });

/** A request the school declined. */
const DeclinedVisit = Schema.Struct({
  at: Schema.Finite,
  status: Schema.Literal("declined"),
});

/**
 * A visit the school approved: the operator's Person acts through the grant
 * until `expiresAt`, which is the approval time plus the visit's length.
 */
export const ApprovedVisit = Schema.Struct({
  at: Schema.Finite,
  expiresAt: Schema.Finite,
  grantId: Id("tenantGrants"),
  personId: Id("tenantPeople"),
  status: Schema.Literal("approved"),
});

/** A visit that ended before the school ended it, or on its own term. */
const EndedVisit = Schema.Struct({
  at: Schema.Finite,
  reason: VisitEndReason,
  status: Schema.Literal("ended"),
});

/** Where one visit stands. A pending or approved visit is open. */
export const VisitState = Schema.Union([
  PendingVisit,
  DeclinedVisit,
  ApprovedVisit,
  EndedVisit,
]);

/** One visit of an operator to one school. */
export const tenantVisitValidator = Schema.Struct({
  minutes: VisitMinutes,
  note: VisitNote,
  operatorId: Id("operators"),
  reason: VisitReason,
  requestedAt: Schema.Finite,
  state: VisitState,
  tenantId: Id("tenants"),
});

/** A visit's state as the wire shows it: the Person and the grant stay private. */
export const VisitStateView = Schema.Union([
  PendingVisit,
  DeclinedVisit,
  Schema.Struct({
    at: Schema.Finite,
    expiresAt: Schema.Finite,
    status: Schema.Literal("approved"),
  }),
  EndedVisit,
]);

/** One visit as the operator console and the school's approval list show it. */
export const VisitView = Schema.Struct({
  id: Id("tenantVisits"),
  minutes: VisitMinutes,
  note: VisitNote,
  reason: VisitReason,
  requestedAt: Schema.Finite,
  state: VisitStateView,
});

/** One operator row as the staff commands show it. */
export const OperatorView = Schema.Struct({
  changedAt: Schema.Finite,
  grantedAt: Schema.Finite,
  id: Id("operators"),
  status: OperatorStatus,
  userId: Id("users"),
});

/** One school as the operator directory shows it, with the operator's open visit if any. */
export const TenantRow = Schema.Struct({
  id: Id("tenants"),
  kind: TenantKind,
  name: TenantName,
  slug: TenantSlug,
  status: TenantStatus,
  unitCount: Schema.Finite,
  visit: Schema.NullOr(VisitView),
});
