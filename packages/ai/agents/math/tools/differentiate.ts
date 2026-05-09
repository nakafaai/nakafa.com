import { formatMathData } from "@repo/ai/agents/math/format";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { MathData, MathDifferentiateInput } from "@repo/math/schema";
import { MathService } from "@repo/math/service";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";

/** Differentiates one expression and writes deterministic math evidence. */
export function differentiate({
  input,
  toolCallId,
  writer,
}: {
  input: MathDifferentiateInput;
  toolCallId: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  return Effect.gen(function* () {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-math",
        data: {
          kind: "differentiate",
          status: "loading",
          input,
        },
      })
    );

    const data = yield* MathService.differentiate(input).pipe(
      Effect.map((result) => {
        const data = {
          kind: "differentiate",
          status: "verified",
          input,
          result,
          summary: `Verified derivative: ${result.output.expression}`,
        } satisfies MathData;

        return data;
      }),
      Effect.catchTags({
        MathExpressionParseError: (error) =>
          Effect.succeed({
            kind: "differentiate",
            status: "error",
            input,
            error: error.message,
          } satisfies MathData),
        MathUnsupportedError: (error) =>
          Effect.succeed({
            kind: "differentiate",
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
