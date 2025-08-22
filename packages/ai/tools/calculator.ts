import { tool } from "ai";
import * as math from "mathjs";
import { calculatorInputSchema, calculatorOutputSchema } from "../schema/tools";

export const calculatorTool = tool({
  name: "calculator",
  description:
    "MANDATORY calculator tool - ALWAYS use this for ANY mathematical calculation including simple arithmetic. NEVER calculate manually. Only use for evaluable expressions with concrete numbers, not algebraic variables. Uses Math.js to evaluate expressions.",
  inputSchema: calculatorInputSchema,
  outputSchema: calculatorOutputSchema,
  execute: ({ expression }) => {
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
    } catch {
      result.expression = node.toString();
      result.latex = node.toTex();
      result.value = "Cannot be evaluated.";
    }

    return {
      original,
      result,
    };
  },
});
