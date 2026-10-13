import type { GenericId } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { Duration, Effect, Option, Schema } from "effect";

/**
 * Invites one run claims at most. A page of them reads a few documents each,
 * far inside the 4,096 index ranges that one mutation may read.
 */
export const CLAIM_PAGE_SIZE = 20;

/**
 * Accounts that can hold one address. Better Auth keeps one account for an
 * address, so the bound only protects the read.
 */
const ACCOUNT_LIMIT = 2;

/** Schedules the claim run of one account, outside the transaction that asked for it. */
const scheduleRun = Effect.fn("tenancy.claims.schedule")(function* (
  userId: GenericId.GenericId<"users">
) {
  yield* (yield* Scheduler).runAfter(
    Duration.zero,
    refs.internal.tenancy.claims.run,
    { cursor: null, userId }
  );
});

/**
 * After an account signs up or Better Auth verifies its address: schedules the
 * claim run only when an invite waits for that address, so a sign-up with no
 * invite costs one indexed read. An address that is not in the form that
 * invites store can match no invite.
 */
export const claimAfterVerification = Effect.fn(
  "tenancy.claims.afterVerification"
)(function* (userId: GenericId.GenericId<"users">, address: string) {
  const email = Schema.decodeOption(Email)(address);
  if (Option.isNone(email)) {
    return;
  }
  const waiting = yield* (yield* DatabaseReader)
    .table("tenantInvites")
    .index("by_channel_email_and_state_status", (query) =>
      query.eq("channel.email", email.value).eq("state.status", "pending")
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(waiting)) {
    yield* scheduleRun(userId);
  }
});

/**
 * After an invite is made: schedules the claim run of each account that
 * already holds the invited address, because no sign-in is coming to do it.
 */
export const claimAfterInvite = Effect.fn("tenancy.claims.afterInvite")(
  function* (email: typeof Email.Type) {
    const users = yield* (yield* DatabaseReader)
      .table("users")
      .index("by_email", (query) => query.eq("email", email))
      .take(ACCOUNT_LIMIT)
      .pipe(Effect.orDie);
    yield* Effect.forEach(users, (user) => scheduleRun(user._id), {
      discard: true,
    });
  }
);
