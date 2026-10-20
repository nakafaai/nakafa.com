import type { CapabilityOutputSchema } from "@repo/backend/client/nina/capability";
import type { LearningCapabilityName } from "@repo/backend/confect/nina/capability/spec";
import type { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import type { ToolUIPart } from "ai";
import type { ServedMessage } from "../query";

/**
 * What a capability stored when it ended, as the wire holds it: its cards, its
 * outcome and the text Nina read. The type comes from the contract's own
 * schema, so a card the contract would refuse does not compile, and the page
 * decodes the output with that schema when it reads the part.
 *
 * The contract itself cannot load in the browser test process: the packages
 * that own its schemas are not ES modules to Node, which cannot resolve their
 * imports outside the bundler.
 */
type Output = typeof CapabilityOutputSchema.Encoded;

/** One card of a capability, as the wire holds it. */
export type Card = Output["artifacts"][number];

/** One part of a message, as Agent hands it to the page. */
export type Part = NinaMessage["parts"][number];

/** The thread of the fixture conversation. */
export const THREAD = "e2e-evidence-thread";

/** The first moment of the fixture conversation, in milliseconds. */
const START = 1_790_000_000_000;

/** One turn takes a minute, so the order of a turn also orders its moments. */
const TURN_MILLISECONDS = 60_000;

/** The tool part Agent stores for a capability that ended with `output`. */
export function ran(
  capability: LearningCapabilityName,
  id: string,
  output: Output
): ToolUIPart {
  return {
    input: { task: `Run ${capability}.` },
    output,
    state: "output-available",
    toolCallId: id,
    type: `tool-${capability}`,
  };
}

/** The tool part of a capability that still works: its output so far is preliminary. */
export function working(
  capability: LearningCapabilityName,
  id: string,
  output: Output
): ToolUIPart {
  return {
    input: { task: `Run ${capability}.` },
    output,
    preliminary: true,
    state: "output-available",
    toolCallId: id,
    type: `tool-${capability}`,
  };
}

/** The tool part of a capability that the policy refused to run. */
export function denied(
  capability: LearningCapabilityName,
  id: string
): ToolUIPart {
  return {
    approval: { approved: false, id: `${id}-approval` },
    input: { task: `Run ${capability}.` },
    state: "output-denied",
    toolCallId: id,
    type: `tool-${capability}`,
  };
}

/** The tool part of a capability that ended with an error and no card. */
export function crashed(
  capability: LearningCapabilityName,
  id: string
): ToolUIPart {
  return {
    errorText: "The capability stopped.",
    input: { task: `Run ${capability}.` },
    state: "output-error",
    toolCallId: id,
    type: `tool-${capability}`,
  };
}

/** The text part of an answer that Nina finished writing. */
export function said(text: string): Part {
  return { state: "done", text, type: "text" };
}

/** What a capability stored when it ended with these cards and, when it fell short, how. */
export function stored(
  cards: Output["artifacts"],
  outcome?: Output["outcome"]
): Output {
  return {
    artifacts: cards,
    ...(outcome === undefined ? {} : { outcome }),
    text: "",
  };
}

/** The reply of one capability run: its tool part, and the line Nina writes after it. */
export function reply({
  cards,
  capability,
  id,
  outcome,
  text,
}: {
  readonly capability: LearningCapabilityName;
  readonly cards: Output["artifacts"];
  readonly id: string;
  readonly outcome?: Output["outcome"];
  readonly text: string;
}): readonly Part[] {
  return [ran(capability, id, stored(cards, outcome)), said(text)];
}

/** A source that an older answer cites, as the AI SDK stored it. */
export function cited(id: string, url: string, title?: string): Part {
  return {
    sourceId: id,
    type: "source-url",
    url,
    ...(title === undefined ? {} : { title }),
  };
}

/** The moment a turn started, in milliseconds. */
function startedAt(order: number) {
  return START + order * TURN_MILLISECONDS;
}

/** The facts a turn keeps once the page reads it: it ended, or it is still running. */
function summaryOf(
  order: number,
  running: boolean
): typeof NinaTurnSummary.Type {
  return {
    order,
    promptMessageId: `prompt-${order}`,
    promptedAt: startedAt(order),
    state: running
      ? { startedAt: startedAt(order), status: "running" }
      : {
          finishedAt: startedAt(order) + TURN_MILLISECONDS / 2,
          status: "complete",
        },
    usage: [],
  };
}

/**
 * The learner's question and Nina's reply to it, as Agent hands both to the
 * page, with the facts of the turn kept in the reply's metadata: the served
 * chat strips them, since the page reads them from the turns query. A reply
 * with a running turn is still streaming.
 */
export function exchange({
  order,
  parts,
  question,
  running = false,
}: {
  readonly order: number;
  readonly parts: readonly Part[];
  readonly question: string;
  readonly running?: boolean;
}): readonly ServedMessage[] {
  return [
    {
      _creationTime: startedAt(order),
      id: `prompt-${order}`,
      key: `${THREAD}-${order}-0`,
      order,
      parts: [{ state: "done", text: question, type: "text" }],
      role: "user",
      status: "success",
      stepOrder: 0,
      text: question,
    },
    {
      _creationTime: startedAt(order) + TURN_MILLISECONDS / 4,
      id: `reply-${order}`,
      key: `${THREAD}-${order}-1`,
      metadata: summaryOf(order, running),
      order,
      parts: [...parts],
      role: "assistant",
      status: running ? "streaming" : "success",
      stepOrder: 1,
      text: "",
    },
  ];
}
