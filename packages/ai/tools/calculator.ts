import { tool, type UIMessageStreamWriter } from "ai";
import * as math from "mathjs";
import { nakafaCalculator } from "../prompt/calculator";
import { calculatorInputSchema } from "../schema/tools";
import type { MyUIMessage } from "../types/message";

type Params = {
  writer: UIMessageStreamWriter<MyUIMessage>;
};

export const createCalculator = ({ writer }: Params) => {
  return tool({
    name: "calculator",
    description: nakafaCalculator(),
    inputSchema: calculatorInputSchema,
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

      return {
        original,
        result,
      };
    },
  });
};
