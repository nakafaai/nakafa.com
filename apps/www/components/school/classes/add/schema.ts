import { Schema } from "effect";
import { getCurrentAcademicYear } from "@/components/school/classes/add/utils";

const MIN_NAME_LENGTH = 3;
/** Validation schema for the school class creation form. */
const classCreateForm = Schema.Struct({
  name: Schema.Trim.pipe(Schema.check(Schema.isMinLength(MIN_NAME_LENGTH))),
  subject: Schema.Trim.pipe(Schema.check(Schema.isMinLength(MIN_NAME_LENGTH))),
  year: Schema.Trim.pipe(Schema.check(Schema.isMinLength(MIN_NAME_LENGTH))),
  visibility: Schema.Literals(["public", "private"]),
});
export const classCreateFormSchema = Schema.toStandardSchemaV1(classCreateForm);
/** Default values used by the school class creation form. */
export const classCreateDefaultValues: Schema.Codec.Encoded<
  typeof classCreateForm
> = {
  name: "",
  subject: "",
  year: getCurrentAcademicYear(),
  visibility: "private",
};
/** Available visibility variants for new school classes. */
export const classVisibilityList = ["private", "public"] as const;
