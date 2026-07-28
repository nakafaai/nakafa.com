import { analytics } from "@repo/analytics/posthog";
import { Effect, Schema } from "effect";
import { authClient } from "@/lib/auth/client";

const accountReauthenticationFailedCode = "ACCOUNT_REAUTHENTICATION_FAILED";
const accountStorageKeyPrefix = "nakafa-";

type SignOutResult = Awaited<ReturnType<typeof authClient.signOut>>;
type SignOutRequest = () => Promise<SignOutResult>;

interface BrowserIdentityCleanup {
  readonly flushAnalytics: () => Promise<void>;
  readonly removePersistedAccountState: () => void;
  readonly resetAnalytics: () => void;
}

/** Raised when the stale session cannot be cleared for reauthentication. */
export class AccountReauthenticationFailed extends Schema.TaggedError<AccountReauthenticationFailed>()(
  "AccountReauthenticationFailed",
  {
    code: Schema.Literal(accountReauthenticationFailedCode),
  }
) {}

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

/** Clears account-scoped browser identity and the stale auth session. */
export const prepareAccountReauthentication = Effect.fn(
  "www.auth.prepareAccountReauthentication"
)(function* (request: SignOutRequest = async () => await authClient.signOut()) {
  yield* clearDeletedAccountBrowserIdentity();

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
