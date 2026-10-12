import { CapabilityOutputSchema } from "@repo/backend/client/nina/capability";
import {
  boundText,
  countFileTokens,
  countTextTokens,
  NINA_BUDGET,
} from "@repo/backend/confect/nina/budget";
import { LearningCapabilityNameSchema } from "@repo/backend/confect/nina/capability/spec";
import type { NinaUncoveredTurn } from "@repo/backend/confect/nina/summaries.spec";
import { encodeJsonText } from "@repo/utilities/json";
import { type ModelMessage, pruneMessages, type ToolResultPart } from "ai";
import { Array as Arr, MutableHashSet, Option, Schema } from "effect";

/** Earlier evidence keeps this much text once its turn outgrows the budget. */
const EXCERPT_TOKENS = 600;
const EXCERPT_NOTE =
  "Earlier evidence in this conversation, shortened. Call the capability again when the full evidence matters.";

/** Estimates provider tokens for one message; a file counts what the provider bills for it, not its bytes. */
function messageTokens(message: ModelMessage) {
  if (typeof message.content === "string") {
    return countTextTokens(message.content);
  }
  let total = 0;
  for (const part of message.content) {
    if (part.type === "text" || part.type === "reasoning") {
      total += countTextTokens(part.text);
    } else if (part.type === "tool-call") {
      total += countTextTokens(encodeJsonText(part.input));
    } else if (part.type === "tool-result") {
      total += countTextTokens(encodeJsonText(part.output));
    } else if (part.type === "image") {
      total += countFileTokens(part.mediaType ?? "image/*");
    } else if (part.type === "file") {
      total += countFileTokens(part.mediaType);
    } else {
      total += countTextTokens(encodeJsonText(part));
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
  return capabilityText(part) ?? encodeJsonText(output);
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

/**
 * Splits a flat run of messages into whole turns; each turn opens with a user
 * message. Only a window the Agent fetched needs this: Nina's own history
 * arrives as turns.
 */
export function splitTurns(
  messages: readonly ModelMessage[]
): ModelMessage[][] {
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

/** A complete turn by its order, and the order of the turn that first asked its question. */
export type Asking = typeof NinaUncoveredTurn.Type;

/** Names the question of a turn by the order of the turn that first asked it. */
export function questionKey({ order, retryOf }: Asking) {
  return retryOf ?? order;
}

/**
 * Keeps the complete turns whose question no later turn asks again. A learner
 * who retries an answer prefers the newest asking, so each question keeps only
 * its newest complete asking, whichever of its askings was retried. `later`
 * holds the turns that come after `turns`, such as the one being answered: a
 * question one of them asks again leaves none of `turns`.
 */
export function newestAskings(
  turns: readonly Asking[],
  later: readonly Asking[]
) {
  const all = Arr.appendAll(turns, later);
  return Arr.filter(
    turns,
    (turn) =>
      !Arr.some(
        all,
        (other) =>
          other.order > turn.order && questionKey(other) === questionKey(turn)
      )
  );
}

/**
 * Keeps the current turn's evidence within its budget while a tool loop runs.
 * The learner's message opens the turn and is not evidence, so neither it nor
 * its attachments count. The newest message stays intact; older tool results
 * in the turn shorten to excerpts until the evidence fits. Earlier history
 * passes through unchanged.
 */
export function boundStep(messages: readonly ModelMessage[]) {
  const projected = projectMessages(messages);
  const start = Option.getOrElse(
    Arr.findLastIndex(projected, (message) => message.role === "user"),
    () => 0
  );
  let turn = Arr.drop(projected, start);
  for (
    let index = 0;
    index < turn.length - 1 &&
    turnTokens(Arr.drop(turn, 1)) > NINA_BUDGET.turnEvidence;
    index += 1
  ) {
    turn = Arr.map(turn, (message, position) =>
      position === index ? excerptMessage(message) : message
    );
  }
  return [...Arr.take(projected, start), ...turn];
}

/**
 * What the model receives of one earlier complete turn, and what that costs:
 * its tool results become bounded text, an earlier document becomes a note,
 * and a turn that alone costs more than the history budget keeps every message
 * with its tool results shortened to excerpts. The summary's fold counts a
 * turn through this function, so it counts what the model would receive.
 */
export function sentTurn(turn: readonly ModelMessage[]) {
  const whole = Arr.map(projectMessages(turn), noteDocuments);
  const cost = turnTokens(whole);
  if (cost <= NINA_BUDGET.history) {
    return { messages: whole, tokens: cost };
  }
  const messages = Arr.map(whole, excerptMessage);
  return { messages, tokens: turnTokens(messages) };
}

/**
 * Assembles provider input for one Nina generation. `history` holds the
 * complete earlier turns the rolling summary does not cover, oldest first,
 * each with its question and answer. They are kept newest first within the
 * history budget and trimmed only at a turn boundary: a turn that does not fit
 * is dropped whole, and the newest turn is always kept, with shortened
 * evidence when it alone costs more than the budget. The current turn always
 * follows.
 *
 * The summary folds the oldest turns as soon as the turns it does not cover
 * cost more than the budget, so between two folds the history only grows at
 * its end, and its start moves only when a fold covers its oldest turns. Two
 * things move it otherwise. A retry takes the asking it replaces out of the
 * history, wherever that asking is. And the drop above reaches turns that
 * outgrew the budget before a fold covered them, because the fold was still
 * running, failed, or has a longer backlog than one fold clears.
 */
export function assembleContext({
  current,
  history,
}: {
  readonly current: readonly ModelMessage[];
  readonly history: readonly (readonly ModelMessage[])[];
}) {
  const [, candidates] = Arr.mapAccum(
    Arr.reverse(Arr.map(history, sentTurn)),
    0,
    (used, { messages, tokens }, offset) => [
      used + tokens,
      { messages, offset, total: used + tokens },
    ]
  );
  const selected = Arr.takeWhile(
    candidates,
    ({ offset, total }) => offset === 0 || total <= NINA_BUDGET.history
  );
  return [
    ...Arr.flatten(Arr.reverse(Arr.map(selected, ({ messages }) => messages))),
    ...boundStep(current),
  ];
}
