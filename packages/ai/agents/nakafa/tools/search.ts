import { formatSearch } from "@repo/ai/agents/nakafa/format";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { NakafaAgentSearchInput } from "@repo/contents/_lib/agent/schemas";
import { Nakafa } from "@repo/contents/_lib/agent/service";
import type { UIMessageStreamWriter } from "ai";
import { Effect, Either } from "effect";

type Writer = Pick<UIMessageStreamWriter<MyUIMessage>, "write">;

interface Params {
  input: NakafaAgentSearchInput;
  toolCallId: string;
  writer: Writer;
}

/** Searches Nakafa content and writes a bounded `data-nakafa` UI part. */
export const search = Effect.fn("nakafa.search")(function* ({
  input,
  toolCallId,
  writer,
}: Params) {
  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-nakafa",
      data: {
        kind: "search",
        input,
        status: "loading",
      },
    })
  );

  const result = yield* Effect.either(Nakafa.search(input));

  if (Either.isLeft(result)) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-nakafa",
        data: {
          kind: "search",
          input,
          status: "error",
          error: result.left.message,
        },
      })
    );

    return result.left.message;
  }

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-nakafa",
      data: {
        kind: "search",
        input,
        status: "done",
        result: result.right,
      },
    })
  );

  return formatSearch(result.right);
});
