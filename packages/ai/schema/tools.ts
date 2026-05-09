import { type InferUITools, tool } from "ai";
import * as z from "zod";

const toolNameSchema = z.enum(["nakafa", "deepResearch", "mathCalculation"]);
export type ToolName = z.infer<typeof toolNameSchema>;

/**
 * Input schema for the Nakafa orchestrator tool.
 */
export const nakafaToolInputSchema = z.object({
  query: z
    .string()
    .describe(
      "The specific request or question about Nakafa content. Include the current URL, verified status, user goal, and enough subject/article/exercise/Quran context to search or read the right Nakafa source."
    ),
});

/**
 * Input schema for the deep research orchestrator tool.
 */
export const researchToolInputSchema = z.object({
  query: z
    .string()
    .describe(
      "The research question or topic to investigate. IMPORTANT: Include full context such as: what the user is asking about, why they need this information, and any relevant background that would help focus the research."
    ),
});

/**
 * Input schema for the math calculation orchestrator tool.
 */
export const mathToolInputSchema = z.object({
  query: z
    .string()
    .describe(
      "The concrete numeric expression to calculate. Use only for expressions Math.js can evaluate, not symbolic algebra or proof-style explanations."
    ),
});

const textOutputSchema = z.string();

const uiTools = {
  nakafa: tool({
    inputSchema: nakafaToolInputSchema,
    outputSchema: textOutputSchema,
  }),
  deepResearch: tool({
    inputSchema: researchToolInputSchema,
    outputSchema: textOutputSchema,
  }),
  mathCalculation: tool({
    inputSchema: mathToolInputSchema,
    outputSchema: textOutputSchema,
  }),
};

export type MyUITools = InferUITools<typeof uiTools>;
