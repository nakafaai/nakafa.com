import {
  matchesAnswerKey,
  type NumberKey,
  NumberKeySchema,
  readNumberAnswer,
} from "@nakafa/aksara-contracts/assessment/answer";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { BigDecimal, Option, Schema } from "effect";

/** A numeric entry: a number the learner types, which its key holds the value of. */
export type NumericEntry = Extract<Interaction, { kind: "numericEntry" }>;

/** The key of a numeric entry: its value and, when the teacher allows one, how far an answer may stray from it. */
export type NumericKey = Extract<InteractionKey, { kind: "numericEntry" }>;

/** The Arabic-Indic digits ٠ to ٩ and the Eastern Arabic-Indic ones ۰ to ۹, which an Arabic keypad writes. */
const EASTERN_DIGIT = /[٠-٩۰-۹]/gu;

/** The comma and the Arabic decimal separator ٫, either of which a learner may write for the decimal point. */
const DECIMAL_SEPARATOR = /[,٫]/gu;

/** The code point of the Arabic-Indic zero ٠, from which each Arabic-Indic digit counts its value. */
const ARABIC_INDIC_ZERO = 0x06_60;

/** How far the Eastern Arabic-Indic digits ۰ to ۹ start after the Arabic-Indic ones, so both runs count alike. */
const EASTERN_RUN = 0x90;

/**
 * A typed number as the contract reads it, whatever script and separator the learner wrote it in: each
 * Arabic-Indic digit becomes its ASCII digit, and the comma or the Arabic decimal separator becomes the dot,
 * which the contract reads in English. A school's papers name no language, so the decimal point a learner
 * types is never wrong: `0,75`, `0.75` and `٠٫٧٥` read the same. Anything else stays as it was typed, so a
 * text that is no number stays no number.
 */
export const numberText = (typed: string) =>
  typed
    .replace(EASTERN_DIGIT, (digit) =>
      String((digit.charCodeAt(0) - ARABIC_INDIC_ZERO) % EASTERN_RUN)
    )
    .replace(DECIMAL_SEPARATOR, ".");

/**
 * The canonical decimal a typed number stands for, as a key stores its value: the contract's one spelling,
 * with no trailing zero and `0` for zero. A fraction, a text that is no number, and a number too long to
 * spell without an exponent stand for none.
 */
export const canonicalDecimal = (typed: string): Option.Option<string> =>
  Option.flatMap(readNumberAnswer(numberText(typed), "en"), (number) =>
    number.fraction
      ? Option.none()
      : Option.some(BigDecimal.format(number.numerator))
  );

/** The contract's number key that a numeric entry's key and the entry's rule on fractions make together. */
const numberKeyOf = (
  interaction: NumericEntry,
  key: NumericKey
): NumberKey => ({
  acceptsFractions: interaction.acceptsFractions,
  kind: "number",
  ...(key.tolerance === undefined ? {} : { tolerance: key.tolerance }),
  value: key.value,
});

/** Whether a number key is one the contract takes: a canonical value, and a tolerance it allows for that value. */
const isNumberKey = Schema.is(NumberKeySchema);

/**
 * Whether a numeric entry's key is one the contract grades: its value is a canonical decimal, and its
 * tolerance, when it has one, is a positive decimal, below one when relative, and never relative to zero.
 */
export const numericKeyFits = (interaction: NumericEntry, key: NumericKey) =>
  isNumberKey(numberKeyOf(interaction, key));

/**
 * Whether a typed answer is the key's number, read in any script and with either decimal point
 * (`numberText`), and within the key's tolerance. A fraction counts only when the entry accepts fractions.
 */
export const matchesNumber = (
  interaction: NumericEntry,
  key: NumericKey,
  typed: string
) => matchesAnswerKey(numberKeyOf(interaction, key), numberText(typed), "en");
