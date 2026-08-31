import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import type {
  OnboardingFocus,
  OnboardingRegion,
} from "@repo/backend/convex/onboarding/schema";
import { v } from "convex/values";

interface OnboardingRegionDefaults {
  readonly curriculumProgramKey?: typeof LearningProgramKeySchema.Type;
  readonly locale: Locale;
}

const onboardingRegionDefaults = {
  germany: {
    curriculumProgramKey: LearningProgramKeySchema.make(
      "cambridge-international"
    ),
    locale: "de",
  },
  indonesia: {
    curriculumProgramKey: LearningProgramKeySchema.make("merdeka"),
    locale: "id",
  },
  international: {
    curriculumProgramKey: LearningProgramKeySchema.make(
      "cambridge-international"
    ),
    locale: "en",
  },
  singapore: {
    curriculumProgramKey: LearningProgramKeySchema.make("singapore-moe"),
    locale: "en",
  },
  "united-kingdom": {
    curriculumProgramKey: LearningProgramKeySchema.make(
      "cambridge-international"
    ),
    locale: "en",
  },
  "united-states": {
    curriculumProgramKey: LearningProgramKeySchema.make("united-states"),
    locale: "en",
  },
} as const satisfies Record<OnboardingRegion, OnboardingRegionDefaults>;

export const onboardingFinishResultValidator = v.object({
  destination: v.union(
    v.object({ kind: v.literal("curriculum-index") }),
    v.object({
      kind: v.literal("curriculum-program"),
      publicSlug: v.string(),
    }),
    v.object({ kind: v.literal("tryout") })
  ),
  locale: localeValidator,
});

/** Resolves one product learning region to its initial locale and curriculum. */
export function getOnboardingRegionDefaults(
  region: OnboardingRegion
): OnboardingRegionDefaults {
  return onboardingRegionDefaults[region];
}

/** Builds the first post-onboarding destination without owning app route strings. */
export function getOnboardingDestination({
  focus,
  publicSlug,
}: {
  focus: OnboardingFocus;
  publicSlug?: string;
}) {
  if (focus === "tryout") {
    return { kind: "tryout" } as const;
  }

  if (publicSlug) {
    return { kind: "curriculum-program", publicSlug } as const;
  }

  return { kind: "curriculum-index" } as const;
}
