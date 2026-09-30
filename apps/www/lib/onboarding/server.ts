import "server-only";

import { HttpClient } from "@confect/js";
import refs from "@repo/backend/confect/_generated/refs";
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
      return yield* client.query(refs.public.onboarding.queries.getStatus, {});
    }).pipe(
      Effect.provide(httpLayer({ auth: token })),
      Effect.mapError((cause) => new OnboardingStatusReadError({ cause }))
    );
  }
);

/** Records and returns authoritative onboarding admission for an account. */
export const recordOnboardingAdmission = Effect.fn(
  "www.onboarding.recordAdmission"
)(function* (token: string) {
  return yield* Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    return yield* client.mutation(refs.public.onboarding.mutations.admit, {});
  }).pipe(
    Effect.provide(httpLayer({ auth: token })),
    Effect.mapError((cause) => new OnboardingAdmissionError({ cause }))
  );
});
