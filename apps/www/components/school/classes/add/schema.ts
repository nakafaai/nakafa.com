import { Schema } from "effect";
import { getCurrentAcademicYear } from "@/components/school/classes/add/utils";

const MIN_NAME_LENGTH = 3;

/** Validation schema for the school class creation form. */
const classCreateForm = Schema.Struct({
  name: Schema.Trim.pipe(Schema.minLength(MIN_NAME_LENGTH)),
  subject: Schema.Trim.pipe(Schema.minLength(MIN_NAME_LENGTH)),
  year: Schema.Trim.pipe(Schema.minLength(MIN_NAME_LENGTH)),
  visibility: Schema.Literal("public", "private"),
});

export const classCreateFormSchema = Schema.standardSchemaV1(classCreateForm);

/** Default values used by the school class creation form. */
export const classCreateDefaultValues: Schema.Schema.Encoded<
  typeof classCreateForm
> = {
  name: "",
  subject: "",
  year: getCurrentAcademicYear(),
  visibility: "private",
};

/** Available visibility variants for new school classes. */
export const classVisibilityList = ["private", "public"] as const;
