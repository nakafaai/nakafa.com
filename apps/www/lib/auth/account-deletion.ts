import { analytics } from "@repo/analytics/posthog";
import {
  ACCOUNT_DELETION_ATTEMPT_HEADER,
  ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE,
} from "@repo/backend/convex/auth/deletion/constants";
import { Effect, Either, Schema } from "effect";
import { authClient } from "@/lib/auth/client";

const accountDeletionFailedCode = "ACCOUNT_DELETION_FAILED";
const accountDeletionRequestUncertainCode =
  "ACCOUNT_DELETION_REQUEST_UNCERTAIN";
const accountDeletionSessionExpiredCode = "ACCOUNT_DELETION_SESSION_EXPIRED";
const accountReauthenticationFailedCode = "ACCOUNT_REAUTHENTICATION_FAILED";
const betterAuthSessionExpiredCode = "SESSION_EXPIRED";
const betterAuthUserDeletedMessage = "User deleted";
const accountStorageKeyPrefix = "nakafa-";

type DeleteUserResult = Awaited<ReturnType<typeof authClient.deleteUser>>;
type SignOutResult = Awaited<ReturnType<typeof authClient.signOut>>;
type DeleteUserRequest = (attemptId: string) => Promise<DeleteUserResult>;
type CancelAccountDeletionRequest = (attemptId: string) => Promise<unknown>;
type SignOutRequest = () => Promise<SignOutResult>;

interface AccountDeletionOperations {
  readonly attemptId: string;
  readonly cancelPreparation: CancelAccountDeletionRequest;
  readonly request: DeleteUserRequest;
}

interface BrowserIdentityCleanup {
  readonly flushAnalytics: () => Promise<void>;
  readonly removePersistedAccountState: () => void;
  readonly resetAnalytics: () => void;
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
  }
) {}

/** Raised when an owned school has no active successor. */
export class AccountDeletionSchoolMemberRequired extends Schema.TaggedError<AccountDeletionSchoolMemberRequired>()(
  "AccountDeletionSchoolMemberRequired",
  {
    code: Schema.Literal(ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE),
  }
) {}

/** Raised when the stale session cannot be cleared for reauthentication. */
export class AccountReauthenticationFailed extends Schema.TaggedError<AccountReauthenticationFailed>()(
  "AccountReauthenticationFailed",
  {
    code: Schema.Literal(accountReauthenticationFailedCode),
  }
) {}

/** Deletes the current Better Auth account through a typed failure channel. */
export const deleteCurrentAccount = Effect.fn("www.auth.deleteCurrentAccount")(
  function* ({
    request = async (attemptId) =>
      await authClient.deleteUser({
        fetchOptions: {
          headers: {
            [ACCOUNT_DELETION_ATTEMPT_HEADER]: attemptId,
          },
        },
      }),
    cancelPreparation = async () => undefined,
    attemptId = crypto.randomUUID(),
  }: Partial<AccountDeletionOperations> = {}) {
    const resultOrFailure = yield* Effect.either(
      Effect.tryPromise({
        try: () => request(attemptId),
        catch: () =>
          new AccountDeletionRequestUncertain({
            attemptId,
            code: accountDeletionRequestUncertainCode,
          }),
      })
    );

    if (Either.isLeft(resultOrFailure)) {
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

    yield* Effect.tryPromise({
      try: () => cancelPreparation(attemptId),
      catch: () => undefined,
    }).pipe(Effect.ignore);

    if (!result.error) {
      return yield* new AccountDeletionFailed({
        code: accountDeletionFailedCode,
      });
    }

    if (result.error.code === betterAuthSessionExpiredCode) {
      return yield* new AccountDeletionSessionExpired({
        code: accountDeletionSessionExpiredCode,
      });
    }

    if (result.error.code === ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE) {
      return yield* new AccountDeletionSchoolMemberRequired({
        code: ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE,
      });
    }

    return yield* new AccountDeletionFailed({
      code: accountDeletionFailedCode,
    });
  }
);

/**
 * Clears browser identities after a successful deletion. Each cleanup is
 * best-effort because the server-side deletion has already committed.
 */
export const clearDeletedAccountBrowserIdentity = Effect.fn(
  "www.auth.clearDeletedAccountBrowserIdentity"
)(function* (
  cleanup: BrowserIdentityCleanup = {
    flushAnalytics: () => analytics.shutdown(),
    removePersistedAccountState: () => {
      for (const storage of [window.localStorage, window.sessionStorage]) {
        for (let index = storage.length - 1; index >= 0; index -= 1) {
          const storageKey = storage.key(index);

          if (storageKey?.startsWith(accountStorageKeyPrefix)) {
            storage.removeItem(storageKey);
          }
        }
      }
    },
    resetAnalytics: () => analytics.reset(true),
  }
) {
  yield* Effect.tryPromise({
    try: cleanup.flushAnalytics,
    catch: () => undefined,
  }).pipe(Effect.ignore);

  yield* Effect.all(
    [
      Effect.try(cleanup.resetAnalytics).pipe(Effect.ignore),
      Effect.try(cleanup.removePersistedAccountState).pipe(Effect.ignore),
    ],
    { discard: true }
  );
});

/** Clears the stale session before sending the user through sign-in again. */
export const prepareAccountReauthentication = Effect.fn(
  "www.auth.prepareAccountReauthentication"
)(function* (request: SignOutRequest = async () => await authClient.signOut()) {
  const result = yield* Effect.tryPromise({
    try: request,
    catch: () =>
      new AccountReauthenticationFailed({
        code: accountReauthenticationFailedCode,
      }),
  });

  if (result.error) {
    return yield* new AccountReauthenticationFailed({
      code: accountReauthenticationFailedCode,
    });
  }
});
