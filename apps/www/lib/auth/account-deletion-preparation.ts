import { ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE } from "@repo/backend/convex/auth/deletion/constants";
import {
  type AccountDeletionBrowserAttempt,
  type AccountDeletionCancellationOutcome,
  type AccountDeletionPreparationOutcome,
  type AccountDeletionRequestPhase,
  accountDeletionCancellationOutcome,
  accountDeletionPreparationOutcome,
  accountDeletionRequestPhase,
} from "@repo/backend/convex/auth/deletion/spec";
import { Effect, Either } from "effect";
import type { AccountDeletionAttemptStorageFailed } from "@/lib/auth/account-deletion-attempt";
import {
  AccountDeletionFailed,
  AccountDeletionRequestUncertain,
  AccountDeletionSchoolMemberRequired,
  accountDeletionErrorCode,
} from "@/lib/auth/account-deletion-errors";

type AccountDeletionAttemptId = AccountDeletionBrowserAttempt["attemptId"];
type CancelAccountDeletionRequest = (
  attemptId: AccountDeletionAttemptId
) => Promise<AccountDeletionCancellationOutcome>;
type PrepareAccountDeletionRequest = (
  attemptId: AccountDeletionAttemptId
) => Promise<AccountDeletionPreparationOutcome>;
type PersistAccountDeletionAttempt = (
  attempt: AccountDeletionBrowserAttempt
) => Effect.Effect<void, AccountDeletionAttemptStorageFailed>;
type ClearAccountDeletionAttempt = () => Effect.Effect<
  void,
  AccountDeletionAttemptStorageFailed
>;

export interface AccountDeletionPreparationOperations {
  readonly attempt: AccountDeletionBrowserAttempt;
  readonly cancelPreparation: CancelAccountDeletionRequest;
  readonly clearAttempt: ClearAccountDeletionAttempt;
  readonly persist: PersistAccountDeletionAttempt;
  readonly prepare: PrepareAccountDeletionRequest;
}

/** Cancels every bounded batch owned by one browser deletion attempt. */
export const cancelPreparedAccountDeletion = Effect.fn(
  "www.auth.cancelPreparedAccountDeletion"
)(function* (
  attemptId: AccountDeletionAttemptId,
  uncertainPhase: AccountDeletionRequestPhase,
  cancelPreparation: CancelAccountDeletionRequest
) {
  let outcome: AccountDeletionCancellationOutcome =
    accountDeletionCancellationOutcome.continue;

  while (outcome === accountDeletionCancellationOutcome.continue) {
    outcome = yield* Effect.tryPromise({
      try: () => cancelPreparation(attemptId),
      catch: () =>
        new AccountDeletionRequestUncertain({
          attemptId,
          code: accountDeletionErrorCode.requestUncertain,
          phase: uncertainPhase,
        }),
    });
  }
});

/** Persists one durable browser phase without leaking storage failures. */
export const persistAccountDeletionPhase = Effect.fn(
  "www.auth.persistAccountDeletionPhase"
)(function* (
  attempt: AccountDeletionBrowserAttempt,
  phase: AccountDeletionRequestPhase,
  persist: PersistAccountDeletionAttempt
) {
  yield* persist({ ...attempt, phase }).pipe(
    Effect.mapError(
      () =>
        new AccountDeletionFailed({
          code: accountDeletionErrorCode.failed,
        })
    )
  );
});

/** Removes a proven-canceled browser attempt before another delete can begin. */
export const clearCanceledAccountDeletionAttempt = Effect.fn(
  "www.auth.clearCanceledAccountDeletionAttempt"
)(function* (clearAttempt: ClearAccountDeletionAttempt) {
  yield* clearAttempt().pipe(
    Effect.mapError(
      () =>
        new AccountDeletionFailed({
          code: accountDeletionErrorCode.failed,
        })
    )
  );
});

/** Reserves all owned resources before the irreversible auth deletion. */
export const prepareAccountDeletion = Effect.fn(
  "www.auth.prepareAccountDeletion"
)(function* ({
  attempt,
  cancelPreparation,
  clearAttempt,
  persist,
  prepare,
}: AccountDeletionPreparationOperations) {
  const { attemptId } = attempt;
  let preparationOutcome: AccountDeletionPreparationOutcome =
    accountDeletionPreparationOutcome.continue;

  while (preparationOutcome === accountDeletionPreparationOutcome.continue) {
    preparationOutcome = yield* Effect.tryPromise({
      try: () => prepare(attemptId),
      catch: () =>
        new AccountDeletionRequestUncertain({
          attemptId,
          code: accountDeletionErrorCode.requestUncertain,
          phase: accountDeletionRequestPhase.preparation,
        }),
    });
  }

  if (
    preparationOutcome ===
    accountDeletionPreparationOutcome.schoolSuccessorRequired
  ) {
    yield* cancelPreparedAccountDeletion(
      attemptId,
      accountDeletionRequestPhase.preparation,
      cancelPreparation
    );
    yield* clearCanceledAccountDeletionAttempt(clearAttempt);
    return yield* new AccountDeletionSchoolMemberRequired({
      code: ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE,
    });
  }

  if (preparationOutcome !== accountDeletionPreparationOutcome.ready) {
    yield* cancelPreparedAccountDeletion(
      attemptId,
      accountDeletionRequestPhase.preparation,
      cancelPreparation
    );
    yield* clearCanceledAccountDeletionAttempt(clearAttempt);
    return yield* new AccountDeletionFailed({
      code: accountDeletionErrorCode.failed,
    });
  }

  const persistedDeletionPhase = yield* Effect.either(
    persistAccountDeletionPhase(
      attempt,
      accountDeletionRequestPhase.deletion,
      persist
    )
  );

  if (Either.isLeft(persistedDeletionPhase)) {
    yield* cancelPreparedAccountDeletion(
      attemptId,
      accountDeletionRequestPhase.preparation,
      cancelPreparation
    );
    yield* clearCanceledAccountDeletionAttempt(clearAttempt);
    return yield* persistedDeletionPhase.left;
  }
});
