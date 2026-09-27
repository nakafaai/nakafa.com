import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { readOnboardingProfileByUserId } from "@repo/backend/confect/onboarding/impl";
import spec from "@repo/backend/confect/onboarding/queries.spec";
import { toOnboardingStatus } from "@repo/backend/confect/onboarding/status";
import { Effect, Layer } from "effect";

const getStatus = FunctionImpl.make(
  databaseSchema,
  spec,
  "getStatus",
  Effect.fn("onboarding.queries.getStatus")(function* () {
    return yield* Effect.gen(function* () {
      const user = yield* getOptionalAppUserForRead();
      if (!user) {
        return {
          isAuthenticated: false as const,
          isRequired: false as const,
          profile: null,
        };
      }
      const profile = yield* readOnboardingProfileByUserId(user.appUser._id);
      return toOnboardingStatus(user.appUser, profile);
    });
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getStatus),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
