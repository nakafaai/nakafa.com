import { LearningInterestSchema } from "@repo/contents/_types/learner/preferences";
import { Schema } from "effect";
import {
  onboardingFocusSchema,
  onboardingRoleSchema,
} from "@/components/programs/onboarding/model";

const onboardingValueSchema = Schema.Struct({
  focusKey: onboardingFocusSchema,
  interest: LearningInterestSchema,
  programKey: Schema.Trim.pipe(Schema.check(Schema.isMinLength(1))),
  role: onboardingRoleSchema,
});
const onboardingRoleValueSchema = Schema.Struct({
  role: onboardingRoleSchema,
});
const onboardingFocusValueSchema = Schema.Struct({
  focusKey: onboardingFocusSchema,
});
/** Submitted onboarding values derived from the form schema. */
export type OnboardingFormValue = Schema.Schema.Type<
  typeof onboardingValueSchema
>;
/** Submitted role-step values derived from the role form schema. */
export type OnboardingRoleValue = Schema.Schema.Type<
  typeof onboardingRoleValueSchema
>;
/** Submitted focus-step values derived from the focus form schema. */
export type OnboardingFocusValue = Schema.Schema.Type<
  typeof onboardingFocusValueSchema
>;
/** TanStack Form validator for the role step. */
export const onboardingRoleFormSchema = Schema.toStandardSchemaV1(
  onboardingRoleValueSchema
);
/** TanStack Form validator for the focus step. */
export const onboardingFocusFormSchema = Schema.toStandardSchemaV1(
  onboardingFocusValueSchema
);
/** Decodes untrusted onboarding form values before profile selection is saved. */
export const decodeOnboardingValue = Schema.decodeUnknownEffect(
  onboardingValueSchema
);
/** Decodes untrusted role-step form values before the role is saved. */
export const decodeOnboardingRoleValue = Schema.decodeUnknownEffect(
  onboardingRoleValueSchema
);
/** Result state shown by the onboarding form when profile selection fails. */
export interface OnboardingState {
  messageKey?: "onboarding.invalid-selection" | "onboarding.save-error";
  status: "error" | "idle" | "success";
}
