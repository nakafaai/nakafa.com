import { Id } from "@repo/backend/confect/_generated/id";
import {
  type AgentContext,
  AgentCurriculumPreferenceSchema,
} from "@repo/backend/confect/nina/contract/agent";
import {
  NinaContextPackSchema,
  NinaLearningContextSchema,
  NinaToolContextSchema,
} from "@repo/backend/confect/nina/contract/pack";
import { NinaSuggestions } from "@repo/backend/confect/nina/contract/suggestions";
import { NinaUsageTotal } from "@repo/backend/confect/nina/contract/usage";
import { PromptUserRoleSchema } from "@repo/backend/confect/users/role";
import { LocaleSchema } from "@repo/contents/content";
import { cleanSlug } from "@repo/utilities/slug";
import { Effect, Schema, Struct } from "effect";

/**
 * Verified learning page state consumed by one Nina turn. Its address and signed
 * state are `nina.learning.url` and `nina.learning.verified`, and nowhere else.
 */
const NinaPageSchema = Schema.Struct({
  locale: LocaleSchema,
  needsFetch: Schema.Boolean,
  nina: NinaContextPackSchema,
  slug: Schema.String,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
/**
 * Step one of two of the change that stores only what a turn's readers use.
 * Turns stored before it hold fields that nothing reads, and the table keeps
 * admitting them until `nina/reshape:rewrite` has removed them from every turn
 * on dev and on production. Step two deletes the stored schemas below,
 * `NinaLegacyField` with the two fields of `NinaTurnFacts` that use it, and
 * `dropLegacyPage`, and the table takes `NinaPageSchema` again.
 *
 * `NinaLegacyField` stands for the copy of their context (`snapshot`) and the
 * marker of a switch of context (`transition`) that those turns hold. No turn
 * is written with one, and the table admits any value there. A copy typed in
 * full would have the shape of a pack, so Confect's check for recursive schemas
 * would read the pack, and the turn with it, as recursive and type their
 * validators as `any`.
 */
const NinaLegacyField = Schema.optionalKey(Schema.Any);
/**
 * The pack as the table admits it: the pack of a turn written now, and what
 * turns stored before the change hold beside it. Their asset id is also in
 * `contentId`, and their three permission flags, `true` on every turn, sit in
 * `tools`.
 */
const NinaStoredPackSchema = NinaContextPackSchema.mapFields((fields) => ({
  ...fields,
  learning: Schema.mutableKey(
    NinaLearningContextSchema.mapFields((learning) => ({
      ...learning,
      contentId: Schema.optionalKey(Schema.String),
    }))
  ),
  snapshot: NinaLegacyField,
  tools: Schema.mutableKey(
    NinaToolContextSchema.mapFields((tools) => ({
      ...tools,
      allowDeepResearch: Schema.optionalKey(Schema.Boolean),
      allowMath: Schema.optionalKey(Schema.Boolean),
      allowNakafa: Schema.optionalKey(Schema.Boolean),
    }))
  ),
  transition: NinaLegacyField,
}));
/**
 * The page as the table admits it: the page of a turn written now, and beside
 * it the address and the signed state of the page that older turns hold in
 * `url` and `verified`.
 */
export const NinaStoredPageSchema = NinaPageSchema.mapFields((fields) => ({
  ...fields,
  nina: Schema.mutableKey(NinaStoredPackSchema),
  url: Schema.optionalKey(Schema.String),
  verified: Schema.optionalKey(Schema.Boolean),
}));
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
/** A turn that was admitted and waits for a run. */
export const NinaQueuedState = Schema.Struct({
  status: Schema.Literal("queued"),
});
/** A turn that a run took. */
export const NinaRunningState = Schema.Struct({
  status: Schema.Literal("running"),
  startedAt: Schema.Finite,
});
/** A turn that ended with an answer. */
export const NinaCompleteState = Schema.Struct({
  status: Schema.Literal("complete"),
  finishedAt: Schema.Finite,
});
/** A turn that ended without one, with the reason when it is known. */
export const NinaFailedState = Schema.Struct({
  status: Schema.Literal("failed"),
  finishedAt: Schema.Finite,
  reason: Schema.optionalKey(NinaFailureReason),
});
/** A turn that the learner stopped. */
export const NinaCancelledState = Schema.Struct({
  status: Schema.Literal("cancelled"),
  finishedAt: Schema.Finite,
});
/**
 * Every state a turn can be in. The order of the members is the order the
 * stored validator lists them in. A phase picks its states by these names, so a
 * new state cannot slip into one by its position. The web app reads the type of
 * its `status`.
 */
export const NinaTurnState = Schema.Union([
  NinaQueuedState,
  NinaRunningState,
  NinaCompleteState,
  NinaFailedState,
  NinaCancelledState,
]);
/**
 * Milliseconds counted from the admission of a turn, never below zero. A
 * creation time carries a fraction of a millisecond, and so does the count.
 */
const MillisecondsSinceAdmission = Schema.Finite.check(
  Schema.isGreaterThanOrEqualTo(0)
);

/**
 * How long a learner waited at each stage of a turn, in milliseconds after its
 * admission. Each stage is stored the first time the turn reaches it, so a turn
 * that ended early holds only the stages it reached, and the gap between two
 * stages is the wait between them. It holds numbers only, never a word of the
 * conversation.
 */
export const NinaTurnTiming = Schema.Struct({
  /** A run started and took the turn. This holds the wait for its action to start. */
  claimedMs: Schema.optionalKey(MillisecondsSinceAdmission),
  /** The run had read what the model needs and was about to call it. */
  readyMs: Schema.optionalKey(MillisecondsSinceAdmission),
  /**
   * The model produced the first part that the page can show: reasoning, a
   * capability row or answer text. The page shows it a little later, once
   * Agent has written it.
   */
  progressMs: Schema.optionalKey(MillisecondsSinceAdmission),
  /** The model produced the first word of an answer. */
  tokenMs: Schema.optionalKey(MillisecondsSinceAdmission),
});

/** A request key survives settlement so network retries remain idempotent. */
export const NinaRequestId = Schema.NonEmptyString.check(
  Schema.isMaxLength(128)
);
/** Recorded response facts never invent an unknown model, charge or token count. */
export const NinaTurnFacts = Schema.Struct({
  userId: Id("users"),
  chatId: Id("chats"),
  threadId: Schema.String,
  promptMessageId: Schema.String,
  promptedAt: Schema.optionalKey(Schema.Finite),
  order: Schema.Finite,
  /**
   * The order of the turn that first asked this turn's question, when this turn
   * is a retry. A retry saves its question once more, and a retry of a retry
   * names the same first turn, so every asking of one question carries one key
   * and history shows only the newest complete one.
   */
  retryOf: Schema.optionalKey(Schema.Finite),
  credits: Schema.optionalKey(Schema.Finite),
  requestId: Schema.optionalKey(NinaRequestId),
  fingerprint: Schema.optionalKey(Schema.String),
  transactionId: Schema.optionalKey(Id("creditTransactions")),
  page: Schema.optionalKey(NinaStoredPageSchema),
  user: Schema.optionalKey(NinaUserSchema),
  /**
   * The oldest turns hold a copy of their context and a marker beside their
   * page, from before a turn kept its context in `page`. See `NinaLegacyField`.
   */
  snapshot: NinaLegacyField,
  transition: NinaLegacyField,
  tokens: Schema.optionalKey(
    Schema.Struct({
      input: Schema.optionalKey(Schema.Finite),
      output: Schema.optionalKey(Schema.Finite),
      total: Schema.optionalKey(Schema.Finite),
    })
  ),
  usage: Schema.Array(NinaUsageTotal).check(Schema.isMaxLength(32)),
  /** The waits of the turn. Turns stored before this field have none. */
  timing: Schema.optionalKey(NinaTurnTiming),
  suggestions: Schema.optionalKey(NinaSuggestions),
  /** Memories Nina saved or confirmed from this turn's message, when there are any. */
  remembered: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThan(0))),
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
    "remembered",
  ])
);
/**
 * The turn as a reader who does not own the chat is told of it: where it stands
 * and which prompt it answers. What the turn cost, what Nina kept from it and
 * what she suggests next belong to the owner's account, so a reader is told
 * none of them. `usage` stays in the shape as an empty list.
 */
export function readerTurn(
  turn: typeof NinaTurnSummary.Type
): typeof NinaTurnSummary.Type {
  return {
    ...Struct.pick(turn, ["order", "promptMessageId", "promptedAt", "state"]),
    usage: [],
  };
}
export type NinaPage = typeof NinaPageSchema.Type;
export type NinaRuntime = typeof NinaRuntimeSchema.Type;
export type NinaUser = typeof NinaUserSchema.Type;
/**
 * The page of a stored turn as a turn is written now: decoding leaves out the
 * keys the page schema does not declare. A retry copies the page of the turn it
 * asks again through this, so a new turn never holds what only older turns do,
 * and the rewrite takes every stored page through it. Step two deletes it.
 */
export const dropLegacyPage = Effect.fn("nina.turn.dropLegacyPage")(function* (
  page: typeof NinaStoredPageSchema.Type
) {
  return yield* Schema.decodeEffect(NinaPageSchema)(page).pipe(Effect.orDie);
});
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
/**
 * Builds the shared specialist context from validated Nina turn inputs.
 * `memory` is whether the learner's memory is on for the turn. The turn reads
 * the pause once, and the capability policy decides from it whether the memory
 * capability is offered and whether a call may run. Every other capability is
 * offered on every page.
 */
export function createNinaAgentContext({
  memory,
  page,
  runtime,
  user,
}: {
  readonly memory: boolean;
  readonly page: NinaPage;
  readonly runtime: NinaRuntime;
  readonly user: NinaUser;
}): AgentContext {
  const learningPage = readNinaLearningPage(page);
  return {
    currentDate: runtime.currentDate,
    memory,
    slug: learningPage.slug,
    url: learningPage.url,
    verified: learningPage.verified,
    ...(user.curriculumPreference
      ? { curriculumPreference: user.curriculumPreference }
      : {}),
    ...(user.role ? { userRole: user.role } : {}),
  };
}
