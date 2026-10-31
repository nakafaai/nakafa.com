import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import {
  canonicalDecimal,
  type NumericEntry,
  type NumericKey,
  numericKeyFits,
} from "@repo/backend/confect/assessment/number";
import type { QuestionView } from "@repo/backend/confect/exams/question";
import { Array as Arr, Option, Schema, String as Str } from "effect";

/** How far a student's number may stray from the key's: not at all, a fixed distance, or a share of the value. */
export const ToleranceKind = Schema.Literals(["exact", "absolute", "relative"]);
export type ToleranceKind = typeof ToleranceKind.Type;

/**
 * A numeric answer as the teacher's layer writes it: the correct number and the tolerance as typed, how
 * far the tolerance reaches, whether a fraction counts, and the unit shown beside the student's field.
 */
export const NumberSetting = Schema.Struct({
  acceptsFractions: Schema.Boolean,
  tolerance: Schema.String,
  toleranceKind: ToleranceKind,
  unit: Schema.String,
  value: Schema.String,
});
export type NumberSetting = typeof NumberSetting.Type;

/** Whether an interaction is a numeric entry. */
const isNumericEntry = (answer: Interaction): answer is NumericEntry =>
  answer.kind === "numericEntry";

/** The first numeric entry of a question's answers, or none when the answers hold no numeric entry. */
const numberEntryOf = (
  answers: readonly Interaction[]
): Option.Option<NumericEntry> => Arr.findFirst(answers, isNumericEntry);

/** The numeric key of a question, or none without a key or with a key of another kind. */
const numericKeyOf = (
  key: readonly InteractionKey[] | null
): Option.Option<NumericKey> =>
  Arr.findFirst(
    key ?? [],
    (answer): answer is NumericKey => answer.kind === "numericEntry"
  );

/**
 * The setting the teacher's layer shows for a numeric answer: the key's number and tolerance, or blank and
 * exact without a key, and the entry's fraction rule and unit, or none.
 */
export const numberSettingOf = (
  answers: readonly Interaction[],
  key: readonly InteractionKey[] | null
): NumberSetting => {
  const entry = numberEntryOf(answers);
  const keyed = numericKeyOf(key);
  const tolerance = Option.flatMap(keyed, (answer) =>
    Option.fromNullishOr(answer.tolerance)
  );
  return {
    acceptsFractions: Option.exists(entry, (answer) => answer.acceptsFractions),
    tolerance: Option.match(tolerance, {
      onNone: () => "",
      onSome: (within) => within.value,
    }),
    toleranceKind: Option.match(tolerance, {
      onNone: (): ToleranceKind => "exact",
      onSome: (within) => within.kind,
    }),
    unit: Option.getOrElse(
      Option.flatMap(entry, (answer) => Option.fromNullishOr(answer.unit)),
      () => ""
    ),
    value: Option.match(keyed, {
      onNone: () => "",
      onSome: (answer) => answer.value,
    }),
  };
};

/**
 * The key of one numeric entry for a setting: the value and the tolerance read in any script and with either
 * decimal point, and spelled as the contract stores them (`canonicalDecimal`). A value that is no decimal
 * gives no key, and so does a tolerance that is no decimal, or one that the contract does not allow for the
 * value (`numericKeyFits`), since a key it refuses grades nothing.
 */
const keyFor = (
  entry: NumericEntry,
  setting: NumberSetting
): Option.Option<NumericKey> => {
  const kind = setting.toleranceKind;
  return Option.flatMap(canonicalDecimal(setting.value), (value) => {
    const exact: NumericKey = {
      interaction: entry.id,
      kind: "numericEntry",
      value,
    };
    const keyed =
      kind === "exact"
        ? Option.some(exact)
        : Option.map(canonicalDecimal(setting.tolerance), (within) => ({
            ...exact,
            tolerance: { kind, value: within },
          }));
    return Option.filter(keyed, (answer) => numericKeyFits(entry, answer));
  });
};

/**
 * The answers and the key of a numeric answer once the teacher's setting is saved: the numeric entry takes
 * the fraction rule and the unit, which a blank unit leaves out, and the key holds the number for that
 * entry (`keyFor`), or is null while it holds none the contract grades.
 */
export const withNumber = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  setting: NumberSetting
): Pick<QuestionView, "answers" | "key"> => {
  const unit = Str.trim(setting.unit);
  const next = Arr.map(
    answers,
    (answer): Interaction =>
      answer.kind === "numericEntry"
        ? {
            acceptsFractions: setting.acceptsFractions,
            id: answer.id,
            kind: answer.kind,
            label: answer.label,
            ...(unit === "" ? {} : { unit }),
          }
        : answer
  );
  const key = Option.flatMap(numberEntryOf(next), (entry) =>
    keyFor(entry, setting)
  );
  return {
    answers: next,
    key: Option.match(key, {
      onNone: () => null,
      onSome: (answer): Arr.NonEmptyReadonlyArray<InteractionKey> => [answer],
    }),
  };
};
