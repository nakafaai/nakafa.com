import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import {
  readOnboardingProfileByUserId,
  toOnboardingProfile,
} from "@repo/backend/convex/onboarding/impl";
import { onboardingStatusValidator } from "@repo/backend/convex/onboarding/schema";
import { isSelfSelectableUserRole } from "@repo/backend/convex/users/roles";
import { Effect, Schema } from "effect";

const onboardingReadFailedCode = "ONBOARDING_READ_FAILED";

/** Expected authentication read failure for onboarding state. */
class OnboardingReadError extends Schema.TaggedError<OnboardingReadError>()(
  "OnboardingReadError",
  {
    code: Schema.Literal(onboardingReadFailedCode),
    message: Schema.Literal("Unable to read onboarding progress."),
  }
) {}

/** Returns whether onboarding is required and any resumable draft profile. */
export const getStatus = query({
  args: {},
  returns: onboardingStatusValidator,
  handler: (ctx) =>
    runConvexProgram(
      Effect.gen(function* () {
        const user = yield* Effect.tryPromise({
          catch: () =>
            new OnboardingReadError({
              code: onboardingReadFailedCode,
              message: "Unable to read onboarding progress.",
            }),
          try: () => getOptionalAppUserForRead(ctx),
        });
        if (!user) {
          return { isRequired: false, profile: null };
        }

        const profile = yield* readOnboardingProfileByUserId(
          ctx,
          user.appUser._id
        );
        const publicProfile = profile ? toOnboardingProfile(profile) : null;
        const maySelfSelectRole =
          user.appUser.role === undefined ||
          isSelfSelectableUserRole(user.appUser.role);
        return {
          isRequired: maySelfSelectRole && profile?.completedAt === undefined,
          profile: publicProfile,
        };
      })
    ),
});
