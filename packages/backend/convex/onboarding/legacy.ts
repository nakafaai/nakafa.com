import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  OnboardingFocus,
  OnboardingRegion,
} from "@repo/backend/convex/onboarding/schema";
import {
  isSelfSelectableUserRole,
  type SelfSelectableUserRole,
} from "@repo/backend/convex/users/roles";

export interface MigratedOnboardingAnswers {
  readonly focus: OnboardingFocus;
  readonly region: OnboardingRegion;
  readonly role: SelfSelectableUserRole;
}

/** Reads a normal end-user role without migrating privileged roles. */
function readSelfSelectableRole(
  role: Doc<"users">["role"]
): SelfSelectableUserRole | undefined {
  return isSelfSelectableUserRole(role) ? role : undefined;
}

/** Maps one canonical curriculum key to the least-assumptive product region. */
function readCurriculumRegion(
  programKey: string | undefined
): OnboardingRegion | undefined {
  switch (programKey) {
    case "merdeka":
      return "indonesia";
    case "singapore-moe":
      return "singapore";
    case "cambridge-international":
      return "international";
    case "united-states":
      return "united-states";
    default:
      return undefined;
  }
}

/** Resolves the explicit focus saved by the old onboarding flow. */
function readLegacyInterestFocus(
  preference: Doc<"learningPreferences">
): OnboardingFocus | undefined {
  switch (preference.learningInterest) {
    case "school-curriculum":
      return "learning";
    case "assessment-prep":
    case "exam-prep":
      return "tryout";
    default:
      return undefined;
  }
}

/** Resolves a focus only when the old primary program makes it unambiguous. */
function readLegacyProgramFocus(
  preference: Doc<"learningPreferences">
): OnboardingFocus | undefined {
  if (
    preference.primaryProgramKey === "assessment" ||
    preference.primaryProgramKey === "snbt" ||
    preference.primaryProgramKey === "tka"
  ) {
    return "tryout";
  }

  return readCurriculumRegion(preference.primaryProgramKey)
    ? "learning"
    : undefined;
}

/** Combines old focus signals without guessing when they disagree. */
function readLegacyFocus(
  preference: Doc<"learningPreferences">
): OnboardingFocus | undefined {
  const interestFocus = readLegacyInterestFocus(preference);
  const programFocus = readLegacyProgramFocus(preference);
  if (interestFocus && programFocus && interestFocus !== programFocus) {
    return undefined;
  }

  return (
    interestFocus ??
    programFocus ??
    (readCurriculumRegion(preference.preferredCurriculumProgramKey)
      ? "learning"
      : undefined)
  );
}

/** Derives a complete new profile only from unambiguous legacy facts. */
export function deriveMigratedOnboardingAnswers(
  user: Pick<Doc<"users">, "deletedAt" | "role">,
  preference: Doc<"learningPreferences"> | null
): MigratedOnboardingAnswers | null {
  if (user.deletedAt !== undefined || !preference) {
    return null;
  }

  const role = readSelfSelectableRole(user.role);
  const focus = readLegacyFocus(preference);
  const region =
    readCurriculumRegion(preference.preferredCurriculumProgramKey) ??
    readCurriculumRegion(preference.primaryProgramKey) ??
    (preference.primaryProgramKey === "snbt" ||
    preference.primaryProgramKey === "tka"
      ? "indonesia"
      : undefined);

  if (!(role && focus && region)) {
    return null;
  }

  return { focus, region, role };
}
