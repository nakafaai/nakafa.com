import { formatMathData } from "@repo/ai/agents/math/format";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { MathData, MathSimplifyInput } from "@repo/math/schema";
import { MathService } from "@repo/math/service";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";

/** Simplifies one expression and writes deterministic math evidence. */
export function simplify({
  input,
  toolCallId,
  writer,
}: {
  input: MathSimplifyInput;
  toolCallId: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  return Effect.gen(function* () {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-math",
        data: {
          kind: "simplify",
          status: "loading",
          input,
        },
      })
    );

    const data = yield* MathService.simplify(input).pipe(
      Effect.map((result) => {
        const data = {
          kind: "simplify",
          status: "verified",
          input,
          result,
          summary: `Verified simplification: ${result.output.expression}`,
        } satisfies MathData;

        return data;
      }),
      Effect.catchTags({
        MathExpressionParseError: (error) =>
          Effect.succeed({
            kind: "simplify",
            status: "error",
            input,
            error: error.message,
          } satisfies MathData),
        MathUnsupportedError: (error) =>
          Effect.succeed({
            kind: "simplify",
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
