import { formatMathData } from "@repo/ai/agents/math/format";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { MathCompareInput, MathData } from "@repo/math/schema";
import { MathService } from "@repo/math/service";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";

/** Compares two expressions and writes deterministic math evidence. */
export function compare({
  input,
  toolCallId,
  writer,
}: {
  input: MathCompareInput;
  toolCallId: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  return Effect.gen(function* () {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-math",
        data: {
          kind: "compare",
          status: "loading",
          input,
        },
      })
    );

    const data = yield* MathService.compare(input).pipe(
      Effect.map((result) => {
        const data = {
          kind: "compare",
          status: result.status,
          input,
          result,
          summary: result.reason,
        } satisfies MathData;

        return data;
      }),
      Effect.catchTags({
        MathExpressionParseError: (error) =>
          Effect.succeed({
            kind: "compare",
            status: "error",
            input,
            error: error.message,
          } satisfies MathData),
      })
    );

    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-math",
        data,
      })
    );

    return formatMathData(data);
  });
}
