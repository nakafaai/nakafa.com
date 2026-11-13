import authInternal from "@repo/backend/confect/_generated/refs/auth.server";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE } from "@repo/backend/confect/auth/deletion/constants";
import { deleteAccountAgents } from "@repo/backend/confect/auth/grant/agents";
import { releaseTenantPeople } from "@repo/backend/confect/auth/deletion/release";
import { createDeletedUserTombstone } from "@repo/backend/confect/auth/deletion/tombstone";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Duration, Effect, flow, Option } from "effect";

/**
 * Finishes a deleted account: deletes the agents it let in and releases its
 * Persons, one bounded batch per transaction, then replaces the profile with the tombstone that shared records
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
