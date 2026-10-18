import type { GenericId } from "@confect/core";
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
import { noteInvite } from "@repo/backend/confect/notifications/inbox";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import { claimAfterInvite } from "@repo/backend/confect/tenancy/claims";
import { createPerson } from "@repo/backend/confect/tenancy/create";
import { ProvisionRejected } from "@repo/backend/confect/tenancy/errors";
import type { InviteRequest } from "@repo/backend/confect/tenancy/provision.spec";
import {
  type Email,
  INVITE_TERM,
  type InviteState,
  type PersonReason,
} from "@repo/backend/confect/tenancy/schema";
import {
  Array as Arr,
  Clock,
  DateTime,
  Duration,
  Effect,
  Option,
  Struct,
} from "effect";

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

/** The most invites one sweep run expires. A longer backlog drains over later runs. */
const INVITE_SWEEP_BATCH_SIZE = 50;

/**
 * The most pending invites of one address that a school reads. An address holds a
 * few invites, one per school that invites it, so the bound is never reached in use.
 */
const ADDRESS_INVITE_LIMIT = 32;

/**
 * Expires the pending invites whose term has passed, as the system. Each invite
 * normally ends at its own moment; this sweep is the backstop for a run that
 * never happened. It reads one indexed batch of due invites per run.
 */
export const expireDueInvites = Effect.fn("tenancy.invite.expireDue")(
  function* () {
    const reader = yield* DatabaseReader;
    const now = yield* Clock.currentTimeMillis;
    const due = yield* reader
      .table("tenantInvites")
      .index("by_state_status_and_expiresAt", (query) =>
        query.eq("state.status", "pending").lte("expiresAt", now)
      )
      .take(INVITE_SWEEP_BATCH_SIZE)
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      due,
      (invite) =>
        reader
          .table("tenantPeople")
          .get(invite.personId)
          .pipe(
            Effect.orDie,
            Effect.flatMap((person) => expireInvite(invite, person))
          ),
      { discard: true }
    );
  }
);

/**
 * Writes the pending invite of one unclaimed Person, then starts what it implies
 * in the caller's transaction, so the invite and its email exist together or not
 * at all: the expiry at a fixed moment, the journal entry, the invitation email
 * in `locale`, and the claim of an account that already holds the address. A
 * `reason` is journaled with the invite when an operator writes it.
 */
export const writeInvite = Effect.fn("tenancy.invite.write")(function* (
  actor: typeof TenantActor.Type,
  person: TenantPeopleDoc,
  email: typeof Email.Type,
  locale: ActiveAppLocaleCode,
  reason?: typeof PersonReason.Type
) {
  const requestedAt = yield* Clock.currentTimeMillis;
  const expiresAt = requestedAt + Duration.toMillis(INVITE_TERM);
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
  const entryId = yield* personAuthority.record(
    actor,
    person,
    reason === undefined
      ? { invite: inviteId, type: "person.invited" }
      : { invite: inviteId, reason, type: "person.invited" }
  );
  yield* noteInvite(person.tenantId, entryId);
  yield* startInviteEmail(inviteId, locale, requestedAt);
  yield* claimAfterInvite(email);
  return invite;
});

/**
 * Invites one new Person into a school that already exists, as the system: the
 * Person is an active member that no account has claimed, and the pending invite
 * names the address, so an account that holds the address claims it. The school is
 * found by its address, and an address that no school uses is refused.
 */
export const inviteToSchool = Effect.fn("tenancy.invite.toSchool")(function* (
  actor: typeof TenantActor.Type,
  args: typeof InviteRequest.Type
) {
  const school = yield* (yield* DatabaseReader)
    .table("tenants")
    .index("by_slug", (query) => query.eq("slug", args.slug))
    .first()
    .pipe(Effect.orDie);
  if (Option.isNone(school)) {
    return yield* new ProvisionRejected({
      code: "SCHOOL_NOT_FOUND",
      message: "No school uses this address.",
    });
  }
  const person = yield* createPerson(actor, school.value._id, args.name);
  const invite = yield* writeInvite(actor, person, args.email, args.locale);
  return { invite: invite._id, person: person._id };
});

/**
 * Whether an address already holds a pending invite in this school. An invite whose
 * term has ended no longer counts, as `invite` decides it. The address index holds
 * the invites of every school, so the read takes a bounded few.
 */
export const addressInvited = Effect.fn("tenancy.invite.address")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  email: typeof Email.Type
) {
  const now = yield* Clock.currentTimeMillis;
  const pending = yield* (yield* DatabaseReader)
    .table("tenantInvites")
    .index("by_channel_email_and_state_status", (query) =>
      query.eq("channel.email", email).eq("state.status", "pending")
    )
    .take(ADDRESS_INVITE_LIMIT)
    .pipe(Effect.orDie);
  return Arr.some(
    pending,
    (invite) => invite.tenantId === tenantId && invite.expiresAt > now
  );
});
