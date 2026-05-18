import { Schema } from "effect";

/** Validation schema for the school join onboarding form. */
const schoolJoinForm = Schema.Struct({
  code: Schema.Trim.pipe(Schema.minLength(1)),
});

export const schoolJoinFormSchema = Schema.standardSchemaV1(schoolJoinForm);

/** Default values for the school join onboarding form. */
export const schoolJoinDefaultValues = {
  code: "",
} satisfies Schema.Schema.Type<typeof schoolJoinForm>;
