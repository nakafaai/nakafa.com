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
import type {
  BuiltinRole,
  GrantEndReason,
  GrantScope,
} from "@repo/backend/confect/access/schema";
import { record } from "@repo/backend/confect/journal/record";
import type { Actor } from "@repo/backend/confect/journal/schema";
import { Effect } from "effect";

/** Active Owner grants one tenant may hold. */
export const OWNER_LIMIT = 8;

const rejected = (code: GrantRejected["code"], message: string) =>
  new GrantRejected({ code, message });

const sameScope = (left: GrantScope, right: GrantScope) =>
  left.kind === "tenant"
    ? right.kind === "tenant"
    : right.kind === "unit" && left.unitId === right.unitId;

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
 * Gives a member Person a standing built-in role under the tenant's
 * invariants and records it under the Person. An identical active grant is
 * returned instead of duplicated, so a retried request stays idempotent.
 * Callers check that the actor may manage the role first.
 */
export const assignRole = Effect.fn("access.grant.assign")(function* (input: {
  readonly actor: Actor;
  readonly person: TenantPeopleDoc;
  readonly role: BuiltinRole;
  readonly scope: GrantScope;
}) {
  const { person, role, scope } = input;
  if (person.kind !== "member") {
    return yield* rejected(
      "PERSON_KIND",
      "Operators hold only temporary visit grants."
    );
  }
  if (person.status !== "active") {
    return yield* rejected("PERSON_INACTIVE", "This person is not active.");
  }
  if (role === "integration") {
    return yield* rejected("GRANT_ROLE", "Integrations are not people.");
  }
  if (role === "owner" && scope.kind !== "tenant") {
    return yield* rejected("GRANT_SCOPE", "Owners cover the whole school.");
  }
  const grants = yield* activeGrants(person._id);
  const existing = grants.find(
    (grant) =>
      grant.role.key === role &&
      grant.term.kind === "standing" &&
      sameScope(grant.scope, scope)
  );
  if (existing) {
    return existing._id;
  }
  if (grants.length >= GRANT_LIMIT) {
    return yield* rejected("GRANT_LIMIT", "This person has too many roles.");
  }
  if (
    role === "owner" &&
    (yield* activeOwners(person.tenantId)).length >= OWNER_LIMIT
  ) {
    return yield* rejected("GRANT_LIMIT", "This school has too many owners.");
  }
  const granted = {
    role: { key: role, kind: "builtin" as const },
    scope,
    term: { kind: "standing" as const },
  };
  const grantId = yield* (yield* DatabaseWriter)
    .table("tenantGrants")
    .insert({
      ...granted,
      grantedBy: input.actor,
      personId: person._id,
      status: "active",
      tenantId: person.tenantId,
    })
    .pipe(Effect.orDie);
  yield* record({
    actor: input.actor,
    change: { ...granted, grant: grantId, type: "grant.created" },
    subject: { kind: "person", row: person },
  });
  return grantId;
});

/** Ends an active grant and records it under the Person who held it. */
export const endGrant = Effect.fn("access.grant.end")(function* (input: {
  readonly actor: Actor;
  readonly grant: TenantGrantsDoc;
  readonly holder: TenantPeopleDoc;
  readonly reason: typeof GrantEndReason.Type;
}) {
  const { _creationTime, _id, ...fields } = input.grant;
  yield* (yield* DatabaseWriter)
    .table("tenantGrants")
    .replace(_id, {
      ...fields,
      status: input.reason === "expired" ? "expired" : "revoked",
    })
    .pipe(Effect.orDie);
  yield* record({
    actor: input.actor,
    change: { grant: _id, reason: input.reason, type: "grant.ended" },
    subject: { kind: "person", row: input.holder },
  });
});

/** Refuses to end the last Owner grant held by an active, claimed Person. */
export const ensureOwnerRemains = Effect.fn("access.grant.ownerRemains")(
  function* (grant: TenantGrantsDoc) {
    if (grant.role.key !== "owner") {
      return;
    }
    const reader = yield* DatabaseReader;
    const others = (yield* activeOwners(grant.tenantId)).filter(
      (owner) => owner._id !== grant._id
    );
    const holders = yield* Effect.forEach(others, (owner) =>
      reader.table("tenantPeople").get(owner.personId).pipe(Effect.orDie)
    );
    if (
      !holders.some(
        (holder) =>
          holder.status === "active" && holder.account.state === "claimed"
      )
    ) {
      return yield* rejected(
        "LAST_OWNER",
        "A school keeps at least one owner who has signed in."
      );
    }
  }
);
