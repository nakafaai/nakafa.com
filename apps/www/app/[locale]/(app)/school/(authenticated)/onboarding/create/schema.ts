import * as z from "zod/mini";

const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 64;

/** Validation schema for the school creation onboarding form. */
export const schoolCreateFormSchema = z.object({
  name: z
    .string()
    .check(
      z.minLength(MIN_NAME_LENGTH),
      z.maxLength(MAX_NAME_LENGTH),
      z.trim()
    ),
  email: z.string().check(z.email()),
  phone: z.string().check(z.minLength(1), z.trim()),
  address: z.string().check(z.minLength(1), z.trim()),
  city: z.string().check(z.minLength(1), z.trim()),
  province: z.string().check(z.minLength(1), z.trim()),
  type: z.union([
    z.literal("elementary-school"),
    z.literal("middle-school"),
    z.literal("high-school"),
    z.literal("vocational-school"),
    z.literal("university"),
    z.literal("other"),
  ]),
});

export const schoolTypeSchema = schoolCreateFormSchema.shape.type;

/** Default values for the school creation onboarding form. */
export const schoolCreateDefaultValues: z.infer<typeof schoolCreateFormSchema> =
  {
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    province: "",
    type: "high-school",
  };
