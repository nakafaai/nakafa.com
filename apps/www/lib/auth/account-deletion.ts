import { analytics } from "@repo/analytics/posthog";
import { ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE } from "@repo/backend/convex/auth/deletion/constants";
import { Effect, Schema } from "effect";
import { authClient } from "@/lib/auth/client";

const accountDeletionFailedCode = "ACCOUNT_DELETION_FAILED";
const accountDeletionSchoolMemberRequiredCode =
  "ACCOUNT_DELETION_SCHOOL_MEMBER_REQUIRED";
const accountDeletionSessionExpiredCode = "ACCOUNT_DELETION_SESSION_EXPIRED";
const accountReauthenticationFailedCode = "ACCOUNT_REAUTHENTICATION_FAILED";
const betterAuthSessionExpiredCode = "SESSION_EXPIRED";
const accountStorageKeyPrefix = "nakafa-";

type DeleteUserResult = Awaited<ReturnType<typeof authClient.deleteUser>>;
type SignOutResult = Awaited<ReturnType<typeof authClient.signOut>>;
type DeleteUserRequest = () => Promise<DeleteUserResult>;
type SignOutRequest = () => Promise<SignOutResult>;

interface BrowserIdentityCleanup {
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

/** Raised when an owned school has no active successor. */
export class AccountDeletionSchoolMemberRequired extends Schema.TaggedError<AccountDeletionSchoolMemberRequired>()(
  "AccountDeletionSchoolMemberRequired",
  {
    code: Schema.Literal(accountDeletionSchoolMemberRequiredCode),
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
  function* (
    request: DeleteUserRequest = async () => await authClient.deleteUser()
  ) {
    const result = yield* Effect.tryPromise({
      try: request,
      catch: () =>
        new AccountDeletionFailed({ code: accountDeletionFailedCode }),
    });

    if (!result.error) {
      return;
    }

    if (result.error.code === betterAuthSessionExpiredCode) {
      return yield* new AccountDeletionSessionExpired({
        code: accountDeletionSessionExpiredCode,
      });
    }

    if (result.error.code === ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE) {
      return yield* new AccountDeletionSchoolMemberRequired({
        code: accountDeletionSchoolMemberRequiredCode,
      });
    }

    return yield* new AccountDeletionFailed({
      code: accountDeletionFailedCode,
    });
  }
);

/**
 * Clears browser identities after a successful deletion. Each cleanup is
 * best-effort so local browser state can never turn a completed server-side
 * deletion into an error screen.
 */
export const clearDeletedAccountBrowserIdentity = Effect.fn(
  "www.auth.clearDeletedAccountBrowserIdentity"
)(function* (
  cleanup: BrowserIdentityCleanup = {
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
    resetAnalytics: () => analytics.reset(),
  }
) {
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
