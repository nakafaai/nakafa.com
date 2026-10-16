import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type {
  TenantInvitesDoc,
  UsersDoc,
} from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { authReader } from "@repo/backend/confect/auth/reader";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import {
  bindPerson,
  type ClaimedAccount,
} from "@repo/backend/confect/tenancy/claim";
import { CLAIM_PAGE_SIZE } from "@repo/backend/confect/tenancy/claims";
import spec from "@repo/backend/confect/tenancy/claims.spec";
import { admitsAddress } from "@repo/backend/confect/tenancy/policy";
import type { InviteState } from "@repo/backend/confect/tenancy/schema";
import { Clock, Duration, Effect, Layer, Option, Struct } from "effect";

/**
 * The address Better Auth has verified for an account. Better Auth lowercases
 * every address it saves, which is the form invites store, and the account row
 * here only mirrors it, so the answer comes from Better Auth itself.
 */
const verifiedEmail = Effect.fn("tenancy.claims.email")(function* (
  user: UsersDoc
) {
  const ctx = yield* MutationCtx;
  const authUser = yield* Effect.promise(() =>
    authReader.getAnyUserById(ctx, user.authId)
  );
  return authUser?.emailVerified === true
    ? Option.some(authUser.email)
    : Option.none();
});

/**
 * Binds the invited Person to the account and accepts the invite, unless the
 * Person is not waiting any more, the account already holds a Person in the
 * tenant, the tenant is suspended, which refuses every write, the invite has
 * reached its expiry, or the tenant's email domains do not admit the address:
 * then the invite stays as it is for the school to resolve.
 */
const claim = Effect.fn("tenancy.claims.claim")(function* (
  invite: TenantInvitesDoc,
  userId: GenericId.GenericId<"users">
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const person = yield* reader
    .table("tenantPeople")
    .get(invite.personId)
    .pipe(Effect.orDie);
  const tenant = yield* reader
    .table("tenants")
    .get(invite.tenantId)
    .pipe(Effect.orDie);
  const held = yield* reader
    .table("tenantPeople")
    .get("by_tenantId_and_account_userId", invite.tenantId, userId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
  const at = yield* Clock.currentTimeMillis;
  if (
    tenant.status !== "active" ||
    person.status !== "active" ||
    person.account.state !== "unclaimed" ||
    Option.isSome(held) ||
    invite.expiresAt <= at ||
    !admitsAddress(tenant.policies, invite.channel.email)
  ) {
    return;
  }
  const account: ClaimedAccount = {
    claimedAt: at,
    method: "invite",
    state: "claimed",
    userId,
  };
  const state: typeof InviteState.Type = { at, status: "accepted", userId };
  yield* bindPerson(person, account);
  yield* writer
    .table("tenantInvites")
    .replace(
      invite._id,
      Struct.assign(Struct.omit(invite, ["_creationTime", "_id"]), { state })
    )
    .pipe(Effect.orDie);
  yield* personAuthority.record(systemActor, person, {
    method: "invite",
    type: "person.claimed",
  });
});

/**
 * Claims one page of the pending invites that name the account's verified
 * address, then schedules the next page, so an account invited to many schools
 * joins them all. An account that is being deleted, or whose address Better
 * Auth has not verified, claims nothing.
 */
const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("tenancy.claims.run")(function* ({ cursor, userId }) {
    const reader = yield* DatabaseReader;
    const user = yield* reader
      .table("users")
      .get(userId)
      .pipe(
        Effect.asSome,
        Effect.catchTag("GetByIdFailure", () => Effect.succeedNone),
        Effect.orDie
      );
    if (Option.isNone(user) || isAccountDeletionPending(user.value)) {
      return null;
    }
    const email = yield* verifiedEmail(user.value);
    if (Option.isNone(email)) {
      return null;
    }
    const page = yield* reader
      .table("tenantInvites")
      .index("by_channel_email_and_state_status", (query) =>
        query.eq("channel.email", email.value).eq("state.status", "pending")
      )
      .paginate({ cursor, numItems: CLAIM_PAGE_SIZE })
      .pipe(Effect.orDie);
    yield* Effect.forEach(page.page, (invite) => claim(invite, userId), {
      discard: true,
    });
    if (!page.isDone) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.tenancy.claims.run,
        { cursor: page.continueCursor, userId }
      );
    }
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(run),
  GroupImpl.finalize
);
