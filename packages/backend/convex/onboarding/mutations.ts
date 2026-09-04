import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { mutation } from "@repo/backend/convex/functions";
import {
  getUnknownErrorMessage,
  readConvexErrorData,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import {
  getOptionalActiveAppUser,
  requireAuth,
} from "@repo/backend/convex/lib/helpers/auth";
import {
  admitOnboarding,
  finishOnboarding,
  saveOnboardingAnswer,
} from "@repo/backend/convex/onboarding/impl";
import {
  onboardingAnswerValidator,
  onboardingCompletionValidator,
  onboardingProfileValidator,
  onboardingStatusValidator,
} from "@repo/backend/convex/onboarding/schema";
import { onboardingFinishResultValidator } from "@repo/backend/convex/onboarding/spec";
import { isSelfSelectableUserRole } from "@repo/backend/convex/users/roles";
import type { Infer } from "convex/values";
import { Effect, Schema } from "effect";

type OnboardingAnswer = Infer<typeof onboardingAnswerValidator>;
const onboardingAuthFailedCode = "ONBOARDING_AUTH_FAILED";
const unauthenticatedCode = "UNAUTHENTICATED";
const unauthorizedCode = "UNAUTHORIZED";

/** Expected authentication failure for an onboarding mutation. */
class OnboardingAuthError extends Schema.TaggedError<OnboardingAuthError>()(
  "OnboardingAuthError",
  {
    code: Schema.Literals([
      onboardingAuthFailedCode,
      unauthenticatedCode,
      unauthorizedCode,
    ]),
    message: Schema.String,
  }
) {}

/** Preserves shared auth failures and redacts unknown boundary details. */
function toOnboardingAuthError(error: unknown) {
  const known = readConvexErrorData(error);
  const message = known?.message ?? getUnknownErrorMessage(error);
  if (known?.code === unauthorizedCode) {
    return new OnboardingAuthError({
      code: unauthorizedCode,
      message,
    });
  }

  if (message === "Unauthenticated") {
    return new OnboardingAuthError({
      code: unauthenticatedCode,
      message,
    });
  }

  return new OnboardingAuthError({
    code: onboardingAuthFailedCode,
    message: "Unable to authenticate the onboarding request.",
  });
}

/** Resolves the authenticated app user inside the Effect error channel. */
const requireActiveOnboardingUser = Effect.fn("onboarding.requireActiveUser")(
  function* (ctx: MutationCtx) {
    const user = yield* Effect.tryPromise({
      catch: toOnboardingAuthError,
      try: () => requireAuth(ctx),
    });
    return user;
  }
);

/** Resolves optional auth so admission can preserve a signed-out continuation. */
const readOptionalActiveOnboardingUser = Effect.fn(
  "onboarding.readOptionalActiveUser"
)(function* (ctx: MutationCtx) {
  return yield* Effect.tryPromise({
    catch: toOnboardingAuthError,
    try: () => getOptionalActiveAppUser(ctx),
  });
});

/** Restricts self-service answers to roles owned by learner onboarding. */
const requireSelfSelectableOnboardingUser = Effect.fn(
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

/** Records the first authoritative first-run admission for this app user. */
export const admit = mutation({
  args: {},
  returns: onboardingStatusValidator,
  handler: (ctx) =>
    runConvexProgram(
      Effect.gen(function* () {
        const user = yield* readOptionalActiveOnboardingUser(ctx);
        if (!user) {
          return {
            isAuthenticated: false as const,
            isRequired: false as const,
            profile: null,
          };
        }
        return yield* admitOnboarding(ctx, user.appUser);
      })
    ),
});

/** Saves one authenticated onboarding answer as resumable draft state. */
const saveAnswerProgram = Effect.fn("onboarding.saveAnswerMutation")(function* (
  ctx: MutationCtx,
  answer: OnboardingAnswer
) {
  const user = yield* requireSelfSelectableOnboardingUser(ctx);
  return yield* saveOnboardingAnswer(ctx, user.appUser._id, answer);
});

/** Saves one answer without applying locale, curriculum, or role settings. */
export const saveAnswer = mutation({
  args: { answer: onboardingAnswerValidator },
  returns: onboardingProfileValidator,
  handler: (ctx, { answer }) =>
    runConvexProgram(saveAnswerProgram(ctx, answer)),
});

/** Atomically applies a complete onboarding profile and marks it complete. */
export const finish = mutation({
  args: { answers: onboardingCompletionValidator },
  returns: onboardingFinishResultValidator,
  handler: (ctx, { answers }) =>
    runConvexProgram(
      Effect.gen(function* () {
        const user = yield* requireSelfSelectableOnboardingUser(ctx);
        return yield* finishOnboarding(ctx, user.appUser._id, answers);
      })
    ),
});
