import { FunctionSpec, GroupSpec } from "@confect/core";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  OnboardingProfileError,
  onboardingStatusValidator,
} from "@repo/backend/confect/onboarding/schema";
/** Returns whether onboarding is required and any resumable draft profile. */

export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "getStatus",
    args: () => ({}),
    returns: () => onboardingStatusValidator,
    error: () => OnboardingProfileError,
  }).middleware(Session)
);
