import { Schema } from "effect";

export const assessmentModeSchema = Schema.Literal(
  "practice",
  "assignment",
  "quiz",
  "exam",
  "tryout"
);

export const assessmentStatusSchema = Schema.Literal(
  "draft",
  "published",
  "scheduled",
  "archived"
);

const createAssessmentForm = Schema.Struct({
  title: Schema.Trim.pipe(Schema.minLength(1)),
  description: Schema.String,
  mode: assessmentModeSchema,
  status: assessmentStatusSchema,
  scheduledAt: Schema.optional(Schema.Number),
}).pipe(
  Schema.filter((data) => {
    if (data.status !== "scheduled") {
      return true;
    }

    if (!data.scheduledAt) {
      return false;
    }

    return data.scheduledAt > Date.now();
  })
);

export const createAssessmentFormSchema =
  Schema.standardSchemaV1(createAssessmentForm);

export type CreateAssessmentFormValues = Schema.Schema.Type<
  typeof createAssessmentForm
>;
