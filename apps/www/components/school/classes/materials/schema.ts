import { Schema } from "effect";

export const materialStatusSchema = Schema.Literal(
  "draft",
  "published",
  "scheduled",
  "archived"
);

const materialGroupForm = Schema.Struct({
  name: Schema.Trim.pipe(Schema.minLength(1)),
  description: Schema.Trim.pipe(Schema.minLength(1)),
  status: materialStatusSchema,
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

export const materialGroupFormSchema =
  Schema.standardSchemaV1(materialGroupForm);

export type MaterialGroupFormValues = Schema.Schema.Type<
  typeof materialGroupForm
>;
