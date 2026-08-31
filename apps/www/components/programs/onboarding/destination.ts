import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import {
  getCurriculumIndexHref,
  getCurriculumProgramHref,
} from "@/lib/curriculum/routes";

type OnboardingFinishResult = FunctionReturnType<
  typeof api.onboarding.mutations.finish
>;

/** Converts the backend destination contract into one localized app href. */
export function getOnboardingDestinationHref(result: OnboardingFinishResult) {
  if (result.destination.kind === "tryout") {
    return "/try-out";
  }

  if (result.destination.kind === "curriculum-index") {
    return getCurriculumIndexHref(result.locale);
  }

  return getCurriculumProgramHref({
    locale: result.locale,
    publicSlug: result.destination.publicSlug,
  });
}
