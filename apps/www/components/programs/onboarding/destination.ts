import type { Ref } from "@confect/core";
import type refs from "@repo/backend/confect/_generated/refs";

import type { PostAuthIntentResolution } from "@/lib/auth/admission";
import { getPostAuthDestination } from "@/lib/auth/admission";
import { getCurriculumProgramHref } from "@/lib/curriculum/routes";

type OnboardingFinishResult = Ref.Returns<
  typeof refs.public.onboarding.mutations.finish
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

  return {
    href: getCurriculumProgramHref({
      locale: result.locale,
      publicSlug: result.destination.publicSlug,
    }),
    locale: result.locale,
  };
}
