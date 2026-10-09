import type { InvokeReturn } from "@confect/react";
import type auth from "@repo/backend/confect/_generated/refs/auth";
import { ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE } from "@repo/backend/confect/auth/deletion/constants";
import {
  type AccountDeletionBrowserAttempt,
  type AccountDeletionCancellationOutcome,
  type AccountDeletionPreparationOutcome,
  type AccountDeletionRequestPhase,
  accountDeletionCancellationOutcome,
  accountDeletionPreparationOutcome,
  accountDeletionRequestPhase,
} from "@repo/backend/confect/auth/deletion/spec";
import { Effect, Result } from "effect";
import type { AccountDeletionAttemptStorageFailed } from "@/lib/auth/deletion/attempt";
import {
  AccountDeletionFailed,
  AccountDeletionRequestUncertain,
  AccountDeletionSchoolMemberRequired,
  accountDeletionErrorCode,
} from "@/lib/auth/deletion/errors";

type AccountDeletionAttemptId = AccountDeletionBrowserAttempt["attemptId"];
export type CancelAccountDeletionRequest = (
  attemptId: AccountDeletionAttemptId
) => InvokeReturn<typeof auth.deletion.cancelAccountDeletionAttempt>;
export type PrepareAccountDeletionRequest = (
  attemptId: AccountDeletionAttemptId
) => InvokeReturn<typeof auth.deletion.prepareCurrentAccountDeletion>;
export type PersistAccountDeletionAttempt = (
  attempt: AccountDeletionBrowserAttempt
) => Effect.Effect<void, AccountDeletionAttemptStorageFailed>;
export type ClearAccountDeletionAttempt = Effect.Effect<
  void,
  AccountDeletionAttemptStorageFailed
>;
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
    outcome = yield* Effect.tryPromise(() => cancelPreparation(attemptId)).pipe(
      Effect.flatMap(Effect.fromResult),
      Effect.mapError(
        () =>
          new AccountDeletionRequestUncertain({
            attemptId,
            code: accountDeletionErrorCode.requestUncertain,
            phase: uncertainPhase,
          })
      )
    );
  }
});
/** Persists one durable browser phase without leaking storage failures. */
const persistAccountDeletionPhase = Effect.fn(
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
  yield* clearAttempt.pipe(
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
}: {
  readonly attempt: AccountDeletionBrowserAttempt;
  readonly cancelPreparation: CancelAccountDeletionRequest;
  readonly clearAttempt: ClearAccountDeletionAttempt;
  readonly persist: PersistAccountDeletionAttempt;
  readonly prepare: PrepareAccountDeletionRequest;
}) {
  const { attemptId } = attempt;
  let preparationOutcome: AccountDeletionPreparationOutcome =
    accountDeletionPreparationOutcome.continue;
  while (preparationOutcome === accountDeletionPreparationOutcome.continue) {
    preparationOutcome = yield* Effect.tryPromise(() =>
      prepare(attemptId)
    ).pipe(
      Effect.flatMap(Effect.fromResult),
      Effect.mapError(
        () =>
          new AccountDeletionRequestUncertain({
            attemptId,
            code: accountDeletionErrorCode.requestUncertain,
            phase: accountDeletionRequestPhase.preparation,
          })
      )
    );
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
  const persistedDeletionPhase = yield* Effect.result(
    persistAccountDeletionPhase(
      attempt,
      accountDeletionRequestPhase.deletion,
      persist
    )
  );
  if (Result.isFailure(persistedDeletionPhase)) {
    yield* cancelPreparedAccountDeletion(
      attemptId,
      accountDeletionRequestPhase.preparation,
      cancelPreparation
    );
    yield* clearCanceledAccountDeletionAttempt(clearAttempt);
    return yield* persistedDeletionPhase.failure;
  }
});
