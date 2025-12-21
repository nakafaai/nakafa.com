import * as z from "zod/mini";

export const materialStatusSchema = z.union([
  z.literal("draft"),
  z.literal("published"),
  z.literal("scheduled"),
  z.literal("archived"),
]);

export const materialGroupFormSchema = z
  .object({
    name: z.string().check(z.minLength(1), z.trim()),
    description: z.string().check(z.minLength(1), z.trim()),
    status: materialStatusSchema,
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

export type MaterialGroupFormValues = z.infer<typeof materialGroupFormSchema>;
