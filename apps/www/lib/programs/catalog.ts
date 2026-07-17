import type {
  ActiveLearningProfile,
  LearningProgramCatalog,
} from "@/components/programs/contract";

/** Keeps first-run choices limited to programs that can produce a useful plan. */
function isProgramReadyForOnboarding(program: LearningProgramCatalog[number]) {
  return (
    program.coverageStatus === "available" ||
    program.coverageStatus === "partial"
  );
}

/** Returns only programs that are safe to show in first-run onboarding. */
export function filterOnboardingPrograms(catalog: LearningProgramCatalog) {
  return catalog.filter(isProgramReadyForOnboarding);
}

/** Decides whether a locale can require first-run learning-profile onboarding. */
function hasOnboardingPrograms(catalog: LearningProgramCatalog) {
  return catalog.some(isProgramReadyForOnboarding);
}

/** Decides whether home should require first-run onboarding for this locale. */
export function shouldRequireLearningProgramOnboarding(
  activeProfile: ActiveLearningProfile,
  catalog: LearningProgramCatalog
) {
  return !activeProfile && hasOnboardingPrograms(catalog);
}
