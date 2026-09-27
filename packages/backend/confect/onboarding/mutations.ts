import {
  getOptionalActiveAppUser,
  requireAuth,
} from "@repo/backend/confect/auth/session";
import type { AuthFailure } from "@repo/backend/confect/auth/spec";
import { saveOnboardingAnswer } from "@repo/backend/confect/onboarding/impl";
import {
  OnboardingAuthError,
  onboardingAuthFailedCode,
  unauthorizedCode,
} from "@repo/backend/confect/onboarding/mutations.spec";
import type { onboardingAnswerValidator } from "@repo/backend/confect/onboarding/schema";
import { isSelfSelectableUserRole } from "@repo/backend/confect/users/roles";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect, type Schema } from "effect";
export type OnboardingAnswer = Schema.Schema.Type<
  typeof onboardingAnswerValidator
>;
/** Preserves shared auth failures and redacts storage details. */
function toOnboardingAuthError(error: AuthFailure) {
  if (error._tag !== "AuthReadError") {
    return new OnboardingAuthError({
      code: error.code,
      message: error.message,
    });
  }
  return new OnboardingAuthError({
    code: onboardingAuthFailedCode,
    message: "Unable to authenticate the onboarding request.",
  });
}

/** Resolves the authenticated app user inside the Effect error channel. */
export const requireActiveOnboardingUser = Effect.fn(
  "onboarding.requireActiveUser"
)(function* (ctx: MutationCtx) {
  const user = yield* requireAuth(ctx).pipe(
    Effect.mapError(toOnboardingAuthError)
  );
  return user;
});

/** Resolves optional auth so admission can preserve a signed-out continuation. */
export const readOptionalActiveOnboardingUser = Effect.fn(
  "onboarding.readOptionalActiveUser"
)(function* (ctx: MutationCtx) {
  return yield* getOptionalActiveAppUser(ctx).pipe(
    Effect.mapError(toOnboardingAuthError)
  );
});

/** Restricts self-service answers to roles owned by learner onboarding. */
export const requireSelfSelectableOnboardingUser = Effect.fn(
  "onboarding.requireSelfSelectableUser"
)(function* (ctx: MutationCtx) {
  const user = yield* requireActiveOnboardingUser(ctx);
  if (
    user.appUser.role !== undefined &&
    !isSelfSelectableUserRole(user.appUser.role)
  ) {
    return yield* new OnboardingAuthError({
      code: unauthorizedCode,
      message: "This account role cannot be changed through onboarding.",
    });
  }
  return user;
});

/** Saves one authenticated onboarding answer as resumable draft state. */
export const saveAnswerProgram = Effect.fn("onboarding.saveAnswerMutation")(
  function* (ctx: MutationCtx, answer: OnboardingAnswer) {
    const user = yield* requireSelfSelectableOnboardingUser(ctx);
    return yield* saveOnboardingAnswer(ctx, user.appUser._id, answer);
  }
);
