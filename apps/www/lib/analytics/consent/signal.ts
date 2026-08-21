import {
  ANALYTICS_BROWSER_SIGNAL_MECHANISM,
  ANALYTICS_CONSENT_CATEGORY,
  ANALYTICS_CONSENT_NOTICE_VERSION,
} from "@repo/analytics/consent";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { Effect, Schedule, Schema } from "effect";

const browserSignalRevocationFailedCode = "BROWSER_SIGNAL_REVOCATION_FAILED";
const browserSignalRetrySchedule = Schedule.spaced("10 seconds");
type SetAccountConsentArgs = FunctionArgs<
  typeof api.consents.mutations.setCurrent
>;
type SetAccountConsent = (args: SetAccountConsentArgs) => Promise<unknown>;

/** Raised after a browser privacy signal cannot persist its account override. */
export class BrowserSignalRevocationError extends Schema.TaggedError<BrowserSignalRevocationError>()(
  "BrowserSignalRevocationError",
  {
    code: Schema.Literal(browserSignalRevocationFailedCode),
    message: Schema.Literal(
      "Unable to persist the browser privacy signal for this account."
    ),
  }
) {}

function toBrowserSignalRevocationError() {
  return new BrowserSignalRevocationError({
    code: browserSignalRevocationFailedCode,
    message: "Unable to persist the browser privacy signal for this account.",
  });
}

/** Persists a browser privacy signal with two delayed retries, then fails. */
export const revokeAccountAnalyticsGrant = Effect.fn(
  "analytics.consent.revokeAccountAnalyticsGrant"
)((setAccountConsent: SetAccountConsent) =>
  Effect.tryPromise({
    catch: toBrowserSignalRevocationError,
    try: () =>
      setAccountConsent({
        decision: {
          category: ANALYTICS_CONSENT_CATEGORY,
          granted: false,
          mechanism: ANALYTICS_BROWSER_SIGNAL_MECHANISM,
          noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
        },
      }),
  }).pipe(
    Effect.retry({
      schedule: browserSignalRetrySchedule,
      times: 2,
    })
  )
);
