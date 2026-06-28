import { ModelIdSchema } from "@repo/ai/config/model";
import { NinaContextPackSchema } from "@repo/ai/nina/memory/pack";
import {
  type AgentContext,
  AgentLearningProfileSchema,
} from "@repo/ai/types/agents";
import { PromptUserRoleSchema } from "@repo/ai/types/roles";
import { LocaleSchema } from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";
import { Schema } from "effect";

/** Verified learning page state consumed by one Nina harness turn. */
export const NinaPageSchema = Schema.Struct({
  locale: LocaleSchema,
  needsFetch: Schema.Boolean,
  nina: NinaContextPackSchema,
  slug: Schema.String,
  url: Schema.String,
  verified: Schema.Boolean,
}).pipe(Schema.mutable);

/** Runtime facts that are stable for one Nina harness turn. */
export const NinaRuntimeSchema = Schema.Struct({
  currentDate: Schema.String,
  modelId: ModelIdSchema,
}).pipe(Schema.mutable);

/** Coarse user-location facts allowed in Nina prompt context. */
export const NinaLocationSchema = Schema.Struct({
  city: Schema.String,
  country: Schema.String,
  countryRegion: Schema.String,
  latitude: Schema.String,
  longitude: Schema.String,
}).pipe(Schema.mutable);

/** User facts Nina may use after app auth/profile boundaries validate them. */
export const NinaUserSchema = Schema.Struct({
  learningProfile: Schema.optional(AgentLearningProfileSchema),
  location: NinaLocationSchema,
  role: Schema.optional(PromptUserRoleSchema),
}).pipe(Schema.mutable);

/** Browser-facing localized copy needed by AI SDK stream error handlers. */
export const NinaCopySchema = Schema.Struct({
  errorMessage: Schema.String,
  rateLimitMessage: Schema.String,
}).pipe(Schema.mutable);

/** Single schema-owned input accepted by the external NinaHarness Interface. */
export const NinaTurnSchema = Schema.Struct({
  copy: NinaCopySchema,
  page: NinaPageSchema,
  runtime: NinaRuntimeSchema,
  user: NinaUserSchema,
}).pipe(Schema.mutable);

export type NinaPage = Schema.Schema.Type<typeof NinaPageSchema>;
export type NinaRuntime = Schema.Schema.Type<typeof NinaRuntimeSchema>;
export type NinaLocation = Schema.Schema.Type<typeof NinaLocationSchema>;
export type NinaUser = Schema.Schema.Type<typeof NinaUserSchema>;
export type NinaCopy = Schema.Schema.Type<typeof NinaCopySchema>;
export type NinaTurn = Schema.Schema.Type<typeof NinaTurnSchema>;

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
    needsPageFetch: page.needsFetch,
    nina: page.nina,
    slug: learningPage.slug,
    url: learningPage.url,
    verified: learningPage.verified,
    ...(user.learningProfile ? { learningProfile: user.learningProfile } : {}),
    ...(user.role ? { userRole: user.role } : {}),
  };
}
