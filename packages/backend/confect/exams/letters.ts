import type { ContentDocumentSchema } from "@nakafa/aksara-contracts/assessment/document";
import { REASON_ID } from "@repo/backend/confect/exams/scoring";
import { Array as Arr, Option, Schema } from "effect";

/** The label of an option, a statement or an answer: a rich document of its own. */
type PartLabel = typeof ContentDocumentSchema.Type;

/** The scripts that name the options of a set: Arabic letters for an Arabic set, Latin ones for any other. */
export const LetterScript = Schema.Literals(["arabic", "latin"]);

/** The character code of the letter A, which names the first option of a Latin set. */
const LETTER_A = 65;

/** The letters that name the options of an Arabic set, in abjad order, as Arabic papers name their choices. */
const ABJAD = [
  "أ",
  "ب",
  "ج",
  "د",
  "هـ",
  "و",
  "ز",
  "ح",
  "ط",
  "ي",
  "ك",
  "ل",
  "م",
  "ن",
  "س",
  "ع",
  "ف",
  "ص",
  "ق",
  "ر",
  "ش",
  "ت",
  "ث",
  "خ",
  "ذ",
  "ض",
  "ظ",
  "غ",
];

/** A letter of any script. */
const LETTER = /\p{L}/u;

/** A letter of the Arabic script. */
const ARABIC_LETTER = /\p{Script=Arabic}/u;

/**
 * The plain text of a label: the text of its paragraphs in order, joined by spaces, as a control that
 * shows a short label as text reads it. A line break or a formula holds no text of a label.
 */
export const labelText = (label: PartLabel): string =>
  Arr.join(
    Arr.flatMap(label.content, (block) =>
      block.type === "paragraph"
        ? [
            Arr.join(
              Arr.flatMap(block.content ?? [], (node) =>
                node.type === "text" ? [node.text] : []
              ),
              ""
            ),
          ]
        : []
    ),
    " "
  );

/**
 * The script that names a set of options from their labels: Arabic when most letters of the labels are
 * Arabic, so a set written in Arabic is named أ, ب, ج, and any other set A, B, C. A set without a letter
 * is Latin. Every place that names an option reads this one rule: the editor, the student's paper, and
 * the results.
 */
export const letterScript = (
  labels: readonly PartLabel[]
): typeof LetterScript.Type => {
  const letters = Arr.filter(
    Arr.fromIterable(Arr.join(Arr.map(labels, labelText), "")),
    (character) => LETTER.test(character)
  );
  const arabic = Arr.filter(letters, (character) =>
    ARABIC_LETTER.test(character)
  );

  return arabic.length * 2 > letters.length ? "arabic" : "latin";
};

/**
 * The letter that names the option at `index` of a set in its script. Past the 28 letters of the abjad,
 * an option of an Arabic set takes the name a Latin set gives its place. A question holds five options
 * at most, so both scripts name every option with a letter.
 */
export const optionLetter = (
  index: number,
  script: typeof LetterScript.Type
) =>
  script === "arabic"
    ? Option.getOrElse(Arr.get(ABJAD, index), () =>
        String.fromCharCode(LETTER_A + index)
      )
    : String.fromCharCode(LETTER_A + index);

/**
 * The letters of one set of options, by place, in the one script their labels call for. Every place that
 * draws the options of a set takes its letters here, so a paper, a review and a key cannot name an option
 * apart.
 */
export const optionLetters = (labels: readonly PartLabel[]) => {
  const script = letterScript(labels);
  return (index: number) => optionLetter(index, script);
};

/** Whether an option is one of a two-tier question's reasons. */
export const isReasonOption = (optionId: string) =>
  optionId.startsWith(`${REASON_ID}-`);

/**
 * The place of one option among a question's options in order, within its own choice: a two-tier question's
 * reasons count from the start again, so a result names each one by the letter its paper showed.
 */
export const optionPlace = (optionIds: readonly string[], index: number) =>
  Option.match(Arr.findFirstIndex(optionIds, isReasonOption), {
    onNone: () => index,
    onSome: (first) => (index >= first ? index - first : index),
  });
