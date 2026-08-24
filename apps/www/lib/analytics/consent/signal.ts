import {
  ANALYTICS_BROWSER_SIGNAL_MECHANISM,
  ANALYTICS_CONSENT_CATEGORY,
  ANALYTICS_CONSENT_MECHANISM,
  ANALYTICS_CONSENT_NOTICE_VERSION,
  hasBrowserPrivacySignal,
} from "@repo/analytics/consent";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect, Option, Schedule, Schema } from "effect";

const accountConsentPersistenceFailedCode =
  "ACCOUNT_CONSENT_PERSISTENCE_FAILED";
const accountConsentRetrySchedule = Schedule.spaced("10 seconds");
type SetAccountConsentArgs = FunctionArgs<typeof api.consents.current.set>;
type SetAccountConsent = (
  args: SetAccountConsentArgs
) => Promise<FunctionReturnType<typeof api.consents.current.set>>;

export interface BrowserPrivacySignalSource {
  readonly read: () => {
    readonly doNotTrack: string | null | undefined;
    readonly globalPrivacyControl: unknown;
  };
}

/** Reads current DNT and GPC values each time the Effect executes. */
export const readBrowserPrivacySignal = Effect.fn(
  "analytics.consent.readBrowserPrivacySignal"
)((source: BrowserPrivacySignalSource) =>
  Effect.sync(() => {
    const signal = source.read();

    return hasBrowserPrivacySignal({
      doNotTrack: [signal.doNotTrack],
      globalPrivacyControl: signal.globalPrivacyControl,
    });
  })
);

/** Raised when the browser cannot persist an account analytics decision. */
export class AccountConsentPersistenceError extends Schema.TaggedError<AccountConsentPersistenceError>()(
  "AccountConsentPersistenceError",
  {
    code: Schema.Literal(accountConsentPersistenceFailedCode),
    message: Schema.Literal(
      "Unable to persist the analytics decision for this account."
    ),
  }
) {}

function toAccountConsentPersistenceError() {
  return new AccountConsentPersistenceError({
    code: accountConsentPersistenceFailedCode,
    message: "Unable to persist the analytics decision for this account.",
  });
}

const persistAccountAnalyticsConsent = Effect.fnUntraced(function* (
  setAccountConsent: SetAccountConsent,
  expectedUserId: SetAccountConsentArgs["expectedUserId"],
  decision: SetAccountConsentArgs["decision"]
) {
  return yield* Effect.tryPromise({
    catch: toAccountConsentPersistenceError,
    try: () => setAccountConsent({ decision, expectedUserId }),
  });
});

const persistAccountAnalyticsChoice = Effect.fnUntraced(function* (
  setAccountConsent: SetAccountConsent,
  expectedUserId: SetAccountConsentArgs["expectedUserId"],
  granted: boolean,
  currentBrowserPrivacySignal: Effect.Effect<boolean>
) {
  const hasBrowserPrivacySignal = granted
    ? yield* currentBrowserPrivacySignal
    : false;
  if (hasBrowserPrivacySignal) {
    return yield* persistAccountAnalyticsConsent(
      setAccountConsent,
      expectedUserId,
      {
        category: ANALYTICS_CONSENT_CATEGORY,
        granted: false,
        mechanism: ANALYTICS_BROWSER_SIGNAL_MECHANISM,
        noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
      }
    );
  }

  return yield* persistAccountAnalyticsConsent(
    setAccountConsent,
    expectedUserId,
    {
      category: ANALYTICS_CONSENT_CATEGORY,
      granted,
      mechanism: ANALYTICS_CONSENT_MECHANISM,
      noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
    }
  );
});

/** Persists an explicit choice after enforcing the current browser signal. */
export const saveAccountAnalyticsChoice = Effect.fn(
  "analytics.consent.saveAccountAnalyticsChoice"
)(function* (
  setAccountConsent: SetAccountConsent,
  expectedUserId: SetAccountConsentArgs["expectedUserId"],
  granted: boolean,
  currentBrowserPrivacySignal: Effect.Effect<boolean>
) {
  return yield* persistAccountAnalyticsChoice(
    setAccountConsent,
    expectedUserId,
    granted,
    currentBrowserPrivacySignal
  ).pipe(Effect.retry({ schedule: accountConsentRetrySchedule, times: 2 }));
});

/** Revalidates and persists a browser signal with two delayed retries. */
export const revokeAccountAnalyticsGrant = Effect.fn(
  "analytics.consent.revokeAccountAnalyticsGrant"
)(
  (
    setAccountConsent: SetAccountConsent,
    expectedUserId: SetAccountConsentArgs["expectedUserId"],
    currentBrowserPrivacySignal: Effect.Effect<boolean>
  ) =>
    Effect.gen(function* () {
      const hasBrowserPrivacySignal = yield* currentBrowserPrivacySignal;
      if (!hasBrowserPrivacySignal) {
        return Option.none<
          FunctionReturnType<typeof api.consents.current.set>
        >();
      }

      const decision = yield* persistAccountAnalyticsConsent(
        setAccountConsent,
        expectedUserId,
        {
          category: ANALYTICS_CONSENT_CATEGORY,
          granted: false,
          mechanism: ANALYTICS_BROWSER_SIGNAL_MECHANISM,
          noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
        }
      );
      return Option.some(decision);
    }).pipe(Effect.retry({ schedule: accountConsentRetrySchedule, times: 2 }))
);
