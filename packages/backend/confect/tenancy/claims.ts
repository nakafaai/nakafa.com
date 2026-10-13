import type { GenericId } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import type { Email } from "@repo/backend/confect/tenancy/schema";
import { Duration, Effect, Option } from "effect";

/**
 * Rows one scheduled claim step handles at most: the invites that one run
 * claims, and the accounts that one `tenancy/holders` page schedules a run for.
 * A page of them reads a few documents per row, far inside the 4,096 index
 * ranges that one mutation may read.
 */
export const CLAIM_PAGE_SIZE = 20;

/** Schedules the claim run of one account, outside the transaction that asked for it. */
export const scheduleRun = Effect.fn("tenancy.claims.schedule")(function* (
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
 * invite costs one indexed read. Invites store the form that `Email` accepts,
 * trimmed and lowercase, so an address in any other form matches none.
 */
export const claimAfterVerification = Effect.fn(
  "tenancy.claims.afterVerification"
)(function* (userId: GenericId.GenericId<"users">, address: string) {
  const waiting = yield* (yield* DatabaseReader)
    .table("tenantInvites")
    .index("by_channel_email_and_state_status", (query) =>
      query.eq("channel.email", address).eq("state.status", "pending")
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(waiting)) {
    yield* scheduleRun(userId);
  }
});

/**
 * After an invite is made: schedules the walk over the accounts that already
 * hold the invited address, because no sign-in is coming to claim it. The walk
 * is its own step, so no number of accounts is assumed here.
 */
export const claimAfterInvite = Effect.fn("tenancy.claims.afterInvite")(
  function* (email: typeof Email.Type) {
    yield* (yield* Scheduler).runAfter(
      Duration.zero,
      refs.internal.tenancy.holders.schedule,
      { cursor: null, email }
    );
  }
);
