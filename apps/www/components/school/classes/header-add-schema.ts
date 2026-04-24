import * as z from "zod/mini";
import { getCurrentAcademicYear } from "./header-add-utils";

const MIN_NAME_LENGTH = 3;

/** Validation schema for the school class creation form. */
export const classCreateFormSchema = z.object({
  name: z.string().check(z.minLength(MIN_NAME_LENGTH), z.trim()),
  subject: z.string().check(z.minLength(MIN_NAME_LENGTH), z.trim()),
  year: z.string().check(z.minLength(MIN_NAME_LENGTH), z.trim()),
  visibility: z.enum(["public", "private"]),
});

/** Default values used by the school class creation form. */
export const classCreateDefaultValues: z.infer<typeof classCreateFormSchema> = {
  name: "",
  subject: "",
  year: getCurrentAcademicYear(),
  visibility: "private",
};

/** Available visibility variants for new school classes. */
export const classVisibilityList = ["private", "public"] as const;
