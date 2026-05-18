import { formatExercise } from "@repo/ai/agents/nakafa/format";
import { previewExercise } from "@repo/ai/agents/nakafa/preview";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { NakafaAgentExerciseOptions } from "@repo/contents/_lib/agent/schema/exercise";
import { Nakafa } from "@repo/contents/_lib/agent/service";
import type { UIMessageStreamWriter } from "ai";
import { Effect, Either, Option } from "effect";

type Writer = Pick<UIMessageStreamWriter<MyUIMessage>, "write">;

interface Params {
  input: NakafaAgentExerciseOptions;
  toolCallId: string;
  writer: Writer;
}

const notFoundMessage = "Nakafa exercise content was not found.";

/** Reads a Nakafa exercise set or single exercise and writes a preview UI part. */
export const exercise = Effect.fn("nakafa.exercise")(function* ({
  input,
  toolCallId,
  writer,
}: Params) {
  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-nakafa",
      data: {
        kind: "exercise",
        input,
        status: "loading",
      },
    })
  );

  const result = yield* Effect.either(
    Nakafa.exercise(input.content_ref, input.exercise_number)
  );

  if (Either.isLeft(result)) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-nakafa",
        data: {
          kind: "exercise",
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
          kind: "exercise",
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
        kind: "exercise",
        input,
        status: "done",
        result: previewExercise(value),
      },
    })
  );

  return formatExercise(value);
});
