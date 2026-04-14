import * as z from "zod/mini";

/** Validation schema for the school join onboarding form. */
export const schoolJoinFormSchema = z.object({
  code: z.string().check(z.minLength(1), z.trim()),
});

/** Default values for the school join onboarding form. */
export const schoolJoinDefaultValues: z.infer<typeof schoolJoinFormSchema> = {
  code: "",
};
