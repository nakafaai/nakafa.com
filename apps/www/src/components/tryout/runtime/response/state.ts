import type { Ref } from "@confect/core";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { select } from "@repo/backend/confect/response/selection";
import {
  Array as Arr,
  MutableHashMap,
  MutableHashSet,
  Option,
  Result,
  Struct,
} from "effect";

import type { TryoutResponseFieldsProps } from "@/components/tryout/runtime/response/fields";
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

/**
 * Returns the version of the next write of one question: the first for a
 * question without a versioned write, otherwise the one after the version it
 * shows, which is the server's version of the latest write (a cleared answer
 * keeps it) or the optimistic one of the latest write that is still on its way.
 * Convex keeps both in the same cached query, so the number survives a
 * re-render, and a reload starts from the server's version.
 */
export function nextTryoutResponseVersion(question: TryoutRuntimeQuestion) {
  return (question.version ?? 0) + 1;
}

/**
 * Tells what a failed save means for the page. A stale refusal needs nothing:
 * a newer write took its place, Convex dropped the optimistic answer with the
 * failed mutation, and the screen shows the server's answer again. An attempt
 * or section that ended gets a notice, and anything else is a fault to report.
 */
export function tryoutSubmitFailureOf(
  code: Ref.Error<typeof tryouts.mutations.responses.save>["code"] | undefined
) {
  if (code === "TRYOUT_RESPONSE_STALE") {
    return "stale";
  }
  if (
    code === "TRYOUT_EXPIRED" ||
    code === "TRYOUT_ATTEMPT_NOT_ACTIVE" ||
    code === "TRYOUT_SECTION_NOT_ACTIVE"
  ) {
    return "ended";
  }
  return "error";
}

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
      return { ...question, ...Struct.pick(args, ["version"]), response: null };
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
      ...Struct.pick(args, ["version"]),
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
