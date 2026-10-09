import type { Ref } from "@confect/core";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { select } from "@repo/backend/confect/response/selection";
import {
  Array as Arr,
  MutableHashMap,
  MutableHashSet,
  Option,
  Result,
} from "effect";

import type { TryoutResponseFieldsProps } from "@/components/tryout/runtime/response/fields.client";
import type {
  TryoutRuntimeQuestion,
  TryoutSectionRuntime,
} from "@/components/tryout/runtime/types";

type SaveResponseArgs = Ref.Args<typeof tryouts.mutations.responses.save>;
export type TryoutResponseSelection = NonNullable<
  TryoutRuntimeQuestion["response"]
>["selection"];

/** The response spec and selection that the response helpers read from one field set. */
type TryoutResponseState = Pick<
  TryoutResponseFieldsProps["value"],
  "responseSpec" | "selection"
>;

/** Applies one local response while Convex remains authoritative for time. */
export function applyOptimisticTryoutResponse(
  runtime: TryoutSectionRuntime,
  args: SaveResponseArgs,
  selectedAt: number
) {
  let answeredDelta = 0;
  let foundQuestion = false;
  let validSelection = true;
  const questions = Arr.map(runtime.questions, (question) => {
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
  const optionKeys = Arr.flatMap(state.responseSpec.options, ({ optionKey }) =>
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
      ? Arr.map(state.selection.assignments, (assignment) => [
          assignment.statementKey,
          assignment.categoryKey,
        ])
      : []
  );
  MutableHashMap.set(assignments, statementKey, categoryKey);
  return {
    assignments: Arr.flatMap(state.responseSpec.statements, (statement) => {
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
