import {
  languageModelId,
  providerId,
} from "@repo/backend/confect/gateway/model";
import { purposes } from "@repo/backend/confect/gateway/purpose";
import { NinaUsageTotal } from "@repo/backend/confect/nina/contract/usage";
import {
  Array as Arr,
  Match,
  Option,
  Predicate,
  Result,
  Schema,
  String as Str,
} from "effect";

/**
 * The part of a stored turn that the release gate reads, as
 * `nina/conversation:get` returns it to a client. The status stays a plain
 * string, so a state the product adds later is reported instead of refused.
 * The test of this module encodes a turn with the product's own schema and
 * decodes it here, so the two cannot drift apart unseen.
 */
export const GateTurn = Schema.Struct({
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
const CHAT_AGENT = "nina" satisfies Usage["agent"];

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
type ChatStep = ReturnType<typeof chatSteps>[number];

/** Whether the turn is still queued or running, so that it can change by itself. */
export function isOpen({ state }: GateTurn) {
  return state.status === "queued" || state.status === "running";
}

/** Whether the follow-up work after the answer has saved its suggestions. */
export function hasFollowUp({ suggestions }: GateTurn) {
  return suggestions !== undefined;
}

/**
 * The most one step of an agent may write: the output cap of the purpose its
 * calls run under. A new agent fails the compiler here until it has a cap.
 */
function capOf(agent: Usage["agent"]) {
  return Match.value(agent).pipe(
    Match.when(CHAT_AGENT, () => purposes.chat.maxOutputTokens),
    Match.whenOr(
      "nakafa",
      "research",
      "math",
      () => purposes.specialist.maxOutputTokens
    ),
    Match.whenOr(
      "math-repair",
      "memory",
      "nina-repair",
      () => purposes.background.maxOutputTokens
    ),
    Match.when("suggestions", () => purposes.suggestion.maxOutputTokens),
    Match.when("title", () => purposes.presentation.maxOutputTokens),
    Match.exhaustive
  );
}

/** Milliseconds from the admission of the turn to its end, when both are recorded. */
function elapsedMillis({ promptedAt, state }: GateTurn) {
  return promptedAt === undefined || state.finishedAt === undefined
    ? Option.none()
    : Option.some(state.finishedAt - promptedAt);
}

/** The sum of one number over rows. */
function sum<Row>(rows: readonly Row[], pick: (row: Row) => number) {
  return Arr.reduce(rows, 0, (total, row) => total + pick(row));
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
 * No other agent wrote as much as its steps would write at their cap. Their
 * steps are not in the journal, and the usage record sums them.
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

/** The turn ended inside the total budget of the chat call, counted from its admission. */
function judgeDeadline(turn: GateTurn) {
  const limit = purposes.chat.timeout.totalMs;
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

/** One printed line of the table: an agent's row of the usage record, or the total. */
const Line = Schema.Struct({
  agent: Schema.String,
  cached: Schema.Finite,
  cost: Schema.UndefinedOr(Schema.Finite),
  input: Schema.Finite,
  output: Schema.Finite,
  reasoning: Schema.Finite,
  seconds: Schema.UndefinedOr(Schema.Finite),
  steps: Schema.Finite,
});
type Line = typeof Line.Type;

/** The table's columns: a header, a side to align on, and the text of each line. */
const COLUMNS = [
  { cell: (line: Line) => line.agent, header: "agent", left: true },
  { cell: (line: Line) => String(line.steps), header: "steps", left: false },
  { cell: (line: Line) => String(line.input), header: "input", left: false },
  { cell: (line: Line) => String(line.cached), header: "cached", left: false },
  { cell: (line: Line) => String(line.output), header: "output", left: false },
  {
    cell: (line: Line) => String(line.reasoning),
    header: "reasoning",
    left: false,
  },
  {
    cell: (line: Line) =>
      line.cost === undefined ? "-" : line.cost.toFixed(6),
    header: "cost",
    left: false,
  },
  {
    cell: (line: Line) =>
      line.seconds === undefined ? "" : line.seconds.toFixed(1),
    header: "seconds",
    left: false,
  },
];

/** The line of one agent's row. A row stored before October 2026 may lack cached or reasoning tokens. */
function lineOf(row: Usage): Line {
  return {
    agent: row.agent,
    cached: row.cached ?? 0,
    cost: row.cost,
    input: row.input,
    output: row.output,
    reasoning: row.reasoning ?? 0,
    seconds: undefined,
    steps: row.calls,
  };
}

/** The line that adds up every row and holds the time of the whole turn. */
function totalOf(turn: GateTurn, lines: readonly Line[]): Line {
  const costs = Arr.filter(
    Arr.map(lines, (line) => line.cost),
    Predicate.isNotUndefined
  );
  return {
    agent: "total",
    cached: sum(lines, (line) => line.cached),
    cost: Arr.isReadonlyArrayNonEmpty(costs)
      ? sum(costs, (cost) => cost)
      : undefined,
    input: sum(lines, (line) => line.input),
    output: sum(lines, (line) => line.output),
    reasoning: sum(lines, (line) => line.reasoning),
    seconds: Option.getOrUndefined(
      Option.map(elapsedMillis(turn), (elapsed) => elapsed / 1000)
    ),
    steps: sum(lines, (line) => line.steps),
  };
}

/**
 * The line under the table that shows the cache step by step: the input tokens
 * of each chat step that the provider read from its cache. A first step that
 * already read the cache means an earlier turn with the same prompt prefix
 * warmed it, so the later reads do not prove that this turn wrote it.
 */
function describeSteps(steps: readonly ChatStep[]) {
  if (Arr.isReadonlyArrayEmpty(steps)) {
    return `The Agent journal holds no step of the ${CHAT_AGENT} agent.`;
  }
  const line = `Cached of input tokens, by ${CHAT_AGENT} step: ${Arr.join(
    Arr.map(steps, (step) => `${step.cached} of ${step.input}`),
    ", "
  )}.`;
  return Arr.some(Arr.take(steps, 1), (step) => step.cached > 0)
    ? `${line} The first step already read the cache, so a turn before this one with the same prompt prefix warmed it. Run the gate again after five minutes to see the turn's own cache.`
    : line;
}

/**
 * The table of a stored turn: steps, input, cached, output, reasoning, cost
 * and seconds, one row for each agent of the usage record and a total, with a
 * line under it for the cache of each chat step. Cost is in US dollars. It
 * holds no message text.
 */
export function renderTable(turn: GateTurn, steps: readonly ChatStep[]) {
  const lines = Arr.map(turn.usage, lineOf);
  const shown = Arr.append(lines, totalOf(turn, lines));
  const sized = Arr.map(COLUMNS, (column) => ({
    column,
    width: Arr.reduce(shown, column.header.length, (width, line) =>
      Math.max(width, column.cell(line).length)
    ),
  }));
  const format = (cell: (column: (typeof COLUMNS)[number]) => string) =>
    Str.trimEnd(
      Arr.join(
        Arr.map(sized, ({ column, width }) =>
          column.left
            ? Str.padEnd(width)(cell(column))
            : Str.padStart(width)(cell(column))
        ),
        "  "
      )
    );
  return Arr.join(
    [
      format((column) => column.header),
      ...Arr.map(shown, (line) => format((column) => column.cell(line))),
      "",
      describeSteps(steps),
    ],
    "\n"
  );
}
