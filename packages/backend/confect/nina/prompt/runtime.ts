import { AgentCurriculumPreferenceSchema } from "@repo/backend/confect/nina/contract/agent";
import { NinaContextPackSchema } from "@repo/backend/confect/nina/contract/pack";
import type {
  NinaPage,
  NinaRuntime,
  NinaUser,
} from "@repo/backend/confect/nina/contract/turn";
import { formatCurriculumPreferencePromptContext } from "@repo/backend/confect/nina/prompt/curriculum";
import { formatNinaContextPackPrompt } from "@repo/backend/confect/nina/prompt/system";
import dedent from "dedent";
import { Schema, Struct } from "effect";

/** Structured runtime facts that Nina can use without route or title guessing. */
const RuntimePromptContextSchema = Schema.Struct({
  currentDate: Schema.String,
  curriculumPreference: Schema.optional(AgentCurriculumPreferenceSchema),
  nina: NinaContextPackSchema,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
type RuntimePromptContext = typeof RuntimePromptContextSchema.Type;
/**
 * Formats the date, the page, Nina context, and learning selection facts. The
 * page is named once, in the context pack: its address, locale, slug and
 * whether it has signed content.
 */
function formatRuntimePrompt({
  currentDate,
  curriculumPreference,
  nina,
}: RuntimePromptContext) {
  return `
      # Runtime Context

      Nakafa wrote this for the learner's message below. The learner did not, so do not quote it back.

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
  const facts = dedent(
    formatRuntimePrompt({
      currentDate: runtime.currentDate,
      curriculumPreference: user.curriculumPreference,
      nina: page.nina,
    })
  );
  return memories === undefined ? facts : `${facts}\n\n${memories}`;
}
