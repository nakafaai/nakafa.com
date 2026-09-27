import { requireAuth } from "@repo/backend/confect/auth/session";
import { saveOnboardingAnswer } from "@repo/backend/confect/onboarding/impl";
import { OnboardingRoleError } from "@repo/backend/confect/onboarding/mutations.spec";
import type { onboardingAnswerValidator } from "@repo/backend/confect/onboarding/schema";
import { isSelfSelectableUserRole } from "@repo/backend/confect/users/roles";
import { Effect, type Schema } from "effect";
export type OnboardingAnswer = Schema.Schema.Type<
  typeof onboardingAnswerValidator
>;
/** Restricts self-service answers to roles owned by learner onboarding. */
export const requireSelfSelectableOnboardingUser = Effect.fn(
  "onboarding.requireSelfSelectableUser"
)(function* () {
  const user = yield* requireAuth();
  if (
    user.appUser.role !== undefined &&
    !isSelfSelectableUserRole(user.appUser.role)
  ) {
    return yield* new OnboardingRoleError({
      code: "UNAUTHORIZED",
      message: "This account role cannot be changed through onboarding.",
    });
  }
  return user;
});

/** Saves one authenticated onboarding answer as resumable draft state. */
export const saveAnswerProgram = Effect.fn("onboarding.saveAnswerMutation")(
  function* (answer: OnboardingAnswer) {
    const user = yield* requireSelfSelectableOnboardingUser();
    return yield* saveOnboardingAnswer(user.appUser._id, answer);
  }
);
