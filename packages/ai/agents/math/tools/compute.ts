import { formatMathData } from "@repo/ai/agents/math/format";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { MathData, MathRequest } from "@repo/math/schema";
import { MathService } from "@repo/math/service";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";

/** Runs one deterministic math request and writes the math evidence data part. */
export function compute({
  input,
  toolCallId,
  writer,
}: {
  input: MathRequest;
  toolCallId: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  return Effect.gen(function* () {
    yield* Effect.sync(() =>
      writer.write({
        data: {
          input,
          kind: input.operation,
          status: "loading",
        },
        id: toolCallId,
        type: "data-math",
      })
    );

    const data = yield* MathService.compute(input).pipe(
      Effect.map((result) => {
        const data = {
          input,
          kind: result.operation,
          result,
          status: result.status,
          summary: result.status,
        } satisfies MathData;

        return data;
      }),
      Effect.catchTags({
        MathCasRequestError: (error) =>
          Effect.succeed({
            error: error.message,
            input,
            kind: input.operation,
            status: "error",
          } satisfies MathData),
        MathCasResponseError: (error) =>
          Effect.succeed({
            error: error.message,
            input,
            kind: input.operation,
            status: "error",
          } satisfies MathData),
      })
    );

    yield* Effect.sync(() =>
      writer.write({
        data,
        id: toolCallId,
        type: "data-math",
      })
    );

    return formatMathData(data);
  });
}
