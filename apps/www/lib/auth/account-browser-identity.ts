import { analytics } from "@repo/analytics/posthog";
import { resetAnalyticsIdentity } from "@repo/analytics/posthog/identity";
import { Effect, Schema } from "effect";
import { authClient } from "@/lib/auth/client";

const accountSignOutFailedCode = "ACCOUNT_SIGN_OUT_FAILED";
const accountStorageKeyPrefix = "nakafa-";

type SignOutResult = Awaited<ReturnType<typeof authClient.signOut>>;
type SignOutRequest = () => Promise<SignOutResult>;

interface BrowserAccountIdentityCleanup {
  readonly removePersistedAccountState: () => void;
  readonly resetAnalytics: () => void;
}

interface DeletedAccountIdentityCleanup extends BrowserAccountIdentityCleanup {
  readonly flushAnalytics: () => Promise<void>;
}

/** Raised when the current account cannot be signed out safely. */
export class AccountSignOutFailed extends Schema.TaggedError<AccountSignOutFailed>()(
  "AccountSignOutFailed",
  {
    code: Schema.Literal(accountSignOutFailedCode),
  }
) {}

const defaultBrowserAccountIdentityCleanup: BrowserAccountIdentityCleanup = {
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
  resetAnalytics: () => resetAnalyticsIdentity(analytics, true),
};

/** Clears account-scoped state before another browser identity can take over. */
export const clearAccountBrowserIdentity = Effect.fn(
  "www.auth.clearAccountBrowserIdentity"
)(function* (
  cleanup: BrowserAccountIdentityCleanup = defaultBrowserAccountIdentityCleanup
) {
  yield* Effect.all(
    [
      Effect.try(cleanup.resetAnalytics).pipe(Effect.ignore),
      Effect.try(cleanup.removePersistedAccountState).pipe(Effect.ignore),
    ],
    { discard: true }
  );
});

/**
 * Flushes analytics and clears browser identity after a committed deletion.
 * Cleanup is best-effort because the server-side deletion is irreversible.
 */
export const clearDeletedAccountBrowserIdentity = Effect.fn(
  "www.auth.clearDeletedAccountBrowserIdentity"
)(function* (
  cleanup: DeletedAccountIdentityCleanup = {
    flushAnalytics: () => analytics.shutdown(),
    ...defaultBrowserAccountIdentityCleanup,
  }
) {
  yield* Effect.tryPromise({
    try: cleanup.flushAnalytics,
    catch: () => undefined,
  }).pipe(Effect.ignore);

  yield* clearAccountBrowserIdentity(cleanup);
});

/** Clears account-scoped browser identity before ending the auth session. */
export const signOutAccountBrowserIdentity = Effect.fn(
  "www.auth.signOutAccountBrowserIdentity"
)(function* (request: SignOutRequest = async () => await authClient.signOut()) {
  yield* clearAccountBrowserIdentity();

  const result = yield* Effect.tryPromise({
    try: request,
    catch: () =>
      new AccountSignOutFailed({
        code: accountSignOutFailedCode,
      }),
  });

  if (result.error) {
    return yield* new AccountSignOutFailed({
      code: accountSignOutFailedCode,
    });
  }
});
