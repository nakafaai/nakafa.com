import { formatRead } from "@repo/ai/agents/nakafa/format";
import { previewRead } from "@repo/ai/agents/nakafa/preview";
import { Nakafa } from "@repo/ai/agents/nakafa/service";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { NakafaAgentReadOptions } from "@repo/contents/_lib/agent/schema/read";
import type { UIMessageStreamWriter } from "ai";
import { Effect, Option, Result } from "effect";

type Writer = Pick<UIMessageStreamWriter<MyUIMessage>, "write">;
const notFoundMessage = "Nakafa content was not found.";
/** Reads one Nakafa content reference and writes a bounded preview UI part. */
export const read = Effect.fn("nakafa.read")(function* ({
  input,
  toolCallId,
  writer,
}: {
  readonly input: NakafaAgentReadOptions;
  readonly toolCallId: string;
  readonly writer: Writer;
}) {
  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-nakafa",
      data: {
        kind: "content",
        input,
        status: "loading",
      },
    })
  );
  const result = yield* Effect.result(
    Nakafa.use((service) => service.read(input.content_ref))
  );
  if (Result.isFailure(result)) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-nakafa",
        data: {
          kind: "content",
          input,
          status: "error",
          error: result.failure.message,
        },
      })
    );
    return result.failure.message;
  }
  const content = result.success;
  if (Option.isNone(content)) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-nakafa",
        data: {
          kind: "content",
          input,
          status: "error",
          error: notFoundMessage,
        },
      })
    );
    return notFoundMessage;
  }
  const value = content.value;
  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-nakafa",
      data: {
        kind: "content",
        input,
        status: "done",
        result: previewRead(value),
      },
    })
  );
  return formatRead(value);
});
