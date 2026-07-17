import { Option, Schema } from "effect";
import type {
  ActiveLearningProfile,
  LearningProgramCatalog,
} from "@/components/programs/contract";
import {
  type FocusOption,
  focusOptionsByRole,
  type OnboardingFocusKey,
  type OnboardingRole,
  onboardingFocusKeys,
  onboardingRoles,
  roleOptions,
} from "@/components/programs/onboarding/options";

/** One selectable program summary returned by the Convex program catalog. */
export type ProgramOption = LearningProgramCatalog[number];

/** Runtime schema for the role step. */
export const onboardingRoleSchema = Schema.Literal(...onboardingRoles);

/** Runtime schema for the second onboarding step. */
export const onboardingFocusSchema = Schema.Literal(...onboardingFocusKeys);

/** Safely parses unknown form roles into the self-selectable app role union. */
export function parseOnboardingRole(value: unknown): OnboardingRole | null {
  const parsed = Schema.decodeUnknownOption(onboardingRoleSchema)(value);

  if (Option.isNone(parsed)) {
    return null;
  }

  return parsed.value;
}

/** Lists role-specific focus cards that can resolve to a selectable program. */
export function getFocusOptionsForRole(
  role: OnboardingRole,
  programs: readonly ProgramOption[]
) {
  return focusOptionsByRole[role].filter(
    (option) => resolveFocusSelection(programs, option) !== null
  );
}

/** Lists role cards that have at least one usable next-step focus. */
export function getSelectableRoleOptions(programs: readonly ProgramOption[]) {
  return roleOptions.filter(
    (role) => getFocusOptionsForRole(role.key, programs).length > 0
  );
}

/** Finds a role-specific focus card by key after the role is selected. */
export function getFocusOptionForKey(
  role: OnboardingRole,
  key: string
): FocusOption | null {
  return focusOptionsByRole[role].find((option) => option.key === key) ?? null;
}

/** Finds the focus card that best matches a returning user's active profile. */
export function getInitialFocusKey({
  activeProfile,
  programs,
  role,
}: {
  activeProfile: ActiveLearningProfile;
  programs: readonly ProgramOption[];
  role: OnboardingRole;
}): OnboardingFocusKey | "" {
  if (!activeProfile) {
    return "";
  }

  const options = getFocusOptionsForRole(role, programs);
  const programMatch = options.find((option) => {
    const selection = resolveFocusSelection(programs, option);
    return selection?.program.key === activeProfile.program.key;
  });

  if (programMatch) {
    return programMatch.key;
  }

  const interestMatch = options.find((option) =>
    activeProfile.interests.some((interest) => interest === option.interest)
  );

  return interestMatch?.key ?? "";
}

/** Resolves one learner-facing focus into the persisted interest and program. */
export function resolveFocusSelection(
  programs: readonly ProgramOption[],
  focus: FocusOption
) {
  const program = programs.find((program) =>
    focus.preferredKinds.some((kind) => kind === program.kind)
  );

  if (!program) {
    return null;
  }

  return {
    interests: [focus.interest],
    program,
  };
}

/** Checks whether the current language has at least one usable onboarding card. */
export function hasOnboardingChoices(programs: readonly ProgramOption[]) {
  return roleOptions.some(
    (role) => getFocusOptionsForRole(role.key, programs).length > 0
  );
}
