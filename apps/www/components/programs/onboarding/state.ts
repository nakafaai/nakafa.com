import { LearningInterestSchema } from "@repo/contents/_types/program/schema";
import { Schema } from "effect";

const onboardingValueSchema = Schema.Struct({
  interests: Schema.Array(LearningInterestSchema).pipe(
    Schema.minItems(1),
    Schema.mutable
  ),
  primaryProgramKey: Schema.Trim.pipe(Schema.minLength(1)),
});

/** TanStack Form validator for the program onboarding flow. */
export const onboardingFormSchema = Schema.standardSchemaV1(
  onboardingValueSchema
);

/** Submitted onboarding values derived from the form schema. */
export type OnboardingFormValue = Schema.Schema.Type<
  typeof onboardingValueSchema
>;

/** Decodes untrusted onboarding form values before profile selection is saved. */
export const decodeOnboardingValue = Schema.decodeUnknown(
  onboardingValueSchema
);

/** Result state shown by the onboarding form when profile selection fails. */
export interface OnboardingState {
  messageKey?: "onboarding.invalid-selection" | "onboarding.save-error";
  status: "error" | "idle" | "success";
}

/** Default submission state for the program onboarding form. */
export const initialOnboardingState: OnboardingState = {
  status: "idle",
};
