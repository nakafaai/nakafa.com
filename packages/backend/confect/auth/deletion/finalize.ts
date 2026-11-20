import { components } from "@repo/backend/confect/_generated/components";
import authInternal from "@repo/backend/confect/_generated/refs/auth.server";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE } from "@repo/backend/confect/auth/deletion/constants";
import { releaseTenantPeople } from "@repo/backend/confect/auth/deletion/release";
import { createDeletedUserTombstone } from "@repo/backend/confect/auth/deletion/tombstone";
import { deleteAccountAgents } from "@repo/backend/confect/auth/grant/agents";
import { removeWelcomeIntent } from "@repo/backend/confect/emails/welcome/impl";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Duration, Effect, flow, Option } from "effect";

/**
 * Finishes a deleted account: cancels the welcome email it was still owed and
 * erases that intent, deletes the agents it let in and releases its
 * Persons, one bounded batch per transaction, then erases its Google accounts
 * in Convex Auth, replaces the profile with the tombstone that shared records
 * keep (`deletion/tombstone`) and starts the durable cleanup of everything else.
 * A run that finds more agents or Persons schedules the next one; an account that is not
 * deleted, or whose cleanup already started, is left as it is.
 */
export const finalizeAccountDeletion = Effect.fn(
  "auth.deletion.finalizeAccountDeletion"
)(
  function* (userId: Id<"users">) {
    const scheduler = yield* Scheduler;
    const user = yield* (yield* DatabaseReader)
      .table("users")
      .get(userId)
      .pipe(Effect.option);
    if (
      Option.isNone(user) ||
      user.value.deletedAt === undefined ||
      user.value.deletionCleanupStartedAt !== undefined
    ) {
      return;
    }
    const { deletedAt } = user.value;
    yield* removeWelcomeIntent(userId);
    const moreAgents = yield* deleteAccountAgents(
      userId,
      ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE
    );
    if (moreAgents || (yield* releaseTenantPeople(user.value, deletedAt))) {
      yield* scheduler.runAfter(
        Duration.zero,
        authInternal.deletion.workflow.finalize,
        { userId }
      );
      return;
    }
    // A user holds one Google account row for each Google identity they signed
    // in with, so the deletion reads only that person's rows (ADR 0009).
    const ctx = yield* MutationCtx;
    yield* Effect.promise(() =>
      ctx.runMutation(components.authGoogle.provider.deleteUser, { userId })
    );
    yield* (yield* DatabaseWriter)
      .table("users")
      .patch(userId, createDeletedUserTombstone(userId, deletedAt))
      .pipe(Effect.orDie);
    yield* scheduler.runAfter(
      Duration.zero,
      authInternal.deletion.workflow.launch,
      { userId }
    );
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
