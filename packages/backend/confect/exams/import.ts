import type { ContentDocumentSchema } from "@nakafa/aksara-contracts/assessment/document";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import {
  CHOICE_OPTIONS_MAX,
  CHOICE_OPTIONS_MIN,
  choiceAnswers,
} from "@repo/backend/confect/exams/question";
import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Array as Arr, Option, Schema, String as Str } from "effect";

/** One document of the contract: a prompt, or the label of an option. */
type ContentDocument = typeof ContentDocumentSchema.Type;

/** One inline node of a paragraph: a run of text or an inline formula. */
type InlineNode = NonNullable<
  Extract<ContentDocument["content"][number], { type: "paragraph" }>["content"]
>[number];

/** One block of a document that the import writes: a paragraph or a formula on its own line. */
type ImportedBlock = ContentDocument["content"][number];

/** The longest text Nina may write for one prompt. A longer prompt is cut by the schema's refusal. */
const MAX_PROMPT_LENGTH = 6000;

/** The longest text Nina may write for one option. */
const MAX_OPTION_LENGTH = 1500;

/** The most questions one read of five pages returns, which also bounds one placement. */
export const MAX_IMPORTED_QUESTIONS = 60;

/**
 * One question as Nina reads it from a page: the prompt and each option as plain text with
 * formulas written in LaTeX between `\(` and `\)`, or between `\[` and `\]` on a line of their
 * own; the zero-based index of the option the file marks correct, or null when the file marks
 * none. A paragraph ends at a line break.
 */
export const ImportedQuestion = Schema.Struct({
  answer: Schema.NullOr(Schema.Int),
  options: Schema.Array(
    Schema.String.check(Schema.isMaxLength(MAX_OPTION_LENGTH))
  ),
  prompt: Schema.String.check(Schema.isMaxLength(MAX_PROMPT_LENGTH)),
});
export type ImportedQuestion = typeof ImportedQuestion.Type;

/** What Nina returns for one group of pages: its questions in the order the file holds them. */
export const ImportedRead = Schema.Struct({
  questions: Schema.Array(ImportedQuestion).check(
    Schema.isMaxLength(MAX_IMPORTED_QUESTIONS)
  ),
});

/** The opening and closing marks of an inline formula, and of a formula on its own line. */
const INLINE_OPEN = "\\(";
const INLINE_CLOSE = "\\)";
const BLOCK_OPEN = "\\[";
const BLOCK_CLOSE = "\\]";

/** A text node, or nothing for an empty run, which the contract does not hold. */
const textNodes = (text: string): InlineNode[] =>
  text === "" ? [] : [{ text, type: "text" }];

/** An inline formula, or the marks as text when the formula between them is empty. */
const mathNode = (latex: string, raw: string): InlineNode => {
  const trimmed = Str.trim(latex);
  return trimmed === ""
    ? { text: raw, type: "text" }
    : { attrs: { latex: trimmed }, type: "mathInline" };
};

/**
 * The inline nodes of a line that holds something: the runs of text between formulas, and each
 * formula between `\(` and `\)` or `\[` and `\]` as an inline formula. A mark that opens a
 * formula and is never closed stays in the text, so nothing the file holds is lost.
 */
const inlineNodes = (line: string): Arr.NonEmptyArray<InlineNode> => {
  const inline = line.indexOf(INLINE_OPEN);
  const block = line.indexOf(BLOCK_OPEN);
  const opens = Arr.filter([inline, block], (index) => index >= 0);
  const start = Math.min(...opens);
  const close = start === inline ? INLINE_CLOSE : BLOCK_CLOSE;
  const end = line.indexOf(close, start + INLINE_OPEN.length);
  if (!Arr.isArrayNonEmpty(opens) || end < 0) {
    return [{ text: line, type: "text" }];
  }
  const rest = line.slice(end + close.length);
  return Arr.prependAll(
    Arr.prepend(
      rest === "" ? [] : inlineNodes(rest),
      mathNode(
        line.slice(start + INLINE_OPEN.length, end),
        line.slice(start, end + close.length)
      )
    ),
    textNodes(line.slice(0, start))
  );
};

/**
 * One block of a document from one line that holds something: a formula alone on its line
 * between `\[` and `\]` becomes a formula block, and any other line a paragraph of its runs
 * and inline formulas.
 */
const blockOf = (line: string): ImportedBlock => {
  const latex = Str.trim(
    line.slice(BLOCK_OPEN.length, line.length - BLOCK_CLOSE.length)
  );
  const isBlock =
    line.startsWith(BLOCK_OPEN) &&
    line.endsWith(BLOCK_CLOSE) &&
    line.indexOf(BLOCK_OPEN, BLOCK_OPEN.length) < 0 &&
    latex !== "";
  return isBlock
    ? { attrs: { latex }, type: "mathBlock" }
    : { content: inlineNodes(line), type: "paragraph" };
};

/**
 * The document of a text that Nina wrote: one block for each line that holds anything, or one
 * empty paragraph for an empty text, which the contract accepts as an empty prompt.
 */
export const documentOf = (text: string): ContentDocument => {
  const lines = Arr.filter(
    Arr.map(Str.split(text, "\n"), Str.trim),
    Str.isNonEmpty
  );
  return Arr.match(lines, {
    onEmpty: () => ({ content: [{ type: "paragraph" }], type: "doc" }),
    onNonEmpty: (present) => ({
      content: Arr.map(present, blockOf),
      type: "doc",
    }),
  });
};

/**
 * The stored parts of one imported question: its prompt document, its single-answer choice
 * with one option for each option Nina read, and its key when the file marks an option that
 * exists. A question with fewer than two or more than five options is not one this kind holds,
 * so it is none, and the import counts it as left out.
 */
export const importedParts = (question: ImportedQuestion) => {
  const { options } = question;
  if (
    !Arr.isReadonlyArrayNonEmpty(options) ||
    options.length < CHOICE_OPTIONS_MIN ||
    options.length > CHOICE_OPTIONS_MAX
  ) {
    return Option.none();
  }
  const answers = choiceAnswers(Arr.map(options, documentOf));
  const [choice] = answers;
  const correct = Option.flatMap(Option.fromNullOr(question.answer), (index) =>
    Arr.get(choice.options, index)
  );
  return Option.some({
    answers,
    key: Option.match(correct, {
      onNone: () => null,
      onSome: (option): Arr.NonEmptyReadonlyArray<InteractionKey> => [
        { correct: [option.id], interaction: choice.id, kind: "choice" },
      ],
    }),
    prompt: documentOf(question.prompt),
  });
};

/** The most pages one read sends to Nina, as the blueprint sets: five pages a call. */
export const PAGES_PER_READ = 5;

/** The longest text layer one page carries. A denser page sends its image alone. */
export const MAX_PAGE_TEXT = 20_000;

/** The longest text of a Word file one read carries: about five pages of WordprocessingML text. */
export const MAX_SOURCE_TEXT = 120_000;

/**
 * Nina could not read the pages: the model failed, timed out, or answered with something that is
 * not the questions' shape. Nothing is placed, so the teacher can send the same pages again.
 */
export class ImportUnread extends Schema.TaggedError<ImportUnread>()(
  "ImportUnread",
  {
    ...refusal("IMPORT_UNREAD", "Nina could not read these pages."),
  }
) {}

/** A page image that is no PNG or JPEG, or larger than an image may be. Every page image of the read is deleted. */
export class ImportPageRefused extends Schema.TaggedError<ImportPageRefused>()(
  "ImportPageRefused",
  {
    ...refusal(
      "IMPORT_PAGE_REFUSED",
      "A page must be a PNG or JPEG image of at most 2 MB."
    ),
  }
) {}

/**
 * What Nina is told for every read. The questions stay in the file's own words and languages,
 * a key comes only from what the file marks, and formulas are LaTeX between the marks
 * `documentOf` reads.
 */
export const IMPORT_INSTRUCTIONS = `You read part of a school exam that a teacher uploaded: pages of a PDF as images with their text layers, or the text of a Word file in which each equation is written as Office Math XML.

Return every multiple-choice question in this part, in the order of the file, as the file writes it. Keep each question in its own languages, and never translate, solve, shorten or add to it.

For each question:
- prompt: the question as the student reads it, with any passage, table text or statements that belong to it, and without its number. Put each paragraph on its own line.
- options: the text of each option in order, without its letter or number.
- answer: the zero-based index of the option that the file marks as correct, through an answer key, a key table, or a marked option in this part; null when this part marks none.

Write every formula in LaTeX between \\( and \\), or between \\[ and \\] on a line of its own, and turn Office Math XML into LaTeX the same way. Leave out page headers and footers, instructions for students, answer key tables themselves, and questions that are not multiple choice. Return an empty list when this part holds no question.`;
