import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { readOnboardingProfileByUserId } from "@repo/backend/confect/onboarding/impl";
import spec, {
  OnboardingReadError,
  onboardingReadFailedCode,
} from "@repo/backend/confect/onboarding/queries.spec";
import { toOnboardingStatus } from "@repo/backend/confect/onboarding/status";
import { Effect, Layer } from "effect";

const getStatus = FunctionImpl.make(
  databaseSchema,
  spec,
  "getStatus",
  Effect.fn("onboarding.queries.getStatus")(function* () {
    const ctx = yield* QueryCtxService;
    return yield* Effect.gen(function* () {
      const user = yield* getOptionalAppUserForRead(ctx).pipe(
        Effect.mapError(
          () =>
            new OnboardingReadError({
              code: onboardingReadFailedCode,
              message: "Unable to read onboarding progress.",
            })
        )
      );
      if (!user) {
        return {
          isAuthenticated: false as const,
          isRequired: false as const,
          profile: null,
        };
      }
      const profile = yield* readOnboardingProfileByUserId(
        ctx,
        user.appUser._id
      );
      return toOnboardingStatus(user.appUser, profile);
    });
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getStatus),
  GroupImpl.finalize
);
