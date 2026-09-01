import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import type {
  TryoutRuntimeQuestion,
  TryoutSectionRuntime,
} from "@/components/tryout/runtime/types";

type SaveResponseArgs = FunctionArgs<
  typeof api.tryouts.mutations.responses.save
>;
export type TryoutResponseSelection = Exclude<
  NonNullable<TryoutRuntimeQuestion["response"]>["selection"],
  undefined
>;

interface TryoutResponseState {
  readonly responseSpec: TryoutRuntimeQuestion["responseSpec"];
  readonly selection: TryoutResponseSelection | null;
}

/** Applies one local response while Convex remains authoritative for time. */
export function applyOptimisticTryoutResponse(
  runtime: TryoutSectionRuntime,
  args: SaveResponseArgs,
  selectedAt: number
) {
  const saved = readSaveSelection(args);
  if (!saved.valid) {
    return null;
  }
  const selection = saved.selection;
  let answeredDelta = 0;
  let foundQuestion = false;
  let validSelection = true;
  const questions = runtime.questions.map((question) => {
    if (question.placementId !== args.placementId) {
      return question;
    }
    foundQuestion = true;
    if (selection && selection.kind !== question.responseSpec.kind) {
      validSelection = false;
      return question;
    }
    const wasComplete = question.response?.isComplete ?? false;
    const isComplete = getSelectionCompleteness(question, selection);
    answeredDelta = Number(isComplete) - Number(wasComplete);
    return {
      ...question,
      response: selection
        ? {
            answeredAt: question.response?.answeredAt ?? selectedAt,
            isComplete,
            selection,
            updatedAt: selectedAt,
          }
        : null,
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
  const selected = new Set(
    state.selection?.kind === "multiple-choice"
      ? state.selection.optionKeys
      : []
  );
  if (selected.has(optionKey)) {
    selected.delete(optionKey);
  } else {
    selected.add(optionKey);
  }
  const optionKeys = state.responseSpec.options.flatMap(({ optionKey }) =>
    selected.has(optionKey) ? [optionKey] : []
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
  const assignments = new Map(
    state.selection?.kind === "category"
      ? state.selection.assignments.map((assignment) => [
          assignment.statementKey,
          assignment.categoryKey,
        ])
      : []
  );
  assignments.set(statementKey, categoryKey);
  return {
    assignments: state.responseSpec.statements.flatMap((statement) => {
      const assignedCategory = assignments.get(statement.statementKey);
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

function readSaveSelection(
  args: SaveResponseArgs
):
  | { readonly selection: TryoutResponseSelection | null; readonly valid: true }
  | { readonly valid: false } {
  if (args.selection !== undefined && args.selectedOptionId === undefined) {
    return { selection: args.selection, valid: true };
  }
  if (args.selection === undefined && args.selectedOptionId !== undefined) {
    return {
      selection: {
        kind: "single-choice",
        optionKey: args.selectedOptionId,
      },
      valid: true,
    };
  }
  return { valid: false };
}

function getSelectionCompleteness(
  question: TryoutRuntimeQuestion,
  selection: TryoutResponseSelection | null
) {
  if (!selection) {
    return false;
  }
  if (selection.kind !== "category") {
    return true;
  }
  return (
    question.responseSpec.kind === "category" &&
    selection.assignments.length === question.responseSpec.statements.length
  );
}
