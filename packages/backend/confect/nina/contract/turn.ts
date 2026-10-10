import { Id } from "@repo/backend/confect/_generated/id";
import {
  type AgentContext,
  AgentCurriculumPreferenceSchema,
} from "@repo/backend/confect/nina/contract/agent";
import {
  NinaContextPackSchema,
  NinaContextSnapshotSchema,
  NinaContextTransitionSchema,
} from "@repo/backend/confect/nina/contract/pack";
import { NinaSuggestions } from "@repo/backend/confect/nina/contract/suggestions";
import { NinaUsageTotal } from "@repo/backend/confect/nina/contract/usage";
import { PromptUserRoleSchema } from "@repo/backend/confect/users/role";
import { LocaleSchema } from "@repo/contents/content";
import { cleanSlug } from "@repo/utilities/slug";
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
const NinaRuntimeSchema = Schema.Struct({
  currentDate: Schema.String,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
/** User facts Nina may use after app auth and selection boundaries validate them. */
export const NinaUserSchema = Schema.Struct({
  curriculumPreference: Schema.optional(AgentCurriculumPreferenceSchema),
  role: Schema.optional(PromptUserRoleSchema),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
/** Safe response failure facts, independent of provider diagnostics and UI language. */
export const NinaFailureReason = Schema.Literals([
  "provider-busy",
  "provider-unavailable",
  "service-configuration",
  "request-rejected",
  "input-too-large",
  "response-timeout",
  "content-blocked",
  "response-limit",
  "interrupted",
  "unknown",
]);
export const NinaTurnState = Schema.Union([
  Schema.Struct({ status: Schema.Literal("queued") }),
  Schema.Struct({
    status: Schema.Literal("running"),
    startedAt: Schema.Finite,
  }),
  Schema.Struct({
    status: Schema.Literal("complete"),
    finishedAt: Schema.Finite,
  }),
  Schema.Struct({
    status: Schema.Literal("failed"),
    finishedAt: Schema.Finite,
    reason: Schema.optionalKey(NinaFailureReason),
  }),
  Schema.Struct({
    status: Schema.Literal("cancelled"),
    finishedAt: Schema.Finite,
  }),
  Schema.Struct({ status: Schema.Literal("unanswered") }),
]);
/** A request key survives settlement so network retries remain idempotent. */
export const NinaRequestId = Schema.NonEmptyString.check(
  Schema.isMaxLength(128)
);
/**
 * The model key learners chose before October 2026. Old turns still store
 * it and old browser tabs still send it. Nothing reads it; the contract
 * change unsets the stored values and deletes this schema.
 */
export const RetiredModelKey = Schema.Literals(["nakafa-lite", "nakafa-pro"]);

/** Recorded response facts never invent an unknown model, charge or token count. */
export const NinaTurnFacts = Schema.Struct({
  userId: Id("users"),
  chatId: Id("chats"),
  threadId: Schema.String,
  promptMessageId: Schema.String,
  promptedAt: Schema.optionalKey(Schema.Finite),
  order: Schema.Finite,
  modelId: Schema.optionalKey(RetiredModelKey),
  credits: Schema.optionalKey(Schema.Finite),
  requestId: Schema.optionalKey(NinaRequestId),
  fingerprint: Schema.optionalKey(Schema.String),
  transactionId: Schema.optionalKey(Id("creditTransactions")),
  page: Schema.optionalKey(NinaPageSchema),
  user: Schema.optionalKey(NinaUserSchema),
  snapshot: Schema.optionalKey(NinaContextSnapshotSchema),
  transition: Schema.optionalKey(NinaContextTransitionSchema),
  tokens: Schema.optionalKey(
    Schema.Struct({
      input: Schema.optionalKey(Schema.Finite),
      output: Schema.optionalKey(Schema.Finite),
      total: Schema.optionalKey(Schema.Finite),
    })
  ),
  usage: Schema.Array(NinaUsageTotal).check(Schema.isMaxLength(32)),
  suggestions: Schema.optionalKey(NinaSuggestions),
});
/** Public response facts exclude account, billing-period and private page context. */
export const NinaTurnSummary = Schema.Struct({
  ...NinaTurnFacts.fields,
  state: NinaTurnState,
}).mapFields(
  Struct.pick([
    "order",
    "state",
    "credits",
    "usage",
    "tokens",
    "suggestions",
    "promptMessageId",
    "promptedAt",
  ])
);
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
