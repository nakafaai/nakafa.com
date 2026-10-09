import "server-only";

import { HttpClient } from "@confect/js";
import { NETWORK_ATTEMPT_DEADLINE } from "@repo/backend/client/network";
import onboarding from "@repo/backend/confect/_generated/refs/onboarding";
import { Effect, Schema } from "effect";
import { httpLayer } from "@/lib/convex/http";

/** Expected server write failure for one authoritative onboarding admission. */
export class OnboardingAdmissionError extends Schema.TaggedError<OnboardingAdmissionError>()(
  "OnboardingAdmissionError",
  { cause: Schema.Unknown }
) {}

/** Expected server read failure for the authenticated onboarding status. */
export class OnboardingStatusReadError extends Schema.TaggedError<OnboardingStatusReadError>()(
  "OnboardingStatusReadError",
  { cause: Schema.Unknown }
) {}

/** Reads whether onboarding is required and any resumable draft state. */
export const readOnboardingStatus = Effect.fn("www.onboarding.readStatus")(
  function* (token: string) {
    return yield* Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      return yield* client.query(onboarding.queries.getStatus, {});
    }).pipe(
      Effect.provide(httpLayer({ auth: token })),
      Effect.mapError((cause) => OnboardingStatusReadError.make({ cause }))
    );
  }
);

/**
 * Records and returns authoritative onboarding admission for an account. The
 * mutation gets one attempt within the shared deadline and is never retried:
 * admission is idempotent by state, and a missed deadline is an admission
 * failure like any other.
 */
export const recordOnboardingAdmission = Effect.fn(
  "www.onboarding.recordAdmission"
)(function* (token: string) {
  return yield* Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    return yield* client.mutation(onboarding.mutations.admit, {});
  }).pipe(
    Effect.timeout(NETWORK_ATTEMPT_DEADLINE),
    Effect.provide(httpLayer({ auth: token })),
    Effect.mapError((cause) => OnboardingAdmissionError.make({ cause }))
  );
});
