import { formatMathData } from "@repo/ai/agents/math/format";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { MathData, MathEvaluateInput } from "@repo/math/schema";
import { MathService } from "@repo/math/service";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";

/** Evaluates a numeric expression and writes deterministic math evidence. */
export function evaluate({
  input,
  toolCallId,
  writer,
}: {
  input: MathEvaluateInput;
  toolCallId: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  return Effect.gen(function* () {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-math",
        data: {
          kind: "evaluate",
          status: "loading",
          input,
        },
      })
    );

    const data = yield* MathService.evaluate(input).pipe(
      Effect.map((result) => {
        const data = {
          kind: "evaluate",
          status: "verified",
          input,
          result,
          summary: `Verified numeric evaluation: ${result.output.value}`,
        } satisfies MathData;

        return data;
      }),
      Effect.catchTags({
        MathExpressionParseError: (error) =>
          Effect.succeed({
            kind: "evaluate",
            status: "error",
            input,
            error: error.message,
          } satisfies MathData),
        MathEvaluationError: (error) =>
          Effect.succeed({
            kind: "evaluate",
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
