import {
  languageModelId,
  providerId,
} from "@repo/backend/confect/gateway/model";
import { purposes } from "@repo/backend/confect/gateway/purpose";
import {
  NinaUsageTotal,
  purposeOf,
} from "@repo/backend/confect/nina/contract/usage";
import { TURN_DEADLINE } from "@repo/backend/confect/nina/deadline";
import { Array as Arr, Duration, Option, Result, Schema } from "effect";

/**
 * The part of a stored turn that the release gate reads, as
 * `nina/conversation:get` returns it to a client. The status stays a plain
 * string, so a state the product adds later is reported instead of refused.
 * The test of this module encodes a turn with the product's own schema and
 * decodes it here, so the two cannot drift apart unseen.
 */
export const GateTurn = Schema.Struct({
  order: Schema.Finite,
  promptedAt: Schema.optionalKey(Schema.Finite),
  state: Schema.Struct({
    finishedAt: Schema.optionalKey(Schema.Finite),
    reason: Schema.optionalKey(Schema.String),
    status: Schema.String,
  }),
  suggestions: Schema.optionalKey(Schema.Unknown),
  usage: Schema.Array(NinaUsageTotal),
});
export type GateTurn = typeof GateTurn.Type;

/**
 * One message of the Agent journal, as the Agent component lists it. The gate
 * reads the steps of the chat agent from it, because the usage record sums the
 * steps of an agent and so cannot show which step read the cache. The component
 * keeps one assistant message for each step, with the usage and the finish
 * reason of that step.
 */
export const StoredMessage = Schema.Struct({
  agentName: Schema.optional(Schema.String),
  finishReason: Schema.optional(Schema.String),
  message: Schema.optional(Schema.Struct({ role: Schema.String })),
  status: Schema.optional(Schema.String),
  usage: Schema.optional(
    Schema.Struct({
      cachedInputTokens: Schema.optional(Schema.Finite),
      completionTokens: Schema.optional(Schema.Finite),
      promptTokens: Schema.optional(Schema.Finite),
    })
  ),
});
export type StoredMessage = typeof StoredMessage.Type;

type Usage = typeof NinaUsageTotal.Type;

/** The agent that writes the chat answer, step by step. */
export const CHAT_AGENT = "nina" satisfies Usage["agent"];

/** The agent that names a chat after its first turn. */
const TITLE_AGENT = "title" satisfies Usage["agent"];

/** The order of the turn that opens a chat, which is the one that names it. */
const FIRST_TURN = 0;

/** Steps the chat agent must take before a later step can read what an earlier one cached. */
const MINIMUM_CHAT_STEPS = 2;

/**
 * The steps of the chat agent in the journal, in order. The journal lists its
 * messages oldest first, and the chat agent saves one assistant message for
 * each step that it finished. A step that reports no usage counts as zero
 * tokens.
 */
export function chatSteps(messages: readonly StoredMessage[]) {
  return Arr.map(
    Arr.filter(
      messages,
      (stored) =>
        stored.agentName === CHAT_AGENT &&
        stored.message?.role === "assistant" &&
        stored.status === "success"
    ),
    ({ finishReason, usage }) => ({
      cached: usage?.cachedInputTokens ?? 0,
      finishReason,
      input: usage?.promptTokens ?? 0,
      output: usage?.completionTokens ?? 0,
    })
  );
}
export type ChatStep = ReturnType<typeof chatSteps>[number];

/** Whether the turn is still queued or running, so that it can change by itself. */
export function isOpen({ state }: GateTurn) {
  return state.status === "queued" || state.status === "running";
}

/**
 * Whether the follow-up work after the answer is done: the suggestions are
 * saved and, for the turn that opens a chat, the call that names the chat has
 * recorded its usage. The title call starts after the suggestions are saved, so
 * the suggestions alone do not mean that it ran.
 */
export function hasFollowUp({ order, suggestions, usage }: GateTurn) {
  return (
    suggestions !== undefined &&
    (order !== FIRST_TURN ||
      Arr.some(usage, (row) => row.agent === TITLE_AGENT))
  );
}

/**
 * The most one step of an agent may write: the output cap of the purpose its
 * calls run under, which the usage ledger names for every agent it records. A
 * new agent has a cap the moment the ledger accepts it.
 */
function capOf(agent: Usage["agent"]) {
  return purposes[purposeOf(agent)].maxOutputTokens;
}

/** Milliseconds from the admission of the turn to its end, when both are recorded. */
export function elapsedMillis({ promptedAt, state }: GateTurn) {
  return promptedAt === undefined || state.finishedAt === undefined
    ? Option.none()
    : Option.some(state.finishedAt - promptedAt);
}

/**
 * The turn must end complete. The settlement completes a turn only when the
 * Agent journal holds a final answer with text, so this also proves the answer.
 */
function judgeState({ state }: GateTurn) {
  if (state.status === "complete") {
    return [];
  }
  const reason =
    state.reason === undefined ? "" : ` with the reason ${state.reason}`;
  return [`The turn is ${state.status}${reason}, not complete.`];
}

/** Every call the usage record holds ran on the gateway's model through the gateway's provider. */
function judgeGateway({ usage }: GateTurn) {
  if (Arr.isReadonlyArrayEmpty(usage)) {
    return ["The turn recorded no model call."];
  }
  return Arr.map(
    Arr.filter(
      usage,
      (row) => row.provider !== providerId || row.model !== languageModelId
    ),
    (row) =>
      `The ${row.agent} calls ran on ${row.model} through ${row.provider}, not on ${languageModelId} through ${providerId}.`
  );
}

/**
 * The chat agent needs two steps, and each step after the first must read the
 * prompt prefix that the first one cached.
 */
function judgeCache(steps: readonly ChatStep[]) {
  if (steps.length < MINIMUM_CHAT_STEPS) {
    return [
      `The ${CHAT_AGENT} agent took ${steps.length} of the ${MINIMUM_CHAT_STEPS} steps the gate needs, so no later step could read what the first one cached.`,
    ];
  }
  return Arr.filterMap(Arr.drop(steps, 1), (step, index) =>
    step.cached > 0
      ? Result.failVoid
      : Result.succeed(
          `Step ${index + 2} of the ${CHAT_AGENT} agent read no input tokens from the cache (${step.input} input tokens). A short prompt is not cached, so check that the lesson page the question names still exists.`
        )
  );
}

/** No step of the chat agent ended at its output cap. */
function judgeChatCaps(steps: readonly ChatStep[]) {
  const cap = capOf(CHAT_AGENT);
  return Arr.filterMap(steps, (step, index) =>
    step.finishReason === "length" || step.output >= cap
      ? Result.succeed(
          `Step ${index + 1} of the ${CHAT_AGENT} agent ended at its output cap of ${cap} tokens (${step.output} tokens written).`
        )
      : Result.failVoid
  );
}

/**
 * No other agent wrote as many tokens as its steps would write at their cap.
 * Their steps are not in the journal and the usage record sums them, so a row of
 * one call is judged exactly, and a row of several calls only by its sum: one
 * step at its cap among shorter ones passes.
 */
function judgeCaps({ usage }: GateTurn) {
  return Arr.map(
    Arr.filter(
      usage,
      (row) =>
        row.agent !== CHAT_AGENT && row.output >= row.calls * capOf(row.agent)
    ),
    (row) =>
      `The ${row.agent} agent wrote ${row.output} tokens, at least the ${row.calls * capOf(row.agent)} that its calls (${row.calls}) write at their cap of ${capOf(row.agent)} tokens each.`
  );
}

/** The turn ended inside the deadline that the product gives a turn, counted from its admission. */
function judgeDeadline(turn: GateTurn) {
  const limit = Duration.toMillis(TURN_DEADLINE);
  return Option.match(elapsedMillis(turn), {
    onNone: () => ["The turn has no recorded start and end to measure."],
    onSome: (elapsed) =>
      elapsed > limit
        ? [
            `The turn took ${elapsed / 1000} seconds, longer than its deadline of ${limit / 1000} seconds.`,
          ]
        : [],
  });
}

/**
 * Everything that is wrong with a stored turn, one sentence each, in the order
 * of the gate: the end state, the gateway, the cache, the caps, the deadline.
 * An empty list means the turn passes. No sentence holds message text.
 */
export function judgeTurn(turn: GateTurn, steps: readonly ChatStep[]) {
  return Arr.flatten([
    judgeState(turn),
    judgeGateway(turn),
    judgeCache(steps),
    judgeChatCaps(steps),
    judgeCaps(turn),
    judgeDeadline(turn),
  ]);
}
