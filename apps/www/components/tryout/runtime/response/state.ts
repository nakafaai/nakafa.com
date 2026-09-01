import type { api } from "@repo/backend/convex/_generated/api";
import { validateTryoutResponseSelection } from "@repo/backend/convex/tryouts/response/selection";
import type { FunctionArgs } from "convex/server";
import type {
  TryoutRenderableResponseSpec,
  TryoutRuntimeQuestion,
  TryoutSectionRuntime,
} from "@/components/tryout/runtime/types";

type SaveResponseArgs = FunctionArgs<
  typeof api.tryouts.mutations.responses.save
>;
export type TryoutResponseSelection = NonNullable<
  TryoutRuntimeQuestion["response"]
>["selection"];

interface TryoutResponseState {
  readonly responseSpec: TryoutRenderableResponseSpec;
  readonly selection: TryoutResponseSelection | null;
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
    const validated = validateTryoutResponseSelection(
      question.responseSpec,
      args.selection
    );
    if (!validated.valid) {
      validSelection = false;
      return question;
    }
    const isComplete = validated.isComplete;
    answeredDelta = Number(isComplete) - Number(wasComplete);
    return {
      ...question,
      response: {
        answeredAt: question.response?.answeredAt ?? selectedAt,
        isComplete,
        selection: validated.selection,
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
