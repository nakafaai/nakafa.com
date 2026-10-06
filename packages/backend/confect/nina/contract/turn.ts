import {
  type AgentContext,
  AgentCurriculumPreferenceSchema,
} from "@repo/backend/confect/nina/contract/agent";
import { NinaContextPackSchema } from "@repo/backend/confect/nina/contract/pack";
import { PromptUserRoleSchema } from "@repo/backend/confect/users/role";
import { LocaleSchema } from "@repo/contents/content";
import { cleanSlug } from "@repo/utilities/helper";
import { Schema, Struct } from "effect";
/** Verified learning page state consumed by one Nina turn. */
export const NinaPageSchema = Schema.Struct({
  locale: LocaleSchema,
  needsFetch: Schema.Boolean,
  nina: NinaContextPackSchema,
  slug: Schema.String,
  url: Schema.String,
  verified: Schema.Boolean,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
/** Runtime facts that are stable for one Nina turn. */
export const NinaRuntimeSchema = Schema.Struct({
  currentDate: Schema.String,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
/** User facts Nina may use after app auth and selection boundaries validate them. */
export const NinaUserSchema = Schema.Struct({
  curriculumPreference: Schema.optional(AgentCurriculumPreferenceSchema),
  role: Schema.optional(PromptUserRoleSchema),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export type NinaPage = typeof NinaPageSchema.Type;
export type NinaRuntime = typeof NinaRuntimeSchema.Type;
export type NinaUser = typeof NinaUserSchema.Type;
/** Returns the immutable learning page that should drive one Nina turn. */
export function readNinaLearningPage(page: NinaPage) {
  const learning = page.nina.learning;
  return {
    locale: learning.locale,
    slug: cleanSlug(learning.slug),
    url: learning.url,
    verified: learning.verified,
  };
}
/** Builds the shared specialist context from validated Nina turn inputs. */
export function createNinaAgentContext({
  page,
  runtime,
  user,
}: {
  readonly page: NinaPage;
  readonly runtime: NinaRuntime;
  readonly user: NinaUser;
}): AgentContext {
  const learningPage = readNinaLearningPage(page);
  return {
    currentDate: runtime.currentDate,
    nina: page.nina,
    slug: learningPage.slug,
    url: learningPage.url,
    verified: learningPage.verified,
    ...(user.curriculumPreference
      ? { curriculumPreference: user.curriculumPreference }
      : {}),
    ...(user.role ? { userRole: user.role } : {}),
  };
}
