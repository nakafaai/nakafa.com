import type { DeliveryLanguage } from "@nakafa/aksara-contracts/locale";
import {
  canonicalQuestionResponse,
  type QuestionResponse,
} from "@nakafa/aksara-contracts/question/response";
import {
  type RenderableSpec,
  ResponseSpec,
  Selection,
} from "@repo/backend/confect/response/model";
import { Array as Arr, Struct } from "effect";

type Options = (typeof ResponseSpec.cases)["single-choice"]["Type"]["options"];

/**
 * Freezes one signed response for a placement as a `ResponseSpec` in
 * canonical field order. Short answers and rubrics keep the delivery language
 * their typed answers are read in; choice and category responses keep their
 * stored shape. The result stays a plain document value for Convex writes.
 */
export function freeze(response: QuestionResponse, language: DeliveryLanguage) {
  const canonical = canonicalQuestionResponse(response);
  if (canonical.kind === "short-answer" || canonical.kind === "rubric") {
    return { ...canonical, language } satisfies ResponseSpec;
  }
  return canonical satisfies ResponseSpec;
}

/** Removes every answer-key fact unless the learner may review answers. */
export function project(spec: ResponseSpec, reveal: boolean): RenderableSpec {
  return ResponseSpec.match(spec, {
    category: (spec) => ({
      categories: spec.categories,
      kind: spec.kind,
      statements: Arr.map(spec.statements, (statement) => ({
        ...(reveal ? { correctCategoryKey: statement.correctCategoryKey } : {}),
        label: statement.label,
        order: statement.order,
        statementKey: statement.statementKey,
      })),
    }),
    "multiple-choice": (spec) => ({
      kind: spec.kind,
      options: projectOptions(spec.options, reveal),
    }),
    rubric: (spec) => ({
      criteria: Arr.map(spec.criteria, (criterion) => ({
        criterionKey: criterion.criterionKey,
        final: criterion.finalAnswer !== undefined,
        ...(reveal
          ? {
              ...(criterion.finalAnswer === undefined
                ? {}
                : { finalAnswer: criterion.finalAnswer }),
              label: criterion.label,
              levels: criterion.levels,
            }
          : {}),
        order: criterion.order,
      })),
      kind: spec.kind,
      language: spec.language,
    }),
    "short-answer": (spec) => ({
      ...(reveal ? { key: spec.key } : {}),
      kind: spec.kind,
      language: spec.language,
    }),
    "single-choice": (spec) => ({
      kind: spec.kind,
      options: projectOptions(spec.options, reveal),
    }),
  });
}

/**
 * Removes the number each typed answer was read as unless the learner may
 * review answers. Only a numeric key reads a number, so a stored reading would
 * show the key's kind while the attempt runs.
 */
export function projectSelection(
  selection: Selection,
  reveal: boolean
): Selection {
  if (reveal) {
    return selection;
  }
  return Selection.match(selection, {
    category: (selection) => selection,
    "multiple-choice": (selection) => selection,
    rubric: (selection) => ({
      ...selection,
      finalAnswers: Arr.map(selection.finalAnswers, (answer) =>
        Struct.omit(answer, ["number"])
      ),
    }),
    "short-answer": (selection) => Struct.omit(selection, ["number"]),
    "single-choice": (selection) => selection,
  });
}

/** Keeps each option's label and order, and its correctness only in review. */
function projectOptions(options: Options, reveal: boolean) {
  return Arr.map(options, (option) => ({
    ...(reveal ? { isCorrect: option.isCorrect } : {}),
    label: option.label,
    optionKey: option.optionKey,
    order: option.order,
  }));
}
