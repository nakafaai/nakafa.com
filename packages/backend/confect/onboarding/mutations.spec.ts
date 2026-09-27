import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import { WelcomeIntentErrorWire } from "@repo/backend/confect/emails/welcome/spec";
import { failureWire } from "@repo/backend/confect/failure";
import {
  CurriculumPreferenceErrorWire,
  LearningPreferencePersistenceErrorWire,
} from "@repo/backend/confect/learningPreferences/schema";
import {
  OnboardingProfileErrorWire,
  onboardingAnswerValidator,
  onboardingCompletionValidator,
  onboardingProfileValidator,
  onboardingStatusValidator,
} from "@repo/backend/confect/onboarding/schema";
import { onboardingFinishResultValidator } from "@repo/backend/confect/onboarding/spec";
import { Schema } from "effect";
export const onboardingAuthFailedCode = "ONBOARDING_AUTH_FAILED";
export const unauthenticatedCode = "UNAUTHENTICATED";
export const unauthorizedCode = "UNAUTHORIZED";

/** Expected authentication failure for an onboarding mutation. */
export class OnboardingAuthError extends Schema.TaggedError<OnboardingAuthError>()(
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
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
export const OnboardingAuthErrorWire = failureWire(OnboardingAuthError);
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "admit",
      args: () => ({}),
      returns: () => onboardingStatusValidator,
      error: () =>
        Schema.Union([OnboardingAuthErrorWire, OnboardingProfileErrorWire]),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "saveAnswer",
      args: () => ({
        answer: onboardingAnswerValidator,
      }),
      returns: () => onboardingProfileValidator,
      error: () =>
        Schema.Union([OnboardingAuthErrorWire, OnboardingProfileErrorWire]),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "finish",
      args: () => ({
        answers: onboardingCompletionValidator,
      }),
      returns: () => onboardingFinishResultValidator,
      error: () =>
        Schema.Union([
          OnboardingAuthErrorWire,
          OnboardingProfileErrorWire,
          ReleaseErrorWire,
          CurriculumPreferenceErrorWire,
          LearningPreferencePersistenceErrorWire,
          WelcomeIntentErrorWire,
        ]),
    })
  );
