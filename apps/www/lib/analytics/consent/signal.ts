import type { Ref } from "@confect/core";
import type { InvokeReturn } from "@confect/react";
import {
  ANALYTICS_BROWSER_SIGNAL_MECHANISM,
  ANALYTICS_CONSENT_CATEGORY,
  ANALYTICS_CONSENT_MECHANISM,
  ANALYTICS_CONSENT_NOTICE_VERSION,
  hasBrowserPrivacySignal,
} from "@repo/analytics/consent";
import { NETWORK_ATTEMPT_DEADLINE } from "@repo/backend/client/network";
import type consents from "@repo/backend/confect/_generated/refs/consents";

import { Data, Effect, Option, Schedule, Schema } from "effect";

const accountConsentPersistenceFailedCode =
  "ACCOUNT_CONSENT_PERSISTENCE_FAILED";
const accountConsentRejectedCode = "ACCOUNT_CONSENT_REJECTED";
const accountConsentRetrySchedule = Schedule.spaced("10 seconds");
type SetAccountConsentArgs = Ref.Args<typeof consents.current.set>;
type SetAccountConsent = (
  args: SetAccountConsentArgs
) => InvokeReturn<typeof consents.current.set>;

const BrowserPrivacySignalSchema = Schema.Struct({
  doNotTrack: Schema.NullishOr(Schema.String),
  globalPrivacyControl: Schema.Unknown,
});

/** Reads the browser's current DNT and GPC values. */
type BrowserPrivacySignalSource = () => typeof BrowserPrivacySignalSchema.Type;

/** Reads current DNT and GPC values each time the Effect executes. */
export const readBrowserPrivacySignal = Effect.fn(
  "analytics.consent.readBrowserPrivacySignal"
)((readSignal: BrowserPrivacySignalSource) =>
  Effect.sync(() => {
    const signal = readSignal();

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
    cause: Schema.Unknown,
    code: Schema.Literal(accountConsentPersistenceFailedCode),
    message: Schema.Literal(
      "Unable to persist the analytics decision for this account."
    ),
  }
) {}

/** Raised when Convex authoritatively rejects an account analytics decision. */
export class AccountConsentRejectedError extends Schema.TaggedError<AccountConsentRejectedError>()(
  "AccountConsentRejectedError",
  {
    cause: Schema.Unknown,
    code: Schema.Literal(accountConsentRejectedCode),
    message: Schema.Literal(
      "The analytics decision was rejected for this account."
    ),
  }
) {}

function toAccountConsentWriteError(cause: unknown) {
  return AccountConsentPersistenceError.make({
    cause,
    code: accountConsentPersistenceFailedCode,
    message: "Unable to persist the analytics decision for this account.",
  });
}

/** One consent write that did not answer within its attempt deadline. */
class AccountConsentWriteDeadline extends Data.TaggedError(
  "AccountConsentWriteDeadline"
) {}

const persistAccountAnalyticsConsent = Effect.fnUntraced(function* (
  setAccountConsent: SetAccountConsent,
  expectedUserId: SetAccountConsentArgs["expectedUserId"],
  decision: SetAccountConsentArgs["decision"]
) {
  return yield* Effect.tryPromise({
    catch: toAccountConsentWriteError,
    try: () => setAccountConsent({ decision, expectedUserId }),
  }).pipe(
    // A hung write ends at its deadline, so the retry schedule can run again.
    Effect.timeoutOrElse({
      duration: NETWORK_ATTEMPT_DEADLINE,
      orElse: () =>
        Effect.fail(
          toAccountConsentWriteError(new AccountConsentWriteDeadline())
        ),
    }),
    Effect.flatMap((result) =>
      Effect.fromResult(result).pipe(
        Effect.mapError((cause) =>
          AccountConsentRejectedError.make({
            cause,
            code: accountConsentRejectedCode,
            message: "The analytics decision was rejected for this account.",
          })
        )
      )
    )
  );
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
  ).pipe(
    Effect.retry({
      schedule: accountConsentRetrySchedule,
      times: 2,
      while: (error) => error._tag === "AccountConsentPersistenceError",
    })
  );
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
        return Option.none<Ref.Returns<typeof consents.current.set>>();
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
    }).pipe(
      Effect.retry({
        schedule: accountConsentRetrySchedule,
        times: 2,
        while: (error) => error._tag === "AccountConsentPersistenceError",
      })
    )
);
