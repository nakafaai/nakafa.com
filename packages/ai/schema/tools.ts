import * as z from "zod";

export const getContentInputSchema = z
  .object({
    locale: z.enum(["en", "id"]).describe("The locale of the content to get."),
    slug: z
      .string()
      .describe(
        "The slug of the content to get. Use slug as it is, do not change anything. Always start with slash (/)."
      ),
  })
  .describe("The input schema for the getContent tool.");
export type GetContentInput = z.infer<typeof getContentInputSchema>;

export const getContentOutputSchema = z
  .object({
    slug: z.string().describe("The slug of the content to get."),
    content: z.string().describe("The content of the page."),
  })
  .describe("The output schema for the getContent tool.");
export type GetContentOutput = z.infer<typeof getContentOutputSchema>;

export const mathEvalInputSchema = z
  .object({
    expression: z
      .string()
      .describe(
        "Valid math expression to evaluate. It will use math.js to evaluate the expression."
      ),
  })
  .describe("The input schema for the mathEval tool.");
export type MathEvalInput = z.infer<typeof mathEvalInputSchema>;

export const mathEvalOutputSchema = z
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
  .describe("The output schema for the mathEval tool.");
export type MathEvalOutput = z.infer<typeof mathEvalOutputSchema>;
