import { LocalIdSchema } from "@nakafa/aksara-contracts/assessment/identity";
import { CHOICE_OPTIONS_MAX } from "@repo/backend/confect/exams/question";
import { Array as Arr, Schema, String as Str } from "effect";

/** The most characters a student types as a short answer: one line, as long as a try-out's typed answer. */
export const TEXT_RESPONSE_MAX = 500;

/** The most characters a student writes as an essay: a few pages, well within the row size. */
export const ESSAY_RESPONSE_MAX = 20_000;

/** The options a student chose in a choice, in the order the student chose them. */
const ChoiceResponse = Schema.Array(LocalIdSchema);

/** The text a student typed in a text entry or wrote in an essay, as the student wrote it. */
const TextResponse = Schema.Struct({
  text: Schema.String.check(Schema.isMaxLength(ESSAY_RESPONSE_MAX)),
});

/** The pairs a student made in a match: each statement the student paired, with the answer it chose. */
const PairsResponse = Schema.Struct({
  pairs: Schema.Array(
    Schema.Struct({ source: LocalIdSchema, target: LocalIdSchema })
  ).check(Schema.isMaxLength(CHOICE_OPTIONS_MAX)),
});

/**
 * One student's response to one question (ADR 0013): the option IDs the student chose in a choice, or
 * the text the student typed in a text entry or wrote in an essay, or the pairs the student made in a
 * match, or the cells the student marked in a table. A choice left blank is no option, a text left
 * blank is text with nothing but spaces, and a match or a table left blank is no pair or no cell.
 */
/** The cells a student marked in a table: each statement the student marked, with the column it chose. */
const CellsResponse = Schema.Struct({
  cells: Schema.Array(
    Schema.Struct({ column: LocalIdSchema, statement: LocalIdSchema })
  ).check(Schema.isMaxLength(CHOICE_OPTIONS_MAX)),
});

export const ExamResponse = Schema.Union([
  ChoiceResponse,
  TextResponse,
  PairsResponse,
  CellsResponse,
]);
export type ExamResponse = typeof ExamResponse.Type;

/** A response that answers nothing yet, as an unanswered choice is scored. */
export const NO_RESPONSE: ExamResponse = [];

/** Whether a response is typed text rather than chosen options. */
export const isTextResponse = Schema.is(TextResponse);

/** Whether a response is the pairs of a match. */
export const isPairsResponse = Schema.is(PairsResponse);

/** Whether a response is the cells of a table. */
export const isCellsResponse = Schema.is(CellsResponse);

/** Whether a response answers its question: a chosen option, typed text that is not blank, or a pair. */
export const isAnswered = (response: ExamResponse) => {
  if (isTextResponse(response)) {
    return Str.isNonEmpty(Str.trim(response.text));
  }
  if (isPairsResponse(response)) {
    return Arr.isReadonlyArrayNonEmpty(response.pairs);
  }
  if (isCellsResponse(response)) {
    return Arr.isReadonlyArrayNonEmpty(response.cells);
  }
  return Arr.isReadonlyArrayNonEmpty(response);
};

/** The options a response chose: the options of a choice response, and none of any other. */
export const chosenOptions = (response: ExamResponse): readonly string[] =>
  isTextResponse(response) ||
  isPairsResponse(response) ||
  isCellsResponse(response)
    ? []
    : response;

/** The pairs a response made: the pairs of a match response, and none of any other. */
export const madePairs = (
  response: ExamResponse
): readonly { readonly source: string; readonly target: string }[] =>
  isPairsResponse(response) ? response.pairs : [];

/** The text a response typed: the text of a text response, and none of a choice response. */
export const typedText = (response: ExamResponse): string =>
  isTextResponse(response) ? response.text : "";

/** The cells a response marked: the cells of a table response, and none of any other. */
export const markedCells = (
  response: ExamResponse
): readonly { readonly column: string; readonly statement: string }[] =>
  isCellsResponse(response) ? response.cells : [];
