import { Schema } from "effect";
export const materialStatusSchema = Schema.Literals([
  "draft",
  "published",
  "scheduled",
  "archived",
]);
const materialGroupForm = Schema.Struct({
  name: Schema.Trim.pipe(Schema.check(Schema.isMinLength(1))),
  description: Schema.Trim.pipe(Schema.check(Schema.isMinLength(1))),
  status: materialStatusSchema,
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
export const materialGroupFormSchema =
  Schema.toStandardSchemaV1(materialGroupForm);
export type MaterialGroupFormValues = Schema.Schema.Type<
  typeof materialGroupForm
>;
