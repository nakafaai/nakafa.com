import type { GenericId } from "@confect/core";
import type {
  TenantGrantsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { grantAuthority } from "@repo/backend/confect/access/authority";
import {
  GrantRejected,
  inactivePerson,
  integrationRole,
} from "@repo/backend/confect/access/errors";
import { activeGrants, GRANT_LIMIT } from "@repo/backend/confect/access/policy";
import {
  type BuiltinRole,
  type GrantEndReason,
  GrantScope,
  type GrantStatus,
  type GrantTerm,
  OwnerRole,
} from "@repo/backend/confect/access/schema";
import { ensureStudentSeat } from "@repo/backend/confect/billing/seats";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import {
  personAuthority,
  tenantAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { Array as Arr, Effect, Match, Option, Schema, Struct } from "effect";

/** One grant as the wire shows it (`GrantView`). */
export const grantView = (grant: TenantGrantsDoc) =>
  Struct.renameKeys(Struct.pick(grant, ["_id", "role", "scope", "term"]), {
    _id: "id",
  });

/** Active Owner grants one tenant may hold. */
export const OWNER_LIMIT = 8;

/** Two grants hold the same scope when both cover the tenant or both cover one unit. */
const sameScope = Schema.toEquivalence(GrantScope);

/** The tenant's active Owner grants, bounded by the Owner limit plus one. */
export const activeOwners = Effect.fn("access.grant.owners")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  return yield* (yield* DatabaseReader)
    .table("tenantGrants")
    .index("by_tenantId_and_role_key_and_status", (query) =>
      query
        .eq("tenantId", tenantId)
        .eq("role.key", "owner")
        .eq("status", "active")
    )
    .take(OWNER_LIMIT + 1)
    .pipe(Effect.orDie);
});

/**
 * The first tenant invariant a new standing grant breaks, decided before any
 * read: only member Persons hold standing grants, only active ones hold any,
 * no person holds the integration role, and Owners cover the whole tenant.
 */
const refusal = (
  person: TenantPeopleDoc,
  role: BuiltinRole,
  scope: GrantScope
) =>
  Match.value({ person, role, scope }).pipe(
    Match.not(
      { person: { kind: "member" } },
      () =>
        new GrantRejected({
          code: "PERSON_KIND",
          message: "Operators hold only temporary visit grants.",
        })
    ),
    Match.not({ person: { status: "active" } }, inactivePerson),
    Match.when({ role: "integration" }, integrationRole),
    Match.when(
      { role: "owner", scope: { kind: "unit" } },
      () =>
        new GrantRejected({
          code: "GRANT_SCOPE",
          message: "Owners cover the whole school.",
        })
    ),
    Match.option
  );

/**
 * Writes one active grant under the Person and records it under the Person. The
 * Person's grants are read by the caller; the limits of the Person and of the
 * tenant's Owners are checked here before the grant is written.
 */
export const writeGrant = Effect.fn("access.grant.write")(function* (
  actor: typeof TenantActor.Type,
  person: TenantPeopleDoc,
  grants: readonly TenantGrantsDoc[],
  role: BuiltinRole,
  scope: GrantScope,
  term: typeof GrantTerm.Type
) {
  if (grants.length >= GRANT_LIMIT) {
    return yield* new GrantRejected({
      code: "GRANT_LIMIT",
      message: "This person has too many roles.",
    });
  }
  if (
    role === "owner" &&
    (yield* activeOwners(person.tenantId)).length >= OWNER_LIMIT
  ) {
    return yield* new GrantRejected({
      code: "GRANT_LIMIT",
      message: "This school has too many owners.",
    });
  }
  // A Person who already studies in the school takes no new seat in another unit.
  if (
    role === "student" &&
    !Arr.some(grants, (grant) => grant.role.key === "student")
  ) {
    yield* ensureStudentSeat(person.tenantId);
  }
  const grantId = yield* (yield* DatabaseWriter)
    .table("tenantGrants")
    .insert({
      grantedBy: actor,
      personId: person._id,
      role: { key: role, kind: "builtin" },
      scope,
      status: "active",
      tenantId: person.tenantId,
      term,
    })
    .pipe(Effect.orDie);
  yield* personAuthority.record(actor, person, {
    grant: grantId,
    role: { key: role, kind: "builtin" },
    scope,
    term,
    type: "grant.created",
  });
  return grantId;
});

/**
 * Gives a member Person a standing built-in role under the tenant's
 * invariants and records it under the Person. An identical active grant is
 * returned instead of duplicated, so a retried request stays idempotent.
 * Callers check that the actor may manage the role first.
 */
export const assignRole = Effect.fn("access.grant.assign")(function* (
  actor: typeof TenantActor.Type,
  person: TenantPeopleDoc,
  role: BuiltinRole,
  scope: GrantScope
) {
  yield* Option.match(refusal(person, role, scope), {
    onNone: () => Effect.void,
    onSome: Effect.fail,
  });
  const grants = yield* activeGrants(person._id);
  const existing = Arr.findFirst(
    grants,
    (grant) =>
      grant.role.key === role &&
      grant.term.kind === "standing" &&
      sameScope(grant.scope, scope)
  );
  if (Option.isSome(existing)) {
    return existing.value._id;
  }
  return yield* writeGrant(actor, person, grants, role, scope, {
    kind: "standing",
  });
});

/**
 * Ends an active grant and records it under the Person who held it. A grant
 * that expires is marked expired; every other reason marks it revoked.
 */
export const endGrant = Effect.fn("access.grant.end")(function* (
  actor: typeof TenantActor.Type,
  grant: TenantGrantsDoc,
  holder: TenantPeopleDoc,
  reason: typeof GrantEndReason.Type
) {
  const status: typeof GrantStatus.Type =
    reason === "expired" ? "expired" : "revoked";
  yield* (yield* DatabaseWriter)
    .table("tenantGrants")
    .replace(
      grant._id,
      Struct.assign(Struct.omit(grant, ["_creationTime", "_id"]), { status })
    )
    .pipe(Effect.orDie);
  yield* personAuthority.record(actor, holder, {
    grant: grant._id,
    reason,
    type: "grant.ended",
  });
});

/** Refuses to end the last Owner grant held by an active, claimed Person. */
export const ensureOwnerRemains = Effect.fn("access.grant.ownerRemains")(
  function* (grant: TenantGrantsDoc) {
    if (grant.role.key !== "owner") {
      return;
    }
    const reader = yield* DatabaseReader;
    const holders = yield* Effect.forEach(
      Arr.filter(
        yield* activeOwners(grant.tenantId),
        (owner) => owner._id !== grant._id
      ),
      (owner) =>
        reader.table("tenantPeople").get(owner.personId).pipe(Effect.orDie)
    );
    if (
      !Arr.some(
        holders,
        (holder) =>
          holder.status === "active" && holder.account.state === "claimed"
      )
    ) {
      return yield* new GrantRejected({
        code: "LAST_OWNER",
        message: "A school keeps at least one owner who has signed in.",
      });
    }
  }
);

/**
 * Owner and Admin roles also need `owner.manage`, which only Owners hold, so an
 * Admin can neither give nor end an Admin role.
 */
export const authorizeOwnerRole = Effect.fn("access.grant.ownerRole")(
  function* (role: BuiltinRole) {
    if (Schema.is(OwnerRole)(role)) {
      yield* tenantAuthority.check("owner.manage", (yield* Member).tenant);
    }
  }
);

/**
 * Ends one active grant the way the access lane's revoke path does: the grant's
 * own `grant.revoke` decision, the Owner rule for Owner and Admin roles, and the
 * last-Owner rule, all before the grant ends and is recorded under its holder.
 */
export const revokeGrant = Effect.fn("access.grant.revoke")(function* (
  actor: typeof TenantActor.Type,
  grant: TenantGrantsDoc,
  holder: TenantPeopleDoc
) {
  yield* grantAuthority.check("grant.revoke", grant);
  yield* authorizeOwnerRole(grant.role.key);
  yield* ensureOwnerRemains(grant);
  yield* endGrant(actor, grant, holder, "revoked");
});
