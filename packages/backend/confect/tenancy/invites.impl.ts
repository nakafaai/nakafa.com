import { FunctionImpl, GroupImpl } from "@confect/server";
import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { startInviteEmail } from "@repo/backend/confect/emails/invite/workflow";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { noteInvite } from "@repo/backend/confect/notifications/inbox";
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
  writeInvite,
} from "@repo/backend/confect/tenancy/invite";
import spec from "@repo/backend/confect/tenancy/invites.spec";
import {
  list,
  loadInvite,
  revoke,
  viewOf,
} from "@repo/backend/confect/tenancy/invites.table";
import { admitsAddress } from "@repo/backend/confect/tenancy/policy";
import { Clock, Effect, Layer, Option } from "effect";

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
