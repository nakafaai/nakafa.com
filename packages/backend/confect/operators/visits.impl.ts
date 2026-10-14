import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { assignTemporaryRole } from "@repo/backend/confect/access/grant";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Visit } from "@repo/backend/confect/operators/access";
import {
  visitAccess,
  visitAuthority,
} from "@repo/backend/confect/operators/authority";
import { loadTenant } from "@repo/backend/confect/operators/directory";
import {
  NotOperator,
  TenantSuspended,
  VisitNotApproved,
  VisitNotPending,
  VisitOpen,
} from "@repo/backend/confect/operators/errors";
import { callingOperator } from "@repo/backend/confect/operators/staff";
import {
  admitOperator,
  endVisit,
  openVisitOf,
  replaceVisitState,
  viewOf,
} from "@repo/backend/confect/operators/visit";
import spec from "@repo/backend/confect/operators/visits.spec";
import {
  operatorActor,
  personActor,
} from "@repo/backend/confect/tenancy/actor";
import {
  Array as Arr,
  Clock,
  DateTime,
  Duration,
  Effect,
  Layer,
  Option,
  Struct,
} from "effect";

/**
 * Loads a visit that the school decides on. A visit that names no visit and a
 * visit of another school are both denied as `resource`, so an ID probe reveals
 * nothing.
 */
const loadVisit = Effect.fnUntraced(function* (
  visitId: GenericId.GenericId<"tenantVisits">,
  tenantId: GenericId.GenericId<"tenants">,
  action: string
) {
  const stored = yield* (yield* DatabaseReader)
    .table("tenantVisits")
    .get(visitId)
    .pipe(Effect.catchTag("DocumentDecodeError", Effect.die), Effect.option);
  if (Option.isNone(stored) || stored.value.tenantId !== tenantId) {
    return yield* new AccessDenied({ action, reason: "resource" });
  }
  return stored.value;
});

/**
 * Asks for a visit to a school. The operator must be active, the school must be
 * active, and the operator holds at most one open visit to it.
 */
const request = FunctionImpl.make(
  databaseSchema,
  spec,
  "request",
  Effect.fn("operators.visits.request")(function* ({
    minutes,
    note,
    reason,
    tenantId,
  }) {
    const operator = yield* callingOperator();
    const tenant = yield* loadTenant(tenantId);
    if (tenant.status === "suspended") {
      return yield* new TenantSuspended();
    }
    if (Option.isSome(yield* openVisitOf(tenantId, operator._id))) {
      return yield* new VisitOpen();
    }
    const requestedAt = yield* Clock.currentTimeMillis;
    const visitId = yield* (yield* DatabaseWriter)
      .table("tenantVisits")
      .insert({
        minutes,
        note,
        operatorId: operator._id,
        reason,
        requestedAt,
        state: { status: "pending" },
        tenantId,
      })
      .pipe(Effect.orDie);
    const visit = yield* (yield* DatabaseReader)
      .table("tenantVisits")
      .get(visitId)
      .pipe(Effect.orDie);
    yield* visitAuthority.record(operatorActor(operator), visit, {
      minutes,
      reason,
      type: "visit.requested",
    });
    return viewOf(visit);
  })
);

/** The school's requests it has not answered yet, a page at a time. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("operators.visits.list")(function* ({ paginationOpts }) {
    const { tenant } = yield* Member;
    const page = yield* (yield* DatabaseReader)
      .table("tenantVisits")
      .index("by_tenantId_and_state_status", (query) =>
        query.eq("tenantId", tenant._id).eq("state.status", "pending")
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    return Struct.assign(page, { page: Arr.map(page.page, viewOf) });
  })
);

/**
 * Approves a requested visit. The operator's Person is admitted, it holds a
 * temporary Auditor grant for the visit's length, and the end of the visit is
 * scheduled. A visit whose operator is no longer active is refused.
 */
const approve = FunctionImpl.make(
  databaseSchema,
  spec,
  "approve",
  Effect.fn("operators.visits.approve")(function* ({ visitId }) {
    const { person: actor, tenant } = yield* Member;
    const visit = yield* loadVisit(visitId, tenant._id, "visit.approve");
    if (visit.state.status !== "pending") {
      return yield* new VisitNotPending();
    }
    const operator = yield* (yield* DatabaseReader)
      .table("operators")
      .get(visit.operatorId)
      .pipe(Effect.orDie);
    if (operator.status !== "active") {
      return yield* new NotOperator();
    }
    const approvedAt = yield* Clock.currentTimeMillis;
    const expiresAt =
      approvedAt + Duration.toMillis(Duration.minutes(visit.minutes));
    const by = personActor(actor);
    const person = yield* admitOperator(by, tenant._id, operator, approvedAt);
    // A new temporary grant of the Auditor role meets every grant invariant here.
    const grantId = yield* assignTemporaryRole(
      by,
      person,
      "auditor",
      { kind: "tenant" },
      expiresAt
    ).pipe(Effect.orDie);
    const approved = yield* replaceVisitState(visit, {
      at: approvedAt,
      expiresAt,
      grantId,
      personId: person._id,
      status: "approved",
    });
    yield* visitAuthority.record(by, approved, {
      grant: grantId,
      person: person._id,
      type: "visit.approved",
    });
    yield* (yield* Scheduler).runAt(
      DateTime.makeUnsafe(expiresAt),
      refs.internal.operators.expiry.visit,
      { visitId }
    );
    return viewOf(approved);
  })
);

/** Declines a requested visit. The request ends, and the operator may ask again later. */
const decline = FunctionImpl.make(
  databaseSchema,
  spec,
  "decline",
  Effect.fn("operators.visits.decline")(function* ({ visitId }) {
    const { person: actor, tenant } = yield* Member;
    const visit = yield* loadVisit(visitId, tenant._id, "visit.approve");
    if (visit.state.status !== "pending") {
      return yield* new VisitNotPending();
    }
    const at = yield* Clock.currentTimeMillis;
    const declined = yield* replaceVisitState(visit, {
      at,
      status: "declined",
    });
    yield* visitAuthority.record(personActor(actor), declined, {
      type: "visit.declined",
    });
    return viewOf(declined);
  })
);

/**
 * Ends an approved visit. The operator leaves it, or the school's Owner or Admin
 * ends it; either works while the school is suspended. A visit that already
 * ended is returned as it is.
 */
const end = FunctionImpl.make(
  databaseSchema,
  spec,
  "end",
  Effect.fn("operators.visits.end")(function* () {
    const { person: actor } = yield* Member;
    const visit = yield* Visit;
    if (visit.state.status === "ended") {
      return viewOf(visit);
    }
    if (visit.state.status !== "approved") {
      return yield* new VisitNotApproved();
    }
    const reason = visit.state.personId === actor._id ? "left" : "revoked";
    return viewOf(
      yield* endVisit(personActor(actor), visit, visit.state, reason)
    );
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(request),
  Layer.provide(list),
  Layer.provide(approve),
  Layer.provide(decline),
  Layer.provide(end),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  Layer.provide(visitAccess),
  GroupImpl.finalize
);
