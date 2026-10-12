import { AgentCurriculumPreferenceSchema } from "@repo/backend/confect/nina/contract/agent";
import { NinaContextPackSchema } from "@repo/backend/confect/nina/contract/pack";
import {
  type NinaPage,
  type NinaRuntime,
  type NinaUser,
  readNinaLearningPage,
} from "@repo/backend/confect/nina/contract/turn";
import { formatCurriculumPreferencePromptContext } from "@repo/backend/confect/nina/prompt/curriculum";
import { formatNinaContextPackPrompt } from "@repo/backend/confect/nina/prompt/system";
import { LocaleSchema } from "@repo/contents/content";
import dedent from "dedent";
import { Schema, Struct } from "effect";

/** Structured runtime facts that Nina can use without route or title guessing. */
const RuntimePromptContextSchema = Schema.Struct({
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
type RuntimePromptContext = typeof RuntimePromptContextSchema.Type;
/** Formats verified page, Nina context, and learning selection facts. */
function formatRuntimePrompt({
  currentDate,
  currentPage,
  curriculumPreference,
  nina,
  url,
}: RuntimePromptContext) {
  return `
      # Runtime Context

      Nakafa wrote this for the learner's message below. The learner did not, so do not quote it back.

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

/**
 * Formats the runtime facts of one turn from what admission froze, and the
 * memories the turn recalls (`memories`, already formatted by `formatRecalled`),
 * which follow them. They change between turns, so they travel with the newest
 * learner message and never sit in the system prompt, whose bytes the provider
 * caches.
 */
export function formatTurnContext({
  memories,
  page,
  runtime,
  user,
}: {
  readonly memories?: string | undefined;
  readonly page: NinaPage;
  readonly runtime: NinaRuntime;
  readonly user: NinaUser;
}) {
  const learningPage = readNinaLearningPage(page);
  const facts = dedent(
    formatRuntimePrompt({
      currentDate: runtime.currentDate,
      currentPage: {
        locale: learningPage.locale,
        slug: learningPage.slug,
        verified: learningPage.verified,
      },
      curriculumPreference: user.curriculumPreference,
      nina: page.nina,
      url: learningPage.url,
    })
  );
  return memories === undefined ? facts : `${facts}\n\n${memories}`;
}
