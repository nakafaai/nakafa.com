import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { getOptionalActiveAppUser } from "@repo/backend/confect/auth/session";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import {
  admitOnboarding,
  finishOnboarding,
} from "@repo/backend/confect/onboarding/impl";
import {
  requireSelfSelectableOnboardingUser,
  saveAnswerProgram,
} from "@repo/backend/confect/onboarding/mutations";
import spec from "@repo/backend/confect/onboarding/mutations.spec";
import { Effect, Layer } from "effect";

const admit = FunctionImpl.make(
  databaseSchema,
  spec,
  "admit",
  Effect.fn("onboarding.mutations.admit")(function* () {
    return yield* Effect.gen(function* () {
      const user = yield* getOptionalActiveAppUser();
      if (!user) {
        return {
          isAuthenticated: false as const,
          isRequired: false as const,
          profile: null,
        };
      }
      return yield* admitOnboarding(user.appUser);
    });
  })
);
const saveAnswer = FunctionImpl.make(
  databaseSchema,
  spec,
  "saveAnswer",
  Effect.fn("onboarding.mutations.saveAnswer")(function* ({ answer }) {
    return yield* saveAnswerProgram(answer);
  })
);
const finish = FunctionImpl.make(
  databaseSchema,
  spec,
  "finish",
  Effect.fn("onboarding.mutations.finish")(function* ({ answers }) {
    return yield* Effect.gen(function* () {
      const user = yield* requireSelfSelectableOnboardingUser();
      return yield* finishOnboarding(user.appUser._id, answers);
    });
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(admit),
  Layer.provide(saveAnswer),
  Layer.provide(finish),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
