import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import {
  cancelAccountDeletionBatch,
  hasAccountDeletionCancellation,
} from "@repo/backend/confect/auth/deletion/cancel";
import { ACCOUNT_DELETION_RECOVERY_DELAY_MS } from "@repo/backend/confect/auth/deletion/constants";
import { accountDeletionPreparationOutcome } from "@repo/backend/confect/auth/deletion/spec";
import { findSchoolOwnershipSuccessorPage } from "@repo/backend/confect/auth/deletion/successor";
import { Clock, Effect, flow, Option } from "effect";

type AccountDeletionPreparation = Docs["accountDeletionPreparations"];
type AccountDeletionPreparationProgress = {
  [Key in
    | "pendingSchoolId"
    | "pendingSchoolNextCursor"
    | "schoolCursor"
    | "successorCursor"]?: AccountDeletionPreparation[Key] | undefined;
};
type AppUser = Docs["users"];

/** Persists cursor progress and atomically renews its versioned recovery lease. */
const advancePreparation = Effect.fn("auth.deletion.advancePreparation")(
  function* (
    preparation: AccountDeletionPreparation,
    progress: AccountDeletionPreparationProgress
  ) {
    const writer = yield* DatabaseWriter;
    const progressedAt = yield* Clock.currentTimeMillis;
    yield* writer
      .table("accountDeletionPreparations")
      .patch(preparation._id, {
        ...progress,
        recoveryAt: progressedAt + ACCOUNT_DELETION_RECOVERY_DELAY_MS,
        recoveryGeneration: preparation.recoveryGeneration + 1,
      })
      .pipe(Effect.orDie);
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Marks a fully reserved preparation ready and refreshes its recovery lease. */
const completePreparation = Effect.fn("auth.deletion.completePreparation")(
  function* (user: AppUser, preparation: AccountDeletionPreparation) {
    const writer = yield* DatabaseWriter;
    const readyAt = yield* Clock.currentTimeMillis;
    const recoveryGeneration = preparation.recoveryGeneration + 1;
    yield* writer
      .table("accountDeletionPreparations")
      .patch(preparation._id, {
        pendingSchoolId: undefined,
        pendingSchoolNextCursor: undefined,
        readyAt,
        recoveryAt: readyAt + ACCOUNT_DELETION_RECOVERY_DELAY_MS,
        recoveryGeneration,
        schoolCursor: undefined,
        successorCursor: undefined,
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("users")
      .patch(user._id, {
        deletionPreparedAt: readyAt,
      })
      .pipe(Effect.orDie);
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Advances one bounded, cursor-backed school reservation transaction. */
const reserveSchoolSuccessors = Effect.fn(
  "auth.deletion.reserveSchoolSuccessors"
)(
  function* (
    user: AppUser,
    preparation: AccountDeletionPreparation,
    attemptId: string
  ) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const schoolCursor = preparation.schoolCursor ?? null;
    let pendingSchoolId = preparation.pendingSchoolId;
    let pendingSchoolNextCursor = preparation.pendingSchoolNextCursor;
    let successorCursor = preparation.successorCursor ?? null;
    if (!pendingSchoolId) {
      const schoolPage = yield* database
        .table("schools")
        .index("by_createdBy", (query) => query.eq("createdBy", user._id))
        .paginate({
          cursor: schoolCursor,
          numItems: 1,
        })
        .pipe(Effect.orDie);
      const school = schoolPage.page[0];
      if (!school) {
        return accountDeletionPreparationOutcome.ready;
      }
      pendingSchoolId = school._id;
      pendingSchoolNextCursor = schoolPage.continueCursor;
      successorCursor = null;
      yield* advancePreparation(preparation, {
        pendingSchoolId,
        pendingSchoolNextCursor,
        schoolCursor: schoolCursor ?? undefined,
        successorCursor: undefined,
      });
      return accountDeletionPreparationOutcome.continue;
    }
    const school = yield* database
      .table("schools")
      .get(pendingSchoolId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!school || school.createdBy !== user._id) {
      yield* advancePreparation(preparation, {
        pendingSchoolId: undefined,
        pendingSchoolNextCursor: undefined,
        schoolCursor: pendingSchoolNextCursor,
        successorCursor: undefined,
      });
      return accountDeletionPreparationOutcome.continue;
    }
    const successor = yield* findSchoolOwnershipSuccessorPage(
      school._id,
      user._id,
      successorCursor
    );
    if (successor.kind === "continue") {
      yield* advancePreparation(preparation, {
        pendingSchoolId: school._id,
        pendingSchoolNextCursor,
        schoolCursor: schoolCursor ?? undefined,
        successorCursor: successor.cursor,
      });
      return accountDeletionPreparationOutcome.continue;
    }
    if (successor.kind === "not-found") {
      yield* cancelAccountDeletionBatch(preparation.authId, {
        attemptId,
        preparationId: preparation._id,
        recoveryGeneration: preparation.recoveryGeneration,
      });
      return accountDeletionPreparationOutcome.schoolSuccessorRequired;
    }
    yield* writer
      .table("accountDeletionSchoolTransfers")
      .insert({
        preparationId: preparation._id,
        schoolId: school._id,
        successorMembershipId: successor.successorMembership._id,
        successorUserId: successor.successorMembership.userId,
      })
      .pipe(Effect.orDie);
    yield* advancePreparation(preparation, {
      pendingSchoolId: undefined,
      pendingSchoolNextCursor: undefined,
      schoolCursor: pendingSchoolNextCursor,
      successorCursor: undefined,
    });
    return accountDeletionPreparationOutcome.continue;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Creates or advances the exact browser attempt's durable preparation. */
export const prepareAccountDeletion = Effect.fn(
  "auth.deletion.prepareAccountDeletion"
)(
  function* (authId: string, attemptId: string) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const user = yield* database
      .table("users")
      .get("by_authId", authId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!user || user.deletedAt !== undefined) {
      return accountDeletionPreparationOutcome.ready;
    }
    if (yield* hasAccountDeletionCancellation(attemptId)) {
      return accountDeletionPreparationOutcome.temporarilyUnavailable;
    }
    let preparation = yield* database
      .table("accountDeletionPreparations")
      .get("by_authId", authId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (preparation?.finalizedAt !== undefined) {
      return accountDeletionPreparationOutcome.temporarilyUnavailable;
    }
    if (preparation?.cancellationStartedAt !== undefined) {
      return accountDeletionPreparationOutcome.temporarilyUnavailable;
    }
    if (
      preparation &&
      (preparation.attemptId !== attemptId || preparation.userId !== user._id)
    ) {
      return accountDeletionPreparationOutcome.temporarilyUnavailable;
    }
    if (preparation?.readyAt !== undefined) {
      yield* completePreparation(user, preparation);
      return accountDeletionPreparationOutcome.ready;
    }
    if (!preparation) {
      const successorReservation = yield* database
        .table("accountDeletionSchoolTransfers")
        .index("by_successorUserId", (query) =>
          query.eq("successorUserId", user._id)
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (successorReservation) {
        return accountDeletionPreparationOutcome.temporarilyUnavailable;
      }
      const preparationStartedAt = yield* Clock.currentTimeMillis;
      const preparationId = yield* writer
        .table("accountDeletionPreparations")
        .insert({
          attemptId,
          authId,
          recoveryAt: preparationStartedAt + ACCOUNT_DELETION_RECOVERY_DELAY_MS,
          recoveryGeneration: 0,
          userId: user._id,
        })
        .pipe(Effect.orDie);
      yield* writer
        .table("users")
        .patch(user._id, {
          deletionPreparedAt: preparationStartedAt,
        })
        .pipe(Effect.orDie);
      preparation = yield* database
        .table("accountDeletionPreparations")
        .get(preparationId)
        .pipe(Effect.orDie);
    }
    const outcome = yield* reserveSchoolSuccessors(
      user,
      preparation,
      attemptId
    );
    if (outcome === accountDeletionPreparationOutcome.ready) {
      yield* completePreparation(user, preparation);
      return accountDeletionPreparationOutcome.ready;
    }
    return outcome;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
