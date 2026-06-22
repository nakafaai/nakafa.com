import type { NinaContextPack } from "@repo/ai/nina/context";
import { formatNinaContextPackPrompt } from "@repo/ai/nina/prompt";
import { formatLearningProfilePromptContext } from "@repo/ai/prompt/learning-profile";
import type { AgentLearningProfile } from "@repo/ai/types/agents";
import type { Locale } from "@repo/utilities/locales";

/** Structured runtime facts that Nina can use without route or title guessing. */
export interface RuntimePromptContext {
  readonly currentDate: string;
  readonly currentPage: {
    readonly locale: Locale;
    readonly slug: string;
    readonly verified: boolean;
  };
  readonly learningProfile?: AgentLearningProfile;
  readonly nina: NinaContextPack;
  readonly url: string;
  readonly userLocation: {
    readonly city: string;
    readonly country: string;
    readonly countryRegion: string;
    readonly latitude: string;
    readonly longitude: string;
  };
}

/** Formats verified page, location, Nina context, and learning profile facts. */
export function formatRuntimePrompt({
  currentDate,
  currentPage,
  learningProfile,
  nina,
  url,
  userLocation,
}: RuntimePromptContext) {
  return `
      # Runtime Context

      Current page:
      - url: ${url}
      - locale: ${currentPage.locale}
      - slug: ${currentPage.slug}
      - verified: ${currentPage.verified ? "yes" : "no"}

      User context:
      - date: ${currentDate}
      - city: ${userLocation.city}
      - country: ${userLocation.country}
      - country region: ${userLocation.countryRegion}
      - latitude: ${userLocation.latitude}
      - longitude: ${userLocation.longitude}

      ${formatNinaContextPackPrompt(nina)}

      ${formatLearningProfilePromptContext(learningProfile)}
    `;
}
