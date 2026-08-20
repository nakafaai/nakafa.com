import { Schema } from "effect";

/** Validation schema for the school join onboarding form. */
const schoolJoinForm = Schema.Struct({
  code: Schema.Trim.pipe(Schema.check(Schema.isMinLength(1))),
});
export const schoolJoinFormSchema = Schema.toStandardSchemaV1(schoolJoinForm);
/** Default values for the school join onboarding form. */
export const schoolJoinDefaultValues = {
  code: "",
} satisfies Schema.Schema.Type<typeof schoolJoinForm>;
