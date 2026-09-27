import { FunctionSpec, GroupSpec } from "@confect/core";
import { failureWire } from "@repo/backend/confect/failure";
import {
  OnboardingProfileErrorWire,
  onboardingStatusValidator,
} from "@repo/backend/confect/onboarding/schema";
import { Schema } from "effect";
export const onboardingReadFailedCode = "ONBOARDING_READ_FAILED";

/** Expected authentication read failure for onboarding state. */
export class OnboardingReadError extends Schema.TaggedError<OnboardingReadError>()(
  "OnboardingReadError",
  {
    code: Schema.Literal(onboardingReadFailedCode),
    message: Schema.Literal("Unable to read onboarding progress."),
  }
) {}

/** Returns whether onboarding is required and any resumable draft profile. */
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
export const OnboardingReadErrorWire = failureWire(OnboardingReadError);
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "getStatus",
    args: () => ({}),
    returns: () => onboardingStatusValidator,
    error: () =>
      Schema.Union([OnboardingReadErrorWire, OnboardingProfileErrorWire]),
  })
);
