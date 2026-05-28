import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import { Effect, Schema } from "effect";

export class ChatMessagePartError extends Schema.TaggedError<ChatMessagePartError>()(
  "ChatMessagePartError",
  { message: Schema.String }
) {}

interface PartFieldInput<Value> {
  readonly fieldName: string;
  readonly partType: string;
  readonly value: Value | undefined;
}

interface ToolStatePart {
  readonly toolState?: Doc<"parts">["toolState"];
  readonly type: Doc<"parts">["type"];
}

/** Fails a synchronous AI SDK conversion with a typed Effect error. */
function failMessagePart(message: string) {
  return Effect.runSync(Effect.fail(new ChatMessagePartError({ message })));
}

/** Returns a required persisted part field or fails with a readable schema error. */
function requirePartField<Value>({
  value,
  fieldName,
  partType,
}: PartFieldInput<Value>) {
  if (value !== undefined) {
    return value;
  }
  return failMessagePart(
    `Required field '${fieldName}' is missing for part type '${partType}'.`
  );
}

/** Returns the persisted tool state for a stored chat message part. */
function requireToolState(part: ToolStatePart) {
  return requirePartField({
    value: part.toolState,
    fieldName: "toolState",
    partType: part.type,
  });
}

export { failMessagePart, requirePartField, requireToolState };
