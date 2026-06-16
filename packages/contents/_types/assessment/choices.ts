import { Schema } from "effect";

const ChoicesItemSchema = Schema.Struct({
  label: Schema.String,
  value: Schema.Boolean,
}).pipe(Schema.mutable);

export const ExercisesChoicesSchema = Schema.Struct({
  id: Schema.Array(ChoicesItemSchema).pipe(Schema.mutable),
  en: Schema.Array(ChoicesItemSchema).pipe(Schema.mutable),
}).pipe(Schema.mutable);

export type ExercisesChoices = Schema.Schema.Type<
  typeof ExercisesChoicesSchema
>;
