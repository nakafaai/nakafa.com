import type { ContentDocumentSchema } from "@nakafa/aksara-contracts/assessment/document";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { Id } from "@repo/backend/confect/_generated/id";
import { MAX_EXAM_QUESTIONS } from "@repo/backend/confect/exams/exam";
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

/** The longest worked solution Nina may copy for one question. */
const MAX_EXPLANATION_LENGTH = 6000;

/** The longest text Nina may write for one option. */
const MAX_OPTION_LENGTH = 1500;

/** The longest alternative text of one figure. */
const MAX_ALT_LENGTH = 300;

/** The most figures one question carries from its file. */
const MAX_FIGURES = 6;

/** The most questions one read of five pages returns, which also bounds one placement. */
export const MAX_IMPORTED_QUESTIONS = 60;

/** A place on a page in thousandths of its width and height, from its top left corner. */
const Thousandths = Schema.Int.check(
  Schema.isBetween({ maximum: 1000, minimum: 0 })
);

/**
 * One figure of a question as Nina finds it: on a page of a PDF, as the box that frames it in
 * thousandths of the page, or as one of the images a Word file holds, by its number; and the
 * alternative text that says what it shows. The prompt or an option holds `{{figure:N}}` on a
 * line of its own where figure N goes, counted from one.
 */
const ImportedFigure = Schema.Struct({
  alt: Schema.String.check(Schema.isMaxLength(MAX_ALT_LENGTH)),
  box: Schema.NullOr(
    Schema.Struct({
      bottom: Thousandths,
      left: Thousandths,
      right: Thousandths,
      top: Thousandths,
    })
  ),
  image: Schema.NullOr(Schema.Int),
  page: Schema.NullOr(Schema.Int),
});

/**
 * One question as Nina reads it from a page: the number the file gives it, or null; the prompt
 * and each option as plain text with formulas written in LaTeX between `\(` and `\)`, or between
 * `\[` and `\]` on a line of their own; the zero-based index of the option the file marks
 * correct, or null when this part marks none; the worked solution the file prints for it, or an
 * empty string; and its figures. A paragraph ends at a line break.
 */
export const ImportedQuestion = Schema.Struct({
  answer: Schema.NullOr(Schema.Int),
  explanation: Schema.String.check(Schema.isMaxLength(MAX_EXPLANATION_LENGTH)),
  figures: Schema.Array(ImportedFigure).check(Schema.isMaxLength(MAX_FIGURES)),
  number: Schema.NullOr(Schema.Int),
  options: Schema.Array(
    Schema.String.check(Schema.isMaxLength(MAX_OPTION_LENGTH))
  ),
  prompt: Schema.String.check(Schema.isMaxLength(MAX_PROMPT_LENGTH)),
});
export type ImportedQuestion = typeof ImportedQuestion.Type;

/**
 * What Nina returns for one part of a file: its questions in the order the file holds them, and
 * the answers of an answer key table in this part, by question number, which may belong to
 * questions of an earlier part.
 */
export const ImportedRead = Schema.Struct({
  keys: Schema.Array(
    Schema.Struct({ answer: Schema.Int, number: Schema.Int })
  ).check(Schema.isMaxLength(MAX_EXAM_QUESTIONS)),
  questions: Schema.Array(ImportedQuestion).check(
    Schema.isMaxLength(MAX_IMPORTED_QUESTIONS)
  ),
});

/**
 * One question the browser places after a read: Nina's text, with each of its figures now an
 * image of the exam and its alternative text, in the order the `{{figure:N}}` marks count them.
 */
export const PlacedQuestion = Schema.Struct({
  answer: Schema.NullOr(Schema.Int),
  explanation: Schema.String.check(Schema.isMaxLength(MAX_EXPLANATION_LENGTH)),
  figures: Schema.Array(
    Schema.Struct({
      alt: Schema.String.check(Schema.isMaxLength(MAX_ALT_LENGTH)),
      asset: Id("examAssets"),
    })
  ).check(Schema.isMaxLength(MAX_FIGURES)),
  number: Schema.NullOr(Schema.Int),
  options: Schema.Array(
    Schema.String.check(Schema.isMaxLength(MAX_OPTION_LENGTH))
  ),
  prompt: Schema.String.check(Schema.isMaxLength(MAX_PROMPT_LENGTH)),
});
export type PlacedQuestion = typeof PlacedQuestion.Type;

/** A figure as a document draws it: an image of the exam with its size and alternative text. */
const FigureImage = Schema.Struct({
  alt: Schema.String,
  asset: Schema.String,
  height: Schema.Int,
  width: Schema.Int,
});

/** The mark Nina writes on its own line where a figure goes: `{{figure:N}}`. */
const FIGURE_OPEN = "{{figure:";
const FIGURE_CLOSE = "}}";

/** The number of the figure a line marks, counted from one, or none for any other line. */
const figureNumberOf = (line: string) =>
  line.startsWith(FIGURE_OPEN) && line.endsWith(FIGURE_CLOSE)
    ? Schema.decodeOption(Schema.FiniteFromString)(
        line.slice(FIGURE_OPEN.length, line.length - FIGURE_CLOSE.length)
      )
    : Option.none();

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
 * The blocks of one line that holds something: the figure a `{{figure:N}}` line marks, or
 * nothing when the question has no figure N; a formula alone on its line between `\[` and `\]`
 * as a formula block; and any other line as a paragraph of its runs and inline formulas.
 */
const blocksOf = (
  line: string,
  figures: readonly (typeof FigureImage.Type)[]
): ImportedBlock[] => {
  const figure = figureNumberOf(line);
  if (Option.isSome(figure)) {
    return Option.match(Arr.get(figures, figure.value - 1), {
      onNone: () => [],
      onSome: (image) => [
        {
          attrs: {
            alt: Str.trim(image.alt),
            asset: image.asset,
            height: image.height,
            width: image.width,
          },
          type: "image",
        },
      ],
    });
  }
  const latex = Str.trim(
    line.slice(BLOCK_OPEN.length, line.length - BLOCK_CLOSE.length)
  );
  const isBlock =
    line.startsWith(BLOCK_OPEN) &&
    line.endsWith(BLOCK_CLOSE) &&
    line.indexOf(BLOCK_OPEN, BLOCK_OPEN.length) < 0 &&
    latex !== "";
  return isBlock
    ? [{ attrs: { latex }, type: "mathBlock" }]
    : [{ content: inlineNodes(line), type: "paragraph" }];
};

/**
 * The document of a text that Nina wrote: the blocks of each line that holds anything, with its
 * figures as images, or one empty paragraph when nothing is left, which the contract accepts as
 * an empty prompt.
 */
export const documentOf = (
  text: string,
  figures: readonly (typeof FigureImage.Type)[] = []
): ContentDocument => {
  const lines = Arr.filter(
    Arr.map(Str.split(text, "\n"), Str.trim),
    (line) => line !== ""
  );
  const blocks = Arr.flatMap(lines, (line) => blocksOf(line, figures));
  return Arr.match(blocks, {
    onEmpty: () => ({ content: [{ type: "paragraph" }], type: "doc" }),
    onNonEmpty: (content) => ({ content, type: "doc" }),
  });
};

/**
 * The stored parts of one placed question: its prompt and explanation documents, its
 * single-answer choice with one option for each option Nina read, and its key when the file marks
 * an option that exists, each with the question's figures where its marks place them. A question with fewer than two or
 * more than five options is not one this kind holds, so it is none, and the import counts it as
 * left out.
 */
export const importedParts = (
  question: Pick<
    PlacedQuestion,
    "answer" | "explanation" | "options" | "prompt"
  >,
  figures: readonly (typeof FigureImage.Type)[]
) => {
  const { options } = question;
  if (
    !Arr.isReadonlyArrayNonEmpty(options) ||
    options.length < CHOICE_OPTIONS_MIN ||
    options.length > CHOICE_OPTIONS_MAX
  ) {
    return Option.none();
  }
  const answers = choiceAnswers(
    Arr.map(options, (option) => documentOf(option, figures))
  );
  const [choice] = answers;
  return Option.some({
    answers,
    explanation: documentOf(question.explanation, figures),
    key: keyOf(choice, question.answer),
    prompt: documentOf(question.prompt, figures),
  });
};

/** The key that marks option `answer` of a choice correct, or null when the choice has no such option. */
export const keyOf = (
  choice: Extract<ReturnType<typeof choiceAnswers>[0], { kind: "choice" }>,
  answer: number | null
): Arr.NonEmptyReadonlyArray<InteractionKey> | null =>
  Option.match(
    Option.flatMap(Option.fromNullOr(answer), (index) =>
      Arr.get(choice.options, index)
    ),
    {
      onNone: () => null,
      onSome: (option) => [
        { correct: [option.id], interaction: choice.id, kind: "choice" },
      ],
    }
  );

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
export const IMPORT_INSTRUCTIONS = `You read part of a school exam that a teacher uploaded, so that each question appears in Nina's exam editor exactly as the file has it. The part is either pages of a PDF, each given as "Page N:" with its text layer followed by the page image, or the text of a Word file in which each equation is Office Math XML or LaTeX between \\( and \\) and each picture is marked [image N], followed by those pictures as "Image N:".

Return every multiple-choice question in this part, in the order of the file. Copy the words exactly: keep every language the file mixes (Indonesian, English, Arabic and any other), its spelling and punctuation, and never translate, correct, solve, shorten or add to a question. Read the page image to fix what the text layer gets wrong: broken words, symbols, superscripts, subscripts and the order of columns.

For each question:
- number: the number the file prints before the question, or null when it prints none.
- prompt: the question as the student reads it, with the passage, table text, statements or data that belong to it, without its number. Put each paragraph on its own line. When several questions share one passage, repeat the passage in each of them.
- options: the text of each option in order, without its letter or number (A, B, a., 1), أ and the like).
- answer: the zero-based index of the option that this part marks as correct, through a mark on the option (bold, underline, a tick or a circle) or a key printed right after the question; null when this part marks none. Never guess an answer.
- explanation: the worked solution or discussion that the file prints for the question (for example "Pembahasan", "Solution", "Lösung"), copied exactly with its formulas and figures, without its heading; an empty string when the file prints none. Never write one yourself.
- figures: every picture, graph, diagram, chart or geometric figure that belongs to the question or to one of its options, in the order they appear. For a PDF page give page (its N) and box, the smallest rectangle around the figure in thousandths of the page width and height from the top left corner, with image null. For a Word picture give image (its N) with page and box null. Give alt, one short sentence in the question's language that says what the figure shows. Put the line {{figure:K}} where figure K of this question goes, on its own line in the prompt or in the option it belongs to, counting from 1.

If this part holds an answer key table (for example "Kunci Jawaban", "Answer key", "Lösungen"), put its entries in keys as { number, answer } with answer the zero-based index of the lettered option; do not turn the table into questions.

Write every formula in LaTeX between \\( and \\), or between \\[ and \\] on a line of its own when the file sets it apart, turn Office Math XML into the same LaTeX, and keep the LaTeX a Word file already gives. Chemical formulas and units are LaTeX too. Leave out page headers and footers, page numbers, school names and logos, instructions to students, and questions that are not multiple choice. Return empty lists when this part holds no question and no key.`;
