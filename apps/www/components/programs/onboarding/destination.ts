import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { PostAuthIntentResolution } from "@/lib/auth/admission";
import { getPostAuthDestination } from "@/lib/auth/admission";
import {
  getCurriculumIndexHref,
  getCurriculumProgramHref,
} from "@/lib/curriculum/routes";

type OnboardingFinishResult = FunctionReturnType<
  typeof api.onboarding.mutations.finish
>;

/** Converts the backend destination contract into one localized app href. */
export function getOnboardingDestination(
  result: OnboardingFinishResult,
  intent: PostAuthIntentResolution
) {
  if (intent.kind === "resume") {
    return getPostAuthDestination(intent, result.locale);
  }

  if (result.destination.kind === "tryout") {
    return { href: "/try-out", locale: result.locale };
  }

  if (result.destination.kind === "curriculum-index") {
    return {
      href: getCurriculumIndexHref(result.locale),
      locale: result.locale,
    };
  }

  return {
    href: getCurriculumProgramHref({
      locale: result.locale,
      publicSlug: result.destination.publicSlug,
    }),
    locale: result.locale,
  };
}
