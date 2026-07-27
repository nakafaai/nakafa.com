import { analytics } from "@repo/analytics/posthog";
import { Effect, Schema } from "effect";
import { authClient } from "@/lib/auth/client";

const accountDeletionFailedCode = "ACCOUNT_DELETION_FAILED";
const accountDeletionSessionExpiredCode = "ACCOUNT_DELETION_SESSION_EXPIRED";
const accountReauthenticationFailedCode = "ACCOUNT_REAUTHENTICATION_FAILED";
const betterAuthSessionExpiredCode = "SESSION_EXPIRED";
const deviceIdentityStorageKey = "nakafa-device-id";

type DeleteUserResult = Awaited<ReturnType<typeof authClient.deleteUser>>;
type SignOutResult = Awaited<ReturnType<typeof authClient.signOut>>;
type DeleteUserRequest = () => Promise<DeleteUserResult>;
type SignOutRequest = () => Promise<SignOutResult>;

interface BrowserIdentityCleanup {
  readonly removeDeviceIdentity: () => void;
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
    removeDeviceIdentity: () =>
      window.localStorage.removeItem(deviceIdentityStorageKey),
    resetAnalytics: () => analytics.reset(),
  }
) {
  yield* Effect.all(
    [
      Effect.try(cleanup.resetAnalytics).pipe(Effect.ignore),
      Effect.try(cleanup.removeDeviceIdentity).pipe(Effect.ignore),
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
