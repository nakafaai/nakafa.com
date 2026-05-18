import { Schema } from "effect";

const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 64;

/** Validation schema for the school creation onboarding form. */
const schoolCreateForm = Schema.Struct({
  name: Schema.Trim.pipe(
    Schema.minLength(MIN_NAME_LENGTH),
    Schema.maxLength(MAX_NAME_LENGTH)
  ),
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  phone: Schema.Trim.pipe(Schema.minLength(1)),
  address: Schema.Trim.pipe(Schema.minLength(1)),
  city: Schema.Trim.pipe(Schema.minLength(1)),
  province: Schema.Trim.pipe(Schema.minLength(1)),
  type: Schema.Literal(
    "elementary-school",
    "middle-school",
    "high-school",
    "vocational-school",
    "university",
    "other"
  ),
});

export const schoolCreateFormSchema = Schema.standardSchemaV1(schoolCreateForm);
export const schoolTypeSchema = schoolCreateForm.fields.type;

/** Default values for the school creation onboarding form. */
export const schoolCreateDefaultValues: Schema.Schema.Encoded<
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
