import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type {
  TenantInvitesDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { startInviteEmail } from "@repo/backend/confect/emails/invite/workflow";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import { claimAfterInvite } from "@repo/backend/confect/tenancy/claims";
import {
  type Email,
  INVITE_TERM,
  type InviteState,
} from "@repo/backend/confect/tenancy/schema";
import { Clock, DateTime, Duration, Effect, Struct } from "effect";

/** Writes a new state over one stored invite; every other field of the invite stays as it is. */
export const replaceInviteState = Effect.fn("tenancy.invite.state")(function* (
  invite: TenantInvitesDoc,
  state: typeof InviteState.Type
) {
  yield* (yield* DatabaseWriter)
    .table("tenantInvites")
    .replace(
      invite._id,
      Struct.assign(Struct.omit(invite, ["_creationTime", "_id"]), { state })
    )
    .pipe(Effect.orDie);
});

/**
 * Marks a still-pending invite expired and journals it under its Person, as the
 * system. An invite in any other state is left as it is. The scheduled expiry
 * and a new invite sent after the old term ended both end an invite this way.
 */
export const expireInvite = Effect.fn("tenancy.invite.expire")(function* (
  invite: TenantInvitesDoc,
  person: TenantPeopleDoc
) {
  if (invite.state.status !== "pending") {
    return;
  }
  yield* replaceInviteState(invite, {
    at: yield* Clock.currentTimeMillis,
    status: "expired",
  });
  yield* personAuthority.record(systemActor, person, {
    invite: invite._id,
    type: "invite.expired",
  });
});

/**
 * Writes the pending invite of one unclaimed Person, then starts what it implies
 * in the caller's transaction, so the invite and its email exist together or not
 * at all: the expiry at a fixed moment, the journal entry, the invitation email
 * in `locale`, and the claim of an account that already holds the address.
 */
export const writeInvite = Effect.fn("tenancy.invite.write")(function* (
  actor: typeof TenantActor.Type,
  person: TenantPeopleDoc,
  email: typeof Email.Type,
  locale: ActiveAppLocaleCode
) {
  const expiresAt =
    (yield* Clock.currentTimeMillis) + Duration.toMillis(INVITE_TERM);
  const inviteId = yield* (yield* DatabaseWriter)
    .table("tenantInvites")
    .insert({
      channel: { email, kind: "email" },
      expiresAt,
      personId: person._id,
      state: { status: "pending" },
      tenantId: person.tenantId,
    })
    .pipe(Effect.orDie);
  const invite = yield* (yield* DatabaseReader)
    .table("tenantInvites")
    .get(inviteId)
    .pipe(Effect.orDie);
  yield* (yield* Scheduler).runAt(
    DateTime.makeUnsafe(expiresAt),
    refs.internal.tenancy.expiry.invite,
    { inviteId }
  );
  yield* personAuthority.record(actor, person, {
    invite: inviteId,
    type: "person.invited",
  });
  yield* startInviteEmail(inviteId, locale);
  yield* claimAfterInvite(email);
  return invite;
});
