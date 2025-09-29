import { dedentString } from "@repo/ai/lib/utils";
import { nakafaCalculator } from "@repo/ai/prompt/calculator";
import {
  type CalculatorOutput,
  calculatorInputSchema,
} from "@repo/ai/schema/tools";
import type { MyUIMessage } from "@repo/ai/types/message";
import { tool, type UIMessageStreamWriter } from "ai";
import * as math from "mathjs";
import * as z from "zod";

type Params = {
  writer: UIMessageStreamWriter<MyUIMessage>;
};

export const createCalculator = ({ writer }: Params) =>
  tool({
    name: "calculator",
    description: nakafaCalculator(),
    inputSchema: calculatorInputSchema,
    outputSchema: z.string(),
    execute: ({ expression }, { toolCallId }) => {
      const node = math.parse(expression);
      const original = {
        expression: node.toString(),
        latex: node.toTex(),
      };

      const result = {
        expression: "",
        latex: "",
        value: "",
      };

      try {
        const evaluatedValue = node.evaluate();
        const formattedValue = math.format(evaluatedValue, { precision: 14 });

        let latex = formattedValue;
        if (typeof evaluatedValue?.toTex === "function") {
          latex = evaluatedValue.toTex();
        }

        result.expression = formattedValue;
        result.latex = latex;
        result.value = formattedValue;

        writer.write({
          id: toolCallId,
          type: "data-calculator",
          data: { original, result, status: "done" },
        });
      } catch {
        result.expression = node.toString();
        result.latex = node.toTex();
        result.value = "Cannot be evaluated.";

        writer.write({
          id: toolCallId,
          type: "data-calculator",
          data: {
            original,
            result,
            status: "error",
            error: { message: "Cannot be evaluated." },
          },
        });
      }

      return createOutput({ output: { original, result } });
    },
  });

function createOutput({ output }: { output: CalculatorOutput }): string {
  return dedentString(`
    <calculatorOutput>
      <original>
        <expression>${output.original.expression}</expression>
        <latex>${output.original.latex}</latex>
      </original>
      <result>
        <expression>${output.result.expression}</expression>
        <latex>${output.result.latex}</latex>
        <value>${output.result.value}</value>
      </result>
    </calculatorOutput>
  `);
}
