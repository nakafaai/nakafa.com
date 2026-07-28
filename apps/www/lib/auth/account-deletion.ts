import {
  ACCOUNT_DELETION_ATTEMPT_HEADER,
  ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE,
  ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE,
} from "@repo/backend/convex/auth/deletion/constants";
import {
  type AccountDeletionAttemptStatus,
  type AccountDeletionPreparationOutcome,
  accountDeletionAttemptStatus,
  accountDeletionPreparationOutcome,
} from "@repo/backend/convex/auth/deletion/spec";
import { Effect, Either, Schema } from "effect";
import { authClient } from "@/lib/auth/client";

const accountDeletionFailedCode = "ACCOUNT_DELETION_FAILED";
const accountDeletionRequestUncertainCode =
  "ACCOUNT_DELETION_REQUEST_UNCERTAIN";
const accountDeletionSessionExpiredCode = "ACCOUNT_DELETION_SESSION_EXPIRED";
const betterAuthSessionExpiredCode = "SESSION_EXPIRED";
const betterAuthUserDeletedMessage = "User deleted";

export const accountDeletionRequestPhase = {
  deletion: "deletion",
  preparation: "preparation",
} as const;

export type AccountDeletionRequestPhase =
  (typeof accountDeletionRequestPhase)[keyof typeof accountDeletionRequestPhase];

type DeleteUserResult = Awaited<ReturnType<typeof authClient.deleteUser>>;
type DeleteUserRequest = (attemptId: string) => Promise<DeleteUserResult>;
type CancelAccountDeletionRequest = (attemptId: string) => Promise<unknown>;
type PrepareAccountDeletionRequest = (
  attemptId: string
) => Promise<AccountDeletionPreparationOutcome>;
type ReconcileAccountDeletionRequest = (
  attemptId: string
) => Promise<AccountDeletionAttemptStatus>;

interface AccountDeletionOperations {
  readonly attemptId: string;
  readonly cancelPreparation: CancelAccountDeletionRequest;
  readonly prepare: PrepareAccountDeletionRequest;
  readonly reconcile: ReconcileAccountDeletionRequest;
  readonly request?: DeleteUserRequest;
  readonly startPhase: AccountDeletionRequestPhase;
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
    attemptId,
    cancelPreparation,
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
    startPhase,
  }: AccountDeletionOperations) {
    const cancelPreparedAttempt = () =>
      Effect.tryPromise({
        try: () => cancelPreparation(attemptId),
        catch: () =>
          new AccountDeletionRequestUncertain({
            attemptId,
            code: accountDeletionRequestUncertainCode,
            phase: accountDeletionRequestPhase.preparation,
          }),
      });
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
        yield* cancelPreparedAttempt();
        return yield* new AccountDeletionFailed({
          code: accountDeletionFailedCode,
        });
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
      yield* cancelPreparedAttempt();
      return yield* new AccountDeletionFailed({
        code: accountDeletionFailedCode,
      });
    }

    if (result.error.code === ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE) {
      return yield* new AccountDeletionRequestUncertain({
        attemptId,
        code: accountDeletionRequestUncertainCode,
        phase: accountDeletionRequestPhase.preparation,
      });
    }

    if (result.error.code === betterAuthSessionExpiredCode) {
      yield* cancelPreparedAttempt();
      return yield* new AccountDeletionSessionExpired({
        code: accountDeletionSessionExpiredCode,
      });
    }

    if (result.error.code === ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE) {
      yield* cancelPreparedAttempt();
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
