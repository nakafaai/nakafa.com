import { Array as Arr, Option, Schema } from "effect";

/** The scripts that name the options of a set: Arabic letters for an Arabic set, Latin ones for any other. */
const LetterScript = Schema.Literals(["arabic", "latin"]);

/** The script that names the options of a set. */
type LetterScript = typeof LetterScript.Type;

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
 * The script that names a set of options: Arabic when most letters of their labels are Arabic, so a
 * set written in Arabic is named أ, ب, ج, and any other set A, B, C. A set without a letter is Latin.
 */
export const letterScript = (labels: readonly string[]): LetterScript => {
  const letters = Arr.filter(
    Arr.fromIterable(Arr.join(labels, "")),
    (character) => LETTER.test(character)
  );
  const arabic = Arr.filter(letters, (character) =>
    ARABIC_LETTER.test(character)
  );

  return arabic.length * 2 > letters.length ? "arabic" : "latin";
};

/**
 * The letter that names the option at `index` of a set in its script. Past the 28 letters of the
 * abjad, an option of an Arabic set takes the name a Latin set gives its place. A question holds five
 * options at most, so both scripts name every option with a letter.
 */
export const optionLetter = (index: number, script: LetterScript) =>
  script === "arabic"
    ? Option.getOrElse(Arr.get(ABJAD, index), () =>
        String.fromCharCode(LETTER_A + index)
      )
    : String.fromCharCode(LETTER_A + index);
