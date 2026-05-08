import { type InferUITools, tool } from "ai";
import * as z from "zod";

const toolNameSchema = z.enum([
  "contentAccess",
  "deepResearch",
  "mathCalculation",
]);
export type ToolName = z.infer<typeof toolNameSchema>;

/**
 * Input schema for the content access orchestrator tool.
 */
export const contentToolInputSchema = z.object({
  query: z
    .string()
    .describe(
      "The specific content request or question about Nakafa content. IMPORTANT: Include full context such as: current page URL/slug, whether the page is verified, what specific content the user is asking about, and any relevant details that would help retrieve the right content efficiently."
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
      "The mathematical expression or problem to solve (e.g., 'calculate 2+2', 'solve the quadratic equation x^2 + 5x + 6'). IMPORTANT: Include the full mathematical problem with all necessary context and variables."
    ),
});

const textOutputSchema = z.string();

const uiTools = {
  contentAccess: tool({
    inputSchema: contentToolInputSchema,
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
