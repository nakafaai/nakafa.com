import * as z from "zod";

/**
 * Input schema for calculator tool
 */
export const calculatorInputSchema = z
  .object({
    expression: z
      .string()
      .describe(
        "A mathematical expression with concrete numbers and operations. Use ONLY evaluable expressions with numbers - NOT algebraic variables. Compatible with Math.js."
      ),
  })
  .describe(
    "MANDATORY calculator tool - ALWAYS use this for ANY mathematical calculation including simple arithmetic. NEVER calculate manually. Only use for evaluable expressions with concrete numbers, not algebraic variables."
  );
export type CalculatorInput = z.input<typeof calculatorInputSchema>;

/**
 * Output schema for calculator tool
 */
export const calculatorOutputSchema = z
  .object({
    original: z.object({
      expression: z.string().describe("The original expression."),
      latex: z.string().describe("The original expression in LaTeX."),
    }),
    result: z.object({
      expression: z.string().describe("The simplified expression."),
      latex: z.string().describe("The simplified expression in LaTeX."),
      value: z.string().describe("The evaluated value."),
    }),
  })
  .describe("The output schema for calculator tool.");
export type CalculatorOutput = z.output<typeof calculatorOutputSchema>;
