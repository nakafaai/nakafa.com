import { FunctionImpl, GroupImpl } from "@confect/server";
import type { TenantsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  activeOwners,
  assignRole,
  endGrant,
} from "@repo/backend/confect/access/grant";
import session from "@repo/backend/confect/middleware/session.impl";
import { loadTenant, rowOf } from "@repo/backend/confect/operators/directory";
import { OwnerClaimed } from "@repo/backend/confect/operators/errors";
import { callingOperator } from "@repo/backend/confect/operators/staff";
import spec from "@repo/backend/confect/operators/tenants.spec";
import { operatorActor } from "@repo/backend/confect/tenancy/actor";
import {
  personAuthority,
  tenantAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { InviteDomainRefused } from "@repo/backend/confect/tenancy/errors";
import { writeInvite } from "@repo/backend/confect/tenancy/invite";
import { admitsAddress } from "@repo/backend/confect/tenancy/policy";
import { openTenant } from "@repo/backend/confect/tenancy/provision.impl";
import { removePerson } from "@repo/backend/confect/tenancy/remove";
import type { TenantStatus } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, Effect, Layer, Struct } from "effect";

/** Writes a school's status, as the one write of a suspension or a reactivation. */
const setStatus = Effect.fn("operators.tenants.status")(function* (
  tenant: TenantsDoc,
  status: typeof TenantStatus.Type
) {
  yield* (yield* DatabaseWriter)
    .table("tenants")
    .replace(
      tenant._id,
      Struct.assign(Struct.omit(tenant, ["_creationTime", "_id"]), { status })
    )
    .pipe(Effect.orDie);
  return Struct.assign(tenant, { status });
});

/** The Persons that hold the school's active Owner grants. */
const ownersOf = Effect.fn("operators.tenants.owners")(function* (
  tenant: TenantsDoc
) {
  const reader = yield* DatabaseReader;
  return yield* Effect.forEach(yield* activeOwners(tenant._id), (grant) =>
    reader.table("tenantPeople").get(grant.personId).pipe(Effect.orDie)
  );
});

/** Opens an organisation from the console. The journal names the operator who opened it. */
const open = FunctionImpl.make(
  databaseSchema,
  spec,
  "open",
  Effect.fn("operators.tenants.open")(function* (args) {
    return yield* openTenant(operatorActor(yield* callingOperator()), args);
  })
);

/**
 * Suspends a school: it stays readable and refuses every member write. A school
 * that is already suspended is returned as it is.
 */
const suspend = FunctionImpl.make(
  databaseSchema,
  spec,
  "suspend",
  Effect.fn("operators.tenants.suspend")(function* ({ tenantId }) {
    const operator = yield* callingOperator();
    const tenant = yield* loadTenant(tenantId);
    if (tenant.status === "suspended") {
      return yield* rowOf(tenant, operator._id);
    }
    const suspended = yield* setStatus(tenant, "suspended");
    yield* tenantAuthority.record(operatorActor(operator), suspended, {
      type: "tenant.suspended",
    });
    return yield* rowOf(suspended, operator._id);
  })
);

/** Reactivates a suspended school. A school that is already active is returned as it is. */
const reactivate = FunctionImpl.make(
  databaseSchema,
  spec,
  "reactivate",
  Effect.fn("operators.tenants.reactivate")(function* ({ tenantId }) {
    const operator = yield* callingOperator();
    const tenant = yield* loadTenant(tenantId);
    if (tenant.status === "active") {
      return yield* rowOf(tenant, operator._id);
    }
    const active = yield* setStatus(tenant, "active");
    yield* tenantAuthority.record(operatorActor(operator), active, {
      type: "tenant.reactivated",
    });
    return yield* rowOf(active, operator._id);
  })
);

/**
 * Replaces the Owners of a school that no signed-in Owner holds. Each unclaimed
 * Owner is removed with its invite, and a new Owner is invited in its place. The
 * refusals come before any write, so a refused request changes nothing.
 */
const replaceOwner = FunctionImpl.make(
  databaseSchema,
  spec,
  "replaceOwner",
  Effect.fn("operators.tenants.replaceOwner")(function* ({
    locale,
    owner,
    tenantId,
  }) {
    const operator = yield* callingOperator();
    const tenant = yield* loadTenant(tenantId);
    if (!admitsAddress(tenant.policies, owner.email)) {
      return yield* new InviteDomainRefused();
    }
    const holders = yield* ownersOf(tenant);
    if (Arr.some(holders, (holder) => holder.account.state === "claimed")) {
      return yield* new OwnerClaimed();
    }
    const by = operatorActor(operator);
    yield* Effect.forEach(
      holders,
      (holder) =>
        removePerson(
          by,
          holder,
          (grant) => endGrant(by, grant, holder, "replaced"),
          "break-glass"
        ),
      { discard: true }
    );
    const ownerId = yield* (yield* DatabaseWriter)
      .table("tenantPeople")
      .insert({
        account: { state: "unclaimed" },
        kind: "member",
        name: owner.name,
        status: "active",
        tenantId,
      })
      .pipe(Effect.orDie);
    const person = yield* (yield* DatabaseReader)
      .table("tenantPeople")
      .get(ownerId)
      .pipe(Effect.orDie);
    yield* personAuthority.record(by, person, { type: "person.created" });
    yield* writeInvite(by, person, owner.email, locale, "break-glass");
    // A new active member Person in a school meets every grant invariant.
    yield* assignRole(by, person, "owner", { kind: "tenant" }).pipe(
      Effect.orDie
    );
    return yield* rowOf(tenant, operator._id);
  })
);

/** Lists every school of this deployment, a page at a time, with the operator's open visit to each. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("operators.tenants.list")(function* ({ paginationOpts }) {
    const operator = yield* callingOperator();
    const page = yield* (yield* DatabaseReader)
      .table("tenants")
      .index("by_creation_time")
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    const rows = yield* Effect.forEach(
      page.page,
      (tenant) => rowOf(tenant, operator._id),
      { concurrency: "unbounded" }
    );
    return Struct.assign(page, { page: rows });
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(open),
  Layer.provide(suspend),
  Layer.provide(reactivate),
  Layer.provide(replaceOwner),
  Layer.provide(list),
  Layer.provide(session),
  GroupImpl.finalize
);
