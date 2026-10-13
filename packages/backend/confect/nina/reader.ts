import type { UIMessage } from "@convex-dev/agent";
import { MEMORY_CAPABILITY } from "@repo/backend/confect/nina/capability/spec";
import type {
  MessagePage,
  StreamRequest,
} from "@repo/backend/confect/nina/contract/message";
import { getToolName, isToolUIPart } from "ai";
import { Array as Arr, Option, Record as Rec, Struct } from "effect";

/** One part of a message, as Agent lists it. */
type MessagePart = UIMessage["parts"][number];

/**
 * The keys under which the parts of the AI SDK hold what the provider reported
 * for the call that wrote them: every key of that kind the installed `ai` types
 * declare on a part. The Convex gateway reports what the call cost there
 * (`convexGateway.cost`), and Agent copies the report of a step onto the text,
 * reasoning and tool parts it builds from the step.
 */
export const PROVIDER_METADATA = [
  "providerMetadata",
  "callProviderMetadata",
  "resultProviderMetadata",
] as const;

/**
 * What a reader who does not own the chat is told of the live streams: none.
 * After its first chunk, a tool call's chunks name only the call, so a read that
 * holds no state cannot tell the chunks of a search of the owner's memory from
 * another tool's. Agent's hook asks for no deltas when it lists no stream, so the
 * page does not wait for one, and the reader sees each message once it is saved.
 */
export function readerStreams(
  request: typeof StreamRequest.Type
): (typeof MessagePage.Type)["streams"] {
  return request.kind === "list"
    ? { kind: "list", messages: [] }
    : { kind: "deltas", deltas: [] };
}

/** Whether a part is a call of the memory capability, or its result. */
function isMemoryPart(part: MessagePart) {
  return isToolUIPart(part) && getToolName(part) === MEMORY_CAPABILITY;
}

/**
 * The parts of a message without any part of a search of the owner's memory:
 * the call, its result, and the step marker that Agent writes in front of a call.
 */
function withoutMemory(parts: readonly MessagePart[]) {
  return Arr.filter(
    parts,
    (part, index) =>
      !(
        isMemoryPart(part) ||
        (part.type === "step-start" &&
          Option.exists(Arr.get(parts, index + 1), isMemoryPart))
      )
  );
}

/**
 * A part without what the provider reported for the call that wrote it. The
 * parts of the AI SDK are a union of shapes that hold different keys, and this
 * drops three of them from any, so it reads a part as the record it is.
 */
function withoutProviderMetadata(part: Readonly<Record<string, unknown>>) {
  return Rec.filter(
    part,
    (_value, key) => !Arr.some(PROVIDER_METADATA, (name) => name === key)
  );
}

/**
 * A message as a reader who does not own the chat is told of it. It names no
 * account, which belongs to the owner, and its parts hold nothing else of the
 * owner's account: no part of a search of the owner's memory, which tells what
 * Nina looked for in the memories, in the owner's words, whether something
 * matched and whether memory is paused, and nothing the provider reported for a
 * call, which carries what the call cost. What Nina wrote herself, her
 * reasoning and her answer, is the conversation and stays, whatever it says
 * about a search: the parts do not say which of it belongs to the step of a
 * call, because Agent writes a step marker in front of a tool call only. A
 * message left with no part is the empty answer that Agent saves as pending when
 * a turn begins, which the page shows as Nina typing while the turn runs.
 */
export function readerMessage(message: UIMessage) {
  return {
    ...Struct.omit(message, ["userId"]),
    parts: Arr.map(withoutMemory(message.parts), withoutProviderMetadata),
  };
}
