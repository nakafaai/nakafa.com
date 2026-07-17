import { fieldsForEveryLocale } from "@repo/utilities/locales";
import { Schema } from "effect";

const QuestionChoiceItemSchema = Schema.Struct({
  label: Schema.String,
  value: Schema.Boolean,
}).pipe(Schema.mutable);

type QuestionChoiceItem = Schema.Schema.Type<typeof QuestionChoiceItemSchema>;

/** Validate that one localized choice list has one correct answer. */
const hasExactlyOneCorrectChoice = (choices: readonly QuestionChoiceItem[]) =>
  choices.filter((choice) => choice.value).length === 1;

const QuestionChoiceListSchema = Schema.Array(QuestionChoiceItemSchema).pipe(
  Schema.mutable,
  Schema.filter(hasExactlyOneCorrectChoice, {
    identifier: "QuestionChoiceList",
    message: () => "Expected exactly one correct choice.",
  })
);

/** Localized single-answer choices required for every supported locale. */
export const QuestionChoicesSchema = Schema.Struct(
  fieldsForEveryLocale(QuestionChoiceListSchema)
).pipe(Schema.mutable);

export type QuestionChoices = Schema.Schema.Type<typeof QuestionChoicesSchema>;
