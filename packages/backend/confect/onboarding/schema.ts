import {
  onboardingFocuses,
  onboardingRegions,
} from "@repo/backend/confect/onboarding/values";
import { selfSelectableUserRoleValidator } from "@repo/backend/confect/users/schema";
import { Schema } from "effect";
export const onboardingRegionValidator = Schema.Literals([
  ...onboardingRegions,
]);
export const onboardingFocusValidator = Schema.Literals([...onboardingFocuses]);
export type OnboardingRegion = typeof onboardingRegionValidator.Type;
export type OnboardingFocus = typeof onboardingFocusValidator.Type;
export const onboardingCompletionValidator = Schema.Struct({
  focus: onboardingFocusValidator,
  region: onboardingRegionValidator,
  role: selfSelectableUserRoleValidator,
});
export type OnboardingCompletion = typeof onboardingCompletionValidator.Type;
export const onboardingAnswerValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("role"),
    value: selfSelectableUserRoleValidator,
  }),
  Schema.Struct({
    kind: Schema.Literal("region"),
    value: onboardingRegionValidator,
  }),
  Schema.Struct({
    kind: Schema.Literal("focus"),
    value: onboardingFocusValidator,
  }),
]);
export const onboardingProfileValidator = Schema.Struct({
  completedAt: Schema.optionalKey(Schema.Finite),
  focus: Schema.optionalKey(onboardingFocusValidator),
  region: Schema.optionalKey(onboardingRegionValidator),
  role: Schema.optionalKey(selfSelectableUserRoleValidator),
  updatedAt: Schema.Finite,
});
export const currentOnboardingProfileValidator = Schema.Union([
  Schema.Null,
  onboardingProfileValidator,
]);
export const onboardingStatusValidator = Schema.Union([
  Schema.Struct({
    isAuthenticated: Schema.Literal(false),
    isRequired: Schema.Literal(false),
    profile: Schema.Null,
  }),
  Schema.Struct({
    isAuthenticated: Schema.Literal(true),
    isRequired: Schema.Boolean,
    profile: currentOnboardingProfileValidator,
  }),
]);
export const onboardingAlreadyCompleteCode = "ONBOARDING_ALREADY_COMPLETE";
export const onboardingPersistenceFailedCode = "ONBOARDING_PERSISTENCE_FAILED";
export const onboardingCurriculumMissingCode = "ONBOARDING_CURRICULUM_MISSING";

/** Expected failure while reading, saving, or completing onboarding. */
export class OnboardingProfileError extends Schema.TaggedError<OnboardingProfileError>()(
  "OnboardingProfileError",
  {
    code: Schema.Literals([
      onboardingAlreadyCompleteCode,
      onboardingCurriculumMissingCode,
      onboardingPersistenceFailedCode,
    ]),
    message: Schema.String,
  }
) {}

/** Maps unknown database failures into the stable onboarding contract. */
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
