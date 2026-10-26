import { LocalIdSchema } from "@nakafa/aksara-contracts/assessment/identity";
import { Array as Arr, Schema, String as Str } from "effect";

/** The most characters a student types as a short answer: one line, as long as a try-out's typed answer. */
export const TEXT_RESPONSE_MAX = 500;

/** The options a student chose in a choice, in the order the student chose them. */
const ChoiceResponse = Schema.Array(LocalIdSchema);

/** The text a student typed in a text entry, as the student typed it. */
const TextResponse = Schema.Struct({
  text: Schema.String.check(Schema.isMaxLength(TEXT_RESPONSE_MAX)),
});

/**
 * One student's response to one question (ADR 0013): the option IDs the student chose in a choice, or
 * the text the student typed in a text entry. A choice left blank is no option, and a text entry left
 * blank is text with nothing but spaces.
 */
export const ExamResponse = Schema.Union([ChoiceResponse, TextResponse]);
export type ExamResponse = typeof ExamResponse.Type;

/** A response that answers nothing yet, as an unanswered choice is scored. */
export const NO_RESPONSE: ExamResponse = [];

/** Whether a response is typed text rather than chosen options. */
export const isTextResponse = Schema.is(TextResponse);

/** Whether a response answers its question: at least one chosen option, or typed text that is not blank. */
export const isAnswered = (response: ExamResponse) =>
  isTextResponse(response)
    ? Str.isNonEmpty(Str.trim(response.text))
    : Arr.isReadonlyArrayNonEmpty(response);

/** The options a response chose: the options of a choice response, and none of a text response. */
export const chosenOptions = (response: ExamResponse): readonly string[] =>
  isTextResponse(response) ? [] : response;

/** The text a response typed: the text of a text response, and none of a choice response. */
export const typedText = (response: ExamResponse): string =>
  isTextResponse(response) ? response.text : "";
