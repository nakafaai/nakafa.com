import {
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  createAnonymousAnalyticsConsent,
} from "@repo/analytics/consent";
import {
  disableBrowserAnalytics,
  resetBrowserAnalyticsIdentity,
} from "@repo/analytics/posthog/browser";
import { Clock, Effect, type Effect as EffectType, Schema } from "effect";
import { saveAnonymousAnalyticsConsent } from "@/lib/analytics/consent/storage";
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
  readonly denyAnonymousAnalytics: () => EffectType.Effect<void, unknown>;
  readonly disableAnalytics: () => EffectType.Effect<void, unknown>;
}

const denyAnonymousAnalytics = Clock.currentTimeMillis.pipe(
  Effect.map((decidedAt) =>
    createAnonymousAnalyticsConsent("denied", decidedAt)
  ),
  Effect.flatMap(saveAnonymousAnalyticsConsent)
);

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

        if (
          storageKey?.startsWith(accountStorageKeyPrefix) &&
          storageKey !== ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY
        ) {
          storage.removeItem(storageKey);
        }
      }
    }
  },
  resetAnalytics: () => resetBrowserAnalyticsIdentity(true),
};

/** Clears account state before another browser identity can take over. */
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
 * Disables analytics and clears browser identity after a committed deletion.
 * Cleanup is best-effort because the server-side deletion is irreversible.
 */
export const clearDeletedAccountBrowserIdentity = Effect.fn(
  "www.auth.clearDeletedAccountBrowserIdentity"
)(function* (
  cleanup: DeletedAccountIdentityCleanup = {
    denyAnonymousAnalytics: () => denyAnonymousAnalytics,
    disableAnalytics: disableBrowserAnalytics,
    ...defaultBrowserAccountIdentityCleanup,
  }
) {
  yield* cleanup.disableAnalytics().pipe(Effect.ignore);
  yield* cleanup.denyAnonymousAnalytics().pipe(Effect.ignore);

  yield* clearAccountBrowserIdentity(cleanup);
});

/** Clears account-scoped browser identity after the auth session ends. */
export const signOutAccountBrowserIdentity = Effect.fn(
  "www.auth.signOutAccountBrowserIdentity"
)(function* (request: SignOutRequest = async () => await authClient.signOut()) {
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

  yield* clearAccountBrowserIdentity();
});
