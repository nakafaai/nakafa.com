import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { Effect, Schema } from "effect";

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
    return yield* Effect.tryPromise({
      catch: (cause) => new OnboardingStatusReadError({ cause }),
      try: () => fetchQuery(api.onboarding.queries.getStatus, {}, { token }),
    });
  }
);

/** Records and returns authoritative onboarding admission for an account. */
export const recordOnboardingAdmission = Effect.fn(
  "www.onboarding.recordAdmission"
)(function* (token: string) {
  return yield* Effect.tryPromise({
    catch: (cause) => new OnboardingAdmissionError({ cause }),
    try: () => fetchMutation(api.onboarding.mutations.admit, {}, { token }),
  });
});
