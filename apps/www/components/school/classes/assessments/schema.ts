import * as z from "zod/mini";

export const assessmentModeSchema = z.union([
  z.literal("practice"),
  z.literal("assignment"),
  z.literal("quiz"),
  z.literal("exam"),
  z.literal("tryout"),
]);

export const assessmentStatusSchema = z.union([
  z.literal("draft"),
  z.literal("published"),
  z.literal("scheduled"),
  z.literal("archived"),
]);

export const createAssessmentFormSchema = z
  .object({
    title: z.string().check(z.minLength(1), z.trim()),
    description: z.string(),
    mode: assessmentModeSchema,
    status: assessmentStatusSchema,
    scheduledAt: z.optional(z.number()),
  })
  .check(
    z.refine((data) => {
      if (data.status !== "scheduled") {
        return true;
      }

      if (!data.scheduledAt) {
        return false;
      }

      return data.scheduledAt > Date.now();
    })
  );

export type CreateAssessmentFormValues = z.infer<
  typeof createAssessmentFormSchema
>;
