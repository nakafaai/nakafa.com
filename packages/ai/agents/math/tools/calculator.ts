import type { CalculatorOutput } from "@repo/ai/agents/math/schema";
import { dedentString } from "@repo/ai/lib/utils";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";
import * as math from "mathjs";

/**
 * Calculates one expression and writes the calculator UI data part.
 */
export const calculate = Effect.fn("math.calculate")(function* ({
  expression,
  toolCallId,
  writer,
}: {
  expression: string;
  toolCallId: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  const parsed = yield* Effect.try({
    try: () => math.parse(expression),
    catch: () => new Error("Cannot be parsed."),
  }).pipe(
    Effect.match({
      onFailure: (error) => ({ error: error.message }),
      onSuccess: (node) => ({ node }),
    })
  );

  if ("error" in parsed) {
    const original = {
      expression,
      latex: expression,
    };
    const result = {
      expression,
      latex: expression,
      value: parsed.error,
    };

    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-calculator",
        data: {
          original,
          result,
          status: "error",
          error: parsed.error,
        },
      })
    );

    return formatOutput({ output: { original, result } });
  }

  const node = parsed.node;
  const original = {
    expression: node.toString(),
    latex: node.toTex(),
  };
  const result = {
    expression: "",
    latex: "",
    value: "",
  };

  const evaluated = yield* Effect.try({
    try: () => node.evaluate(),
    catch: () => new Error("Cannot be evaluated."),
  }).pipe(
    Effect.match({
      onFailure: (error) => ({ error: error.message }),
      onSuccess: (value) => ({ value }),
    })
  );

  if ("value" in evaluated) {
    const evaluatedValue = evaluated.value;
    const formattedValue = math.format(evaluatedValue, { precision: 14 });

    let latex = formattedValue;
    if (typeof evaluatedValue?.toTex === "function") {
      latex = evaluatedValue.toTex();
    }

    result.expression = formattedValue;
    result.latex = latex;
    result.value = formattedValue;

    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-calculator",
        data: { original, result, status: "done" },
      })
    );

    return formatOutput({ output: { original, result } });
  }

  result.expression = node.toString();
  result.latex = node.toTex();
  result.value = evaluated.error;

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-calculator",
      data: {
        original,
        result,
        status: "error",
        error: evaluated.error,
      },
    })
  );

  return formatOutput({ output: { original, result } });
});

/**
 * Formats calculator output as markdown for the math agent.
 */
function formatOutput({ output }: { output: CalculatorOutput }) {
  return dedentString(`
    # Calculator Result

    ## Original Expression
    - Input: ${output.original.expression}
    - LaTeX: ${output.original.latex}

    ## Evaluation
    - Result: ${output.result.value}
    - Formatted: ${output.result.expression}
    - LaTeX: ${output.result.latex}
  `);
}
