import {
  ANALYTICS_CONSENT_DENIED,
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  createAnonymousAnalyticsConsent,
} from "@repo/analytics/consent";
import {
  resetBrowserAnalyticsIdentity,
  revokeToBaselineAnalytics,
} from "@repo/analytics/posthog/browser";
import { Clock, Effect, Schema } from "effect";
import { reportClientException } from "@/lib/analytics/client";
import { saveAnonymousAnalyticsConsent } from "@/lib/analytics/consent/storage";
import { readAuthClient } from "@/lib/auth/client";

const accountSignOutFailedCode = "ACCOUNT_SIGN_OUT_FAILED";
const accountStorageKeyPrefix = "nakafa-";

type SignOutResult = Awaited<
  ReturnType<ReturnType<typeof readAuthClient>["signOut"]>
>;
type SignOutRequest = () => Promise<SignOutResult>;

const denyAnonymousAnalytics = Clock.currentTimeMillis.pipe(
  Effect.map((decidedAt) =>
    createAnonymousAnalyticsConsent(ANALYTICS_CONSENT_DENIED, decidedAt)
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

const defaultBrowserAccountIdentityCleanup = {
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

/** The browser cleanup seam, shaped by its default implementation. */
type BrowserAccountIdentityCleanup =
  typeof defaultBrowserAccountIdentityCleanup;

const defaultDeletedAccountIdentityCleanup = {
  ...defaultBrowserAccountIdentityCleanup,
  denyAnonymousAnalytics: () => denyAnonymousAnalytics,
  revokeAnalytics: () => revokeToBaselineAnalytics(),
};

/** The deleted-account cleanup seam, shaped by its default implementation. */
type DeletedAccountIdentityCleanup =
  typeof defaultDeletedAccountIdentityCleanup;

/**
 * Clears account state before another browser identity can take over. A step
 * that fails is reported with its cause, and the other step still runs.
 */
export const clearAccountBrowserIdentity = Effect.fn(
  "www.auth.clearAccountBrowserIdentity"
)(function* (
  cleanup: BrowserAccountIdentityCleanup = defaultBrowserAccountIdentityCleanup
) {
  yield* Effect.all(
    [
      Effect.try(cleanup.resetAnalytics).pipe(
        Effect.catch((cause) =>
          reportClientException(cause, {
            operation: "resetAnalytics",
            source: "auth.identityCleanup",
          })
        )
      ),
      Effect.try(cleanup.removePersistedAccountState).pipe(
        Effect.catch((cause) =>
          reportClientException(cause, {
            operation: "removePersistedAccountState",
            source: "auth.identityCleanup",
          })
        )
      ),
    ],
    { discard: true }
  );
});

/**
 * Disables analytics and clears browser identity after a committed deletion.
 * Cleanup is best-effort because the server-side deletion is irreversible, so
 * each failed step is reported with its cause and the rest still runs.
 */
export const clearDeletedAccountBrowserIdentity = Effect.fn(
  "www.auth.clearDeletedAccountBrowserIdentity"
)(function* (
  cleanup: DeletedAccountIdentityCleanup = defaultDeletedAccountIdentityCleanup
) {
  yield* cleanup.revokeAnalytics().pipe(
    Effect.catch((cause) =>
      reportClientException(cause, {
        operation: "revokeAnalytics",
        source: "auth.identityCleanup",
      })
    )
  );
  yield* cleanup.denyAnonymousAnalytics().pipe(
    Effect.catch((cause) =>
      reportClientException(cause, {
        operation: "denyAnonymousAnalytics",
        source: "auth.identityCleanup",
      })
    )
  );

  yield* clearAccountBrowserIdentity(cleanup);
});

/** Clears account-scoped browser identity after the auth session ends. */
export const signOutAccountBrowserIdentity = Effect.fn(
  "www.auth.signOutAccountBrowserIdentity"
)(function* (
  request: SignOutRequest = async () => await readAuthClient().signOut()
) {
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
