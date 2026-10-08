import type { Ref } from "@confect/core";
import { QuestionResponseSchema } from "@nakafa/aksara-contracts/question/response";
import type refs from "@repo/backend/confect/_generated/refs";
import {
  RenderableSpec,
  Selection,
} from "@repo/backend/confect/response/model";
import { select } from "@repo/backend/confect/response/selection";
import { MutableHashMap, MutableHashSet, Option, Result, Schema } from "effect";

import type {
  TryoutRuntimeQuestion,
  TryoutSectionRuntime,
} from "@/components/tryout/runtime/types";

type SaveResponseArgs = Ref.Args<
  typeof refs.public.tryouts.mutations.responses.save
>;
export type TryoutResponseSelection = NonNullable<
  TryoutRuntimeQuestion["response"]
>["selection"];

/** Response definition a learner sees, from a signed preview or an attempt. */
export const TryoutRenderableResponseSpecSchema = Schema.Union([
  QuestionResponseSchema,
  RenderableSpec,
]);

/** Response definition and the selection a learner made against it. */
export const TryoutResponseStateSchema = Schema.Struct({
  responseSpec: TryoutRenderableResponseSpecSchema,
  selection: Schema.NullOr(Selection),
});
type TryoutResponseState = typeof TryoutResponseStateSchema.Type;

/** Applies one local response while Convex remains authoritative for time. */
export function applyOptimisticTryoutResponse(
  runtime: TryoutSectionRuntime,
  args: SaveResponseArgs,
  selectedAt: number
) {
  let answeredDelta = 0;
  let foundQuestion = false;
  let validSelection = true;
  const questions = runtime.questions.map((question) => {
    if (question.placementId !== args.placementId) {
      return question;
    }
    foundQuestion = true;
    const wasComplete = question.response?.isComplete ?? false;
    if (args.selection === null) {
      answeredDelta = -Number(wasComplete);
      return { ...question, response: null };
    }
    const selected = select(question.responseSpec, args.selection);
    if (Result.isFailure(selected)) {
      validSelection = false;
      return question;
    }
    const { isComplete, selection } = selected.success;
    answeredDelta = Number(isComplete) - Number(wasComplete);
    return {
      ...question,
      response: {
        answeredAt: question.response?.answeredAt ?? selectedAt,
        isComplete,
        selection,
        updatedAt: selectedAt,
      },
    };
  });

  if (!(foundQuestion && validSelection)) {
    return null;
  }
  return {
    ...runtime,
    questions,
    section: {
      ...runtime.section,
      answeredCount: Math.min(
        runtime.section.totalQuestions,
        Math.max(0, runtime.section.answeredCount + answeredDelta)
      ),
    },
  };
}

/** Returns the next exact-set multiple-choice selection in authored order. */
export function toggleMultipleChoiceSelection(
  state: TryoutResponseState,
  optionKey: string
): TryoutResponseSelection | null {
  if (state.responseSpec.kind !== "multiple-choice") {
    return null;
  }
  const selected = MutableHashSet.fromIterable(
    state.selection?.kind === "multiple-choice"
      ? state.selection.optionKeys
      : []
  );
  if (MutableHashSet.has(selected, optionKey)) {
    MutableHashSet.remove(selected, optionKey);
  } else {
    MutableHashSet.add(selected, optionKey);
  }
  const optionKeys = state.responseSpec.options.flatMap(({ optionKey }) =>
    MutableHashSet.has(selected, optionKey) ? [optionKey] : []
  );
  return optionKeys.length > 0 ? { kind: "multiple-choice", optionKeys } : null;
}

/** Returns the next category assignment set in authored statement order. */
export function assignCategorySelection(
  state: TryoutResponseState,
  statementKey: string,
  categoryKey: string
): TryoutResponseSelection | null {
  if (state.responseSpec.kind !== "category") {
    return null;
  }
  const assignments = MutableHashMap.fromIterable(
    state.selection?.kind === "category"
      ? state.selection.assignments.map((assignment) => [
          assignment.statementKey,
          assignment.categoryKey,
        ])
      : []
  );
  MutableHashMap.set(assignments, statementKey, categoryKey);
  return {
    assignments: state.responseSpec.statements.flatMap((statement) => {
      const assignedCategory = Option.getOrUndefined(
        MutableHashMap.get(assignments, statement.statementKey)
      );
      return assignedCategory
        ? [
            {
              categoryKey: assignedCategory,
              statementKey: statement.statementKey,
            },
          ]
        : [];
    }),
    kind: "category",
  };
}
