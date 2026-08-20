import { Schema } from "effect";
export const assessmentModeSchema = Schema.Literals([
  "practice",
  "assignment",
  "quiz",
  "exam",
  "tryout",
]);
export const assessmentStatusSchema = Schema.Literals([
  "draft",
  "published",
  "scheduled",
  "archived",
]);
const createAssessmentForm = Schema.Struct({
  title: Schema.Trim.pipe(Schema.check(Schema.isMinLength(1))),
  description: Schema.String,
  mode: assessmentModeSchema,
  status: assessmentStatusSchema,
  scheduledAt: Schema.optional(Schema.Finite),
}).pipe(
  Schema.check(
    Schema.makeFilter((data) => {
      if (data.status !== "scheduled") {
        return true;
      }
      if (!data.scheduledAt) {
        return false;
      }
      return data.scheduledAt > Date.now();
    })
  )
);
export const createAssessmentFormSchema =
  Schema.toStandardSchemaV1(createAssessmentForm);
export type CreateAssessmentFormValues = Schema.Schema.Type<
  typeof createAssessmentForm
>;
