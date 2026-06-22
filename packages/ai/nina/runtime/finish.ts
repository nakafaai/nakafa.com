import type { MyUIMessage, MyUIMessagePart } from "@repo/ai/types/message";
import { Schema } from "effect";

/** Raised when AI SDK finishes without a durable assistant answer. */
export class IncompleteNinaResponseError extends Schema.TaggedError<IncompleteNinaResponseError>()(
  "IncompleteNinaResponseError",
  {
    finishReason: Schema.optional(Schema.String),
    message: Schema.String,
    reason: Schema.Literal("aborted", "open-stream-part", "missing-final-text"),
    responseMessageId: Schema.String,
  }
) {}

/** Returns a typed failure when a streamed response should not be persisted. */
export function getNinaResponseFailure({
  finishReason,
  isAborted,
  responseMessage,
}: {
  readonly finishReason?: string;
  readonly isAborted: boolean;
  readonly responseMessage: MyUIMessage;
}) {
  if (isAborted) {
    return new IncompleteNinaResponseError({
      finishReason,
      message: "AI SDK reported an aborted Nina response stream.",
      reason: "aborted",
      responseMessageId: responseMessage.id,
    });
  }

  if (responseMessage.parts.some(isOpenStreamPart)) {
    return new IncompleteNinaResponseError({
      finishReason,
      message: "AI SDK finished with at least one open streaming part.",
      reason: "open-stream-part",
      responseMessageId: responseMessage.id,
    });
  }

  if (!responseMessage.parts.some(hasFinalTextPart)) {
    return new IncompleteNinaResponseError({
      finishReason,
      message: "AI SDK finished without a final assistant text part.",
      reason: "missing-final-text",
      responseMessageId: responseMessage.id,
    });
  }
}

/** Identifies a final, non-empty assistant text part that is safe to persist. */
function hasFinalTextPart(part: MyUIMessagePart) {
  return (
    part.type === "text" &&
    part.state !== "streaming" &&
    part.text.trim().length > 0
  );
}

/** Identifies AI SDK UI parts that still represent an in-progress stream. */
function isOpenStreamPart(part: MyUIMessagePart) {
  switch (part.type) {
    case "text":
    case "reasoning":
      return part.state === "streaming";
    case "dynamic-tool":
    case "tool-deepResearch":
    case "tool-math":
    case "tool-nakafa":
      return (
        part.state === "input-streaming" || part.state === "input-available"
      );
    default:
      return false;
  }
}
