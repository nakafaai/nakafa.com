import type { Ref } from "@confect/core";
import type { HttpClient } from "@confect/js";
import type refs from "@repo/backend/confect/_generated/refs";
import {
  ACCOUNT_DELETION_ATTEMPT_HEADER,
  ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE,
  ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE,
  ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
} from "@repo/backend/confect/auth/deletion/constants";
import {
  type AccountDeletionAttemptStatus,
  type AccountDeletionBrowserAttempt,
  accountDeletionAttemptStatus,
  accountDeletionRequestPhase,
} from "@repo/backend/confect/auth/deletion/spec";
import type { Schema } from "effect";
import { Effect, Result } from "effect";
import { authClient } from "@/lib/auth/client";
import {
  AccountDeletionFailed,
  AccountDeletionRequestUncertain,
  AccountDeletionSchoolMemberRequired,
  AccountDeletionSessionExpired,
  accountDeletionErrorCode,
} from "@/lib/auth/deletion/errors";
import {
  type CancelAccountDeletionRequest,
  type ClearAccountDeletionAttempt,
  cancelPreparedAccountDeletion,
  clearCanceledAccountDeletionAttempt,
  type PersistAccountDeletionAttempt,
  type PrepareAccountDeletionRequest,
  prepareAccountDeletion,
} from "@/lib/auth/deletion/prepare";

const betterAuthSessionExpiredCode = "SESSION_EXPIRED";
const betterAuthUserDeletedMessage = "User deleted";
type DeleteUserResult = Awaited<ReturnType<typeof authClient.deleteUser>>;
type AccountDeletionAttemptId = AccountDeletionBrowserAttempt["attemptId"];
export type DeleteUserRequest = (
  attemptId: AccountDeletionAttemptId
) => Promise<DeleteUserResult>;
export type ReconcileAccountDeletionRequest = (
  attemptId: AccountDeletionAttemptId
) => Effect.Effect<
  AccountDeletionAttemptStatus,
  | Ref.Error<typeof refs.public.auth.deletion.getAccountDeletionAttemptStatus>
  | HttpClient.HttpClientError
  | Schema.SchemaError
>;
/** Deletes the current Better Auth account through a typed failure channel. */
export const deleteCurrentAccount = Effect.fn("www.auth.deleteCurrentAccount")(
  function* ({
    attempt,
    cancelPreparation,
    clearAttempt,
    persist,
    prepare,
    reconcile,
    request = async (requestAttemptId) =>
      await authClient.deleteUser({
        fetchOptions: {
          headers: {
            [ACCOUNT_DELETION_ATTEMPT_HEADER]: requestAttemptId,
          },
        },
      }),
  }: {
    readonly attempt: AccountDeletionBrowserAttempt;
    readonly cancelPreparation: CancelAccountDeletionRequest;
    readonly clearAttempt: ClearAccountDeletionAttempt;
    readonly persist: PersistAccountDeletionAttempt;
    readonly prepare: PrepareAccountDeletionRequest;
    readonly reconcile: ReconcileAccountDeletionRequest;
    readonly request?: DeleteUserRequest;
  }) {
    const { attemptId, phase: startPhase } = attempt;
    const proveCommittedDeletion = () =>
      reconcile(attemptId).pipe(
        Effect.mapError(
          () =>
            new AccountDeletionRequestUncertain({
              attemptId,
              code: accountDeletionErrorCode.requestUncertain,
              phase: accountDeletionRequestPhase.deletion,
            })
        ),
        Effect.map(
          (status) => status === accountDeletionAttemptStatus.committed
        )
      );
    const resetPreparedAttempt = () =>
      Effect.gen(function* () {
        yield* cancelPreparedAccountDeletion(
          attemptId,
          accountDeletionRequestPhase.deletion,
          cancelPreparation
        );
        yield* clearCanceledAccountDeletionAttempt(clearAttempt);
      });
    if (startPhase === accountDeletionRequestPhase.preparation) {
      yield* prepareAccountDeletion({
        attempt,
        cancelPreparation,
        clearAttempt,
        persist,
        prepare,
      });
    }
    if (
      startPhase === accountDeletionRequestPhase.deletion &&
      (yield* proveCommittedDeletion())
    ) {
      return;
    }
    const resultOrFailure = yield* Effect.result(
      Effect.tryPromise({
        try: () => request(attemptId),
        catch: () =>
          new AccountDeletionRequestUncertain({
            attemptId,
            code: accountDeletionErrorCode.requestUncertain,
            phase: accountDeletionRequestPhase.deletion,
          }),
      })
    );
    if (Result.isFailure(resultOrFailure)) {
      const reconciliation = yield* Effect.result(proveCommittedDeletion());
      if (Result.isSuccess(reconciliation) && reconciliation.success) {
        return;
      }
      return yield* resultOrFailure.failure;
    }
    const result = resultOrFailure.success;
    if (
      !result.error &&
      result.data?.success === true &&
      result.data.message === betterAuthUserDeletedMessage
    ) {
      return;
    }
    if (yield* proveCommittedDeletion()) {
      return;
    }
    if (!result.error) {
      yield* resetPreparedAttempt();
      return yield* new AccountDeletionFailed({
        code: accountDeletionErrorCode.failed,
      });
    }
    if (
      result.error.code === ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE ||
      result.error.code === ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE
    ) {
      yield* resetPreparedAttempt();
      return yield* new AccountDeletionRequestUncertain({
        attemptId,
        code: accountDeletionErrorCode.requestUncertain,
        phase: accountDeletionRequestPhase.preparation,
      });
    }
    if (result.error.code === betterAuthSessionExpiredCode) {
      yield* resetPreparedAttempt();
      return yield* new AccountDeletionSessionExpired({
        code: accountDeletionErrorCode.sessionExpired,
      });
    }
    if (result.error.code === ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE) {
      yield* resetPreparedAttempt();
      return yield* new AccountDeletionSchoolMemberRequired({
        code: ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE,
      });
    }
    return yield* new AccountDeletionRequestUncertain({
      attemptId,
      code: accountDeletionErrorCode.requestUncertain,
      phase: accountDeletionRequestPhase.deletion,
    });
  }
);
