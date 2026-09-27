import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import {
  admitOnboarding,
  finishOnboarding,
} from "@repo/backend/confect/onboarding/impl";
import {
  readOptionalActiveOnboardingUser,
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
    const ctx = yield* MutationCtxService;
    return yield* Effect.gen(function* () {
      const user = yield* readOptionalActiveOnboardingUser(ctx);
      if (!user) {
        return {
          isAuthenticated: false as const,
          isRequired: false as const,
          profile: null,
        };
      }
      return yield* admitOnboarding(ctx, user.appUser);
    });
  })
);
const saveAnswer = FunctionImpl.make(
  databaseSchema,
  spec,
  "saveAnswer",
  Effect.fn("onboarding.mutations.saveAnswer")(function* ({ answer }) {
    const ctx = yield* MutationCtxService;
    return yield* saveAnswerProgram(ctx, answer);
  })
);
const finish = FunctionImpl.make(
  databaseSchema,
  spec,
  "finish",
  Effect.fn("onboarding.mutations.finish")(function* ({ answers }) {
    const ctx = yield* MutationCtxService;
    return yield* Effect.gen(function* () {
      const user = yield* requireSelfSelectableOnboardingUser(ctx);
      return yield* finishOnboarding(ctx, user.appUser._id, answers);
    });
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(admit),
  Layer.provide(saveAnswer),
  Layer.provide(finish),
  GroupImpl.finalize
);
