import type {
  TenantCohortMembersDoc,
  TenantGrantsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { activeGrants } from "@repo/backend/confect/access/policy";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import { replaceInviteState } from "@repo/backend/confect/tenancy/invite";
import { PERSON_PLACEMENT_LIMIT } from "@repo/backend/confect/tenancy/placement";
import { releaseAccount } from "@repo/backend/confect/tenancy/release";
import type { PersonReason } from "@repo/backend/confect/tenancy/schema";
import { Clock, Effect, Option } from "effect";

/**
 * Whether a placement is history that removal keeps: its period or its cohort is
 * archived, so it stays as the record of where the Person was placed.
 */
const isHistory = Effect.fn("tenancy.remove.history")(function* (
  placement: TenantCohortMembersDoc
) {
  const reader = yield* DatabaseReader;
  const term = yield* reader
    .table("tenantPeriods")
    .get(placement.periodId)
    .pipe(Effect.orDie);
  const cohort = yield* reader
    .table("tenantCohorts")
    .get(placement.cohortId)
    .pipe(Effect.orDie);
  return term.status === "archived" || cohort.status === "archived";
});

/**
 * Removes one Person as `actor`. Each standing grant ends through `endGrant`,
 * and each cohort placement ends unless it is history. The pending invite is
 * revoked, and the account is released as account deletion releases it, so the
 * account can be invited again. The journal records `person.removed`, with the
 * `reason` an operator gives. Returns the Person as stored.
 */
export const removePerson = Effect.fn("tenancy.remove.person")(function* <E, R>(
  actor: typeof TenantActor.Type,
  person: TenantPeopleDoc,
  endGrant: (grant: TenantGrantsDoc) => Effect.Effect<void, E, R>,
  reason?: typeof PersonReason.Type
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const at = yield* Clock.currentTimeMillis;
  yield* Effect.forEach(yield* activeGrants(person._id), endGrant, {
    discard: true,
  });
  const placements = yield* reader
    .table("tenantCohortMembers")
    .index("by_personId", (query) => query.eq("personId", person._id))
    .take(PERSON_PLACEMENT_LIMIT)
    .pipe(Effect.orDie);
  const ended = yield* Effect.filter(placements, (placement) =>
    isHistory(placement).pipe(Effect.map((history) => !history))
  );
  yield* Effect.forEach(
    ended,
    (placement) =>
      writer
        .table("tenantCohortMembers")
        .delete(placement._id)
        .pipe(Effect.orDie),
    { discard: true }
  );
  const pending = yield* reader
    .table("tenantInvites")
    .index("by_personId_and_state_status", (query) =>
      query.eq("personId", person._id).eq("state.status", "pending")
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(pending)) {
    yield* replaceInviteState(pending.value, { at, status: "revoked" });
    yield* personAuthority.record(actor, person, {
      invite: pending.value._id,
      type: "invite.revoked",
    });
  }
  const removed = yield* releaseAccount(person, "removed", at, actor);
  yield* personAuthority.record(
    actor,
    person,
    reason === undefined
      ? { type: "person.removed" }
      : { reason, type: "person.removed" }
  );
  return removed;
});
