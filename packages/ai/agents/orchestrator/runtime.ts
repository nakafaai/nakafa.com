import { NinaContextPackSchema } from "@repo/ai/nina/memory/pack";
import { formatNinaContextPackPrompt } from "@repo/ai/nina/prompt/system";
import { formatLearningProfilePromptContext } from "@repo/ai/prompt/learning-profile";
import { AgentLearningProfileSchema } from "@repo/ai/types/agents";
import { LocaleSchema } from "@repo/contents/_types/content";
import { Schema } from "effect";

/** Structured runtime facts that Nina can use without route or title guessing. */
export const RuntimePromptContextSchema = Schema.Struct({
  currentDate: Schema.String,
  currentPage: Schema.Struct({
    locale: LocaleSchema,
    slug: Schema.String,
    verified: Schema.Boolean,
  }).pipe(Schema.mutable),
  learningProfile: Schema.optional(AgentLearningProfileSchema),
  nina: NinaContextPackSchema,
  url: Schema.String,
  userLocation: Schema.Struct({
    city: Schema.String,
    country: Schema.String,
    countryRegion: Schema.String,
    latitude: Schema.String,
    longitude: Schema.String,
  }).pipe(Schema.mutable),
}).pipe(Schema.mutable);

export type RuntimePromptContext = Schema.Schema.Type<
  typeof RuntimePromptContextSchema
>;

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
