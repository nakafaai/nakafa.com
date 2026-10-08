import {
  boundText,
  countTextTokens,
  NINA_BUDGET,
} from "@repo/backend/confect/nina/budget";
import { CapabilityOutputSchema } from "@repo/backend/confect/nina/capability/progress";
import { LearningCapabilityNameSchema } from "@repo/backend/confect/nina/capability/spec";
import { type ModelMessage, pruneMessages, type ToolResultPart } from "ai";
import { Array as Arr, MutableHashSet, Schema } from "effect";

/**
 * Gemini's flat input cost for one image. Documents count the same, since only
 * the current turn keeps them.
 */
const FILE_TOKENS = 300;
/** Earlier evidence keeps this much text once its turn outgrows the budget. */
const EXCERPT_TOKENS = 600;
const EXCERPT_NOTE =
  "Earlier evidence in this conversation, shortened. Call the capability again when the full evidence matters.";
/** Writes a stored value as the JSON text the model reads, as JSON.stringify does. */
const JsonTextSchema = Schema.fromJsonString(Schema.Unknown);

/** Estimates provider tokens for one message without counting file bytes. */
function messageTokens(message: ModelMessage) {
  if (typeof message.content === "string") {
    return countTextTokens(message.content);
  }
  let total = 0;
  for (const part of message.content) {
    if (part.type === "text" || part.type === "reasoning") {
      total += countTextTokens(part.text);
    } else if (part.type === "tool-call") {
      total += countTextTokens(Schema.encodeSync(JsonTextSchema)(part.input));
    } else if (part.type === "tool-result") {
      total += countTextTokens(Schema.encodeSync(JsonTextSchema)(part.output));
    } else {
      total += FILE_TOKENS;
    }
  }
  return total;
}

function turnTokens(turn: readonly ModelMessage[]) {
  return Arr.reduce(
    turn,
    0,
    (total, message) => total + messageTokens(message)
  );
}

/** Returns validated capability evidence text, when the result carries one. */
function capabilityText({ output }: ToolResultPart) {
  return output.type === "json" &&
    Schema.is(CapabilityOutputSchema)(output.value)
    ? output.value.text
    : undefined;
}

/** Returns the model-facing text of one stored tool result. */
function evidenceText(part: ToolResultPart) {
  const { output } = part;
  if (output.type === "text" || output.type === "error-text") {
    return output.value;
  }
  return capabilityText(part) ?? Schema.encodeSync(JsonTextSchema)(output);
}

/**
 * Projects stored tool results to bounded model-facing text and prunes
 * reasoning plus calls to capabilities Nina no longer registers. Evidence of
 * an unavailable capability survives as assistant text.
 */
function projectMessages(messages: readonly ModelMessage[]) {
  const unavailableTools = MutableHashSet.empty<string>();
  const projected = Arr.flatMap(messages, (message): ModelMessage[] => {
    if (message.role === "assistant" && Arr.isArray(message.content)) {
      for (const part of message.content) {
        if (
          part.type === "tool-call" &&
          !Schema.is(LearningCapabilityNameSchema)(part.toolName)
        ) {
          MutableHashSet.add(unavailableTools, part.toolName);
        }
      }
    }
    if (message.role !== "tool") {
      return [message];
    }
    let retained: ModelMessage[] = [];
    const content = Arr.map(message.content, (part) => {
      if (part.type !== "tool-result") {
        return part;
      }
      const text = boundText(
        evidenceText(part),
        NINA_BUDGET.evidence,
        EXCERPT_NOTE
      );
      if (!Schema.is(LearningCapabilityNameSchema)(part.toolName)) {
        MutableHashSet.add(unavailableTools, part.toolName);
        if (capabilityText(part) !== undefined) {
          retained = Arr.append(retained, { role: "assistant", content: text });
        }
      }
      return { ...part, output: { type: "text" as const, value: text } };
    });
    return [{ ...message, content }, ...retained];
  });
  return pruneMessages({
    messages: projected,
    reasoning: "all",
    toolCalls: [{ type: "all", tools: Arr.fromIterable(unavailableTools) }],
    emptyMessages: "remove",
  });
}

/** Shortens the tool results of one projected message to excerpts. */
function excerptMessage(message: ModelMessage): ModelMessage {
  if (message.role !== "tool") {
    return message;
  }
  return {
    ...message,
    content: Arr.map(message.content, (part) =>
      part.type === "tool-result"
        ? {
            ...part,
            output: {
              type: "text" as const,
              value: boundText(
                evidenceText(part),
                EXCERPT_TOKENS,
                EXCERPT_NOTE
              ),
            },
          }
        : part
    ),
  };
}

/**
 * Replaces an earlier turn's PDF and text attachments with a note. Their
 * provider cost grows with their size, unlike an image's, and Nina already
 * answered about them in that turn.
 */
function noteDocuments(message: ModelMessage): ModelMessage {
  if (message.role !== "user" || typeof message.content === "string") {
    return message;
  }
  return {
    ...message,
    content: Arr.map(message.content, (part) =>
      part.type === "file" && !part.mediaType.startsWith("image/")
        ? {
            type: "text" as const,
            text: `[Attached earlier: ${part.filename ?? "a document"} (${part.mediaType}). Ask the learner to attach it again when its full content matters.]`,
          }
        : part
    ),
  };
}

/** Splits a conversation into whole turns; each turn opens with a user message. */
function splitTurns(messages: readonly ModelMessage[]): ModelMessage[][] {
  // Messages before the first prompt belong to a turn cut by the fetch window.
  const fromFirstPrompt = Arr.dropWhile(
    messages,
    (message) => message.role !== "user"
  );
  return Arr.chop(fromFirstPrompt, ([prompt, ...rest]) => {
    const [replies, later] = Arr.splitWhere(
      rest,
      (message) => message.role === "user"
    );
    return [[prompt, ...replies], later];
  });
}

/**
 * Keeps the current turn's evidence within its budget while a tool loop runs.
 * The newest message stays intact; older tool results in the turn shorten to
 * excerpts until the turn fits. Earlier history passes through unchanged.
 */
export function boundStep(messages: readonly ModelMessage[]) {
  const projected = projectMessages(messages);
  const start = Math.max(
    Arr.map(projected, (message) => message.role).lastIndexOf("user"),
    0
  );
  let turn = projected.slice(start);
  for (
    let index = 0;
    index < turn.length - 1 && turnTokens(turn) > NINA_BUDGET.turnEvidence;
    index += 1
  ) {
    turn = Arr.map(turn, (message, position) =>
      position === index ? excerptMessage(message) : message
    );
  }
  return [...projected.slice(0, start), ...turn];
}

/**
 * Assembles provider input for one Nina generation. History keeps whole turns
 * the rolling summary does not cover, newest first, within the history budget;
 * a single oversized turn keeps its messages with shortened evidence. The
 * current turn always follows. Turn orders count back from `currentOrder`,
 * because every turn opens with exactly one user prompt.
 */
export function assembleContext({
  current,
  currentOrder,
  recent,
  throughOrder,
}: {
  readonly current: readonly ModelMessage[];
  readonly currentOrder: number;
  readonly recent: readonly ModelMessage[];
  readonly throughOrder: number | null;
}) {
  const newestFirst = Arr.reverse(
    splitTurns(Arr.map(projectMessages(recent), noteDocuments))
  );
  const covered = throughOrder ?? -1;
  let selected: ModelMessage[][] = [];
  let used = 0;
  for (const [offset, turn] of newestFirst.entries()) {
    const cost = turnTokens(turn);
    if (
      currentOrder - 1 - offset <= covered ||
      (selected.length > 0 && used + cost > NINA_BUDGET.history)
    ) {
      break;
    }
    const kept =
      cost > NINA_BUDGET.history ? Arr.map(turn, excerptMessage) : turn;
    selected = Arr.prepend(selected, kept);
    used += turnTokens(kept);
  }
  return [...Arr.flatten(selected), ...boundStep(current)];
}
