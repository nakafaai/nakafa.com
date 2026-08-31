import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { Effect, Schema } from "effect";

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
