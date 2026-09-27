import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { WelcomeIntentError } from "@repo/backend/confect/emails/welcome/spec";
import {
  CurriculumPreferenceError,
  LearningPreferencePersistenceError,
} from "@repo/backend/confect/learningPreferences/schema";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  OnboardingProfileError,
  onboardingAnswerValidator,
  onboardingCompletionValidator,
  onboardingProfileValidator,
  onboardingStatusValidator,
} from "@repo/backend/confect/onboarding/schema";
import { onboardingFinishResultValidator } from "@repo/backend/confect/onboarding/spec";
import { Schema } from "effect";
/** A managed account role cannot be replaced through learner onboarding. */
export class OnboardingRoleError extends Schema.TaggedError<OnboardingRoleError>()(
  "OnboardingRoleError",
  {
    code: Schema.Literal("UNAUTHORIZED"),
    message: Schema.String,
  }
) {}

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "admit",
      args: () => ({}),
      returns: () => onboardingStatusValidator,
      error: () => Schema.Union([AuthFailure, OnboardingProfileError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "saveAnswer",
      args: () => ({
        answer: onboardingAnswerValidator,
      }),
      returns: () => onboardingProfileValidator,
      error: () =>
        Schema.Union([
          AuthFailure,
          OnboardingRoleError,
          OnboardingProfileError,
        ]),
    }).middleware(Session)
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
          AuthFailure,
          OnboardingRoleError,
          OnboardingProfileError,
          ReleaseError,
          CurriculumPreferenceError,
          LearningPreferencePersistenceError,
          WelcomeIntentError,
        ]),
    }).middleware(Session)
  );
