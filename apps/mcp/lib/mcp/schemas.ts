import {
  NakafaAgentContentRefInputSchema,
  NakafaAgentExerciseOptionsSchema,
  NakafaAgentExerciseResultSchema,
  NakafaAgentMarkdownSchema,
  NakafaAgentQuranReferenceOptionsSchema,
  NakafaAgentQuranReferenceSchema,
  NakafaAgentReadOptionsSchema,
  NakafaAgentSearchOptionsSchema,
  NakafaAgentSearchResultSchema,
  NakafaAgentTaxonomyOptionsSchema,
  NakafaAgentTaxonomySchema,
} from "@repo/contents/_lib/agent/schemas";
import * as z from "zod";

/** Shared tool-error schema used in `structuredContent` for failed calls. */
export const NakafaMcpToolErrorSchema = z
  .object({
    error: z
      .object({
        message: z.string().describe("Actionable error message."),
        suggestions: z
          .array(z.string())
          .min(1)
          .describe("Concrete next steps the agent can try."),
      })
      .describe("Tool execution error details."),
  })
  .describe("Nakafa MCP tool error.");

/** Output schema for `nakafa_search_content` success and error results. */
export const NakafaSearchContentOutputSchema = z
  .object({
    ...NakafaAgentSearchResultSchema.shape,
    ...NakafaMcpToolErrorSchema.shape,
  })
  .partial()
  .describe("Nakafa content search output.");

/** Output schema for `nakafa_get_content` success and error results. */
export const NakafaGetContentOutputSchema = z
  .object({
    ...NakafaAgentMarkdownSchema.shape,
    ...NakafaMcpToolErrorSchema.shape,
  })
  .partial()
  .describe("Nakafa content markdown output.");

/** Output schema for `nakafa_get_taxonomy` success and error results. */
export const NakafaGetTaxonomyOutputSchema = z
  .object({
    ...NakafaAgentTaxonomySchema.shape,
    ...NakafaMcpToolErrorSchema.shape,
  })
  .partial()
  .describe("Nakafa taxonomy output.");

/** Output schema for `nakafa_get_exercise` success and error results. */
export const NakafaGetExerciseOutputSchema = z
  .object({
    ...NakafaAgentExerciseResultSchema.shape,
    ...NakafaMcpToolErrorSchema.shape,
  })
  .partial()
  .describe("Nakafa exercise output.");

/** Output schema for `nakafa_get_quran_reference` success and error results. */
export const NakafaGetQuranReferenceOutputSchema = z
  .object({
    ...NakafaAgentQuranReferenceSchema.shape,
    ...NakafaMcpToolErrorSchema.shape,
  })
  .partial()
  .describe("Nakafa Quran reference output.");

/** Input schema for `nakafa_search_content`. */
export const NakafaSearchContentInputSchema = NakafaAgentSearchOptionsSchema;

/** Shared content reference input accepted by lookup tools. */
export const NakafaMcpContentRefInputSchema = NakafaAgentContentRefInputSchema;

/** Input schema for `nakafa_get_content`. */
export const NakafaGetContentInputSchema = NakafaAgentReadOptionsSchema;

/** Input schema for `nakafa_get_taxonomy`. */
export const NakafaGetTaxonomyInputSchema = NakafaAgentTaxonomyOptionsSchema;

/** Input schema for `nakafa_get_exercise`. */
export const NakafaGetExerciseInputSchema = NakafaAgentExerciseOptionsSchema;

/** Input schema for `nakafa_get_quran_reference`. */
export const NakafaGetQuranReferenceInputSchema =
  NakafaAgentQuranReferenceOptionsSchema;
