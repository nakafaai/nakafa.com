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

/**
 * The canonical decimal a typed number stands for, as a key stores its value: the contract's one spelling,
 * with no trailing zero and `0` for zero. A fraction, a text that is no number, and a number too long to
 * spell without an exponent stand for none.
 */
export const canonicalDecimal = (typed: string): Option.Option<string> =>
  Option.flatMap(readNumberAnswer(typed), (number) =>
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
 * Whether a typed answer is the key's number, read in any script and with either decimal point, and
 * within the key's tolerance. A fraction counts only when the entry accepts fractions.
 */
export const matchesNumber = (
  interaction: NumericEntry,
  key: NumericKey,
  typed: string
) => matchesAnswerKey(numberKeyOf(interaction, key), typed);
