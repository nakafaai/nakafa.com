import {
  type Message,
  type SourcePart,
  vMessage,
  type vProviderReference,
} from "@convex-dev/agent/validators";
import type { Infer } from "convex/values";
import { parse } from "convex-helpers/validators";
import { Array as Arr, Match, Predicate } from "effect";

/** The provider options key that holds the sealed content of a message. Nothing else uses it. */
export const SEALED_KEY = "nakafa";
/** An http or https address, which a file reference may be. */
const HTTP_URL = /^https?:\/\//u;

type Part = Exclude<Message["content"], string>[number];
type ProviderReference = Infer<typeof vProviderReference>;

/**
 * A file's reference, which the skeleton keeps: a provider reference, or an http
 * or https address. Any other data is content, such as inline bytes or a base64
 * text, so it stays out of the clear.
 */
function reference(data: string | ArrayBuffer | ProviderReference) {
  if (Predicate.isString(data)) {
    return HTTP_URL.test(data) ? data : "";
  }
  return data instanceof ArrayBuffer ? "" : data;
}

/** A source keeps its type and its id. Its address and its title are content. */
const skeletonSource = Match.type<SourcePart>().pipe(
  Match.discriminatorsExhaustive("sourceType")({
    document: (part) => ({
      id: part.id,
      mediaType: part.mediaType,
      sourceType: "document",
      title: "",
      type: "source",
    }),
    url: (part) => ({
      id: part.id,
      sourceType: "url",
      type: "source",
      url: "",
    }),
  })
);

/**
 * The skeleton of one part. It keeps the type, the tool names and ids, the tool
 * approval ids, and the file references. It keeps no text, no reasoning, no tool
 * input or output, no file name and no source address or title.
 */
const skeletonPart = Match.type<Part>().pipe(
  Match.discriminatorsExhaustive("type")({
    custom: (part) => ({ kind: part.kind, type: "custom" }),
    file: (part) => ({
      data: reference(part.data),
      mediaType: part.mediaType,
      type: "file",
    }),
    image: (part) => ({
      image: reference(part.image),
      mediaType: part.mediaType,
      type: "image",
    }),
    "redacted-reasoning": () => ({ data: "", type: "redacted-reasoning" }),
    reasoning: () => ({ text: "", type: "reasoning" }),
    "reasoning-file": (part) => ({
      mediaType: part.mediaType,
      type: "reasoning-file",
      url: reference(part.url ?? ""),
    }),
    source: skeletonSource,
    text: () => ({ text: "", type: "text" }),
    "tool-approval-request": (part) => ({
      approvalId: part.approvalId,
      toolCallId: part.toolCallId,
      type: "tool-approval-request",
    }),
    "tool-approval-response": (part) => ({
      approvalId: part.approvalId,
      approved: part.approved,
      type: "tool-approval-response",
    }),
    "tool-call": (part) => ({
      input: {},
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      type: "tool-call",
    }),
    "tool-result": (part) => ({
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      type: "tool-result",
    }),
  })
);

/** The content of a message as its skeleton. A string has no part to keep, so it becomes empty. */
const skeletonContent = (content: string | readonly Part[]) =>
  Predicate.isString(content) ? "" : Arr.map(content, skeletonPart);

/**
 * The message that the row keeps in the clear while its content is sealed: the
 * role, the skeleton of the content, and the sealed bytes in the provider options.
 * The Agent's own validator checks it, so the component accepts the row.
 */
export function skeletonMessage(message: Message, sealed: string): Message {
  return parse(vMessage, {
    content: skeletonContent(message.content),
    providerOptions: { [SEALED_KEY]: { sealed } },
    role: message.role,
  });
}
