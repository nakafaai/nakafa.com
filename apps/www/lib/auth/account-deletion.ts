import {
  ACCOUNT_DELETION_ATTEMPT_HEADER,
  ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE,
  ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE,
} from "@repo/backend/convex/auth/deletion/constants";
import {
  type AccountDeletionAttemptStatus,
  type AccountDeletionBrowserAttempt,
  accountDeletionAttemptStatus,
  accountDeletionRequestPhase,
} from "@repo/backend/convex/auth/deletion/spec";
import { Effect, Either } from "effect";
import {
  AccountDeletionFailed,
  AccountDeletionRequestUncertain,
  AccountDeletionSchoolMemberRequired,
  AccountDeletionSessionExpired,
  accountDeletionErrorCode,
} from "@/lib/auth/account-deletion-errors";
import {
  type AccountDeletionPreparationOperations,
  cancelPreparedAccountDeletion,
  clearCanceledAccountDeletionAttempt,
  prepareAccountDeletion,
} from "@/lib/auth/account-deletion-preparation";
import { authClient } from "@/lib/auth/client";

const betterAuthSessionExpiredCode = "SESSION_EXPIRED";
const betterAuthUserDeletedMessage = "User deleted";

type DeleteUserResult = Awaited<ReturnType<typeof authClient.deleteUser>>;
type AccountDeletionAttemptId = AccountDeletionBrowserAttempt["attemptId"];
type DeleteUserRequest = (
  attemptId: AccountDeletionAttemptId
) => Promise<DeleteUserResult>;
type ReconcileAccountDeletionRequest = (
  attemptId: AccountDeletionAttemptId
) => Promise<AccountDeletionAttemptStatus>;

interface AccountDeletionOperations
  extends AccountDeletionPreparationOperations {
  readonly reconcile: ReconcileAccountDeletionRequest;
  readonly request?: DeleteUserRequest;
}

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
  }: AccountDeletionOperations) {
    const { attemptId, phase: startPhase } = attempt;
    const proveCommittedDeletion = () =>
      Effect.tryPromise({
        try: () => reconcile(attemptId),
        catch: () =>
          new AccountDeletionRequestUncertain({
            attemptId,
            code: accountDeletionErrorCode.requestUncertain,
            phase: accountDeletionRequestPhase.deletion,
          }),
      }).pipe(
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

    const resultOrFailure = yield* Effect.either(
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

    if (Either.isLeft(resultOrFailure)) {
      const reconciliation = yield* Effect.either(proveCommittedDeletion());

      if (Either.isRight(reconciliation) && reconciliation.right) {
        return;
      }

      return yield* resultOrFailure.left;
    }

    const result = resultOrFailure.right;

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

    if (result.error.code === ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE) {
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
