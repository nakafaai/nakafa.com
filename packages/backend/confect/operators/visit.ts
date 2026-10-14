import type { GenericId } from "@confect/core";
import type {
  OperatorsDoc,
  TenantPeopleDoc,
  TenantVisitsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { endGrant } from "@repo/backend/confect/access/grant";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { visitAuthority } from "@repo/backend/confect/operators/authority";
import { OperatorHasPerson } from "@repo/backend/confect/operators/errors";
import {
  type ApprovedVisit,
  OPERATOR_PERSON_NAME,
  type VisitEndReason,
  type VisitState,
  type VisitStateView,
} from "@repo/backend/confect/operators/schema";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import type { PersonStatus } from "@repo/backend/confect/tenancy/schema";
import { Clock, Effect, Option, Struct } from "effect";

/** A visit's state as the wire shows it: the Person and the grant stay private. */
const stateView = (
  state: typeof VisitState.Type
): typeof VisitStateView.Type =>
  state.status === "approved"
    ? Struct.omit(state, ["grantId", "personId"])
    : state;

/** One stored visit as the operator console and the school show it. */
export const viewOf = (visit: TenantVisitsDoc) => ({
  id: visit._id,
  minutes: visit.minutes,
  note: visit.note,
  reason: visit.reason,
  requestedAt: visit.requestedAt,
  state: stateView(visit.state),
});

/** The visit of one operator to one school in one of the given states. */
const visitIn = Effect.fn("operators.visit.in")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  operatorId: GenericId.GenericId<"operators">,
  status: "pending" | "approved"
) {
  return yield* (yield* DatabaseReader)
    .table("tenantVisits")
    .index("by_tenantId_and_operatorId_and_state_status", (query) =>
      query
        .eq("tenantId", tenantId)
        .eq("operatorId", operatorId)
        .eq("state.status", status)
    )
    .first()
    .pipe(Effect.orDie);
});

/**
 * The visit of one operator to one school that is still open, requested or
 * approved. A request is refused while one is open, so there is at most one.
 */
export const openVisitOf = Effect.fn("operators.visit.open")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  operatorId: GenericId.GenericId<"operators">
) {
  const pending = yield* visitIn(tenantId, operatorId, "pending");
  if (Option.isSome(pending)) {
    return pending;
  }
  return yield* visitIn(tenantId, operatorId, "approved");
});

/** Writes a new state over one stored visit. Every other field of the visit stays as it is. */
export const replaceVisitState = Effect.fn("operators.visit.state")(function* (
  visit: TenantVisitsDoc,
  state: typeof VisitState.Type
) {
  yield* (yield* DatabaseWriter)
    .table("tenantVisits")
    .replace(
      visit._id,
      Struct.assign(Struct.omit(visit, ["_creationTime", "_id"]), { state })
    )
    .pipe(Effect.orDie);
  return Struct.assign(visit, { state });
});

/** Suspends an operator's Person in a school and journals it as `actor`. */
const suspendPerson = Effect.fn("operators.visit.suspend")(function* (
  actor: typeof TenantActor.Type,
  person: TenantPeopleDoc
) {
  const status: typeof PersonStatus.Type = "suspended";
  yield* (yield* DatabaseWriter)
    .table("tenantPeople")
    .replace(
      person._id,
      Struct.assign(Struct.omit(person, ["_creationTime", "_id"]), { status })
    )
    .pipe(Effect.orDie);
  yield* personAuthority.record(actor, person, { type: "person.suspended" });
});

/**
 * Ends an approved visit as `actor`: its grant ends with the reason, the operator's
 * Person is suspended, and the visit records how it ended. Returns the visit as
 * stored. The grant and the Person are ended in the same transaction as the visit.
 * A grant that already ended, or a Person that a removal already ended, is left as
 * it is, so each end is journaled once.
 */
export const endVisit = Effect.fn("operators.visit.end")(function* (
  actor: typeof TenantActor.Type,
  visit: TenantVisitsDoc,
  approved: typeof ApprovedVisit.Type,
  reason: typeof VisitEndReason.Type
) {
  const reader = yield* DatabaseReader;
  const grant = yield* reader
    .table("tenantGrants")
    .get(approved.grantId)
    .pipe(Effect.orDie);
  const person = yield* reader
    .table("tenantPeople")
    .get(approved.personId)
    .pipe(Effect.orDie);
  if (grant.status === "active") {
    yield* endGrant(actor, grant, person, reason);
  }
  if (person.status === "active") {
    yield* suspendPerson(actor, person);
  }
  const at = yield* Clock.currentTimeMillis;
  const ended = yield* replaceVisitState(visit, {
    at,
    reason,
    status: "ended",
  });
  yield* visitAuthority.record(actor, ended, {
    reason,
    type: "visit.ended",
  });
  return ended;
});

/**
 * Ends a visit whose term has run out, as the system. A visit that is no longer
 * approved, because the school or the operator ended it first, is left as it is.
 */
export const expireVisit = Effect.fn("operators.visit.expire")(function* (
  visit: TenantVisitsDoc
) {
  if (visit.state.status !== "approved") {
    return;
  }
  yield* endVisit(systemActor, visit, visit.state, "expired");
});

/**
 * Ends the approved visit of an operator's Person whose account is released, as
 * the system. The operator left by deleting its account, so the visit ends with
 * `left`, and the Person is suspended. A suspended Person is locked, so no invite
 * or claim can bind it to another account. A Person of another kind, or an
 * operator with no approved visit in the school, is left as it is.
 */
export const endReleasedVisit = Effect.fn("operators.visit.released")(
  function* (userId: GenericId.GenericId<"users">, person: TenantPeopleDoc) {
    if (person.kind !== "operator") {
      return;
    }
    const operator = yield* (yield* DatabaseReader)
      .table("operators")
      .get("by_userId", userId)
      .pipe(Effect.orDie);
    const open = yield* openVisitOf(person.tenantId, operator._id);
    if (Option.isSome(open) && open.value.state.status === "approved") {
      yield* endVisit(systemActor, open.value, open.value.state, "left");
    }
  }
);

/**
 * The Person an approved visit acts through in one school: the operator's Person
 * when it exists, reactivated, or a new Person that the operator's account
 * claims. An account holds one Person per school, so an account that holds a
 * Person of another kind there is refused.
 */
export const admitOperator = Effect.fn("operators.visit.admit")(function* (
  actor: typeof TenantActor.Type,
  tenantId: GenericId.GenericId<"tenants">,
  operator: OperatorsDoc,
  at: number
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const held = yield* reader
    .table("tenantPeople")
    .index("by_tenantId_and_account_userId", (query) =>
      query.eq("tenantId", tenantId).eq("account.userId", operator.userId)
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isNone(held)) {
    const personId = yield* writer
      .table("tenantPeople")
      .insert({
        account: {
          claimedAt: at,
          method: "operator",
          state: "claimed",
          userId: operator.userId,
        },
        kind: "operator",
        name: OPERATOR_PERSON_NAME,
        status: "active",
        tenantId,
      })
      .pipe(Effect.orDie);
    const person = yield* reader
      .table("tenantPeople")
      .get(personId)
      .pipe(Effect.orDie);
    yield* personAuthority.record(actor, person, { type: "person.created" });
    yield* personAuthority.record(actor, person, {
      method: "operator",
      type: "person.claimed",
    });
    return person;
  }
  if (held.value.kind !== "operator") {
    return yield* new OperatorHasPerson();
  }
  const status: typeof PersonStatus.Type = "active";
  yield* writer
    .table("tenantPeople")
    .replace(
      held.value._id,
      Struct.assign(Struct.omit(held.value, ["_creationTime", "_id"]), {
        status,
      })
    )
    .pipe(Effect.orDie);
  yield* personAuthority.record(actor, held.value, {
    type: "person.reactivated",
  });
  return Struct.assign(held.value, { status });
});
