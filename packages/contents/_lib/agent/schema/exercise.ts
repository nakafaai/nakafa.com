import { NakafaAgentContentRefInputSchema } from "@repo/contents/_lib/agent/schema/read";
import { NakafaAgentContentRefSchema } from "@repo/contents/_lib/agent/schema/ref";
import * as z from "zod";

/** Runtime schema for exercise read input. */
export const NakafaAgentExerciseOptionsSchema = z
  .object({
    content_ref: NakafaAgentContentRefInputSchema,
    exercise_number: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Optional exercise number inside the set."),
  })
  .strict()
  .describe("Nakafa exercise read options.");

/** Runtime schema for one exercise choice. */
export const NakafaAgentExerciseChoiceSchema = z
  .object({
    correct: z.boolean().describe("Whether this choice is the correct answer."),
    label: z.string().describe("Choice label exactly as published."),
  })
  .describe("Nakafa exercise choice.");

/** Runtime schema for one exercise question and explanation. */
export const NakafaAgentExerciseItemSchema = z
  .object({
    answer: z
      .object({
        raw: z.string().describe("Raw answer and explanation markdown."),
        title: z.string().describe("Answer metadata title."),
      })
      .describe("Published answer and explanation."),
    choices: z
      .array(NakafaAgentExerciseChoiceSchema)
      .describe("Multiple-choice answer options."),
    number: z.number().int().min(1).describe("Exercise number inside the set."),
    question: z
      .object({
        raw: z.string().describe("Raw question markdown."),
        title: z.string().describe("Question metadata title."),
      })
      .describe("Published question content."),
  })
  .describe("Structured Nakafa exercise item.");

/** Runtime schema for exercise retrieval output. */
export const NakafaAgentExerciseResultSchema =
  NakafaAgentContentRefSchema.extend({
    count: z.number().int().min(1).describe("Number of returned exercises."),
    exercise_number: z
      .number()
      .int()
      .min(1)
      .nullable()
      .describe(
        "Requested exercise number, or null when returning a whole set."
      ),
    exercises: z
      .array(NakafaAgentExerciseItemSchema)
      .min(1)
      .describe("Structured exercises."),
  }).describe("Nakafa exercise set or single exercise result.");

export type NakafaAgentExerciseOptions = z.infer<
  typeof NakafaAgentExerciseOptionsSchema
>;
export type NakafaAgentExerciseItem = z.infer<
  typeof NakafaAgentExerciseItemSchema
>;
export type NakafaAgentExerciseResult = z.infer<
  typeof NakafaAgentExerciseResultSchema
>;
