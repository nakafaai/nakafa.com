import type { GenericId } from "@confect/core";
import type {
  TenantGrantsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { GrantRejected } from "@repo/backend/confect/access/errors";
import { activeGrants, GRANT_LIMIT } from "@repo/backend/confect/access/policy";
import {
  type BuiltinRole,
  type GrantEndReason,
  GrantScope,
  type GrantStatus,
} from "@repo/backend/confect/access/schema";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
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
const activeOwners = Effect.fn("access.grant.owners")(function* (
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
    Match.not(
      { person: { status: "active" } },
      () =>
        new GrantRejected({
          code: "PERSON_INACTIVE",
          message: "This person is not active.",
        })
    ),
    Match.when(
      { role: "integration" },
      () =>
        new GrantRejected({
          code: "GRANT_ROLE",
          message: "Integrations are not people.",
        })
    ),
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
  const grantId = yield* (yield* DatabaseWriter)
    .table("tenantGrants")
    .insert({
      grantedBy: actor,
      personId: person._id,
      role: { key: role, kind: "builtin" },
      scope,
      status: "active",
      tenantId: person.tenantId,
      term: { kind: "standing" },
    })
    .pipe(Effect.orDie);
  yield* personAuthority.record(actor, person, {
    grant: grantId,
    role: { key: role, kind: "builtin" },
    scope,
    term: { kind: "standing" },
    type: "grant.created",
  });
  return grantId;
});

/** Ends an active grant and records it under the Person who held it. */
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
