import type { Message, MessageDoc } from "@convex-dev/agent/validators";
import { Array as Arr, Struct } from "effect";

type AssistantContent = Extract<Message, { role: "assistant" }>["content"];
type ReasoningPart = Extract<
  Exclude<AssistantContent, string>[number],
  { type: "reasoning" }
>;
type ReasoningDetail = NonNullable<MessageDoc["reasoningDetails"]>[number];

/** The reasoning parts of a message, in order. Only an assistant message has them. */
function reasoningParts(message: Message): ReasoningPart[] {
  if (message.role !== "assistant" || typeof message.content === "string") {
    return [];
  }
  return Arr.filter(
    message.content,
    (part): part is ReasoningPart => part.type === "reasoning"
  );
}

/**
 * The reasoning of a message, from its reasoning parts, as the Agent derives it
 * (`deriveReasoning` of `@convex-dev/agent`): the parts are the details, and
 * their texts joined are the reasoning, left out when empty.
 */
function deriveReasoning(
  message: Message
): Pick<MessageDoc, "reasoning" | "reasoningDetails"> {
  const parts = reasoningParts(message);
  if (!Arr.isReadonlyArrayNonEmpty(parts)) {
    return {};
  }
  const reasoning = Arr.join(
    Arr.map(parts, (part) => part.text),
    ""
  );
  return reasoning === ""
    ? { reasoningDetails: parts }
    : { reasoning, reasoningDetails: parts };
}

/**
 * A row with the reasoning that the Agent derives on read for a row that stores
 * neither field (`withDerivedReasoning` of `@convex-dev/agent`).
 */
export function withDerivedReasoning(doc: MessageDoc): MessageDoc {
  if (
    doc.message === undefined ||
    doc.reasoning !== undefined ||
    doc.reasoningDetails !== undefined
  ) {
    return doc;
  }
  return { ...doc, ...deriveReasoning(doc.message) };
}

/** Whether a detail is a reasoning part of a skeleton: an empty text and nothing else. */
function isSkeletonDetail(detail: ReasoningDetail) {
  return (
    detail.type === "reasoning" &&
    detail.text === "" &&
    detail.signature === undefined &&
    detail.providerMetadata === undefined &&
    detail.providerOptions === undefined
  );
}

/**
 * A sealed row as the Agent stored it. The Agent derives `reasoningDetails` on
 * read from a row's reasoning parts, and the skeleton of a sealed message keeps
 * one empty part for each, so a sealed row reads with one empty detail for each
 * part and no `reasoning`. Those details are dropped. Details that differ are
 * the row's own and stay, so they still conflict with the sealed content.
 */
export function withoutSkeletonReasoning(
  stored: MessageDoc,
  skeleton: Message
): MessageDoc {
  const details = stored.reasoningDetails;
  const derived =
    stored.reasoning === undefined &&
    details !== undefined &&
    Arr.isReadonlyArrayNonEmpty(details) &&
    details.length === reasoningParts(skeleton).length &&
    Arr.every(details, isSkeletonDetail);
  return derived
    ? Struct.omit(stored, ["reasoning", "reasoningDetails"])
    : stored;
}
