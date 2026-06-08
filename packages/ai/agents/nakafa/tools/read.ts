import { formatRead } from "@repo/ai/agents/nakafa/format";
import { previewRead } from "@repo/ai/agents/nakafa/preview";
import { Nakafa } from "@repo/ai/agents/nakafa/service";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { NakafaAgentReadOptions } from "@repo/contents/_lib/agent/schema/read";
import type { UIMessageStreamWriter } from "ai";
import { Effect, Either, Option } from "effect";

type Writer = Pick<UIMessageStreamWriter<MyUIMessage>, "write">;

interface Params {
  input: NakafaAgentReadOptions;
  toolCallId: string;
  writer: Writer;
}

const notFoundMessage = "Nakafa content was not found.";

/** Reads one Nakafa content reference and writes a bounded preview UI part. */
export const read = Effect.fn("nakafa.read")(function* ({
  input,
  toolCallId,
  writer,
}: Params) {
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

  const result = yield* Effect.either(Nakafa.read(input.content_ref));

  if (Either.isLeft(result)) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-nakafa",
        data: {
          kind: "content",
          input,
          status: "error",
          error: result.left.message,
        },
      })
    );

    return result.left.message;
  }

  const content = result.right;

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
