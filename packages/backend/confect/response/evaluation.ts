import type { DeliveryLanguage } from "@nakafa/aksara-contracts/locale";
import {
  isBlankAnswer,
  matchesAnswerKey,
  type QuestionAnswerKey,
  type QuestionNumberAnswer,
  readNumberAnswer,
} from "@nakafa/aksara-contracts/question/answer";
import { questionRubricPoints } from "@nakafa/aksara-contracts/question/rubric";
import {
  type Evaluated,
  type Outcome,
  ResponseRejected,
  ResponseSpec,
  type Selection,
} from "@repo/backend/confect/response/model";
import { project } from "@repo/backend/confect/response/projection";
import { select } from "@repo/backend/confect/response/selection";
import {
  Array as Arr,
  BigDecimal,
  HashMap,
  Number as Num,
  Option,
  Result,
  String as Str,
  Tuple,
} from "effect";

type Kind = ResponseSpec["kind"];
type SpecOf<K extends Kind> = (typeof ResponseSpec.cases)[K]["Type"];
type SelectionOf<K extends Kind> = (typeof Selection.cases)[K]["Type"];
type Criterion = SpecOf<"rubric">["criteria"][number];
type Evaluating = Result.Result<Evaluated, ResponseRejected>;

const correct: Outcome = { status: "correct" };
const incorrect: Outcome = { status: "incorrect" };
const pending: Outcome = { status: "pending" };

/**
 * Validates one learner selection against its frozen response and decides how
 * it scores. Choice and category answers are correct or incorrect. A short
 * answer is graded by the contract's `matchesAnswerKey` in the delivery
 * language: a numeric key decides it, while a text answer that matches no
 * accepted answer is `pending` until the grader judges text variants. A rubric
 * earns the upper level of each final-answer criterion whose typed final answer
 * matches; a written response leaves judged criteria, and so the answer,
 * `pending`.
 *
 * It returns a `Result`, not an Effect, because www calls this check and
 * `select` from synchronous helpers that AGENTS.md forbids to run an Effect:
 * `TryoutResponsePreview` evaluates the authored preview while React renders,
 * and `submit.client.ts` selects inside a Convex optimistic update, whose
 * handler must be synchronous. A `Result` needs no runner; the answer mutation
 * lifts it with `Effect.fromResult`.
 */
export function evaluate(spec: ResponseSpec, selection: Selection): Evaluating {
  return ResponseSpec.match(spec, {
    category: (spec) =>
      selection.kind === "category"
        ? evaluateCategory(spec, selection)
        : rejectKind(),
    "multiple-choice": (spec) =>
      selection.kind === "multiple-choice"
        ? evaluateMultipleChoice(spec, selection)
        : rejectKind(),
    rubric: (spec) =>
      selection.kind === "rubric"
        ? evaluateRubric(spec, selection)
        : rejectKind(),
    "short-answer": (spec) =>
      selection.kind === "short-answer"
        ? evaluateShortAnswer(spec, selection)
        : rejectKind(),
    "single-choice": (spec) =>
      selection.kind === "single-choice"
        ? evaluateSingleChoice(spec, selection)
        : rejectKind(),
  });
}

function rejectKind(): Evaluating {
  return Result.fail(ResponseRejected.make({ reason: "kind" }));
}

function evaluateSingleChoice(
  spec: SpecOf<"single-choice">,
  selection: SelectionOf<"single-choice">
): Evaluating {
  return Result.map(select(project(spec, true), selection), (selected) => ({
    ...selected,
    outcome: Arr.some(
      spec.options,
      ({ isCorrect, optionKey }) =>
        isCorrect && optionKey === selection.optionKey
    )
      ? correct
      : incorrect,
  }));
}

function evaluateMultipleChoice(
  spec: SpecOf<"multiple-choice">,
  selection: SelectionOf<"multiple-choice">
): Evaluating {
  return Result.map(select(project(spec, true), selection), (selected) => ({
    ...selected,
    outcome: Arr.every(
      spec.options,
      ({ isCorrect, optionKey }) =>
        Arr.contains(selection.optionKeys, optionKey) === isCorrect
    )
      ? correct
      : incorrect,
  }));
}

function evaluateCategory(
  spec: SpecOf<"category">,
  selection: SelectionOf<"category">
): Evaluating {
  const assigned = HashMap.fromIterable(
    Arr.map(selection.assignments, ({ categoryKey, statementKey }) =>
      Tuple.make(statementKey, categoryKey)
    )
  );
  return Result.map(select(project(spec, true), selection), (selected) => ({
    ...selected,
    outcome: Arr.every(
      spec.statements,
      ({ correctCategoryKey, statementKey }) =>
        Option.contains(HashMap.get(assigned, statementKey), correctCategoryKey)
    )
      ? correct
      : incorrect,
  }));
}

function evaluateShortAnswer(
  spec: SpecOf<"short-answer">,
  selection: SelectionOf<"short-answer">
): Evaluating {
  return Result.map(select(project(spec, true), selection), (selected) => ({
    isComplete: selected.isComplete,
    outcome: gradeTyped(spec.key, selection.text, spec.language),
    selection: {
      kind: selection.kind,
      ...typedAnswer(spec.key, selection.text, spec.language),
    },
  }));
}

/** A numeric key decides a typed answer; unmatched text awaits the grader. */
function gradeTyped(
  key: QuestionAnswerKey,
  text: string,
  language: DeliveryLanguage
) {
  if (matchesAnswerKey(key, text, language)) {
    return correct;
  }
  return key.kind === "number" ? incorrect : pending;
}

function evaluateRubric(
  spec: SpecOf<"rubric">,
  selection: SelectionOf<"rubric">
): Evaluating {
  const typed = HashMap.fromIterable(
    Arr.map(selection.finalAnswers, ({ criterionKey, text }) =>
      Tuple.make(criterionKey, text)
    )
  );
  return Result.map(select(project(spec, true), selection), (selected) => ({
    isComplete: selected.isComplete,
    outcome: gradeRubric(spec, typed, !isBlankAnswer(selection.text)),
    selection: {
      finalAnswers: Arr.getSomes(
        Arr.map(spec.criteria, ({ criterionKey, finalAnswer }) =>
          Option.map(
            Option.all([
              Option.fromUndefinedOr(finalAnswer),
              HashMap.get(typed, criterionKey),
            ]),
            ([key, text]) => ({
              criterionKey,
              ...typedAnswer(key, text, spec.language),
            })
          )
        )
      ),
      kind: selection.kind,
      text: selection.text,
    },
  }));
}

/**
 * Sums the upper level of every final-answer criterion whose typed answer
 * matches. A judged criterion reads the written response, so a written
 * response is `pending`; a blank one earns zero there.
 */
function gradeRubric(
  spec: SpecOf<"rubric">,
  typed: HashMap.HashMap<string, string>,
  written: boolean
): Outcome {
  if (
    written &&
    Arr.some(spec.criteria, ({ finalAnswer }) => finalAnswer === undefined)
  ) {
    return pending;
  }
  const earned = Num.sumAll(
    Arr.map(spec.criteria, (criterion) =>
      matchesFinalAnswer(criterion, typed, spec.language)
        ? questionRubricPoints({ criteria: [criterion], kind: spec.kind })
        : 0
    )
  );
  if (earned === 0) {
    return incorrect;
  }
  return earned === questionRubricPoints(spec)
    ? correct
    : { points: earned, status: "partial" };
}

/** Reports whether a final-answer criterion's typed answer matches its key. */
function matchesFinalAnswer(
  { criterionKey, finalAnswer }: Criterion,
  typed: HashMap.HashMap<string, string>,
  language: DeliveryLanguage
) {
  return (
    finalAnswer !== undefined &&
    Option.exists(HashMap.get(typed, criterionKey), (text) =>
      matchesAnswerKey(finalAnswer, text, language)
    )
  );
}

/**
 * Keeps typed text with the exact number a numeric key read from it, such as
 * `0.5` for `0,5` in Indonesian or `3/4` for a fraction; text keys and
 * unreadable text keep only the text.
 */
function typedAnswer(
  key: QuestionAnswerKey,
  text: string,
  language: DeliveryLanguage
) {
  return Option.match(
    key.kind === "number" ? readNumberAnswer(text, language) : Option.none(),
    {
      onNone: () => ({ text }),
      onSome: (answer) => ({ number: spellNumber(answer), text }),
    }
  );
}

/** Spells one reading as a canonical decimal, or `n/d` for a typed fraction. */
function spellNumber(answer: QuestionNumberAnswer) {
  const numerator = spellDecimal(answer.numerator);
  return answer.fraction
    ? `${numerator}/${spellDecimal(answer.denominator)}`
    : numerator;
}

/**
 * Writes one exact decimal as the contract's canonical `QuestionDecimal`. It
 * places the decimal point by scale, because `BigDecimal.format` switches to
 * exponent notation once the normalized scale reaches 16, which no canonical
 * decimal allows.
 */
function spellDecimal(decimal: BigDecimal.BigDecimal) {
  const normalized = BigDecimal.normalize(decimal);
  const sign = BigDecimal.isNegative(normalized) ? "-" : "";
  const digits = `${BigDecimal.abs(normalized).value}`;
  if (normalized.scale <= 0) {
    return `${sign}${Str.padEnd(digits.length - normalized.scale, "0")(digits)}`;
  }
  const padded = Str.padStart(normalized.scale + 1, "0")(digits);
  const whole = Str.takeLeft(padded, padded.length - normalized.scale);
  return `${sign}${whole}.${Str.takeRight(padded, normalized.scale)}`;
}
