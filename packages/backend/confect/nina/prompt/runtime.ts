import { AgentCurriculumPreferenceSchema } from "@repo/backend/confect/nina/contract/agent";
import { NinaContextPackSchema } from "@repo/backend/confect/nina/contract/pack";
import { formatCurriculumPreferencePromptContext } from "@repo/backend/confect/nina/prompt/curriculum";
import { formatNinaContextPackPrompt } from "@repo/backend/confect/nina/prompt/system";
import { LocaleSchema } from "@repo/contents/content";
import { Schema, Struct } from "effect";
/** Structured runtime facts that Nina can use without route or title guessing. */
export const RuntimePromptContextSchema = Schema.Struct({
  currentDate: Schema.String,
  currentPage: Schema.Struct({
    locale: LocaleSchema,
    slug: Schema.String,
    verified: Schema.Boolean,
  }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey))),
  curriculumPreference: Schema.optional(AgentCurriculumPreferenceSchema),
  nina: NinaContextPackSchema,
  url: Schema.String,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export type RuntimePromptContext = Schema.Schema.Type<
  typeof RuntimePromptContextSchema
>;
/** Formats verified page, Nina context, and learning selection facts. */
export function formatRuntimePrompt({
  currentDate,
  currentPage,
  curriculumPreference,
  nina,
  url,
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


      ${formatNinaContextPackPrompt(nina)}

      ${formatCurriculumPreferencePromptContext(curriculumPreference)}
    `;
}
