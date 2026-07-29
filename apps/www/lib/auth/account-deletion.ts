import {
  ACCOUNT_DELETION_ATTEMPT_HEADER,
  ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE,
  ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE,
} from "@repo/backend/convex/auth/deletion/constants";
import {
  type AccountDeletionAttemptStatus,
  type AccountDeletionBrowserAttempt,
  type AccountDeletionPreparationOutcome,
  type AccountDeletionRequestPhase,
  accountDeletionAttemptStatus,
  accountDeletionPreparationOutcome,
  accountDeletionRequestPhase,
} from "@repo/backend/convex/auth/deletion/spec";
import { Effect, Either, Schema } from "effect";
import type { AccountDeletionAttemptStorageFailed } from "@/lib/auth/account-deletion-attempt";
import { authClient } from "@/lib/auth/client";

const accountDeletionFailedCode = "ACCOUNT_DELETION_FAILED";
const accountDeletionRequestUncertainCode =
  "ACCOUNT_DELETION_REQUEST_UNCERTAIN";
const accountDeletionSessionExpiredCode = "ACCOUNT_DELETION_SESSION_EXPIRED";
const betterAuthSessionExpiredCode = "SESSION_EXPIRED";
const betterAuthUserDeletedMessage = "User deleted";

type DeleteUserResult = Awaited<ReturnType<typeof authClient.deleteUser>>;
type AccountDeletionAttemptId = AccountDeletionBrowserAttempt["attemptId"];
type DeleteUserRequest = (
  attemptId: AccountDeletionAttemptId
) => Promise<DeleteUserResult>;
type CancelAccountDeletionRequest = (
  attemptId: AccountDeletionAttemptId
) => Promise<boolean>;
type PrepareAccountDeletionRequest = (
  attemptId: AccountDeletionAttemptId
) => Promise<AccountDeletionPreparationOutcome>;
type PersistAccountDeletionAttempt = (
  attempt: AccountDeletionBrowserAttempt
) => Effect.Effect<void, AccountDeletionAttemptStorageFailed>;
type ReconcileAccountDeletionRequest = (
  attemptId: AccountDeletionAttemptId
) => Promise<AccountDeletionAttemptStatus>;

interface AccountDeletionOperations {
  readonly attempt: AccountDeletionBrowserAttempt;
  readonly cancelPreparation: CancelAccountDeletionRequest;
  readonly persist: PersistAccountDeletionAttempt;
  readonly prepare: PrepareAccountDeletionRequest;
  readonly reconcile: ReconcileAccountDeletionRequest;
  readonly request?: DeleteUserRequest;
}

/** Raised when Better Auth requires a fresh session before account deletion. */
export class AccountDeletionSessionExpired extends Schema.TaggedError<AccountDeletionSessionExpired>()(
  "AccountDeletionSessionExpired",
  {
    code: Schema.Literal(accountDeletionSessionExpiredCode),
  }
) {}

/** Raised when Better Auth cannot complete account deletion. */
export class AccountDeletionFailed extends Schema.TaggedError<AccountDeletionFailed>()(
  "AccountDeletionFailed",
  {
    code: Schema.Literal(accountDeletionFailedCode),
  }
) {}

/** Raised when the browser cannot know whether the server committed deletion. */
export class AccountDeletionRequestUncertain extends Schema.TaggedError<AccountDeletionRequestUncertain>()(
  "AccountDeletionRequestUncertain",
  {
    attemptId: Schema.String,
    code: Schema.Literal(accountDeletionRequestUncertainCode),
    phase: Schema.Literal(
      accountDeletionRequestPhase.preparation,
      accountDeletionRequestPhase.deletion
    ),
  }
) {}

/** Raised when an owned school has no active successor. */
export class AccountDeletionSchoolMemberRequired extends Schema.TaggedError<AccountDeletionSchoolMemberRequired>()(
  "AccountDeletionSchoolMemberRequired",
  {
    code: Schema.Literal(ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE),
  }
) {}

/** Deletes the current Better Auth account through a typed failure channel. */
export const deleteCurrentAccount = Effect.fn("www.auth.deleteCurrentAccount")(
  function* ({
    attempt,
    cancelPreparation,
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
    const cancelPreparedAttempt = (
      uncertainPhase: AccountDeletionRequestPhase
    ) =>
      Effect.tryPromise({
        try: () => cancelPreparation(attemptId),
        catch: () =>
          new AccountDeletionRequestUncertain({
            attemptId,
            code: accountDeletionRequestUncertainCode,
            phase: uncertainPhase,
          }),
      }).pipe(
        Effect.filterOrFail(
          (canceled) => canceled,
          () =>
            new AccountDeletionRequestUncertain({
              attemptId,
              code: accountDeletionRequestUncertainCode,
              phase: uncertainPhase,
            })
        )
      );
    const persistAttemptPhase = (phase: AccountDeletionRequestPhase) =>
      persist({ attemptId, phase }).pipe(
        Effect.mapError(
          () =>
            new AccountDeletionFailed({
              code: accountDeletionFailedCode,
            })
        )
      );
    const proveCommittedDeletion = () =>
      Effect.tryPromise({
        try: () => reconcile(attemptId),
        catch: () =>
          new AccountDeletionRequestUncertain({
            attemptId,
            code: accountDeletionRequestUncertainCode,
            phase: accountDeletionRequestPhase.deletion,
          }),
      }).pipe(
        Effect.map(
          (status) => status === accountDeletionAttemptStatus.committed
        )
      );

    if (startPhase === accountDeletionRequestPhase.preparation) {
      let preparationOutcome: AccountDeletionPreparationOutcome =
        accountDeletionPreparationOutcome.continue;

      while (
        preparationOutcome === accountDeletionPreparationOutcome.continue
      ) {
        preparationOutcome = yield* Effect.tryPromise({
          try: () => prepare(attemptId),
          catch: () =>
            new AccountDeletionRequestUncertain({
              attemptId,
              code: accountDeletionRequestUncertainCode,
              phase: accountDeletionRequestPhase.preparation,
            }),
        });
      }

      if (
        preparationOutcome ===
        accountDeletionPreparationOutcome.schoolSuccessorRequired
      ) {
        return yield* new AccountDeletionSchoolMemberRequired({
          code: ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE,
        });
      }

      if (preparationOutcome !== accountDeletionPreparationOutcome.ready) {
        yield* cancelPreparedAttempt(accountDeletionRequestPhase.preparation);
        return yield* new AccountDeletionFailed({
          code: accountDeletionFailedCode,
        });
      }

      const persistedDeletionPhase = yield* Effect.either(
        persistAttemptPhase(accountDeletionRequestPhase.deletion)
      );

      if (Either.isLeft(persistedDeletionPhase)) {
        yield* cancelPreparedAttempt(accountDeletionRequestPhase.preparation);
        return yield* persistedDeletionPhase.left;
      }
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
            code: accountDeletionRequestUncertainCode,
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
      yield* cancelPreparedAttempt(accountDeletionRequestPhase.deletion);
      yield* persistAttemptPhase(accountDeletionRequestPhase.preparation);
      return yield* new AccountDeletionFailed({
        code: accountDeletionFailedCode,
      });
    }

    if (result.error.code === ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE) {
      yield* persistAttemptPhase(accountDeletionRequestPhase.preparation);
      return yield* new AccountDeletionRequestUncertain({
        attemptId,
        code: accountDeletionRequestUncertainCode,
        phase: accountDeletionRequestPhase.preparation,
      });
    }

    if (result.error.code === betterAuthSessionExpiredCode) {
      yield* cancelPreparedAttempt(accountDeletionRequestPhase.deletion);
      yield* persistAttemptPhase(accountDeletionRequestPhase.preparation);
      return yield* new AccountDeletionSessionExpired({
        code: accountDeletionSessionExpiredCode,
      });
    }

    if (result.error.code === ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE) {
      yield* persistAttemptPhase(accountDeletionRequestPhase.preparation);
      return yield* new AccountDeletionSchoolMemberRequired({
        code: ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE,
      });
    }

    return yield* new AccountDeletionRequestUncertain({
      attemptId,
      code: accountDeletionRequestUncertainCode,
      phase: accountDeletionRequestPhase.deletion,
    });
  }
);
