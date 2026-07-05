import { Schema } from "effect";

const QuestionChoiceItemSchema = Schema.Struct({
  label: Schema.String,
  value: Schema.Boolean,
}).pipe(Schema.mutable);

export const QuestionChoicesSchema = Schema.Struct({
  id: Schema.Array(QuestionChoiceItemSchema).pipe(Schema.mutable),
  en: Schema.Array(QuestionChoiceItemSchema).pipe(Schema.mutable),
}).pipe(Schema.mutable);

export type QuestionChoices = Schema.Schema.Type<typeof QuestionChoicesSchema>;
