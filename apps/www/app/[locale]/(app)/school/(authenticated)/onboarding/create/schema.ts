import { Schema } from "effect";

const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 64;
/** Validation schema for the school creation onboarding form. */
const schoolCreateForm = Schema.Struct({
  name: Schema.Trim.pipe(
    Schema.check(Schema.isMinLength(MIN_NAME_LENGTH)),
    Schema.check(Schema.isMaxLength(MAX_NAME_LENGTH))
  ),
  email: Schema.String.pipe(
    Schema.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
  ),
  phone: Schema.Trim.pipe(Schema.check(Schema.isMinLength(1))),
  address: Schema.Trim.pipe(Schema.check(Schema.isMinLength(1))),
  city: Schema.Trim.pipe(Schema.check(Schema.isMinLength(1))),
  province: Schema.Trim.pipe(Schema.check(Schema.isMinLength(1))),
  type: Schema.Literals([
    "elementary-school",
    "middle-school",
    "high-school",
    "vocational-school",
    "university",
    "other",
  ]),
});
export const schoolCreateFormSchema =
  Schema.toStandardSchemaV1(schoolCreateForm);
export const schoolTypeSchema = schoolCreateForm.fields.type;
/** Default values for the school creation onboarding form. */
export const schoolCreateDefaultValues: Schema.Codec.Encoded<
  typeof schoolCreateForm
> = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  province: "",
  type: "high-school",
};
