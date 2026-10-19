import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import type {
  TenantInvitesDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { activeGrants } from "@repo/backend/confect/access/policy";
import { startInviteEmail } from "@repo/backend/confect/emails/invite/workflow";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { noteInvite } from "@repo/backend/confect/notifications/inbox";
import { purgeInvite } from "@repo/backend/confect/notifications/purge";
import { Person } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  personAccess,
  personAuthority,
} from "@repo/backend/confect/tenancy/authority";
import {
  InviteDomainRefused,
  InviteExpired,
  InviteNotPending,
  InvitePending,
  InviteRateLimited,
  PersonClaimed,
} from "@repo/backend/confect/tenancy/errors";
import {
  expireInvite,
  replaceInviteState,
  writeInvite,
} from "@repo/backend/confect/tenancy/invite";
import spec from "@repo/backend/confect/tenancy/invites.spec";
import { admitsAddress } from "@repo/backend/confect/tenancy/policy";
import { Array as Arr, Clock, Effect, Layer, Option, Struct } from "effect";

/** Sends one Person's invite again at most this many times in any hour: the school's named rate. */
const INVITE_RESENDS_PER_HOUR = 3;

/**
 * A bucket of one token that refills three times an hour, so two resends are
 * at least twenty minutes apart and no hour holds more than three. A fixed
 * window would let a burst of three at the end of one window and three at the
 * start of the next pass.
 */
const inviteResends = new RateLimiter(components.agentRateLimiter, {
  inviteResend: {
    capacity: 1,
    kind: "token bucket",
    period: HOUR,
    rate: INVITE_RESENDS_PER_HOUR,
  },
});

/**
 * Whether a pending invite still waits: one whose term has ended is expired, even before its
 * scheduled expiry runs. Only the pending and expired invites of a school are shown.
 */
const statusOf = (
  invite: TenantInvitesDoc,
  now: number
): "expired" | "pending" =>
  invite.state.status === "pending" && invite.expiresAt > now
    ? "pending"
    : "expired";

/**
 * One invite as the wire shows it: the Person it invites with the name and the roles that
 * Person holds, and the status of the invite.
 */
const viewOf = Effect.fnUntraced(function* (
  invite: TenantInvitesDoc,
  person: TenantPeopleDoc
) {
  const now = yield* Clock.currentTimeMillis;
  const grants = yield* activeGrants(person._id);
  return {
    email: invite.channel.email,
    expiresAt: invite.expiresAt,
    id: invite._id,
    name: person.name,
    personId: invite.personId,
    roles: Arr.dedupe(Arr.map(grants, (grant) => grant.role.key)),
    status: statusOf(invite, now),
  };
});

/**
 * Loads one invite by ID. An invite that does not exist is denied the way an
 * invite of another school is, so an ID probe reveals nothing.
 */
const loadInvite = Effect.fnUntraced(function* (
  inviteId: GenericId.GenericId<"tenantInvites">
) {
  return yield* (yield* DatabaseReader)
    .table("tenantInvites")
    .get(inviteId)
    .pipe(
      Effect.catchTags({
        DocumentDecodeError: Effect.die,
        GetByIdFailure: () =>
          new AccessDenied({ action: "person.invite", reason: "resource" }),
      })
    );
});

/**
 * The pending and expired invites of one school, a page at a time, the pending ones first
 * and each group newest first, with the name and the roles of each Person.
 */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("tenancy.invites.list")(function* ({ paginationOpts }) {
    const { tenant } = yield* Member;
    const reader = yield* DatabaseReader;
    const page = yield* reader
      .table("tenantInvites")
      .index(
        "by_tenantId_and_state_status",
        (query) =>
          query
            .eq("tenantId", tenant._id)
            .gte("state.status", "expired")
            .lte("state.status", "pending"),
        "desc"
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    const rows = yield* Effect.forEach(
      page.page,
      (invite) =>
        reader
          .table("tenantPeople")
          .get(invite.personId)
          .pipe(
            Effect.orDie,
            Effect.flatMap((person) => viewOf(invite, person))
          ),
      { concurrency: "unbounded" }
    );
    return Struct.assign(page, { page: rows });
  })
);

/**
 * Invites one unclaimed Person to the school at an address. The address must be
 * on a domain the school admits, and the Person has at most one pending invite.
 * A pending invite whose term has ended no longer counts: it is expired here,
 * because its scheduled expiry may not have run yet.
 */
const invite = FunctionImpl.make(
  databaseSchema,
  spec,
  "invite",
  Effect.fn("tenancy.invites.invite")(function* ({ email, locale }) {
    const { person: actor, tenant } = yield* Member;
    const person = yield* Person;
    if (person.account.state === "claimed") {
      return yield* new PersonClaimed();
    }
    if (!admitsAddress(tenant.policies, email)) {
      return yield* new InviteDomainRefused();
    }
    const pending = yield* (yield* DatabaseReader)
      .table("tenantInvites")
      .index("by_personId_and_state_status", (query) =>
        query.eq("personId", person._id).eq("state.status", "pending")
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(pending)) {
      if (pending.value.expiresAt > (yield* Clock.currentTimeMillis)) {
        return yield* new InvitePending();
      }
      yield* expireInvite(pending.value, person);
    }
    const written = yield* writeInvite(
      personActor(actor),
      person,
      email,
      locale
    );
    return yield* viewOf(written, person);
  })
);

/** Revokes a pending invite. An invite that is no longer pending changes nothing. */
const revoke = FunctionImpl.make(
  databaseSchema,
  spec,
  "revoke",
  Effect.fn("tenancy.invites.revoke")(function* ({ inviteId }) {
    const { person: actor } = yield* Member;
    const stored = yield* loadInvite(inviteId);
    const person = yield* personAuthority.authorize(
      "person.invite",
      stored.personId
    );
    if (stored.state.status === "pending") {
      yield* replaceInviteState(stored, {
        at: yield* Clock.currentTimeMillis,
        status: "revoked",
      });
      yield* purgeInvite(stored.personId, stored._id);
      yield* personAuthority.record(personActor(actor), person, {
        invite: stored._id,
        type: "invite.revoked",
      });
    }
    return null;
  })
);

/**
 * Sends a pending invite again, to the same address, once the school's resend
 * rate allows it. An invite that expired is never sent again: the school invites
 * the Person anew instead, and the expiry date stays where the invite put it.
 */
const resend = FunctionImpl.make(
  databaseSchema,
  spec,
  "resend",
  Effect.fn("tenancy.invites.resend")(function* ({ inviteId, locale }) {
    const { person: actor } = yield* Member;
    const stored = yield* loadInvite(inviteId);
    const person = yield* personAuthority.authorize(
      "person.invite",
      stored.personId
    );
    if (person.account.state === "claimed") {
      return yield* new PersonClaimed();
    }
    const now = yield* Clock.currentTimeMillis;
    if (
      stored.state.status === "expired" ||
      (stored.state.status === "pending" && stored.expiresAt <= now)
    ) {
      return yield* new InviteExpired();
    }
    if (stored.state.status !== "pending") {
      return yield* new InviteNotPending();
    }
    const ctx = yield* MutationCtx;
    const quota = yield* Effect.tryPromise(() =>
      inviteResends.limit(ctx, "inviteResend", { key: person._id })
    ).pipe(Effect.orDie);
    if (!quota.ok) {
      return yield* new InviteRateLimited();
    }
    yield* startInviteEmail(stored._id, locale, now);
    yield* personAuthority.record(personActor(actor), person, {
      invite: stored._id,
      type: "invite.resent",
    });
    const entryId = yield* personAuthority.record(personActor(actor), person, {
      invite: stored._id,
      type: "person.invited",
    });
    yield* noteInvite(person.tenantId, entryId);
    return yield* viewOf(stored, person);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(invite),
  Layer.provide(revoke),
  Layer.provide(resend),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  Layer.provide(personAccess),
  GroupImpl.finalize
);
