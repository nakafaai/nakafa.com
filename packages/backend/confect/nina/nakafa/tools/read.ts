import { getNakafaContent } from "@repo/backend/agent/content";
import type { CapabilityProgress } from "@repo/backend/confect/nina/capability/progress";
import type { NinaReadOptions } from "@repo/backend/confect/nina/contract/data";
import { previewRead } from "@repo/backend/confect/nina/nakafa/preview";
import { formatRead } from "@repo/backend/confect/nina/nakafa/sections";
import { Effect, Option, Result } from "effect";

const notFoundMessage = "Nakafa content was not found.";
/** Reads one Nakafa content reference, from a heading section when given. */
export const read = Effect.fn("nakafa.read")(function* ({
  input,
  toolCallId,
  publish,
}: {
  readonly input: NinaReadOptions;
  readonly toolCallId: string;
  readonly publish: CapabilityProgress;
}) {
  yield* publish({
    id: toolCallId,
    type: "data-nakafa",
    data: {
      kind: "content",
      input,
      status: "loading",
    },
  });
  const result = yield* Effect.result(getNakafaContent(input.content_ref));
  if (Result.isFailure(result)) {
    yield* publish({
      id: toolCallId,
      type: "data-nakafa",
      data: {
        kind: "content",
        input,
        status: "error",
        error: result.failure.message,
      },
    });
    return result.failure.message;
  }
  const content = result.success;
  if (Option.isNone(content)) {
    yield* publish({
      id: toolCallId,
      type: "data-nakafa",
      data: {
        kind: "content",
        input,
        status: "error",
        error: notFoundMessage,
      },
    });
    return notFoundMessage;
  }
  const value = content.value;
  yield* publish({
    id: toolCallId,
    type: "data-nakafa",
    data: {
      kind: "content",
      input,
      status: "done",
      result: previewRead(value),
    },
  });
  return formatRead(value, { section: input.section });
});
